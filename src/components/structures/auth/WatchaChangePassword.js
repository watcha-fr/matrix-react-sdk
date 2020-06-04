import React from "react";
import createReactClass from "create-react-class";
import WatchaWebPwChanged from "./WatchaWebPwChanged";
import WatchaMobileOnboarding from "./WatchaMobileOnboarding";


function getOS() {
    const userAgent = window.navigator.userAgent;
    const platform = window.navigator.platform;
    const macosPlatforms = ["Macintosh", "MacIntel", "MacPPC", "Mac68K"];
    const windowsPlatforms = ["Win32", "Win64", "Windows", "WinCE"];
    const iosPlatforms = ["iPhone", "iPad", "iPod"];
    
    if (macosPlatforms.indexOf(platform) !== -1) {
        return "Mac OS";
    } else if (iosPlatforms.indexOf(platform) !== -1) {
        return "iOS";
    } else if (windowsPlatforms.indexOf(platform) !== -1) {
        return "Windows";
    } else if (/Android/.test(userAgent)) {
        return "Android";
    } else if (/Linux/.test(platform)) {
        return "Linux";
    }
    // should not occur, of course...
    return "Unsupported platform";
}

// from https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
function b64EncodeUnicode(str) {
    return btoa(encodeURIComponent(str).replace(
        /%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode('0x' + p1);
        }));
}

function b64DecodeUnicode(str) {
    // there doesn't seem to be an easier way without an external library...
    return decodeURIComponent(
        atob(str)
            .split("")
            .map(function (c) {
                return (
                    "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
                );
            })
            .join("")
    );
}


