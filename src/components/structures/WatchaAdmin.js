import React from 'react';
import PropTypes from 'prop-types';
import { MatrixClient } from 'matrix-js-sdk';
import * as languageHandler from '../../languageHandler';
;


class WatchaAdmin extends React.Component {

    constructor(props) {
        super(props);
        this.openWatchaAdmin = this.openWatchaAdmin.bind(this);
        this.state = { isServerAdmin: false };
    }

    static contextTypes = {
        matrixClient: PropTypes.instanceOf(MatrixClient),
    }

    componentDidMount() {
        const self = this;
        this.context.matrixClient.isWatchaAdmin().then(function(res) {
            self.setState({ isServerAdmin: res.is_admin });
        }).catch((err) => {
            // not sure this is useful but just in case
            console.log("Error in isServerAdmin:");
            console.error(err);
            self.setState({ isServerAdmin: false });
        });
    }

    openWatchaAdmin(ev) {
        // the token will be retrieved in watcha-admin.git/src/App.js
        const key = Math.random().toString(36).substring(7);
        // SettingsStore.getValue("language") or counterpart.getLocale() always return 'en' !!
        const value = languageHandler.getCurrentLanguage() + '|' + this.context.matrixClient.getAccessToken();
        localStorage.setItem('watcha-' + key, value);
        window.open('/admin?key='+key, "_blank");
    }

    render() {
        console.log(this.state.isServerAdmin);
        console.log('**************************************************');
      if (!this.props.collapsed) {
        return this.state.isServerAdmin ? (
         <div className="mx_WatchaAdminContainer mx_BottomLeftMenu" >
         <div className=" mx_WatchaAdmin"
            data-original-position="30" data-original-height="25" data-stuck="none"
            onClick={ this.openWatchaAdmin }>
            <div className="mx_WatchaAdminText">
              Administration
              <div className="mx_RoomSubList_add">
                <div className="mx_RoleButton mx_AccessibleButton" aria-label="Open Watcha administration" role="button">
                  <img src={require("../../../res/img/watcha_admin.svg")} alt="admin" className="userBox_button" width="15" height="15" />
                </div>
              </div>
            </div>
         </div>
         </div>
        ):<div>TEST </div>
      }
      else{
        return(
          <div className="mx_BottomLeftMenu " aria-label="Open Watcha administration" role="button">
          <img src={require("../../../res/img/watcha_admin.svg")} alt="admin" className="userBox_button" width="25" height="25" />
        </div>

        )
      }
    }
}

export default WatchaAdmin;
