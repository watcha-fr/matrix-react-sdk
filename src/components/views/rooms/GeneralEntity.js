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

/*

General entity displayer whitch is a "user like" display
with an image this.props.imgUrl
img should be stored in riot-web/src/skins/vector/img i.e imgUrl=img/name.png
at left and a text at right this.props.text
on hover diplay a text this.props.subText
if on hover should be silent add this.props.supresonHover={true}
onClick get the this.props.click
if this.props.presenceState=offline will return a greyed element

*/

'use strict';

var React = require('react');
import PropTypes from 'prop-types';

var MatrixClientPeg = require('../../../MatrixClientPeg');
var sdk = require('../../../index');
import AccessibleButton from '../elements/AccessibleButton';
import { _t } from '../../../languageHandler';

var Avatar = require('../../../Avatar');
var PRESENCE_CLASS = {
    "offline": "mx_EntityTile_offline",
    "online": "mx_EntityTile_online",
    "unavailable": "mx_EntityTile_unavailable",
    "member":"mx_EntityTile_member",
    "room":"mx_EntityTile_room",
    "mail":"mx_EntityTile_mail",
    "invite":"mx_EntityTile_invite",
    "partner":"mx_EntityTile_partner",
    "userBox":"mx_EntityTile_userBox",
};


function presenceClassForMember(presenceState, lastActiveAgo) {
    // offline is split into two categories depending on whether we have
    // a last_active_ago for them.

    if (presenceState == 'offline') {
        if (lastActiveAgo) {
            return PRESENCE_CLASS['offline'] + '_beenactive';
        } else {
            return "";
        }

    }

    else if (presenceState) {
        return PRESENCE_CLASS[presenceState];
    } else {
        return "";
    }
}

module.exports = React.createClass({
    displayName: 'GeneralEntity',

    propTypes: {
        name: PropTypes.string,
        title: PropTypes.string,
        avatarJsx: PropTypes.any, // <BaseAvatar />
        className: PropTypes.string,
        presenceState: PropTypes.string,
        presenceLastActiveAgo: PropTypes.number,
        presenceLastTs: PropTypes.number,
        presenceCurrentlyActive: PropTypes.bool,
        showInviteButton: PropTypes.bool,
        shouldComponentUpdate: PropTypes.func,
        onClick: PropTypes.func,
        suppressOnHover: PropTypes.bool

    },

    getDefaultProps: function() { //if some props are not defined by the caller of EntityTile
        return {
            shouldComponentUpdate: function(nextProps, nextState) { return true; },
            onClick: function() {},
            presenceState: "offline",
            presenceLastActiveAgo: 0,
            presenceLastTs: 0,
            showInviteButton: false,
            suppressOnHover: false
        };
    },

    getInitialState: function() {
        return {
            hover: false
        };
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        if (this.state.hover !== nextState.hover) return true;
        return this.props.shouldComponentUpdate(nextProps, nextState);
    },

    mouseEnter: function(e) { // when the mouse is over the element
        this.setState({ 'hover': true });
    },

    mouseLeave: function(e) { // when the mouse leve the event
        this.setState({ 'hover': false });
    },

    _getInitialLetter: function(name) {
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
        return firstChar.toUpperCase();},

    defaultAvatarUrlForString: function(s) {
        const images = ['76cfa6', '50e2c2', 'f4c371'];
        let total = 0;
        for (let i = 0; i < s.length; ++i) {
            total += s.charCodeAt(i);
        }
        return require('../../../../res/img/' + images[total % images.length] + '.png');
    },



    render: function() {
        const presenceClass = presenceClassForMember(this.props.presenceState, this.props.presenceLastActiveAgo);
        var mainClassName = "mx_EntityTile mx_EntityTile_common ";
        mainClassName += presenceClass + (this.props.className ? (" " + this.props.className) : ""); // make a composed className based on the classname of the caller
        var nameEl;
        const { name } = this.props;

        var text = this.props.text;
        var subText = this.props.subText;

        if (text === subText) { // the main text is a userId. we do not display the suffix part (*:SERVER-core.watcha.fr).
            const spl = text.split(":");
            text = spl.slice(0, spl.length-1).join(":"); // uses the property that ":" is not allowed in domain names
            text = text.substring(1);
        }

        if (this.props.presenceState === "partner") {
            const spl = subText.split(":");
            subText = spl.slice(0, spl.length-1).join(":");

            // if text is a email-like userId, not a custom pseudonym, change it to look like an email
            if ("@" + text === subText) {
                text = text.replace("/", "@");
            }

            // make the subtext look like an email: remove the leading @ if present
            subText = subText.replace("/", "@");
            if (subText[0] === "@") {
                subText = subText.substring(1);
            }
        }

        mainClassName += " mx_EntityTile_hover"; // add the marker hover for the css
        var PresenceLabel = sdk.getComponent("rooms.PresenceLabel");
        nameEl = (
            <div className="mx_GeneralEntity_details">
                <div className="mx_EntityTile_name_hover">
                    { text }
                </div>
                <div className="mx_PresenceLabel_invite">
                    { subText }
                </div>
            </div>
        );

        var inviteButton;
        if (this.props.showInviteButton) { // if caller defined an inviteButton
            inviteButton = (
                <div className="mx_EntityTile_invite">
                    <img src="img/plus.svg" width="16" height="16" />
                </div>
            );
        }

        var av;
        var imgUrl;
        var defaultAvatar = false;

        if (this.props.imgUrl) {
            imgUrl = this.props.imgUrl;
        } else if (this.props.direcLink) {
            imgUrl = Avatar.avatarUrlForMember(this.props.direcLink, this.props.width, this.props.height, null, null, true)
        } else {
            var initialLetter = this._getInitialLetter(this.props.text);
            imgUrl = this.defaultAvatarUrlForString(initialLetter);
            defaultAvatar = true;
        }

        // add the props imgUrl if we wish to use a direct url instead of using avatarUrlForMember in the component

        if (defaultAvatar) {
            av = <span className="mx_BaseAvatar" >
                <div className="mx_BaseAvatar_initial" aria-hidden="true"
                    style={{ fontSize: (this.props.width * 0.65) + "px",
                            width: this.props.width + "px",
                    lineHeight: this.props.height + "px" }}>
                    {initialLetter}
                </div>
                <img className="mx_BaseAvatar_image" src={imgUrl}
                    alt="" title={this.props.name}
                    width={this.props.width} height={this.props.height} />
            </span>

        } else {
            av = <img className="mx_BaseAvatar_image" src={imgUrl}
                onError={this.onError}
                width={this.props.width} height={this.props.height}
                title={this.props.imgTitle} alt=""
                onClick={this.props.onAvatarClicked} />
        }
        if (!this.props.collapsed) {
            return (
                <AccessibleButton className={mainClassName} title={ this.props.title }
                    onClick={ this.props.onClick } onMouseEnter={ this.mouseEnter }
                    onMouseLeave={ this.mouseLeave }>
                    <div className="mx_EntityTile_avatar">
                        { av }
                    </div>
                    { nameEl }
                    { inviteButton }
                    <img src={ this.props.icon } className="generalIcon" width='20' height='20'/>
                </AccessibleButton>
            );
        }

        return (
            <div className="mx_EntityTile_avatar">
                { av }
            </div>
        )
    }
});