export default createReactClass({
    displayName: "WatchaChangePassword",

    getInitialState() {
        return {
            loading: true,
            password: "",
            confirm: "",
            displayName: "",
            initialDisplayName: ""
        };
    },

    componentDidMount() {
        this.fetchInitialParameters();
    },

    async fetchInitialParameters() {
        const jsonParameters = await JSON.parse(
            b64DecodeUnicode(this.props.onboardingUrl.split("t=")[1])
        );
        // BUG: jsonParameters["user"] is different for partners vs. collaborators:
        // When the user was created in the admin (collaborator)
        // it has the identity server ("@<user_id>:<identity_server>" format),
        // but not when it was invited as an external user !!!
        const userWithIdentityServer = jsonParameters["user"];
        const user = userWithIdentityServer.replace("@", "").split(":")[0];
        const email = jsonParameters["email"];
        this.setState({
            loading: true,
            // because of the bug above, we can't set the field here,
            //userWithIdentityServer,
            user,
            email,
            initialPassword: jsonParameters["pw"],
            identityToken: b64EncodeUnicode(
                JSON.stringify({
                    user,
                    email,
                    server: window.location.host,
                })
            )
        });

        try {
            // get config.json and synapse URL.
            const configRequest = await fetch("/config.json");
            const configData = JSON.parse(await configRequest.text());
            // New, complex, format for homeserver location in config.json...
            // see riot-web.git/src/vector/index.js
            const coreUrl =
                configData["default_server_config"]["m.homeserver"]["base_url"];
            if (!coreUrl) {
                this.setState({
                    error:
                        "Impossible de trouver le serveur core. Pour obtenir de l'aide contactez nous à contact@watcha.fr",
                });
            } else {
                this.setState({ coreUrl });
                
                // ... we set userWithIdentityServer here, it shouldn't be needed.
                const server = configData["default_server_config"]["m.homeserver"][
                    "server_name"
                ];
                const userWithIdentityServer = "@" + this.state.user + ":" + server;
                this.setState({ userWithIdentityServer });
                
                const loginRequest = await this.fetchCore(
                    "POST", "/_matrix/client/r0/login", {
                        initial_device_display_name: "Web setup account",
                        user: this.state.user,
                        password: this.state.initialPassword,
                        type: "m.login.password",
                    }
                );
                const loginData = JSON.parse(await loginRequest.text());

                if (!loginData["access_token"]) {
                    this.setState({ passwordAlreadyChanged: true });
                } else {
                    this.setState({ accessToken: loginData["access_token"] });

                    const getDisplayNameRequest = await this.fetchCore(
                        "GET", this.displayNameUri()
                    );
                    const text = await getDisplayNameRequest.text();
                    const profileData = JSON.parse(text);
                    const initialDisplayName = profileData["displayname"];
                    if ((initialDisplayName !== this.state.user) &&
                        // paranoid: sometimes the display name seems to have only spaces
                        initialDisplayName && initialDisplayName.trim()) {
                        this.setState({ initialDisplayName: initialDisplayName });
                    }
                }
            }
        } catch (e) {
            this.setState({
                error:
                    "Une erreur imprévue s'est produite. Pour obtenir de l'aide envoyer ce message à contact@watcha.fr : " +
                    e,
            });
        }
        this.setState({ loading: false });
    },        

    displayNameUri() {
        return "/_matrix/client/r0/profile/" +
            encodeURIComponent(this.state.userWithIdentityServer) + 
            "/displayname";
    },

    async validateForm() {
        this.setState({ loading: true });
        try {
            const error = await this.doValidateForm();
            if (error) {
                this.setState({ error: error })
            }
        } catch (e) {
            this.setState({
                error:
                "Impossible de définir le nom. Pour obtenir de l'aide contacter nous à contact@watcha.fr: " + e
            })
        }
        this.setState({ loading: false });
    },

    async fetchCore(method, uri, body=null) {
        return fetch(
            this.state.coreUrl + uri,
            {
                method: method,
                body: body ? JSON.stringify(body) : null,
                headers: (this.state.accessToken) ? {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Authorization: "Bearer " + this.state.accessToken,
                } : {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                }
            }
        )
    },
    
    async doValidateForm() {
        if (!this.state.accessToken) {
            return;
        }

        if (this.state.password.length == 0) {
            // first error if the user hasn't entered anything - nicer 
            if (!this.state.initialDisplayName && 
                !this.state.displayName) {                
                return "Entrez votre nom complet et un mot de passe";
            }
            return "Entrez un mot de passe";
        }
            
        if (this.state.password !== this.state.confirm) {
            return "Les mots de passe ne correspondent pas.";
        }

        if (this.state.password.length < 8) {
            return "Le mot de passe est trop court.";            
        }

        if (!this.state.initialDisplayName) {
            if (!this.state.displayName) {
                return "Entrez votre nom complet";
            }
            if (!this.state.displayName.trim().includes(' ')) {
                return "Le nom complet doit inclure un prénom et un nom."
            }
            if (this.state.displayName.trim().length < 5) {
                return "Le nom est trop court. Entrez au moins 5 caractères.";
            }
            
            const changeDisplayNameRequest = await this.fetchCore(
                "PUT", this.displayNameUri(), {
                    displayname: this.state.displayName,
                }
            );
                
            if (changeDisplayNameRequest.status !== 200) {
                return "Impossible de définir le nom. Pour obtenir de l'aide contacter nous à contact@watcha.fr";
            }
        }

        const changePasswordRequest = await this.fetchCore(
            "POST", "/_matrix/client/r0/account/password", {
                auth: {
                    type: "m.login.password",
                    user: this.state.user,
                    password: this.state.initialPassword,
                },
                new_password: this.state.password,
            });

        if (changePasswordRequest.status !== 200) {
            return "Impossible de définir le nouveau mot de passe. Pour obtenir de l'aide contacter nous à contact@watcha.fr";
        }

        this.setState({ successChange: true });
    },

    onPasswordChange(evt) {
        this.setState({ password: evt.target.value, error: null });
    },

    onDisplaynameChange(evt) {
        this.setState({ displayName: evt.target.value, error: null });
    },

    onConfirmChange(evt) {
        this.setState({ confirm: evt.target.value, error: null });
    },

    onPasswordBlur() {
        this.setState({ passwordFocus: false, error: null });
    },
    onChangeBlur() {
        this.setState({ changeFocus: false, error: null });
    },
    onChangeFocus() {
        this.setState({ changeFocus: true, error: null });
    },
    onPasswordFocus() {
        this.setState({ passwordFocus: true, error: null });
    },
    onDisplaynameFocus() {
        this.setState({ displaynameFocus: true, error: null });
    },

    render() {
        if (this.state.loading) {
            return (
                <div className="loading">
                    <div>
                        <div className="logoRow">
                            <img
                                src="themes/riot/img/logos/watcha-title.svg"
                                width="150"
                                alt="Watcha"
                                className="wt_Logo"
                            />
                        </div>
                        <div className="loadingText">
                            Chargement<span>.</span>
                            <span>.</span>
                            <span>.</span>
                        </div>
                    </div>
                </div>
            );
        }
        const os = getOS();
        if (this.state.passwordAlreadyChanged || this.state.successChange) {
            if (os === "iOS" || os === "Android") {
                return (
                    <WatchaMobileOnboarding
                        os={os}
                        identityToken={this.state.identityToken}
                        firstConnection={!this.state.passwordAlreadyChanged}
                        user={this.state.user}
                    />
                );
            } else {
                return (
                    <WatchaWebPwChanged
                        firstConnection={!this.state.passwordAlreadyChanged}
                        email={this.state.email}
                    />
                );
            }
        }

        const welcomeText = (this.state.initialDisplayName) ? (
            ", " + this.state.initialDisplayName.replace(/ /g, "\u00a0")
        ) : "";
        
        const fullNameField = (this.state.initialDisplayName) ? null : (
            <div className="wt_fullNameinputContainer">
                <div className="wt_PasswordLength">
                    <div>Entrez votre nom complet&nbsp;:</div>
                    <div className="wt_ChangePasswordSubtitles">
                        Vous apparaitrez aux autres utilisateurs
                        avec ce nom.
                    </div>
                </div>
                <input
                    autoComplete="off"
                    onFocus={this.onDisplaynameFocus}
                    onBlur={this.onDisplaynameBlur}
                    type="text"
                    name="wt_Fullname"
                    placeholder={"Prenom et Nom"}
                    className="wt_InputText"
                    onChange={this.onDisplaynameChange}
                    value={this.state.displayName}
                />
             </div>
        );
        const error = (this.state.error) ? (
                <div className="wt_Error">{this.state.error}</div>
        ) : null;

        let ModulableHeader = "wt_Change_Password_Header";
        let passwordPlaceHolder = "Définissez votre mot de passe";
        let changePlaceHolder = "Confirmez votre mot de passe";
        if (this.state.passwordFocus && os === "Android") {
            ModulableHeader = "wt_Hidden_Header";
            passwordPlaceHolder = "";
        }
        if (this.state.changeFocus && os === "Android") {
            ModulableHeader = "wt_Hidden_Header";
            changePlaceHolder = "";
        }
        
        return (
            <div className="wt_Container">
                <div className="wt_ChangePasswordHeader">
                    <div className={ModulableHeader}>
                        <div className="wt_logo_row">
                            <img
                                src="themes/riot/img/logos/watcha-title.svg"
                                width="150"
                                alt="Watcha"
                                className="wt_Logo"
                            />
                        </div>
                        <div className="wt_welcome_text">
                            Bienvenue sur Watcha{welcomeText}
                        </div>
                    </div>
                    <div className="wt_pw_form_container">
                        {fullNameField}
                        <div className="wt_ChangePasswordText">
                            <div className="wt_PasswordLength">
                                <div>
                                    Définissez votre mot de&nbsp;passe&nbsp;:
                                </div>
                                <div className="wt_ChangePasswordSubtitles">
                                    au&nbsp;moins 8 caractères
                                </div>
                            </div>
                        </div>
                        <div className="wt_PwInputContainer">
                            <input
                                autoComplete="off"
                                onFocus={this.onPasswordFocus}
                                onBlur={this.onPasswordBlur}
                                type="password"
                                name="wt_NewPassword"
                                placeholder={passwordPlaceHolder}
                                className="wt_InputText"
                                onChange={this.onPasswordChange}
                                value={this.state.password}
                            />
                        </div>
                        <div className="wt_ConfirmInputContainer">
                            <input
                                autoComplete="off"
                                onFocus={this.onChangeFocus}
                                onBlur={this.onChangeBlur}
                                type="password"
                                name="wt_ConfirmPassword"
                                placeholder={changePlaceHolder}
                                className="wt_InputText"
                                onChange={this.onConfirmChange}
                                value={this.state.confirm}
                            />
                        </div>
                        <div>{error}</div>
                        <button
                            className="wt_SubmitButton"
                            onClick={this.validateForm}
                        >
                            Se connecter a Watcha
                        </button>
                    </div>
                </div>
            </div>
        );
    },
});
