import React, { useContext, useEffect, useState } from "react";
import { isEmpty } from "lodash";

import { _t } from "../../../../../languageHandler";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import AccessibleButton from "../../../elements/AccessibleButton";
import MatrixClientContext from "../../../../../contexts/MatrixClientContext";
import Modal from "../../../../../Modal";
import QuestionDialog from "../../../dialogs/QuestionDialog";
import Spinner from "../../../elements/Spinner";
import StyledRadioGroup from "../../../elements/StyledRadioGroup";

import { CALENDAR_EVENT_TYPE, StateKeys } from "../../../../../utils/watcha_nextcloudUtils";

interface IProps {
    roomId: string;
}

interface IOwnCalendars {
    VEVENT_VTODO: IOwnCalendar[];
    VEVENT: IOwnCalendar[];
    VTODO: IOwnCalendar[];
}

interface IOwnCalendar {
    id: number;
    displayname: string;
}

interface ICalendar extends IOwnCalendar {
    is_personal: boolean;
}

interface ICalendarEvents {
    VEVENT_VTODO: MatrixEvent | null;
    VEVENT: MatrixEvent | null;
    VTODO: MatrixEvent | null;
}

interface ICalendarEventContent {
    id: number;
    is_personal: boolean;
}

export default ({ roomId }: IProps) => {
    const client = useContext(MatrixClientContext);
    const room = client.getRoom(roomId);

    const getCalendarEvents = (): ICalendarEvents => ({
        VEVENT_VTODO: room.currentState.getStateEvents(CALENDAR_EVENT_TYPE, StateKeys.VEVENT_VTODO),
        VEVENT: room.currentState.getStateEvents(CALENDAR_EVENT_TYPE, StateKeys.VEVENT),
        VTODO: room.currentState.getStateEvents(CALENDAR_EVENT_TYPE, StateKeys.VTODO),
    });

    const [calendarEvents, setCalendarEvents] = useState(getCalendarEvents());

    const isOwnedByAnUser = (calendarEvent: MatrixEvent) => Boolean(calendarEvent.getContent()?.is_personal);

    const isOwnedByMe = (calendarEvent: MatrixEvent) =>
        isOwnedByAnUser(calendarEvent) && calendarEvent.getSender() === client.getUserId();

    const isShared = (stateKey: StateKeys) => Boolean(calendarEvents[stateKey]?.getContent()?.id);

    const isSharedByMe = (stateKey: StateKeys) => calendarEvents[stateKey] && isOwnedByMe(calendarEvents[stateKey]);

    const serviceShareAny = calendarEvents[StateKeys.VEVENT_VTODO]?.getContent()?.is_personal === false;

    const iShareAny = Object.values(calendarEvents).some(event => event && isOwnedByMe(event));

    const anyIsShared = Object.values(calendarEvents).some(event => event?.getContent()?.id);

    const getSharedCalendarId = (stateKey: StateKeys): number | null =>
        calendarEvents[stateKey]?.getContent()?.id || null;

    const canBeShared = (stateKey: StateKeys): boolean => {
        if (stateKey === StateKeys.VEVENT_VTODO && anyIsShared && !isSharedByMe(StateKeys.VEVENT_VTODO)) {
            return false;
        }
        if (
            stateKey === StateKeys.VEVENT &&
            (isShared(StateKeys.VEVENT) || isShared(StateKeys.VEVENT_VTODO)) &&
            !isSharedByMe(StateKeys.VEVENT)
        ) {
            return false;
        }
        if (
            stateKey === StateKeys.VTODO &&
            (isShared(StateKeys.VTODO) || isShared(StateKeys.VEVENT_VTODO)) &&
            !isSharedByMe(StateKeys.VTODO)
        ) {
            return false;
        }
        return true;
    };

    const [ownCalendars, setOwnCalendars] = useState<IOwnCalendars>();
    const [showAdvanced, setShowAdvanced] = useState(iShareAny);

    const onRoomStateEvents = (event: MatrixEvent) => {
        if (event.getType() === CALENDAR_EVENT_TYPE) {
            setCalendarEvents(getCalendarEvents());
        }
    };

    useEffect(() => {
        client.getOwnCalendars().then((calendars: IOwnCalendars) => {
            setOwnCalendars(calendars);
        });
        client.on("RoomState.events", onRoomStateEvents);
        return () => {
            client.removeListener("RoomState.events", onRoomStateEvents);
        };
    }, []);

    const onNew = (): void => {
        client.setRoomCalendar(roomId);
    };

    let addButton: React.ReactNode;
    if (!anyIsShared) {
        addButton = (
            <div className="mx_SettingsTab_section">
                <AccessibleButton
                    kind="primary"
                    onClick={onNew}
                    title={_t(
                        "Create and share a calendar including a to-do list: it will be dedicated to the room without you or any other member owning it"
                    )}
                >
                    {_t("Add a calendar with to-do list")}
                </AccessibleButton>
            </div>
        );
    }

    const onRemove = async (): Promise<void> => {
        Modal.createTrackedDialog("Confirm deletion of dedicated calendar", "", QuestionDialog, {
            danger: true,
            title: _t("Are you sure you want to delete the calendar and to-do list of this room?"),
            description: _t("Please note that all events and tasks there will be permanently lost."),
            button: _t("Delete"),
            onFinished: proceed => {
                if (proceed) {
                    client.unsetRoomCalendar(roomId, StateKeys.VEVENT_VTODO);
                }
            },
        });
    };

    let deleteButton: React.ReactNode;
    if (serviceShareAny) {
        deleteButton = (
            <div className="mx_SettingsTab_section">
                <AccessibleButton kind="danger" onClick={onRemove}>
                    {_t("Delete")}
                </AccessibleButton>
            </div>
        );
    }

    let sharedCalendarsList = [];

    for (const stateKey of Object.values(StateKeys)) {
        const calendarEvent = calendarEvents[stateKey];
        const calendar: ICalendarEventContent = calendarEvent?.getContent();
        if (!calendar || isEmpty(calendar) || !isOwnedByAnUser(calendarEvent) || isOwnedByMe(calendarEvent)) {
            continue;
        }
        const ownerId = isOwnedByAnUser(calendarEvent) ? calendarEvent.getSender() : null;
        sharedCalendarsList.push(
            <SharedCalendar key={stateKey} {...{ roomId, stateKey, ownerId }} calendarId={calendar.id} />
        );
    }

    let sharedCalendars: React.ReactNode;
    if (sharedCalendarsList.length) {
        sharedCalendars = (
            <div className="mx_SettingsTab_section watcha_CalendarSettingsTab_sharedCalendarsList">
                <span className="mx_SettingsTab_subheading">
                    {_t("%(count)s Other member currently sharing a resource", { count: sharedCalendarsList.length })}
                </span>
                {sharedCalendarsList}
            </div>
        );
    }

    const ownCalendarsLists = [];

    if (ownCalendars) {
        if (ownCalendars.VEVENT_VTODO.length) {
            ownCalendarsLists.push(
                <OwnCalendarList
                    {...{ roomId }}
                    subheading={_t("%(count)s My calendar including a to-do list", {
                        count: ownCalendars.VEVENT_VTODO.length,
                    })}
                    stateKey={StateKeys.VEVENT_VTODO}
                    calendars={ownCalendars.VEVENT_VTODO}
                    sharedCalendarId={getSharedCalendarId(StateKeys.VEVENT_VTODO)}
                    disabled={!canBeShared(StateKeys.VEVENT_VTODO)}
                    key={StateKeys.VEVENT_VTODO}
                />
            );
        }
        if (ownCalendars.VEVENT.length) {
            ownCalendarsLists.push(
                <OwnCalendarList
                    {...{ roomId }}
                    subheading={_t("%(count)s My calendar", { count: ownCalendars.VEVENT.length })}
                    stateKey={StateKeys.VEVENT}
                    calendars={ownCalendars.VEVENT}
                    sharedCalendarId={getSharedCalendarId(StateKeys.VEVENT)}
                    disabled={!canBeShared(StateKeys.VEVENT)}
                    key={StateKeys.VEVENT}
                />
            );
        }
        if (ownCalendars.VTODO.length) {
            ownCalendarsLists.push(
                <OwnCalendarList
                    {...{ roomId }}
                    subheading={_t("%(count)s My to-do list", { count: ownCalendars.VTODO.length })}
                    stateKey={StateKeys.VTODO}
                    calendars={ownCalendars.VTODO}
                    sharedCalendarId={getSharedCalendarId(StateKeys.VTODO)}
                    disabled={!canBeShared(StateKeys.VTODO)}
                    key={StateKeys.VTODO}
                />
            );
        }
    }

    let toggle: React.ReactNode;
    if (ownCalendarsLists.length) {
        toggle = (
            <div className="mx_AppearanceUserSettingsTab_AdvancedToggle" onClick={() => setShowAdvanced(!showAdvanced)}>
                {showAdvanced ? _t("Hide advanced") : _t("Show advanced")}
            </div>
        );
    }

    let advanced: React.ReactNode;
    if (ownCalendarsLists.length && showAdvanced) {
        advanced = (
            <>
                <div className="mx_SettingsTab_subsectionText">
                    {_t("It is also possible to select resources to share from one's own calendars and to-do lists.")}
                </div>
                {ownCalendarsLists}
            </>
        );
    }

    return (
        <div className="mx_SettingsTab">
            <div className="mx_SettingsTab_heading">{_t("Calendars and to-do lists sharing")}</div>
            <div className="mx_SettingsTab_subsectionText">
                {_t(
                    "Share a Nextcloud calendar and to-do list with room members and use it as a common planning basis."
                )}
            </div>
            {addButton}
            {deleteButton}
            {sharedCalendars}
            <div className="mx_AppearanceUserSettingsTab_Advanced">
                {toggle}
                {advanced}
            </div>
        </div>
    );
};

