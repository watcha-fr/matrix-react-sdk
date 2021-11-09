import React, { useEffect, useState } from "react";
import classNames from "classnames";

import { _t } from "../../languageHandler";
import { RightPanelPhases } from "../../stores/RightPanelStorePhases";
import BaseCard from "../views/right_panel/BaseCard";
import defaultDispatcher from "../../dispatcher/dispatcher";
import SettingsStore from "../../settings/SettingsStore";
import Spinner from "../views/elements/Spinner";

export default ({ roomId, initialTabId, empty, emptyClass, onClose }) => {
    const [iframeLoading, setIframeLoading] = useState(true);
    const [nextcloudSetting, setNextcloudSetting] = useState(SettingsStore.getValue("nextcloudShare", roomId));

    useEffect(() => {
        const _nextcloudShareWatcherRef = SettingsStore.watchSetting(
            "nextcloudShare",
            roomId,
            (originalSettingName, changedInRoomId, atLevel, newValAtLevel, newValue) => {
                setIframeLoading(true);
                setNextcloudSetting(newValAtLevel);
            }
        );
        return () => {
            SettingsStore.unwatchSetting(_nextcloudShareWatcherRef);
        };
    }, [roomId]);

    const onRoomSettingsClick = () => {
        const payload = {
            action: "open_room_settings",
            initialTabId,
        };
        defaultDispatcher.dispatch(payload);
    };

    let panel;
    if (SettingsStore.getValue("UIFeature.watcha_Nextcloud")) {
        if (nextcloudSetting) {
            panel = (
                <>
                    {iframeLoading && <Spinner />}
                    <iframe
                        id="watcha_NextcloudPanel"
                        className={classNames("watcha_NextcloudPanel", {
                            "watcha_NextcloudPanel-hidden": iframeLoading,
                        })}
                        src={nextcloudSetting}
                        onLoad={() => {
                            setIframeLoading(false);
                        }}
                    />
                </>
            );
        } else {
            let hint;
            if (SettingsStore.canSetValue("nextcloudShare", roomId, "room")) {
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
