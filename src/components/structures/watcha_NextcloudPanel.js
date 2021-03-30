import React, { useRef } from "react";

import { _t } from "../../languageHandler";
import { RightPanelPhases } from "../../stores/RightPanelStorePhases";
import { ROOM_NEXTCLOUD_TAB } from "../views/dialogs/RoomSettingsDialog";
import BaseCard from "../views/right_panel/BaseCard";
import defaultDispatcher from "../../dispatcher/dispatcher";
import SettingsStore from "../../settings/SettingsStore";

import { refineNextcloudIframe } from "../../utils/watcha_nextcloudUtils";

export default ({ roomId, onClose }) => {
    const nextcloudIframeRef = useRef();

    const onRoomSettingsClick = () => {
        const payload = {
            action: "open_room_settings",
            initialTabId: ROOM_NEXTCLOUD_TAB,
        };
        defaultDispatcher.dispatch(payload);
    };

    let panel;
    if (SettingsStore.getValue("feature_nextcloud")) {
        const nextcloudFolder = SettingsStore.getValue("nextcloudShare", roomId);
        if (nextcloudFolder) {
            panel = (
                <iframe
                    id="watcha_NextcloudPanel"
                    ref={nextcloudIframeRef}
                    className="watcha_NextcloudPanel"
                    src={nextcloudFolder}
                    onLoad={() => {
                        refineNextcloudIframe(nextcloudIframeRef);
                    }}
                />
            );
        } else {
            let hint;
            if (SettingsStore.canSetValue("nextcloudShare", roomId, "room")) {
                hint = _t(
                    "You can choose one from room <span>settings </span>",
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
                <div className={"mx_RoomView_messageListWrapper"}>
                    <div className="mx_RoomView_empty">
                        <div className="mx_RightPanel_empty mx_FilePanel_empty">
                            <h2>{_t("No folder shared with this room")}</h2>
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
