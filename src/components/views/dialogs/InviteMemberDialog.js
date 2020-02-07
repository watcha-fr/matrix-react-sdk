/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd

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
import GeminiScrollbar from 'react-gemini-scrollbar';
import React from 'react';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import { _t } from '../../../languageHandler';
import sdk from '../../../index';
import MatrixClientPeg from '../../../MatrixClientPeg';
import AccessibleButton from '../elements/AccessibleButton';
import GeneralEntity from '../rooms/GeneralEntity';
import Promise from 'bluebird';
import { addressTypes, getAddressType } from '../../../UserAddress.js';
import ReactDOM from 'react-dom';
//import Velocity from 'velocity-vector';
//import 'velocity-vector/velocity.ui';

const TRUNCATE_QUERY_LIST = 40;
const QUERY_USER_DIRECTORY_DEBOUNCE_MS = 200;
const AVATAR_SIZE = 36;
const CALLOUT_ANIM_DURATION = 1000;

module.exports = createReactClass({
    displayName: "InviteMemberDialog",

    propTypes: {
        title: PropTypes.string.isRequired,
        description: PropTypes.node,
        value: PropTypes.string,
        placeholder: PropTypes.string,
        roomId: PropTypes.string,
        button: PropTypes.string,
        focus: PropTypes.bool,
        validAddressTypes: PropTypes.arrayOf(PropTypes.oneOf(addressTypes)),
        onFinished: PropTypes.func.isRequired,
    },

    getDefaultProps() {
        return {
            value: "",
            focus: true,
            validAddressTypes: addressTypes,
        };
    },

    getInitialState() {
        return {
            error: false,

            // List of UserAddressType objects representing
            // the list of addresses we're going to invite
            userList: [],
            //List of people that will be invited
            inviteList: [],

            // List of UserAddressType objects representing
            // the set of auto-completion results for the current search
            // query.
            queryList: [],
            roomList:[],

            // Whether a search is ongoing
            busy: false,
            // An error message generated during the user directory search
            searchError: null,
            // Whether the server supports the user_directory API
            serverSupportsUserDirectory: true,
            // The query being searched for
            searchQuery: "",
        };
    },

    componentDidMount() {
        if (this.props.focus) {
            // Set the cursor at the end of the text input
            this.refs.textinput.value = this.props.value;
            this._doUserDirectorySearch();

        }
    },

    sortNamesList(list) {
        var self = this;
        list.sort(function(a, b) {
            var nameA = self._getInitialLetter(a.address.toLowerCase()),
                nameB = self._getInitialLetter(b.address.toLowerCase());
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1
            return 0; //default return value (no sorting)
        });
    },

    componentWillUpdate(nextProps, nextState) {
        this.sortNamesList(nextState.userList);
        this.sortNamesList(nextState.queryList);
        this.sortNamesList(nextState.roomList);
        this.sortNamesList(nextState.inviteList);
    },

    componentDidUpdate(){
        //Velocity(this.refs.addMailButton, "callout.bounce", CALLOUT_ANIM_DURATION);
        },

    onButtonClick() {
        if (this.state.inviteList.length>0) {
        this.props.onFinished(true, this.state.inviteList.slice());
        }
    },

    onCancel() {
        this.props.onFinished(false);
    },

    onQueryChanged(ev) {
        this.setState({email: false});
        this.setState({ searchQuery: ev.target.value, email: this.isEmail(ev.target.value) })
    },

    onDismissed(index) {
        return () => {
            const userList = this.state.userList.slice();
            userList.splice(index, 1);
            this.setState({
                userList: userList,
                queryList: [],
                query: "",
            });
            if (this._cancelThreepidLookup) this._cancelThreepidLookup();
        };
    },

    _doUserDirectorySearch() {
        this.setState({
            busy: true,
            searchError: null,
        });
        MatrixClientPeg.get().searchUserDirectory({
            term: '',
            limit: Number.MAX_SAFE_INTEGER, // get all results at once - will filter locally
        }).then((resp) => {
            this._processResults(resp.results);
        }).catch((err) => {
            console.error('Error whilst searching user directory: ', err);
            this.setState({
                searchError: err.errcode ? err.message : _t('Something went wrong!'),
            });
            if (err.errcode === 'M_UNRECOGNIZED') {
                this.setState({ serverSupportsUserDirectory: false });
                // Do a local search immediately
                this._doLocalSearch(query);
            }
        }).done(() => {
            this.setState({ busy: false });
        });
    },

    _doLocalSearch(query) {
        this.setState({
            query,
            searchError: null,
        });
        const queryLowercase = query.toLowerCase();
        const results = [];
        MatrixClientPeg.get().getUsers().forEach((user) => {
            if (user.user_id.toLowerCase().indexOf(queryLowercase) === -1 &&
                user.displayName.toLowerCase().indexOf(queryLowercase) === -1) {
                return;
            }

            // Put results in the format of the new API
            results.push({
                user_id: user.user_id,
                display_name: user.displayName,
                avatar_url: user.avatarUrl,
            });
        });
        this._processResults(results, query);
    },

    RoomMemberDisplay() {
        if (this.state.roomList) {
            var RoomMemberList = [];
            RoomMemberList = this.state.roomList.map(
                function(member) {
                    return <GeneralEntity
                        key={member.address}
                        text={member.displayName}
                        presenceState={"room"}
                        subText={member.address}
                        directLink= {member.avatarMxc}
                        width={AVATAR_SIZE}
                        height={AVATAR_SIZE} />
                }
            );
            return RoomMemberList;
        }
    },

    _processResults(results) {
        var queryList = [];
        var roomList = [];
        var cli = MatrixClientPeg.get();
        var room = cli.getRoom(this.props.roomId);

        var membersList = [];
        if (this.props.roomId) {
            membersList = room.getJoinedMembers();
        }

        results.forEach((user) => {

            // Return objects, structure of which is defined
            // by UserAddressType
            if (user.user_id != MatrixClientPeg.get().credentials.userId) { // remove the actual user from the list of users

                var online = user.presence === "online";
                var display = user.display_name || user.user_id;
                var isPartner = user.is_partner === 1;

                (this.isMemberInRoom(membersList, user.user_id) ? roomList : queryList).push({
                    addressType: 'mx',
                    address: user.user_id,
                    displayName: display,
                    avatarMxc: user.avatar_url,
                    isKnown: true,
                    online: online,
                    isPartner: isPartner,
                });

            }

        });

        this.setState({ userList: queryList, roomList:roomList });

        // If the query is a valid address, add an entry for that
        // This is important, otherwise there's no way to invite
        // a perfectly valid address if there are close matches.
        const addrType = getAddressType();
        if (this.props.validAddressTypes.includes(addrType)) {
            queryList.unshift({
                addressType: addrType,
                isKnown: false,
            });
            if (this._cancelThreepidLookup) this._cancelThreepidLookup();
            if (addrType == 'email') {
                this._lookupThreepid(addrType, query).done();
            }
        }
        this.setState({
            queryList,
            error: false,
        }, () => {
            if (this.addressSelector) this.addressSelector.moveSelectionTop();
        });
    },

    // filter so only the members who are not in the room will appear in the memberlist
    isMemberInRoom(membersList, roomMember) {
        var isInRoom = false;
        membersList.forEach((user) => {
            if (user.userId === roomMember) {
                isInRoom = true;
            }
        });
        return isInRoom;
    },

    _addInputToList() {
        const addressText = this.refs.textinput.value.trim();
        const addrType = getAddressType(addressText);
        const addrObj = {
            addressType: addrType,
            address: addressText,
            isKnown: false,
        };
        if (addrType == null) {
            this.setState({ error: true });
            return null;
        } else if (addrType == 'mx') {
            const user = MatrixClientPeg.get().getUser(addrObj.address);
            if (user) {
                addrObj.displayName = user.displayName;
                addrObj.avatarMxc = user.avatarUrl;
                addrObj.isKnown = true;
            }
        }

        const userList = this.state.userList.slice();
        userList.push(addrObj);
        this.setState({
            userList: userList,
            queryList: [],
            query: "",
        });
        if (this._cancelThreepidLookup) this._cancelThreepidLookup();
        return userList;
    },

    addtoInviteList(userId) {
        var memberList = this.state.userList;
        var inviteList=this.state.inviteList;
        var user = userId;
        for (let i = 0; i < memberList.length; i++) {
            if (memberList[i] === user) {
                memberList.splice(i, 1);
                inviteList.push(user);
            }
        }
        this.setState({ userList: memberList, inviteList: inviteList });
    },

    removeFromInviteList: function(userId) {
        var memberList = this.state.userList;
        var inviteList = this.state.inviteList;
        for (let i = 0; i < inviteList.length; i++) {
            if (inviteList[i] === userId) {
                inviteList.splice(i, 1);
                memberList.push(userId);
            }
        }
        this.setState({ userList: memberList, inviteList: inviteList });
    },

    _lookupThreepid(medium, address) {
        let cancelled = false;
        // Note that we can't safely remove this after we're done
        // because we don't know that it's the same one, so we just
        // leave it: it's replacing the old one each time so it's
        // not like they leak.
        this._cancelThreepidLookup = function() {
            cancelled = true;
        };

        // wait a bit to let the user finish typing
        return Promise.delay(500).then(() => {
            if (cancelled) return null;
            return MatrixClientPeg.get().lookupThreePid(medium, address);
        }).then((res) => {
            if (res === null || !res.mxid) return null;
            if (cancelled) return null;

            return MatrixClientPeg.get().getProfileInfo(res.mxid);
        }).then((res) => {
            if (res === null) return null;
            if (cancelled) return null;
            this.setState({
                queryList: [{
                    addressType: medium,
                    address: address,
                    displayName: res.display_name,
                    avatarMxc: res.avatar_url,
                    isKnown: true,
                }],
            });
        });
    },

    isProbablyEmail(query) {
        return query.length >= 3 && query.indexOf("@") > 0;
    },

    isEmail(query) {
        return query.match(/^([\w.%+-]+)@([\w-]+\.)+([\w]{2,})$/i);
    },

    convertEmailToUserId(email) {
        // follows the spec defined at https://github.com/watcha-fr/devops/blob/master/doc_email_userId.md
        // on the server watcha.bar.com (as per mx_hs_url var) :
        //      - converts foo@bar.com to @foo:watcha.bar.com
        //      - converts foo@gmail.com to @foo/gmail.com:watcha.bar.com

        var emailSplit = email.split("@");
        if (emailSplit.length == 0) return null;
        if (emailSplit.length == 1) return "@" + emailSplit[0];

        var host = emailSplit[1];
        var locServer = window.localStorage && window.localStorage.getItem("mx_hs_url");
        if (locServer.indexOf("//")) { // remove http:// or https:// at the beginning of the server name
            locServer = locServer.slice(locServer.indexOf("//") + 2);
        }
        if (locServer.indexOf(":")) { // remove port number at the end of the server name, mostly useful for dev environments
            locServer = locServer.slice(0, locServer.indexOf(":"));
        }
        // possibly also check that there are no final "/" in locServer?

        // now we determine if the email belongs to somebody of the company
        if (locServer.indexOf(host) >= 0) { // we have the email of somebody on the company.
            return "@" + emailSplit[0]; // + ":" + locServer;
        } else { // we have the email of an external partner
            return "@" + emailSplit[0] + "/" + host; // + ":" + locServer;
        }
    },

    filter(query) {
        var filteredList = [];
        var MemberTile = sdk.getComponent("rooms.MemberTile");
        query = (query || "").toLowerCase();
        var self = this;
        var isQueryAnEmail = this.isProbablyEmail(query);
        if (isQueryAnEmail) {
            var queryEmailConvertedToUserId = self.convertEmailToUserId(query);
        }

        var memberList = self.state.userList.filter(function (user) {
            if (query) {
                var matchesName = user.displayName.toLowerCase().indexOf(query) !== -1;
                var matchesId = user.address.toLowerCase().indexOf(query) !== -1;
                var matchesIdThroughEmail = isQueryAnEmail && user.address.toLowerCase().indexOf(queryEmailConvertedToUserId) !== -1;
                return matchesName || matchesId || matchesIdThroughEmail;
            } else {
                return true;
            }
        }).map(function (user) {
            filteredList.push(user);
            var commonParams = self.getGeneralEntityDefaultConfig(user, require('../../../../res/img/inviteicon.svg'));
            return React.createElement(GeneralEntity, Object.assign(commonParams, {
                presenceState: user.isPartner ? 'partner' : 'member',
                onClick:(e) => self.addtoInviteList(user),
            }));
        });

        if (this.isEmail(query) && memberList.length == 0) {

            // check that the query is not related to users already invited or already in the room
            var alreadyInInvitations = self.state.inviteList.filter(function (user) {
                return user.address.toLowerCase().indexOf(queryEmailConvertedToUserId) !== -1;
            }).length > 0;

            var alreadyInMembers = this.props.roomId &&
                MatrixClientPeg.get().getRoom(this.props.roomId).getJoinedMembers().filter(function (user) {
                    return user.userId.toLowerCase().indexOf(queryEmailConvertedToUserId) !== -1;
                }).length > 0;

            if (alreadyInInvitations || alreadyInMembers) {
                console.log("alreadyInInvitations=" + alreadyInInvitations + " alreadyInMembers=" + alreadyInMembers);
                return memberList;
            } else {
                return <span> </span>
            }

        } else {
            return memberList;
        }
    },

    addMailtoInviteList() {
        var email = { address: this.state.searchQuery };
        var liste = this.state.inviteList; // should we add .slice() ?
        liste.push(email);
        this.setState({ inviteList: liste, searchQuery: "", email: false });
    },

    removeMailFromInviteListe(mail){
        var memberList = this.state.userList;
        var inviteList=this.state.inviteList
        var mail = mail
        for (let i = 0; i < inviteList.length; i++) {
            if(inviteList[i]===mail)
            {inviteList.splice(i,1)
            }
        }
        this.setState({ userList: memberList, inviteList: inviteList });
    },

    _getInitialLetter(name) {
        if (name.length < 1) {
            return undefined;
        }

        var idx = 0;
        var initial = name[0];
        if ((initial === '@' || initial === '#') && name[1]) {
            idx++;
        }

        // string.codePointAt(0) would do this, but that isn't supported by
        // some browsers (notably PhantomJS).
        var chars = 1;
        var first = name.charCodeAt(idx);

        // check if it’s the start of a surrogate pair
        if (first >= 0xD800 && first <= 0xDBFF && name[idx+1]) {
            var second = name.charCodeAt(idx+1);
            if (second >= 0xDC00 && second <= 0xDFFF) {
                chars++;
            }
        }

        var firstChar = name.substring(idx, idx+chars);
        return firstChar.toUpperCase();
    },

    getGeneralEntityDefaultConfig(user, icon) {
        return {
            key: user.address,
            text: user.displayName,
            subText: user.address,
            direcLink: user.avatarMxc,
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            icon: icon,
        }
    },

    makeInviteList() {
        var liste = [];
        var self = this;
        var MemberTile = sdk.getComponent("rooms.MemberTile");
        if (this.state.inviteList.length > 0) {

            for (let i = 0; i < this.state.inviteList.length; i++) {

                if (this.state.inviteList[i].isKnown) {
                    var commonParams = this.getGeneralEntityDefaultConfig(this.state.inviteList[i], require("../../../../res/img/removeinvite.svg"));
                    var display = React.createElement(GeneralEntity, Object.assign(commonParams, {
                        presenceState: this.state.inviteList[i].isPartner ? 'partner' : 'member',
                        onClick: (e) => this.removeFromInviteList(this.state.inviteList[i])
                    }));
                    liste.push(display);

                } else {
                    var mail = this.state.inviteList[i]
                    liste.push(React.createElement(GeneralEntity, {
                        key: mail.address,
                        text: mail.address,
                        presenceState :"partner",
                        subText: _t("An invitation will be sent to this email"),
                        imgUrl: require("../../../../res/img/watcha_mail.png"),
                        onClick: (e) => this.removeMailFromInviteListe(mail),
                        width: AVATAR_SIZE,
                        height: AVATAR_SIZE,
                        icon:require("../../../../res/img/removeinvite.svg")
                    }));
                }
            }
        }
        return liste;
    },

    render() {
        const TintableSvg = sdk.getComponent("elements.TintableSvg");
        const AddressSelector = sdk.getComponent("elements.AddressSelector");
        var MemberTile = sdk.getComponent("rooms.MemberTile");
        var titleRoom
        this.scrollElement = null;
        var roomMembers = [];
        var memberList = [];
        var inviteList = [];
        var hintInvite;
        var hintMember;
        var addMailButton;
        // create the invite list

        const AddressTile = sdk.getComponent("elements.AddressTile");
        inviteList = this.makeInviteList(inviteList)
        memberList = this.filter(this.state.searchQuery)
        roomMembers = this.RoomMemberDisplay();
        let buttonClassName = "button_invite"

        if (this.state.email) {
            addMailButton = <img src={require("../../../../res/img/plus.svg")}
            alt="plusimg"
            className='invite_add_button' width={25}
            height={25} onClick={this.addMailtoInviteList}
            ref='addMailButton' />;

        }

        if (inviteList.length == 0) {
            buttonClassName="button_invite_disable";
            hintInvite = (
                <div className="mx_MemberDialog_hint">
                    <div className="mx_MemberDialog_hint_text">
                        {_t("No one yet")}
                    </div>
                </div>
            );
        }
        if (memberList.length == 0 && this.state.searchQuery) {
            hintMember = (
                <div className="mx_MemberDialog_hint">
                    <div className="mx_MemberDialog_hint_text">
                        {_t("No matching user. Continue with a complete email address to send an invitation.")}
                    </div>
                </div>
            );
        } else if (memberList.length == 0) {
            hintMember = (
                <div className="mx_MemberDialog_hint">
                    <div className="mx_MemberDialog_hint_text">
                        {_t("No users to add. Type a complete email address to send an invitation.")}
                    </div>
                </div>
            );
        }
        if (roomMembers.length > 0) {
            titleRoom = (
                <div className="mx_MemberDialog_header">
                    {_t("Users already in room")}
                </div>
            );
        }

        let error;
        let addressSelector;

        //console.log(memberList);
        return (
            <div className="mx_ChatInviteDialog">

                <div className="mx_Dialog_title_invite">
                    {this.props.title}
                </div>

                <AccessibleButton className="mx_ChatInviteDialog_cancel"
                    onClick={this.onCancel} >
                    <TintableSvg src={require("../../../../res/img/icons-close-button.svg")} width="35" height="35" />
                </AccessibleButton>

                <div className="mx_ChatInviteDialog_label">
                    <label htmlFor="textinput">{ this.props.description }</label>
                </div>
                <div className="queryContainer">
                    <div className="mx_ChatInviteDialog_query">
                        <input key={this.state.userList.length}
                            rows="1"
                            id="textinput"
                            ref="textinput"
                            className="mx_ChatInviteDialog_input"
                            onChange={this.onQueryChanged}
                            value={this.state.searchQuery}
                            placeholder={this.props.placeholder}
                            autoFocus={this.props.focus}>
                        </input>
                    </div>
                    { addMailButton }
                </div>
                <div className="list">
                    <div className="memberList">
                        <div className="mx_MemberDialog_header">{_t("Directory")}</div>
                        <GeminiScrollbar forceGemini={true} className="mx_ChatInviteDialog_inputContainer_users">
                            <div className="mx_EntityTile_listpadding"></div>
                            { memberList }
                            { hintMember }
                            <div className="mx_EntityTile_listpadding"></div>
                        </GeminiScrollbar>
                    </div>
                    <div className="inviteList">
                        <div className="mx_MemberDialog_header">{_t("Users to be invited")}</div>
                        <GeminiScrollbar forceGemini={true} className="mx_ChatInviteDialog_inputContainer_invite">
                            <div className="mx_EntityTile_listpadding"></div>
                            { inviteList }
                            { hintInvite }
                            { titleRoom }
                            { roomMembers }
                            <div className="mx_EntityTile_listpadding"></div>
                        </GeminiScrollbar>
                    </div>
                </div>

                <div className="mx_Dialog_buttons_invite">
                    <div className={buttonClassName} onClick={this.onButtonClick}>
                        { this.props.button }
                    </div>
                </div>

            </div>

        );
    },
});
