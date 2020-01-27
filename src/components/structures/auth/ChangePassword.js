import React from 'react';
import createReactClass from 'create-react-class';
import WebPwChanged from './WebPwChanged';
import MobileOnboarding from './MobileOnboarding';

module.exports = createReactClass({
    displayName: 'ChangePassword',

    getInitialState: function() {
        return {
            passwordLength: true,
            passwordMatch: true,
            password: '',
            connected: false,
            success: false,

        };
    },
    componentDidMount: function() {
        this.setState({os: this.getOS()});
        this.getUrlParameters();
    },

    onPasswordChange: function(evt) {
        this.setState({ password: evt.target.value });
    },

    onConfirmChange: function(evt) {
        this.setState({ confirm: evt.target.value });
    },

        convertUserId: function(user) {
        let simplifiedUserId = user;
        if (user[0]==='@') {
            simplifiedUserId = user.replace('@', '');
            simplifiedUserId = simplifiedUserId.split(':');
            simplifiedUserId = simplifiedUserId[0];
        }
          return simplifiedUserId;

    },


    getUrlParameters: async function() {
        const arr = this.props.onboardingUrl.split('t=');
        const encodedString= arr[1];
        const CredsString = this.b64DecodeUnicode(encodedString); //there is probably a better way to parse an url parameter bud i did not find any?
        const jsonCred = await JSON.parse(CredsString);
        const user = jsonCred['user'];
        const password = jsonCred['pw'];
        const credentialsWithoutPassword ={user: this.convertUserId(user),
        server: window.location.host};
        this.setState({loading: true});
        this.setState({credUser: user});
        this.setState({credPassword: password});
        this.setState({credServer: window.location.hostname });
        this.setState({credentialsWithoutPassword: credentialsWithoutPassword});
        this.getAccessToken();
    },
    connect: function(password) {
        this.changePassword();
    },
    getOS: function() {
        const userAgent = window.navigator.userAgent;
        const platform = window.navigator.platform;
        const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
        const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
        const iosPlatforms = ['iPhone', 'iPad', 'iPod'];

        if (macosPlatforms.indexOf(platform) !== -1) {
            return 'Mac OS';
        } else if (iosPlatforms.indexOf(platform) !== -1) {
            return 'iOS';
        } else if (windowsPlatforms.indexOf(platform) !== -1) {
            return 'Windows';
        } else if (/Android/.test(userAgent)) {
            return 'Android';
        } else if (/Linux/.test(platform)) {
            return 'Linux';
        }
        // should not occur, of course...
        return "Unsupported platform";
    },

    noPasswordToken: function() {
        this.getIdentityToken( btoa(JSON.stringify(this.state.credentialsWithoutPassword).replace(/%([0-9A-F]{2})/g,
                function toSolidBytes(match, p1) {
                    return String.fromCharCode('0x' + p1);
                })),
                             );
    },

    getIdentityToken: function(string) {
      this.setState({identityToken: string});
    },

    getAccessToken: async function() {
        try {
            // get config.json and synapse URL.
            const configRequest = await fetch('/config.json');
            const configData = JSON.parse(await configRequest.text());
            // New, complex, format for homeserver location in config.json...
            // see riot-web.git/src/vector/index.js
            const coreUrl = configData['default_server_config']['m.homeserver']['base_url'];
            this.setState({coreUrl: coreUrl});
            if (!this.state.coreUrl) {
                this.setState({error:
                 "Impossible de trouver le serveur core. Pour obtenir de l'aide contactez nous à contact@watcha.fr ",
               });
            } else {
                const loginRequest = await fetch(this.state.coreUrl + '/_matrix/client/r0/login', {
                    method: 'POST',
                    body: JSON.stringify({
                        'initial_device_display_name': 'Web setup account',
                        'user': this.state.credUser,
                        'password': this.state.credPassword,
                        'type': 'm.login.password',
                    }),
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                });
                const loginData = JSON.parse(await loginRequest.text());

                if (!loginData['access_token']) {
                    this.noPasswordToken();
                    this.setState({passwordAlreadyChanged: true});
                } else {

                    this.noPasswordToken();
                    this.setState({accessToken: loginData['access_token']});
                }
            }
        } catch (e) {
            this.setState({error:
             "Une erreur imprévue s'est produite. Pour obtenir de l'aide envoyer ce message à contact@watcha.fr :" + e,
           });
        }
                this.setState({loading: false});

    },

    b64DecodeUnicode: function(str) {
        return decodeURIComponent(atob(str).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    },
    changePassword: async function() {
        this.setState({loading:true});
        try {
            // XHR POST to change password
            const changePasswordRequest = await fetch(this.state.coreUrl + '/_matrix/client/r0/account/password', {
                method: 'POST',
                body: JSON.stringify({
                    'auth': {
                        'type': 'm.login.password',
                        'user': this.state.credUser,
                        'password': this.state.credPassword,
                    },
                    'new_password': this.state.password,
                }),
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': 'Bearer ' + this.state.accessToken,
                },
            });


            if (changePasswordRequest.status !== 200 && this.state.accessToken) {
                this.setState({error: "Impossible de définir le nouveau mot de passe. Pour obtenir de l'aide contacter nous à contact@watcha.fr"});
            } else {
                this.setState({successChange: true});
            }
        } catch (e) {
            this.setState({error: "Impossible de définir le nouveau mot de passe. Pour obtenir de l'aide contacter nous à contact@watcha.fr"});
        }
        this.setState({loading:false});
    },


    onChangePassword: function() {
        const PASSWORD_MATCH = (this.state.password === this.state.confirm);
        const PASSWORD_LENGTH =(this.state.password.length > 7);
        this.setState({passwordMatch: PASSWORD_MATCH});
        this.setState({passwordLength: PASSWORD_LENGTH});
        if (PASSWORD_MATCH && PASSWORD_LENGTH) {
            this.connect(this.state.password);
        }
    },
    onPasswordBlur: function() {
     this.setState({passwordFocus: false});
    },
    onChangeBlur: function() {
     this.setState({changeFocus: false});
    },
    onChangeFocus: function() {
     this.setState({changeFocus: true});
    },
    onPasswordFocus: function() {
     this.setState({passwordFocus: true});
     },

    render: function() {
      if (this.state.loading) {
        return (
              <div className='loading'>
                  <div>
                      <div className='logoRow'>
                            <img src="themes/riot/img/logos/watcha-title.svg" width='150' alt="Watcha" className="wt_Logo" />
                      </div>
                      <div className="loadingText">Chargement<span>.</span><span>.</span><span>.</span></div>
                  </div>
              </div>
          );
      }
        let error;
        let ModulableHeader="wt_Change_Password_Header";
        let passwordPlaceHolder="Définissez votre mot de passe";
        let changePlaceHolder="Confirmez votre mot de passe";
        if (this.state.passwordFocus && this.state.os==='Android') {
          ModulableHeader="wt_Hidden_Header";
          passwordPlaceHolder="";
        }
        if (this.state.changeFocus && this.state.os==='Android') {
          ModulableHeader="wt_Hidden_Header";
          changePlaceHolder="";
        }
        if (!this.state.passwordLength ) {
         error = <div className="wt_Error" >Le mot de passe est trop court.</div>;
        } else if (!this.state.passwordMatch) {
          error=<div className="wt_Error">Les mots de passe ne correspondent pas.</div>;
        }
        if (this.state.passwordAlreadyChanged || this.state.successChange) {
        if (this.state.os==='iOS'|| this.state.os==='Android') {
            return <MobileOnboarding os={this.state.os} identityToken={this.state.identityToken} firstConnection={!this.state.passwordAlreadyChanged} user={this.state.credUser} />;
        } else {
          return <WebPwChanged passwordLogin={this.props.PasswordLogin} identityToken={this.state.identityToken} firstConnection={!this.state.passwordAlreadyChanged} user={this.convertUserId(this.state.credUser)} />;
        }
      }
        return (
            <div className="wt_Container">
                <div className="wt_ChangePasswordHeader">
                    <div className={ModulableHeader}>
                        <div className="wt_logo_row">
                            <img src="themes/riot/img/logos/watcha-title.svg" width='150' alt="Watcha" className="wt_Logo" />
                        </div>
                            <div className="wt_welcome_text">Bienvenue sur Watcha</div>
                        <div className="wt_ChangePasswordText">
                            <div className="wt_PasswordLength">
                            <div>Avant de vous connecter,</div>
                            <div>vous devez définir votre mot de&nbsp;passe&nbsp;:</div>
                            <div>(au&nbsp;moins 8 caractères)</div>
                            </div>
                        </div>

                    </div>
                    <div className="wt_pw_form_container">
                        <div className="wt_PwInputContainer">
                            <input autocomplete="off" onFocus={this.onPasswordFocus} onBlur={this.onPasswordBlur} type="password" name="wt_NewPassword" placeholder={passwordPlaceHolder} className="wt_InputText" onChange={this.onPasswordChange} />
                        </div>
                        <div className="wt_ConfirmInputContainer">
                            <input autocomplete="off" onFocus={this.onChangeFocus} onBlur={this.onChangeBlur}type="password" name="wt_ConfirmPassword" placeholder={changePlaceHolder} className="wt_InputText" onChange={this.onConfirmChange} />
                        </div>
                      <div>
                    { error }
                    </div>
                        <button className="wt_SubmitButton" onClick={this.onChangePassword}>
                        Sauver le mot de passe
                        </button>
                    </div>

                </div>
            </div>
        );
    },
},
);
