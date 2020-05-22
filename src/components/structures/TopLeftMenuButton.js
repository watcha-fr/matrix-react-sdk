/*
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from 'react';
import PropTypes from 'prop-types';
import TopLeftMenu from '../views/context_menus/TopLeftMenu';
import BaseAvatar from '../views/avatars/BaseAvatar';
import {MatrixClientPeg} from '../../MatrixClientPeg';
import * as Avatar from '../../Avatar';
import { _t } from '../../languageHandler';
import dis from "../../dispatcher";
import {ContextMenu, ContextMenuButton} from "./ContextMenu";

/* insertion for watcha*/
import LogoutDialog from "../views/dialogs/LogoutDialog";
import Modal from "../../Modal";
/*end of insertion*/

const AVATAR_SIZE = 28;

export default class TopLeftMenuButton extends React.Component {
    static propTypes = {
        collapsed: PropTypes.bool.isRequired,
    };

    static displayName = 'TopLeftMenuButton';

    constructor() {
        super();
        this.state = {
            menuDisplayed: false,
            profileInfo: null,
        };
    }

    async _getProfileInfo() {
        const cli = MatrixClientPeg.get();
        const userId = cli.getUserId();
        const profileInfo = await cli.getProfileInfo(userId);
        const avatarUrl = Avatar.avatarUrlForUser(
            {avatarUrl: profileInfo.avatar_url},
            AVATAR_SIZE, AVATAR_SIZE, "crop");

        return {
            userId,
            name: profileInfo.displayname,
            avatarUrl,
        };
    }

    async componentDidMount() {
        this._dispatcherRef = dis.register(this.onAction);

        try {
            const profileInfo = await this._getProfileInfo();
            this.setState({profileInfo});
        } catch (ex) {
            console.log("could not fetch profile");
            console.error(ex);
        }
    }

    componentWillUnmount() {
        dis.unregister(this._dispatcherRef);
    }

    onAction = (payload) => {
        // For accessibility
        if (payload.action === "toggle_top_left_menu") {
            if (this._buttonRef) this._buttonRef.click();
        }
    };

    _getDisplayName() {
        if (MatrixClientPeg.get().isGuest()) {
            return _t("Guest");
        } else if (this.state.profileInfo) {
            return this.state.profileInfo.name;
        } else {
            return MatrixClientPeg.get().getUserId();
        }
    }

    // insertion for watcha
    openSettings() {
        dis.dispatch({ action: "view_user_settings" });
        this.closeMenu();
    }

    signOut() {
        Modal.createTrackedDialog("Logout E2E Export", "", LogoutDialog);
        this.closeMenu();
    }

    onUserBoxContainerClick(ev) {
        ev.stopPropagation();
        dis.dispatch({ action: "view_home_page" });
    }
    // end of insertion

    openMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.setState({ menuDisplayed: true });
    };

    closeMenu = () => {
        this.setState({
            menuDisplayed: false,
        });
    };

    render() {
        const cli = MatrixClientPeg.get().getUserId();

        const name = this._getDisplayName();
        /*insertion for watcha*/
        /* TODO: this is not clean (li's inside a div??) */
        const signInOutItem = <li className="mx_TopLeftMenu_icon_signout" onClick={this.signOut} tabIndex={0}>
            </li>;

        const settingsItem = <li className="mx_TopLeftMenu_icon_settings" onClick={this.openSettings} tabIndex={0}>
        </li>;
        /*end of insertion*/
        let nameElement;
        let chevronElement;
        if (!this.props.collapsed) {
            nameElement = <div className="mx_TopLeftMenuButton_name">
                { name }
            </div>;
            chevronElement = <span className="mx_TopLeftMenuButton_chevron" />;
        }

        let contextMenu;
        if (this.state.menuDisplayed) {
            const elementRect = this._buttonRef.getBoundingClientRect();

            contextMenu = (
                <ContextMenu
                    chevronFace="none"
                    left={elementRect.left}
                    top={elementRect.top + elementRect.height}
                    onFinished={this.closeMenu}
                >
                    <TopLeftMenu displayName={name} userId={cli} onFinished={this.closeMenu} />
                </ContextMenu>
            );
        }

        return <React.Fragment>
            <ContextMenuButton
                className="mx_TopLeftMenuButton"
                // change for watcha
                onClick={() => {}}
                inputRef={(r) => this._buttonRef = r}
                label={_t("Your profile")}
                isExpanded={this.state.menuDisplayed}
            >
                {/* insertion for watcha */}
                <span className="HomePageButton" onClick={this.onUserBoxContainerClick}>
                {/* end of insertion */}
                <BaseAvatar
                    idName={MatrixClientPeg.get().getUserId()}
                    name={name}
                    url={this.state.profileInfo && this.state.profileInfo.avatarUrl}
                    width={AVATAR_SIZE}
                    height={AVATAR_SIZE}
                    resizeMethod="crop"
                />
                { nameElement }
                {/* deletion for watcha  
                { chevronElement }
                */}
                {/* insertion for watcha */}
                </span>
                <div className="TopLeftMenuButonsContainer">
                    {settingsItem}
                    {signInOutItem}
                </div>
                {/* end of insertion */}
            </ContextMenuButton>

            { contextMenu }
        </React.Fragment>;
    }
}
