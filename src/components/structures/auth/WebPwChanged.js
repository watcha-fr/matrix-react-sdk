import React from 'react';
import createReactClass from 'create-react-class';
import { _t } from '../../../languageHandler';
import sdk from '../../../index';

module.exports = createReactClass({
    displayName: 'WebPwChanged',

    getInitialState: function() {
        return {
            passwordLength: true,
            passwordMatch: true,
            credUser: this.props.user,
            password: '',
            clicked: false,
        };
    },

    componentDidMount: function() {
        this.convertUserId();
    },

    convertUserId: function() {
        if (this.state.credUser[0]==='@') {
            let simplifiedUserId = this.state.credUser.replace('@', '');
            simplifiedUserId = simplifiedUserId.split(':');
            simplifiedUserId = simplifiedUserId[0];
            this.setState({credUser: simplifiedUserId});
        }
        localStorage.setItem('onboardingUsername', this.state.credUser);
    },

     copyToClipboard: function(e) {
/* Get the text field */
  const copyText = document.getElementById("identityToken");

  /* Select the text field */
  copyText.select();

  /* Copy the text inside the text field */
  document.execCommand("copy");

  /* Alert the copied text */
  alert("Copied the text: " + copyText.value);
  },
  onClick: function() {
    this.setState({clicked: true});
     localStorage.setItem('userName', this.state.credUser);

  },

  getTitle: function() {
    let title="Votre mot de passe a déjà été défini.";
    if (this.props.firstConnection) {
      title="Votre mot de passe a été défini.";
    }
    return title;
  },

   render: function() {
        return (
          <div className="wt_WebContainerFallback">
                            <img src="themes/riot/img/logos/watcha-title.svg" alt="Watcha" className="wt_Logo" />

                <div className="wt_web_body_fallback">
                    <h1>Bienvenue sur Watcha</h1>
                    <div className="wt_web_username">{ this.getTitle() }</div>
                    <a href={window.location.origin} onClick={this.onClick} > Cliquez ici pour vous connecter </a>
                </div>
            </div>
        );
    },
},
);
