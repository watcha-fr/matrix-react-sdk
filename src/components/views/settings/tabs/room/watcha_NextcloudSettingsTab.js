import PropTypes from "prop-types";
import React from "react";

import { _t } from "../../../../../languageHandler";

import NextcloudSettings from "../../../room_settings/watcha_NextcloudSettings";

const NextcloudSettingsTab = ({ roomId }) => (
    <div className="mx_SettingsTab">
        <div className="mx_SettingsTab_heading">{_t("Document sharing")}</div>
        <div className="mx_SettingsTab_section">
            <NextcloudSettings {...{ roomId }} />
        </div>
    </div>
);

NextcloudSettingsTab.propTypes = {
    roomId: PropTypes.string.isRequired,
};

export default NextcloudSettingsTab;
