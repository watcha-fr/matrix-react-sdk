import React, { useRef } from "react";

import SettingsStore from "../../settings/SettingsStore";
import { _t } from "../../languageHandler";

import { refineNextcloudIframe } from "../../utils/watcha_nextcloudUtils";

export default ({ roomId }) => {
    const nextcloudIframeRef = useRef();

    let panel;
    if (SettingsStore.getValue("feature_nextcloud")) {
        const nextcloudFolder = SettingsStore.getValue(
            "nextcloudShare",
            roomId
        );
        if (nextcloudFolder) {
            panel = (
                <iframe
                    id="watcha_Nextcloud"
                    ref={nextcloudIframeRef}
                    className="watcha_Nextcloud"
                    src={nextcloudFolder}
                    onLoad={() => {
                        refineNextcloudIframe(nextcloudIframeRef);
                    }}
                />
            );
        } else {
            panel = (
                <div className={"mx_RoomView_messageListWrapper"}>
                    <div className="mx_RoomView_empty">
                        {_t("No Nextcloud folder is shared with this room")}
                    </div>
                </div>
            );
        }
    }
    return panel;
};
