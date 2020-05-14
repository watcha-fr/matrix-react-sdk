import React from "react";
import createReactClass from "create-react-class";
import dis from "../../../dispatcher";

module.exports = createReactClass({
    displayName: "WatchaWebPwChanged",

    onClick() {
        dis.dispatch({
            action: "show_login_page_with_autofill_email",
            username: this.props.email,
        });
    },

    getTitle() {
        return (this.props.firstConnection) ?
            "Votre mot de passe a été défini." :
            "Votre mot de passe a déjà été défini.";
    },

    render() {
        return (
            <div className="wt_WebContainerFallback">
                <img
                    src="themes/riot/img/logos/watcha-title.svg"
                    alt="Watcha"
                    className="wt_Logo"
                />

                <div className="wt_web_body_fallback">
                    <h1>Bienvenue sur Watcha</h1>
                    <div className="wt_web_username">{this.getTitle()}</div>
                    <button className="mx_Login_submit" onClick={this.onClick}>
                        Cliquez ici pour vous connecter
                    </button>
                </div>
            </div>
        );
    },
});
