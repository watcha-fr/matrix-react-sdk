'use strict';

var _languageHandler = require('../../../languageHandler');

/*
Copyright 2016 OpenMarket Ltd

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

var React = require('react');
var ReactDOM = require("react-dom");

var Matrix = require("matrix-js-sdk");
var sdk = require('../../../index');
var MatrixClientPeg = require("../../../MatrixClientPeg");
var dis = require("../../../dispatcher");

/*
 * Component which shows the global notification list using a TimelinePanel
 */
var NotificationPanel = React.createClass({
    displayName: 'NotificationPanel',

    propTypes: {},

    render: function render() {
        // wrap a TimelinePanel with the jump-to-event bits turned off.
        var TimelinePanel = sdk.getComponent("structures.TimelinePanel");
        var Loader = sdk.getComponent("elements.Spinner");

        var timelineSet = MatrixClientPeg.get().getNotifTimelineSet();
        if (timelineSet) {
            return React.createElement(TimelinePanel, { key: "NotificationPanel_" + this.props.roomId,
                className: 'mx_NotificationPanel',
                manageReadReceipts: false,
                manageReadMarkers: false,
                timelineSet: timelineSet,
                showUrlPreview: false,
                tileShape: 'notif',
                empty: (0, _languageHandler._t)('You have no visible notifications')
            });
        } else {
            console.error("No notifTimelineSet available!");
            return React.createElement(
                'div',
                { className: 'mx_NotificationPanel' },
                React.createElement(Loader, null)
            );
        }
    }
});

module.exports = NotificationPanel;
//# sourceMappingURL=NotificationPanel.js.map
