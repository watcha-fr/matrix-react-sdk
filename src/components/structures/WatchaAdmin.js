import { Component } from "react";
import PropTypes from "prop-types";
import { MatrixClient } from "matrix-js-sdk";
import * as languageHandler from "../../languageHandler";

class WatchaAdmin extends Component {
    constructor(props) {
        super(props);
        this.state = { isServerAdmin: false };
    }

    static contextTypes = {
        matrixClient: PropTypes.instanceOf(MatrixClient)
    };

    openWatchaAdmin = ev => {
        // The token will be retrieved in watcha-admin.git/src/App.js
        // TODO: this is not necessary, as the token, and the language, are already stored in the local storage !
        // (respectivelly as mx_access_token, and in the mx_local_settings item)
        const key = Math.random()
            .toString(36)
            .substring(7);
        // SettingsStore.getValue("language") or counterpart.getLocale() always return 'en' !!
        const value =
            languageHandler.getCurrentLanguage() +
            "|" +
            this.context.matrixClient.getAccessToken();
        localStorage.setItem("watcha-" + key, value);
        window.open("/admin?key=" + key, "_blank");
    };

    render() {
        const adminAccess = (
            <div className="mx_WatchaAdminContainer">
                <button
                    type="button"
                    className="mx_WatchaAdminButton"
                    onClick={this.openWatchaAdmin}
                    aria-label="Open Watcha administration"
                    role="button"
                >
                    Administration
                    <img
                        id="mx_WatchaAdminIcon"
                        src={require("../../../res/img/watcha_admin.svg")}
                        alt="admin"
                        width="15"
                        height="15"
                    />
                </button>
            </div>
        );
        const collapsedAdminAccess = (
            <div className="mx_WatchaAdminContainer">
                <img
                    id="mx_WatchaAdminIcon_collapsed"
                    src={require("../../../res/img/watcha_admin.svg")}
                    onClick={this.openWatchaAdmin}
                    alt="admin"
                    width="25"
                    height="25"
                    aria-label="Open Watcha administration"
                    role="button"
                />
            </div>
        );
        return this.props.collapsed ? collapsedAdminAccess : adminAccess;
    }
}

export default WatchaAdmin;
