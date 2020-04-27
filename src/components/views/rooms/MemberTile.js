/*
Copyright 2015, 2016 OpenMarket Ltd

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

import SettingsStore from "../../../settings/SettingsStore";

import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';

const sdk = require('../../../index');
const dis = require('../../../dispatcher');
import { _t } from '../../../languageHandler';

// insertion for watcha
import MatrixClientPeg from '../../../MatrixClientPeg'
// end of insertion

module.exports = createReactClass({
    displayName: 'MemberTile',

    propTypes: {
        member: PropTypes.any.isRequired, // RoomMember
        showPresence: PropTypes.bool,
    },

    getDefaultProps: function() {
        return {
            showPresence: true,
        };
    },

    getInitialState: function() {
        return {
            statusMessage: this.getStatusMessage(),
            // insertion for watcha
            email: undefined
            // end of insertion
        };
    },

    componentDidMount() {
        // insertion for watcha
        MatrixClientPeg.get()
            .getProfileInfo(this.props.member.userId)
            .then(({ email }) => email && this.setState({ email }));
        // end of insertion
        if (!SettingsStore.isFeatureEnabled("feature_custom_status")) {
            return;
        }
        const { user } = this.props.member;
        if (!user) {
            return;
        }
        user.on("User._unstable_statusMessage", this._onStatusMessageCommitted);
    },

    componentWillUnmount() {
        const { user } = this.props.member;
        if (!user) {
            return;
        }
        user.removeListener(
            "User._unstable_statusMessage",
            this._onStatusMessageCommitted,
        );
    },

    getStatusMessage() {
        const { user } = this.props.member;
        if (!user) {
            return "";
        }
        return user._unstable_statusMessage;
    },

    _onStatusMessageCommitted() {
        // The `User` object has observed a status message change.
        this.setState({
            statusMessage: this.getStatusMessage(),
        });
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        // insertion for watcha
        if (nextState.email !== this.state.email) {
            return true;
        }
        // end of insertion
        if (
            this.member_last_modified_time === undefined ||
            this.member_last_modified_time < nextProps.member.getLastModifiedTime()
        ) {
            return true;
        }
        if (
            nextProps.member.user &&
            (this.user_last_modified_time === undefined ||
            this.user_last_modified_time < nextProps.member.user.getLastModifiedTime())
        ) {
            return true;
        }
        return false;
    },

    onClick: function(e) {
        dis.dispatch({
            action: 'view_user',
            member: this.props.member,
        });
    },

    _getDisplayName: function() {
        /*return this.props.member.name;*/ /*deletion for watcha OP277 */
        /*insertion for watcha OP277 */
        let user = this.props.member;
        let name = user.name
        if(user.isDisambiguate){
            name = name.replace(user.userId, this.state.email)
        }
        return name;
        /* end of insertion */
        /* return this.props.member.name; */ /*deletion for watcha OP277 */
    },

    getPowerLabel: function() {
        return _t("%(userName)s (power %(powerLevelNumber)s)", {
            userName: this.props.member.userId,
            powerLevelNumber: this.props.member.powerLevel,
        });
    },

    render: function() {
        const MemberAvatar = sdk.getComponent('avatars.MemberAvatar');
        const EntityTile = sdk.getComponent('rooms.EntityTile');

        const member = this.props.member;
        const name = this._getDisplayName();
        const presenceState = member.user ? member.user.presence : null;

        let statusMessage = null;
        if (member.user && SettingsStore.isFeatureEnabled("feature_custom_status")) {
            statusMessage = this.state.statusMessage;
        }

        const av = (
            // change for watcha
            <MemberAvatar member={member} title={this.state.email} width={36} height={36}/>
            // end of change
        );

        if (member.user) {
            this.user_last_modified_time = member.user.getLastModifiedTime();
        }
        this.member_last_modified_time = member.getLastModifiedTime();

        const powerStatusMap = new Map([
            [100, EntityTile.POWER_STATUS_ADMIN],
            [50, EntityTile.POWER_STATUS_MODERATOR],
        ]);

        // Find the nearest power level with a badge
        let powerLevel = this.props.member.powerLevel;
        for (const [pl] of powerStatusMap) {
            if (this.props.member.powerLevel >= pl) {
                powerLevel = pl;
                break;
            }
        }

        const powerStatus = powerStatusMap.get(powerLevel);

        return (
            <EntityTile {...this.props} presenceState={presenceState}
                presenceLastActiveAgo={member.user ? member.user.lastActiveAgo : 0}
                presenceLastTs={member.user ? member.user.lastPresenceTs : 0}
                presenceCurrentlyActive={member.user ? member.user.currentlyActive : false}
                // change for watcha
                avatarJsx={av} title={this.state.email || member.userId} onClick={this.onClick}
                // end of change
                name={name} powerStatus={powerStatus} showPresence={this.props.showPresence}
                subtextLabel={statusMessage}
            />
        );
    },
});
