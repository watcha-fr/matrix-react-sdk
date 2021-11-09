import React, { useContext, useEffect, useState } from "react";
import classNames from "classnames";

import { _t } from "../../languageHandler";
import { RightPanelPhases } from "../../stores/RightPanelStorePhases";
import BaseCard from "../views/right_panel/BaseCard";
import defaultDispatcher from "../../dispatcher/dispatcher";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import SettingsStore from "../../settings/SettingsStore";
import Spinner from "../views/elements/Spinner";

import { CALENDAR_EVENT_TYPE, StateKeys, getNextcloudBaseUrl } from "../../utils/watcha_nextcloudUtils";

const getCalendarId = (room, stateKey) =>
    room.currentState.getStateEvents(CALENDAR_EVENT_TYPE, stateKey)?.getContent()?.id ||
    room.currentState.getStateEvents(CALENDAR_EVENT_TYPE, StateKeys.VEVENT_VTODO)?.getContent()?.id;

export default ({ roomId, appName, stateKey, initialTabId, empty, emptyClass, onClose }) => {
    const client = useContext(MatrixClientContext);
    const room = client.getRoom(roomId);

    const [calendarsReordering, setCalendarsReordering] = useState(true);
    const [iframeLoading, setIframeLoading] = useState(true);
    const [canSetCalendar, setCanSetCalendar] = useState(
        room.currentState.maySendStateEvent(CALENDAR_EVENT_TYPE, client.getUserId())
    );
    const [calendarId, setCalendarId] = useState(getCalendarId(room, stateKey));

    const onRoomStateEvents = event => {
        if (event.getRoomId() === roomId && event.getType() === CALENDAR_EVENT_TYPE) {
            setCalendarId(getCalendarId(room, stateKey));
        }
    };

    useEffect(() => {
        client.on("RoomState.events", onRoomStateEvents);
        return () => {
            client.removeListener("RoomState.events", onRoomStateEvents);
        };
    }, []);

    useEffect(() => {
        if (calendarId) {
            setCalendarsReordering(true);
            setIframeLoading(true);
            client.reorderCalendars(calendarId).then(() => {
                setCalendarsReordering(false);
            });
        }
    }, [calendarId]);

    const onRoomSettingsClick = () => {
        const payload = {
            action: "open_room_settings",
            initialTabId,
        };
        defaultDispatcher.dispatch(payload);
    };

    let panel;
    if (SettingsStore.getValue("UIFeature.watcha_Nextcloud")) {
        if (calendarId && calendarsReordering) {
            panel = <Spinner />;
        } else if (calendarId) {
            panel = (
                <>
                    {iframeLoading && <Spinner />}
                    <iframe
                        key={calendarId}
                        id="watcha_NextcloudPanel"
                        className={classNames("watcha_NextcloudPanel", {
                            "watcha_NextcloudPanel-hidden": iframeLoading,
                        })}
                        src={getNextcloudBaseUrl() + "apps/" + appName}
                        onLoad={() => {
                            setIframeLoading(false);
                        }}
                    />
                </>
            );
        } else {
            let hint;
            if (canSetCalendar) {
                hint = _t(
                    "You can share a resource from room <span>settings </span>",
                    {},
                    {
                        span: sub => (
                            <span className="watcha_NextcloudPanel_settingsIcon-noWrap" onClick={onRoomSettingsClick}>
                                {sub}
                            </span>
                        ),
                    }
                );
            }
            panel = (
                <div className="mx_RoomView_messageListWrapper">
                    <div className="mx_RoomView_empty">
                        <div className={classNames("mx_RightPanel_empty", emptyClass)}>
                            <h2>{empty}</h2>
                            <p>{hint}</p>
                        </div>
                    </div>
                </div>
            );
        }
    }
    return (
        <BaseCard className="mx_FilePanel" {...{ onClose }} previousPhase={RightPanelPhases.RoomSummary}>
            {panel}
        </BaseCard>
    );
};
