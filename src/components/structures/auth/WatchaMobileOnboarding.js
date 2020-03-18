import React from 'react';
import createReactClass from 'create-react-class';


class WatchaMobileOnboarding extends React.Component {
  constructor(props) {
    super(props);
    this.convertUserId;
    this.state = {passwordLength: true,
            passwordMatch: true,
            credUser: this.props.user,
            password: '',
            copyButton: "Copier",
            buttonClassName: "wt_copy_button",
            installAppClass: "wt_inactive_step",
            copyTokenClass: "wt_active_step",}
};
  
    

    getInstanceLink() {
        switch (this.props.os) {
        case ('iOS'):
            return <div id="install-app-ios-from-desktop" className="install-app-block">
                <a href="https://itunes.apple.com/us/app/watcha/id1383732254" target="_blank">
                    <img className="app-store-icon" width="500" src={require("../../../../res/img/logos/appleStore.png")} alt="Apple Store" className="wt_store_logo" />
                </a>
            </div>;
        case ('Android'):
            return <div id="install-app-android-from-desktop" className="install-app-block">
                <a href="https://play.google.com/store/apps/details?id=im.watcha.app" target="_blank">
                    <img className="app-store-icon" src={require("../../../../res/img/logos/googlePlayStore.png")} width="500" alt="Google Play Store" className="wt_store_logo" />
                </a>
            </div>;
        default:
        return 'Web';
        }
    }

    convertUserId() {
        if (this.state.credUser[0]==='@') {
            let simplifiedUserId = this.state.credUser.replace('@', '');
            simplifiedUserId = simplifiedUserId.split(':');
            simplifiedUserId = simplifiedUserId[0];
            this.setState({credUser: simplifiedUserId});
        }
    }

     copyToClipboard(e) {
/* Get the text field */
  const copyText = document.getElementById("identityToken");
  if (this.props.os==="iOS") {
		const editable = copyText.contentEditable;
		const readOnly = copyText.readOnly;

		copyText.contentEditable = true;
		copyText.readOnly = false;

		const range = document.createRange();
		range.selectNodeContents(copyText);

		const selection = window.getSelection();
		selection.removeAllRanges();
		selection.addRange(range);

		copyText.setSelectionRange(0, 999999);
		copyText.contentEditable = editable;
		copyText.readOnly = readOnly;
	} else {
  copyText.select();
  }
  document.execCommand("copy");

  this.setState({copyButton: "Copié"});
  this.setState({buttonClassName: "wt_copied_button"});
  this.setState({copied: true});
  document.activeElement.blur();
  this.setState({installAppClass: "wt_active_step"});
  this.setState({copyTokenClass: "wt_inactive_step"});
  }

  getTitle() {
    if (this.props.firstConnection) {
        return "Votre mot de passe a bien été défini.";
    } else {
        return "Votre mot de passe est déjà défini.";
      }
  }


    render() {
      const title= this.getTitle();
      const instanceLink=this.getInstanceLink();
        return (
          <div className="wt_ContainerFallback">
            <div className="wt_BodyFallback">
              <div className="wt_logo_row">
                  <img src="themes/riot/img/logos/watcha-title.svg" width='300' alt="Watcha" className="wt_Logo" />
              </div>
              <h1 className="wt_mobile_title">Lancement de l'application Watcha</h1>
              <div className="wt_mobile_pw_state">{ title }</div>
              <div className="wt_connection_process" >
                <div className={"wt_copy_token "+this.state.copyTokenClass}>
                  <div className="wt_download_app">Avant de lancer l'application,</div>
                  <div className="wt_download_app">copiez le code d’identification&nbsp;:</div>
                    <div className="wt_token_box">
                      <textarea readOnly id='identityToken' className="wt_identity_token" className="wt_token_area" value={this.props.identityToken} />
                      <button className = {this.state.buttonClassName} onClick={this.copyToClipboard}>{ this.state.copyButton }</button>
                    </div>
                  </div>
                  <div className={"wt_install_app "+this.state.installAppClass}>
                    <div className="wt_download_app">Code Enregistré !</div>
                    <div className="wt_download_app">Téléchargez et ouvrez l'application,</div>
                    <div className="wt_download_app">puis&nbsp;renseignez votre mot&nbsp;de&nbsp;passe&nbsp;:</div>
                      { instanceLink }
                    </div>
                  </div>
                </div>
            </div>
        );
    }
}
