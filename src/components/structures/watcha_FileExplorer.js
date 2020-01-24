import filesize from "filesize";
import matchSorter from "match-sorter";
import React, { useMemo, useRef, useEffect } from "react";
import { useTable, useSortBy, useFilters, useRowSelect } from "react-table";

import dis from "../../dispatcher";
import MatrixClientPeg from "../../MatrixClientPeg";
import Modal from "../../Modal";
import {
    formatMimeType,
    getIconFromMimeType
} from "../../watcha_mimeTypeUtils";
import OutlineIconButton from "../views/elements/watcha_OutlineIconButton";
import sdk from "../../index";
import { formatFullDate, formatFileExplorerDate } from "../../DateUtils";
import { _t } from "../../languageHandler";

function FileExplorer({ events, showTwelveHour }) {
    const columns = useMemo(
        () => [
            {
                Header: "Name",
                accessor: "filename",
                filter: "fuzzyText",
                Cell: ({ cell: { value } }) => (
                    <span title={value}>{value}</span>
                )
            },
            {
                Header: "Size",
                accessor: "size",
                // FIXME: Some files like movies recorded in the ios app (named video_xxxxxxx.mp4) don't seem to have a size...
                Cell: ({ cell: { value } }) => (value ? filesize(value) : "")
            },
            {
                Header: "Date",
                accessor: "timestamp",
                Cell: ({ cell: { value } }) => (
                    <LightDate timestamp={value} {...{ showTwelveHour }} />
                )
            },
            {
                Header: "Type",
                accessor: "type",
                sortType: sortType
            },
            {
                Header: "Sender",
                accessor: "sender",
                disableSortBy: true
            }
        ],
        []
    );

    const data = useMemo(() => getData(events), [events]);

    const defaultColumn = useMemo(
        () => ({
            // Let's set up our default Filter UI
            Filter: DefaultColumnFilter
        }),
        []
    );

    const filterTypes = useMemo(
        () => ({
            // Add a new fuzzyTextFilterFn filter type.
            fuzzyText: fuzzyTextFilterFn
        }),
        []
    );

    // Use the state and functions returned from useTable to build your UI
    const tableInstance = useTable(
        {
            columns,
            data,
            defaultColumn, // Be sure to pass the defaultColumn option
            filterTypes
        },
        useFilters,
        useSortBy,
        useRowSelect,
        hooks => {
            hooks.flatColumns.push(columns => [
                // Let's make a column for selection
                {
                    id: "selection",
                    // The header can use the table's getToggleAllRowsSelectedProps method
                    // to render a checkbox
                    Header: ({ getToggleAllRowsSelectedProps }) => (
                        <IndeterminateCheckbox
                            {...getToggleAllRowsSelectedProps()}
                        />
                    ),
                    // The cell can use the individual row's getToggleRowSelectedProps method
                    // to the render a checkbox
                    Cell: ({ row }) => (
                        <IndeterminateCheckbox
                            {...row.getToggleRowSelectedProps()}
                        />
                    )
                },
                ...columns
            ]);
        }
    );

    const { headerGroups } = tableInstance;

    return (
        <div className="watcha_FileExplorer">
            <Body {...{ tableInstance }} />
            <Footer {...{ headerGroups }} />
        </div>
    );
}

function Body({ tableInstance }) {
    const GeminiScrollbarWrapper = sdk.getComponent(
        "elements.GeminiScrollbarWrapper"
    );
    const { selectedFlatRows } = tableInstance;
    const table = (
        <GeminiScrollbarWrapper autoshow={true} minThumbSize={50}>
            <Table {...{ tableInstance }} />
        </GeminiScrollbarWrapper>
    );
    const detailPanel = (
        <GeminiScrollbarWrapper
            className="watcha_FileExplorer_DetailPanel_Scrollbar"
            autoshow={true}
            minThumbSize={50}
        >
            <DetailPanel {...{ selectedFlatRows }} />
        </GeminiScrollbarWrapper>
    );
    return (
        <div className="watcha_FileExplorer_Body">
            {table}
            {selectedFlatRows.length > 0 && detailPanel}
        </div>
    );
}

function Footer({ headerGroups }) {
    // Render the filter UI
    return headerGroups[0].headers[1].render("Filter");
}

