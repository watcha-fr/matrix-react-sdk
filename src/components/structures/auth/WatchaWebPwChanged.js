import React from "react";
import createReactClass from "create-react-class";
import { _t } from "../../../languageHandler";
import sdk from "../../../index";
import dis from "../../../dispatcher";

module.exports = createReactClass({
    displayName: "WatchaWebPwChanged",

    getInitialState() {
        return {
            passwordLength: true,
            passwordMatch: true,
            credUser: this.props.user,
            password: "",
            clicked: false,
        };
    },

    componentDidMount() {
        this.convertUserId();
    },

    convertUserId() {
        if (this.state.credUser[0] === "@") {
            let simplifiedUserId = this.state.credUser.replace("@", "");
            simplifiedUserId = simplifiedUserId.split(":");
            simplifiedUserId = simplifiedUserId[0];
            this.setState({ credUser: simplifiedUserId });
        }
        localStorage.setItem("onboardingUsername", this.state.credUser);
    },

    copyToClipboard(e) {
        /* Get the text field */
        const copyText = document.getElementById("identityToken");

        /* Select the text field */
        copyText.select();

        /* Copy the text inside the text field */
        document.execCommand("copy");

        /* Alert the copied text */
        alert("Copied the text: " + copyText.value);
    },

    onClick() {
        dis.dispatch({
            action: "show_login_page_with_autofill_email",
            username: this.props.email,
        });
    },

    getTitle() {
        let title = "Votre mot de passe a déjà été défini.";
        if (this.props.firstConnection) {
            title = "Votre mot de passe a été défini.";
        }
        return title;
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
                    <button class="mx_Login_submit" onClick={this.onClick}>
                        Cliquez ici pour vous connecter
                    </button>
                </div>
            </div>
        );
    },
});
