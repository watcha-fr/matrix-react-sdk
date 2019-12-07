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

    openWatchaAdmin = ev => {
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
    };

    render() {
        if (!this.state.isServerAdmin) {
            return <div>TEST</div>;
        }
        return this.props.collapsed ? (
            <CollapsedAdminAccess />
        ) : (
            <AdminAccess />
        );
    }
}

class AdminAccess extends Component {
    static contextTypes = {
        matrixClient: PropTypes.instanceOf(MatrixClient)
    };

    render() {
        return (
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
    }
}

class CollapsedAdminAccess extends Component {
    static contextTypes = {
        matrixClient: PropTypes.instanceOf(MatrixClient)
    };

    render() {
        return (
            <div
                className="mx_WatchaAdminContainer"
            >
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
    }
}

export default WatchaAdmin;
