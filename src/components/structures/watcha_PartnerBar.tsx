import React, { useState } from "react";
import classNames from "classnames";

import { _t } from "../../languageHandler";

const HIDE_PARTNER_BAR_KEY = "watcha_hidePartnerBar";

const PartnerBar = () => {
    const [hidePartnerBar, setHidePartnerBar] = useState(localStorage.getItem(HIDE_PARTNER_BAR_KEY) === "true");

    const onClick = () => {
        setHidePartnerBar(true);
        localStorage.setItem(HIDE_PARTNER_BAR_KEY, JSON.stringify(true));
    };

    return (
        <div className={classNames("watcha_PartnerBar", { watcha_PartnerBar_hidden: hidePartnerBar })}>
            <span title={_t("You are logged in from an account with limited rights")}>{_t("Partner account")}</span>
            <img src={require("../../../res/img/cancel.svg")} {...{ onClick }} />
        </div>
    );
};

export default PartnerBar;