interface ISharedCalendarProps {
    roomId: string;
    stateKey: StateKeys;
    calendarId: number;
    ownerId: string;
}

const SharedCalendar: React.FC<ISharedCalendarProps> = ({ roomId, stateKey, calendarId, ownerId }) => {
    const client = useContext(MatrixClientContext);

    const [displayName, setDisplayName] = useState("");
    const [ownerDisplayName, setOwnerDisplayName] = useState(ownerId);

    useEffect(() => {
        client.getCalendar(calendarId).then((calendar: ICalendar) => {
            const displayname = ` (${calendar.displayname})`;
            setDisplayName(displayname);
        });
        client.getProfileInfo(ownerId).then(({ displayname }) => {
            if (displayname) {
                setOwnerDisplayName(displayname);
            }
        });
    }, [calendarId, ownerId]);

    const onUnshare = (): void => {
        Modal.createTrackedDialog("Confirm stopping calendar sharing", "", QuestionDialog, {
            title: _t("Are you sure you want to end this sharing?"),
            description: _t("Please note that only the owner of this resource will be able to share it again."),
            button: _t("Stop sharing"),
            onFinished: proceed => {
                if (proceed) {
                    client.unsetRoomCalendar(roomId, stateKey);
                }
            },
        });
    };

    let icons: React.ReactNode;
    switch (stateKey) {
        case StateKeys.VEVENT_VTODO:
            icons = (
                <div
                    className="watcha_CalendarSettingsTab_SharedCalendar_maskedIcon_container"
                    title={_t("Calendar including a to-do list") + displayName}
                >
                    <span className="watcha_CalendarSettingsTab_SharedCalendar_maskedIcon watcha_CalendarSettingsTab_SharedCalendar_calendarIcon" />
                    <span className="watcha_CalendarSettingsTab_SharedCalendar_maskedIcon watcha_CalendarSettingsTab_SharedCalendar_tasksIcon" />
                </div>
            );
            break;
        case StateKeys.VEVENT:
            icons = (
                <span
                    className="watcha_CalendarSettingsTab_SharedCalendar_maskedIcon watcha_CalendarSettingsTab_SharedCalendar_calendarIcon"
                    title={_t("Calendar") + displayName}
                />
            );
            break;
        case StateKeys.VTODO:
            icons = (
                <span
                    className="watcha_CalendarSettingsTab_SharedCalendar_maskedIcon watcha_CalendarSettingsTab_SharedCalendar_tasksIcon"
                    title={_t("To-do list") + displayName}
                />
            );
            break;
    }

    return (
        <div className="watcha_CalendarSettingsTab_SharedCalendar">
            {icons}
            <span className="watcha_CalendarSettingsTab_SharedCalendar_ownerDisplayName" title={ownerDisplayName}>
                {ownerDisplayName}
            </span>
            <AccessibleButton
                className="watcha_CalendarSettingsTab_SharedCalendar_unshareButton"
                kind="danger_outline"
                onClick={onUnshare}
            >
                {_t("Stop sharing")}
            </AccessibleButton>
        </div>
    );
};

