import React from "react";

import { _t } from "../../../../../languageHandler";
import SdkConfig from "../../../../../SdkConfig";

const SSOProfileTab: React.FC = () => {
    const SSOProfileUrl = SdkConfig.get().watcha_sso_profile_url;

    return (
        <div className="watcha_SSOProfile">
            <iframe className="watcha_SSOProfile_iframe" src={SSOProfileUrl} />
        </div>
    );
};

export default SSOProfileTab;