function Table({ tableInstance }) {
    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow
    } = tableInstance;
    // Render the UI for the table
    return (
        <table {...getTableProps()}>
            <thead>
                {headerGroups.map(headerGroup => (
                    <tr {...headerGroup.getHeaderGroupProps()}>
                        {headerGroup.headers.map(column => (
                            <th
                                {...column.getHeaderProps(
                                    column.getSortByToggleProps()
                                )}
                            >
                                {column.render("Header")}
                                {column.canSort && (
                                    <span className="isSorted">
                                        {column.isSorted
                                            ? column.isSortedDesc
                                                ? "⮟"
                                                : "⮝"
                                            : ""}
                                    </span>
                                )}
                            </th>
                        ))}
                    </tr>
                ))}
            </thead>
            <tbody {...getTableBodyProps()}>
                {rows.map((row, i) => {
                    prepareRow(row);
                    const selectRow = () => {
                        if (
                            tableInstance.selectedFlatRows.length === 1 &&
                            row.isSelected
                        ) {
                            row.toggleRowSelected();
                            return;
                        }
                        const currentRow = row;
                        rows.forEach(row => {
                            if (row === currentRow) {
                                row.toggleRowSelected(true);
                            } else {
                                row.toggleRowSelected(false);
                            }
                        });
                    };
                    return (
                        <tr
                            className={
                                row.isSelected
                                    ? "watcha_FileExplorer_SelectedRow"
                                    : undefined
                            }
                            {...row.getRowProps()}
                        >
                            {row.cells.map(cell => {
                                return (
                                    <td
                                        onClick={
                                            cell.column.id !== "selection"
                                                ? selectRow
                                                : undefined
                                        }
                                        {...cell.getCellProps()}
                                    >
                                        {cell.render("Cell")}
                                    </td>
                                );
                            })}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

function DetailPanel(props) {
    const selectedEvents = props.selectedFlatRows.map(
        row => row.original.mxEvent
    );
    return (
        <div className="watcha_FileExplorer_DetailPanel">
            <Thumbnail {...{ selectedEvents }} />
            <Information {...props} />
            <Action {...{ selectedEvents }} />
        </div>
    );
}

function Thumbnail({ selectedEvents }) {
    const MessageEvent = sdk.getComponent("messages.watcha_MessageEvent");
    let thumbnail;
    if (selectedEvents.length === 1) {
        const mxEvent = selectedEvents[0];
        const content = mxEvent.getContent();
        const mimeType = content.info.mimetype;
        const msgtype = content.msgtype;
        const isMultimedia = ["m.image", "m.video", "m.audio"].includes(
            msgtype
        );
        if (isMultimedia) {
            thumbnail = (
                <MessageEvent mxEvent={mxEvent} onHeightChanged={() => {}} />
            );
        } else {
            thumbnail = <img src={getIconFromMimeType(mimeType)} />;
        }
    } else {
        thumbnail = (
            <img src={require("../../../res/img/watcha_multiple-files.svg")} />
        );
    }
    return <div className="watcha_FileExplorer_Thumbnail">{thumbnail}</div>;
}

function Information({ selectedFlatRows }) {
    const n = selectedFlatRows.length;
    let info;
    if (n === 1) {
        info = selectedFlatRows[0].original.filename;
    } else {
        const title = n + " " + _t("selected files");
        info = (
            <span {...{ title }}>
                {n} {_t("files")}
            </span>
        );
    }
    return <div className="watcha_FileExplorer_Information">{info}</div>;
}

function Action({ selectedEvents }) {
    if (selectedEvents.length > 1) {
        return null;
    }
    const mxEvent = selectedEvents[0];
    return (
        <div className="watcha_FileExplorer_Action">
            <DownloadButton {...{ mxEvent, selectedEvents }} />
            <ShowMessageButton {...{ mxEvent }} />
            <ForwardButton {...{ mxEvent, selectedEvents }} />
            <RemoveButton {...{ mxEvent, selectedEvents }} />
        </div>
    );
}

const IndeterminateCheckbox = React.forwardRef(
    ({ indeterminate, ...rest }, ref) => {
        const defaultRef = useRef();
        const resolvedRef = ref || defaultRef;

        useEffect(() => {
            resolvedRef.current.indeterminate = indeterminate;
        }, [resolvedRef, indeterminate]);

        rest.title = undefined;
        return <input type="checkbox" ref={resolvedRef} {...rest} />;
    }
);

function LightDate({ timestamp, showTwelveHour }) {
    const date = new Date(timestamp);
    const title = formatFullDate(date, showTwelveHour);
    const formattedDate = formatFileExplorerDate(date, showTwelveHour);
    return <span title={title}>{formattedDate}</span>;
}

function DownloadButton({ mxEvent, selectedEvents }) {
    const content = mxEvent.getContent();
    const contentUrl = MatrixClientPeg.get().mxcUrlToHttp(content.url);
    return (
        <a
            className="watcha_FileExplorer_DownloadButton"
            href={contentUrl}
            download
        >
            <OutlineIconButton
                className="watcha_Download_OutlineIconButton"
                title={_t("Download this file")}
            >
                {_t("Download")}
            </OutlineIconButton>
        </a>
    );
}

function ShowMessageButton({ mxEvent }) {
    const onClick = () => {
        dis.dispatch({
            action: "view_room",
            event_id: mxEvent.getId(),
            room_id: mxEvent.getRoomId(),
            highlighted: true
        });
    };
    return (
        <OutlineIconButton
            className="watcha_Message_OutlineIconButton"
            onClick={onClick}
            title={_t("Show the corresponding message in the room timeline")}
        >
            {_t("Message")}
        </OutlineIconButton>
    );
}

function ForwardButton({ mxEvent, selectedEvents }) {
    const onClick = () => {
        dis.dispatch({
            action: "forward_event",
            event: mxEvent
        });
    };
    return (
        <OutlineIconButton
            className="watcha_Forward_OutlineIconButton"
            onClick={onClick}
            title={_t("Forward this file to another room")}
        >
            {_t("Forward")}
        </OutlineIconButton>
    );
}

function RemoveButton({ mxEvent, selectedEvents }) {
    const eventStatus = mxEvent.status;
    const isSent = !eventStatus || eventStatus === EventStatus.SENT;
    const client = MatrixClientPeg.get();
    const room = client.getRoom(mxEvent.getRoomId());
    const canRedact = room.currentState.maySendRedactionForEvent(
        mxEvent,
        client.credentials.userId
    );
    if (!isSent || !canRedact) {
        return null;
    }

    const onClick = () => {
        const ConfirmRedactDialog = sdk.getComponent(
            "dialogs.ConfirmRedactDialog"
        );
        Modal.createDialog(
            ConfirmRedactDialog,
            {
                onFinished: async proceed => {
                    if (!proceed) return;

                    try {
                        await client.redactEvent(
                            mxEvent.getRoomId(),
                            mxEvent.getId()
                        );
                    } catch (error) {
                        const code = error.errcode || error.statusCode;
                        // only show the dialog if failing for something other than a network error
                        // (e.g. no errcode or statusCode) as in that case the redactions end up in the
                        // detached queue and we show the room status bar to allow retry
                        if (typeof code !== "undefined") {
                            const ErrorDialog = sdk.getComponent(
                                "dialogs.ErrorDialog"
                            );
                            Modal.createDialog(ErrorDialog, {
                                title: _t("Error"),
                                description: _t(
                                    "You cannot delete this message. (%(code)s)",
                                    { code }
                                )
                            });
                        }
                    }
                }
            },
            "mx_Dialog_confirmredact"
        );
    };

    return (
        <OutlineIconButton
            className="watcha_Remove_OutlineIconButton"
            onClick={onClick}
            title={_t("Remove this file from the room")}
        >
            {_t("Remove")}
        </OutlineIconButton>
    );
}

// Define a default UI for filtering
function DefaultColumnFilter({
    column: { filterValue, preFilteredRows, setFilter }
}) {
    const SearchBox = sdk.getComponent("structures.SearchBox");
    const count = preFilteredRows.length;

    return (
        <SearchBox
            className="mx_textinput_icon mx_textinput_search"
            placeholder={_t("Filter room files")}
            onSearch={value => {
                setFilter(value || undefined); // Set undefined to remove the filter entirely
            }}
        />
    );
}

function fuzzyTextFilterFn(rows, id, filterValue) {
    return matchSorter(rows, filterValue, { keys: [row => row.values[id]] });
}

// Let the table remove the filter if the string is empty
fuzzyTextFilterFn.autoRemove = val => !val;

function sortType(rowA, rowB) {
    const key = "type";
    const a = rowA.original[key].toLowerCase();
    const b = rowB.original[key].toLowerCase();
    return a === b ? 0 : a > b ? 1 : -1;
}

function getData(events) {
    const data = [];
    for (let i = 0; i < events.length; i++) {
        const mxEvent = events[i];
        if (!shouldHideEvent(mxEvent)) {
            const row = getEventData(mxEvent);
            data.push(row);
        }
    }
    return data;
}

function getEventData(mxEvent) {
    const SenderProfile = sdk.getComponent("messages.SenderProfile");

    const content = mxEvent.getContent();

    const filename = content.body;
    const size = content.info.size;
    const timestamp = mxEvent.getTs();
    const mimeType = content.info.mimetype;
    const type = mimeType ? formatMimeType({ mimeType, filename }) : mimeType;
    const sender = <SenderProfile mxEvent={mxEvent} enableFlair={true} />;
    const key = mxEvent.getId();

    return {
        filename,
        size,
        timestamp,
        type,
        sender,
        key,
        mxEvent
    };
}

function shouldHideEvent(mxEvent) {
    if (
        mxEvent.isRedacted() ||
        // ignored = no show (only happens if the ignore happens after an event was received)
        (mxEvent.sender &&
            MatrixClientPeg.get().isUserIgnored(mxEvent.sender.userId))
    ) {
        return true;
    }
}

export default FileExplorer;
