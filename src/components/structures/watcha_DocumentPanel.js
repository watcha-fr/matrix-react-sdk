import React, { useEffect, useState } from "react";
import classNames from "classnames";

import { _t } from "../../languageHandler";
import { RightPanelPhases } from '../../stores/right-panel/RightPanelStorePhases';
import { useSettingValue } from "../../hooks/useSettings";
import BaseCard from "../views/right_panel/BaseCard";
import defaultDispatcher from "../../dispatcher/dispatcher";
import SettingsStore from "../../settings/SettingsStore";
import Spinner from "../views/elements/Spinner";
import { getDocumentWidgetUrl } from "../../utils/watcha_nextcloudUtils";

export default ({ roomId, initialTabId, empty, emptyClass, onClose }) => {
    const [iframeLoading, setIframeLoading] = useState(true);
    const nextcloudShare = useSettingValue("nextcloudShare", roomId);

    useEffect(() => {
        if (nextcloudShare) {
            setIframeLoading(true);
        }
    }, [nextcloudShare]);

    const onRoomSettingsClick = () => {
        const payload = {
            action: "open_room_settings",
            initial_tab_id: initialTabId,
        };
        defaultDispatcher.dispatch(payload);
    };

    let panel;
    if (SettingsStore.getValue("UIFeature.watcha_Nextcloud")) {
        if (nextcloudShare) {
            panel = (
                <>
                    { iframeLoading && <Spinner /> }
                    <iframe
                        id="watcha_NextcloudPanel"
                        className={classNames("watcha_NextcloudPanel", {
                            "watcha_NextcloudPanel-hidden": iframeLoading,
                        })}
                        src={getDocumentWidgetUrl(nextcloudShare)}
                        onLoad={() => {
                            setIframeLoading(false);
                        }}
                        title={_t("Document sharing")}
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
                                { sub }
                            </span>
                        ),
                    },
                );
            }
            panel = (
                <div className="mx_RoomView_messageListWrapper">
                    <div className="mx_RoomView_empty">
                        <div className={classNames("mx_RightPanel_empty", emptyClass)}>
                            <h2>{ empty }</h2>
                            <p>{ hint }</p>
                        </div>
                    </div>
                </div>
            );
        }
    }
    return (
        <BaseCard className="mx_FilePanel" {...{ onClose }} previousPhase={RightPanelPhases.RoomSummary}>
            { panel }
        </BaseCard>
    );
};
