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

import React, { useState } from "react";
import classNames from "classnames";

import { _t } from "../../languageHandler";

const HIDE_PARTNER_BAR_KEY = "watcha_hide_partner_bar";

const PartnerBar = () => {
    const [hidePartnerBar, setHidePartnerBar] = useState(localStorage.getItem(HIDE_PARTNER_BAR_KEY) === "true");

    const onClick = () => {
        setHidePartnerBar(true);
        localStorage.setItem(HIDE_PARTNER_BAR_KEY, JSON.stringify(true));
    };

    return (
        <div className={classNames("watcha_PartnerBar", { watcha_PartnerBar_hidden: hidePartnerBar })}>
            <span>{ _t("You are logged in from a partner account with limited rights") }</span>
            <img src={require("../../../res/img/cancel.svg").default} {...{ onClick }} />
        </div>
    );
};

export default PartnerBar;
