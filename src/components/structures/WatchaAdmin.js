import React from "react";
import PropTypes from "prop-types";
import { MatrixClient } from "matrix-js-sdk";
import * as languageHandler from "../../languageHandler";

class WatchaAdmin extends React.Component {
    constructor(props) {
        super(props);
        this.openWatchaAdmin = this.openWatchaAdmin.bind(this);
        this.state = { isServerAdmin: false };
    }

    static contextTypes = {
        matrixClient: PropTypes.instanceOf(MatrixClient)
    };

    componentDidMount() {
        const self = this;
        this.context.matrixClient
            .isWatchaAdmin()
            .then(function(res) {
                self.setState({ isServerAdmin: res.is_admin });
            })
            .catch(err => {
                // not sure this is useful but just in case
                console.log("Error in isServerAdmin:");
                console.error(err);
                self.setState({ isServerAdmin: false });
            });
    }

    openWatchaAdmin(ev) {
        // the token will be retrieved in watcha-admin.git/src/App.js
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
    }

    render() {
        if (!this.props.collapsed) {
            return this.state.isServerAdmin ? (
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
            ) : (
                <div>TEST</div>
            );
        } else {
            return (
                <div
                    className="mx_WatchaAdminContainer"
                    aria-label="Open Watcha administration"
                    role="button"
                >
                    <img
                        id="mx_WatchaAdminIcon_collapsed"
                        src={require("../../../res/img/watcha_admin.svg")}
                        onClick={this.openWatchaAdmin}
                        alt="admin"
                        width="25"
                        height="25"
                    />
                </div>
            );
        }
    }
}

export default WatchaAdmin;
