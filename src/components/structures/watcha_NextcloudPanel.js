import React, { useRef } from "react";

import SettingsStore from "../../settings/SettingsStore";
import { _t } from "../../languageHandler";

import { refineNextcloudIframe } from "../../utils/watcha_nextcloudUtils";

export default ({ roomId }) => {
    const nextcloudIframeRef = useRef();

    let panel;
    if (SettingsStore.isFeatureEnabled("feature_nextcloud")) {
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
                hint = (
                    <p>
                        {_t(
                            "You can choose one from room <span>settings </span>",
                            {},
                            {
                                span: sub => <span className="watcha_NextcloudPanel_settingsIcon-noWrap">{sub}</span>,
                            }
                        )}
                    </p>
                );
            }
            panel = (
                <div className={"mx_RoomView_messageListWrapper"}>
                    <div className="mx_RoomView_empty">
                        {_t("No folder is shared")}
                        {hint}
                    </div>
                </div>
            );
        }
    }
    return panel;
};