interface IOwnCalendarListProps {
    roomId: string;
    subheading: string;
    stateKey: StateKeys;
    calendars: IOwnCalendar[];
    sharedCalendarId: number | undefined;
    disabled: boolean;
}

const OwnCalendarList: React.FC<IOwnCalendarListProps> = ({
    roomId,
    subheading,
    stateKey,
    calendars,
    sharedCalendarId,
    disabled,
}) => {
    const client = useContext(MatrixClientContext);

    const onCalendarChange = async (value: string): Promise<void> => {
        const targetSharedCalendarId = parseInt(value);
        if (sharedCalendarId) {
            await client.unsetRoomCalendar(roomId, stateKey);
        }
        client.setRoomCalendar(roomId, targetSharedCalendarId);
    };

    const onUnshare = (): void => {
        client.unsetRoomCalendar(roomId, stateKey);
    };

    const iAmCurrentlySharing: boolean = calendars.some(calendar => calendar.id === sharedCalendarId);

    let unshareButton: React.ReactNode;
    if (iAmCurrentlySharing) {
        unshareButton = (
            <AccessibleButton kind="danger_outline" onClick={onUnshare}>
                {_t("Stop sharing")}
            </AccessibleButton>
        );
    }

    const getLabel = (calendar: IOwnCalendar): React.ReactChild => {
        const displayName = (
            <span className="watcha_CalendarSettingsTab_OwnCalendarList_displayName" title={calendar.displayname}>
                {calendar.displayname}
            </span>
        );
        return calendar.id === sharedCalendarId ? (
            <>
                {displayName}
                {unshareButton}
            </>
        ) : (
            displayName
        );
    };

    let title: string;
    if (disabled) {
        title = _t("It is not possible to share two resources of the same type within the same room");
    }

    return (
        <div className="mx_SettingsTab_section" {...{ title }}>
            <span className="mx_SettingsTab_subheading">{subheading}</span>
            <StyledRadioGroup
                name={stateKey}
                className="watcha_CalendarSettingsTab_OwnCalendarList_StyledRadioButton"
                definitions={calendars.map((calendar: IOwnCalendar) => ({
                    value: calendar.id.toString(),
                    label: getLabel(calendar),
                    disabled,
                }))}
                value={iAmCurrentlySharing ? sharedCalendarId.toString() : undefined}
                onChange={onCalendarChange}
            />
        </div>
    );
};
