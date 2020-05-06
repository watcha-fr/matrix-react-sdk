/*

Copyright 2020 Watcha

This code is not licensed unless directly agreed with Watcha

New code for the Admin button

*/

import PropTypes from "prop-types";
import { Component } from "react";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { _t, getCurrentLanguage } from "../../languageHandler";
import OutlineIconButton from "../views/elements/watcha_OutlineIconButton";
import IconButton from "../views/elements/watcha_IconButton";

class AdminAccess extends Component {
    constructor(props) {
        super(props);
        this.state = { isServerAdmin: false };
    }

    openAdmin = ev => {
        // The token will be retrieved in watcha-admin.git/src/App.js
        // TODO: this is not necessary, as the token, and the language, are already stored in the local storage !
        // (respectivelly as mx_access_token, and in the mx_local_settings item)
        const key = Math.random()
            .toString(36)
            .substring(7);
        // SettingsStore.getValue("language") or counterpart.getLocale() always return 'en' !!
        const value =
            getCurrentLanguage() +
            "|" +
            MatrixClientPeg.get().getAccessToken();
        localStorage.setItem("watcha-" + key, value);
        window.open("/admin?key=" + key, "_blank");
    };

    render() {
        const restProps = {
            onClick: this.openAdmin,
            "aria-label": _t("Open the administration interface in a new tab")
        };
        const adminAccess = (
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
        const collapsedAdminAccess = (
            <div className="watcha_AdminAccess watcha_AdminAccess_collapsed">
                <IconButton
                    className="watcha_AdminAccess_IconButton"
                    {...restProps}
                />
            </div>
        );
        return this.props.collapsed ? collapsedAdminAccess : adminAccess;
    }
}

export default AdminAccess;
