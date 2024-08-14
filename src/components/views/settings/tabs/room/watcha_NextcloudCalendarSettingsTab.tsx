/*
Copyright 2022 Watcha

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { useCallback, useContext, useEffect, useState } from "react";
import { isEmpty } from "lodash";
import { IOwnCalendars, IOwnCalendar, ICalendar } from "matrix-js-sdk/src/client";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";

import { _t } from "../../../../../languageHandler";
import AccessibleButton from "../../../elements/AccessibleButton";
import MatrixClientContext from "../../../../../contexts/MatrixClientContext";
import Modal from "../../../../../Modal";
import QuestionDialog from "../../../dialogs/QuestionDialog";
import StyledRadioGroup from "../../../elements/StyledRadioGroup";
import { CALENDAR_EVENT_TYPE, StateKeys } from "../../../../../utils/watcha_nextcloudUtils";

interface IProps {
    roomId: string;
}

interface ICalendarEvents {
    VEVENT_VTODO: MatrixEvent | null;
    VEVENT: MatrixEvent | null;
    VTODO: MatrixEvent | null;
}

/* eslint-disable camelcase */
interface ICalendarEventContent {
    id: number;
    is_personal: boolean;
}
/* eslint-enable camelcase */

export default ({ roomId }: IProps) => {
    const client = useContext(MatrixClientContext);
    const room = client.getRoom(roomId);

    const getCalendarEvents = useCallback((): ICalendarEvents => ({
        VEVENT_VTODO: room!.currentState.getStateEvents(CALENDAR_EVENT_TYPE, StateKeys.VEVENT_VTODO),
        VEVENT: room!.currentState.getStateEvents(CALENDAR_EVENT_TYPE, StateKeys.VEVENT),
        VTODO: room!.currentState.getStateEvents(CALENDAR_EVENT_TYPE, StateKeys.VTODO),
    }), [room]);

    const [calendarEvents, setCalendarEvents] = useState(getCalendarEvents());

    const isOwnedByAnUser = (calendarEvent: MatrixEvent) => Boolean(calendarEvent.getContent()?.is_personal);

    const isOwnedByMe = (calendarEvent: MatrixEvent) =>
        isOwnedByAnUser(calendarEvent) && calendarEvent.getSender() === client.getUserId();

    const isShared = (stateKey: StateKeys) => Boolean(calendarEvents[stateKey]?.getContent()?.id);

    const isSharedByMe = (stateKey: StateKeys) => calendarEvents[stateKey] && isOwnedByMe(calendarEvents[stateKey]!);

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

    useEffect(() => {
        const onRoomStateEvents = (event: MatrixEvent) => {
            if (event.getType() === CALENDAR_EVENT_TYPE) {
                setCalendarEvents(getCalendarEvents());
            }
        };
        client.getOwnCalendars().then((calendars: IOwnCalendars) => {
            setOwnCalendars(calendars);
        });
        client.on(RoomStateEvent.Events, onRoomStateEvents);
        return () => {
            client.removeListener(RoomStateEvent.Events, onRoomStateEvents);
        };
    }, [getCalendarEvents, client]);

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
                        "watcha|add_calendar_tasks_title",
                    )}
                >
                    { _t("watcha|add_calendar_tasks") }
                </AccessibleButton>
            </div>
        );
    }

    const onRemove = async (): Promise<void> => {
        Modal.createDialog(QuestionDialog, {
            danger: true,
            title: _t("watcha|delete_calendar_tasks_title"),
            description: _t("watcha|delete_calendar_tasks"),
            button: _t("action|delete"),
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
                    { _t("action|delete") }
                </AccessibleButton>
            </div>
        );
    }

    const sharedCalendarsList = [];

    for (const stateKey of Object.values(StateKeys)) {
        const calendarEvent = calendarEvents[stateKey];
        const calendar: ICalendarEventContent = calendarEvent!.getContent()!;
        if (!calendar || isEmpty(calendar) || (calendarEvent && !isOwnedByAnUser(calendarEvent)) || (calendarEvent && isOwnedByMe(calendarEvent))) {
            continue;
        }
        const ownerId = calendarEvent && isOwnedByAnUser(calendarEvent) ? calendarEvent.getSender() ?? "" : "";
        sharedCalendarsList.push(
            <SharedCalendar key={stateKey} {...{ roomId, stateKey, ownerId }} calendarId={calendar.id} />,
        );
    }

    let sharedCalendars: React.ReactNode;
    if (sharedCalendarsList.length) {
        sharedCalendars = (
            <div className="mx_SettingsTab_section watcha_CalendarSettingsTab_sharedCalendarsList">
                <span className="mx_SettingsTab_subheading">
                    { _t("watcha|count_shared_calendar_list", { count: sharedCalendarsList.length }) }
                </span>
                { sharedCalendarsList }
            </div>
        );
    }

    const ownCalendarsLists = [];

    if (ownCalendars) {
        if (ownCalendars.VEVENT_VTODO.length) {
            ownCalendarsLists.push(
                <OwnCalendarList
                    {...{ roomId }}
                    subheading={_t("watcha|count_calendar_include_tasks", {
                        count: ownCalendars.VEVENT_VTODO.length,
                    })}
                    stateKey={StateKeys.VEVENT_VTODO}
                    calendars={ownCalendars.VEVENT_VTODO}
                    sharedCalendarId={getSharedCalendarId(StateKeys.VEVENT_VTODO) ?? undefined}
                    disabled={!canBeShared(StateKeys.VEVENT_VTODO)}
                    key={StateKeys.VEVENT_VTODO}
                />,
            );
        }
        if (ownCalendars.VEVENT.length) {
            ownCalendarsLists.push(
                <OwnCalendarList
                    {...{ roomId }}
                    subheading={_t("watcha|count_calendar", { count: ownCalendars.VEVENT.length })}
                    stateKey={StateKeys.VEVENT}
                    calendars={ownCalendars.VEVENT}
                    sharedCalendarId={getSharedCalendarId(StateKeys.VEVENT) ?? undefined}
                    disabled={!canBeShared(StateKeys.VEVENT)}
                    key={StateKeys.VEVENT}
                />,
            );
        }
        if (ownCalendars.VTODO.length) {
            ownCalendarsLists.push(
                <OwnCalendarList
                    {...{ roomId }}
                    subheading={_t("watcha|count_tasks", { count: ownCalendars.VTODO.length })}
                    stateKey={StateKeys.VTODO}
                    calendars={ownCalendars.VTODO}
                    sharedCalendarId={getSharedCalendarId(StateKeys.VTODO) ?? undefined}
                    disabled={!canBeShared(StateKeys.VTODO)}
                    key={StateKeys.VTODO}
                />,
            );
        }
    }

    let toggle: React.ReactNode;
    if (ownCalendarsLists.length) {
        toggle = (
            <AccessibleButton
                kind="link"
                onClick={() => setShowAdvanced(!showAdvanced)}>
                { showAdvanced ? _t("action|hide_advanced") : _t("action|show_advanced") }
            </AccessibleButton>
        );
    }

    let advanced: React.ReactNode;
    if (ownCalendarsLists.length && showAdvanced) {
        advanced = (
            <>
                <div className="mx_SettingsTab_subsectionText">
                    { _t("watcha|share_ressources_calendar_tasks") }
                </div>
                { ownCalendarsLists }
            </>
        );
    }

    return (
        <div className="mx_SettingsTab">
            <div className="mx_SettingsTab_heading">{ _t("watcha|calendar_tasks_sharing") }</div>
            <div className="mx_SettingsTab_subsectionText">
                { _t("watcha|calendar_tasks_sharing_text") }
            </div>
            { addButton }
            { deleteButton }
            { sharedCalendars }
            <div>
                { toggle }
                { advanced }
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
    }, [client, calendarId, ownerId]);

    const onUnshare = (): void => {
        Modal.createDialog(QuestionDialog, {
            title: _t("watcha|stop_sharing_title"),
            description: _t("watcha|stop_sharing_description"),
            button: _t("watcha|stop_sharing"),
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
                    title={_t("watcha|calendar_include_tasks") + displayName}
                >
                    <span className={
                        "watcha_CalendarSettingsTab_SharedCalendar_maskedIcon " +
                        "watcha_CalendarSettingsTab_SharedCalendar_calendarIcon"
                    } />
                    <span className={
                        "watcha_CalendarSettingsTab_SharedCalendar_maskedIcon " +
                        "watcha_CalendarSettingsTab_SharedCalendar_tasksIcon"
                    } />
                </div>
            );
            break;
        case StateKeys.VEVENT:
            icons = (
                <span
                    className={
                        "watcha_CalendarSettingsTab_SharedCalendar_maskedIcon " +
                        "watcha_CalendarSettingsTab_SharedCalendar_calendarIcon"
                    }
                    title={_t("watcha|calendar") + displayName}
                />
            );
            break;
        case StateKeys.VTODO:
            icons = (
                <span
                    className={
                        "watcha_CalendarSettingsTab_SharedCalendar_maskedIcon " +
                        "watcha_CalendarSettingsTab_SharedCalendar_tasksIcon"
                    }
                    title={_t("watcha|tasks") + displayName}
                />
            );
            break;
    }

    return (
        <div className="watcha_CalendarSettingsTab_SharedCalendar">
            { icons }
            <span className="watcha_CalendarSettingsTab_SharedCalendar_ownerDisplayName" title={ownerDisplayName}>
                { ownerDisplayName }
            </span>
            <AccessibleButton
                className="watcha_CalendarSettingsTab_SharedCalendar_unshareButton"
                kind="danger_outline"
                onClick={onUnshare}
            >
                { _t("watcha|stop_sharing") }
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
                { _t("watcha|stop_sharing") }
            </AccessibleButton>
        );
    }

    const getLabel = (calendar: IOwnCalendar): React.ReactChild => {
        const displayName = (
            <span className="watcha_CalendarSettingsTab_OwnCalendarList_displayName" title={calendar.displayname}>
                { calendar.displayname }
            </span>
        );
        return calendar.id === sharedCalendarId ? (
            <>
                { displayName }
                { unshareButton }
            </>
        ) : (
            displayName
        );
    };

    let title: string="";
    if (disabled) {
        title = _t("watcha|error_two_ressources");
    }

    return (
        <div className="mx_SettingsTab_section" {...{ title }}>
            <span className="mx_SettingsTab_subheading">{ subheading }</span>
            <StyledRadioGroup
                name={stateKey}
                className="watcha_CalendarSettingsTab_OwnCalendarList_StyledRadioButton"
                definitions={calendars.map((calendar: IOwnCalendar) => ({
                    value: calendar.id.toString(),
                    label: getLabel(calendar),
                    disabled,
                }))}
                value={iAmCurrentlySharing && sharedCalendarId !== undefined ? sharedCalendarId.toString() : undefined}
                onChange={onCalendarChange}
            />
        </div>
    );
};
