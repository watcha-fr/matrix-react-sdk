/*

Copyright 2020 Watcha

This code is not licensed unless directly agreed with Watcha

New code for the Admin button

*/

import React from "react";

import { _t } from "../../languageHandler";
import IconButton from "../views/elements/watcha_IconButton";
import OutlineIconButton from "../views/elements/watcha_OutlineIconButton";

export default ({ collapsed }) => {
    const onClick = () => window.open("/admin", "_blank");

    const restProps = {
        onClick,
        "aria-label": _t("Open the administration interface in a new tab"),
    };

    return collapsed ? (
        <div className="watcha_AdminAccess watcha_AdminAccess_collapsed">
            <IconButton
                className="watcha_AdminAccess_IconButton"
                {...restProps}
            />
        </div>
    ) : (
        <div className="watcha_AdminAccess">
            <OutlineIconButton
                className="watcha_AdminAccess_OutlineIconButton"
                title={_t("Administration interface")}
                {...restProps}
            >
                {_t("Administration")}
            </OutlineIconButton>
        </div>
    );
};
