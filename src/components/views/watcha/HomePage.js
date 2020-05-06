/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd

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

'use strict';

import React from 'react';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import GeminiScrollbar from 'react-gemini-scrollbar';
import request from 'browser-request';
import { _t } from '../../../languageHandler';
import sanitizeHtml from 'sanitize-html';
import NotificationPanel from '../../structures/NotificationPanel';

const HomePage = createReactClass({
    displayName: 'HomePage',

    propTypes: {
        // URL base of the team server. Optional.
        teamServerUrl: PropTypes.string,
        // Team token. Optional. If set, used to get the static homepage of the team
        //      associated. If unset, homePageUrl will be used.
        teamToken: PropTypes.string,
        // URL to use as the iFrame src. Defaults to /home.html.
        homePageUrl: PropTypes.string,
    },

    getInitialState: function() {
        return {
            iframeSrc: '',
            page: '',
        };
    },

    translate: function(s) {
        s = sanitizeHtml(_t(s));
        // ugly fix for https://github.com/vector-im/riot-web/issues/4243
        s = s.replace(/Riot\.im/, '<a href="https://riot.im" target="_blank" rel="noopener">Riot.im</a>');
        s = s.replace(/\[matrix\]/, '<a href="https://matrix.org" target="_blank" rel="noopener"><img width="79" height="34" alt="[matrix]" style="padding-left: 1px;vertical-align: middle" src="home/images/matrix.svg"/></a>');
        return s;
    },

    componentWillMount: function() {
        this._unmounted = false;

        if (this.props.teamToken && this.props.teamServerUrl) {
            this.setState({
                iframeSrc: `${this.props.teamServerUrl}/static/${this.props.teamToken}/home.html`
            });
        }
        else {
            // we use request() to inline the homepage into the react component
            // so that it can inherit CSS and theming easily rather than mess around
            // with iframes and trying to synchronise document.stylesheets.

            /*let src = this.props.homePageUrl || 'home.html';

            request(
                { method: "GET", url: src },
                (err, response, body) => {
                    if (this._unmounted) {
                        return;
                    }

                    if (err || response.status < 200 || response.status >= 300) {
                        console.warn(`Error loading home page: ${err}`);
                        this.setState({ page: _t("Couldn't load home page") });
                        return;
                    }

                    body = body.replace(/_t\(['"]([\s\S]*?)['"]\)/mg, (match, g1)=>this.translate(g1));
                    this.setState({ page: body });
                }
            );*/
        }
    },

    componentWillUnmount: function() {
        this._unmounted = true;
    },

    render() {
		var _t = this.translate;
        if (this.state.iframeSrc) {
            return (
                <div className="mx_HomePage">
                    <iframe src={ this.state.iframeSrc } />
                </div>
            )
        }
        else {
            return (
                <div className="mx_HomePage">
					<div className="mx_HomePage_container">
                     <a target="_blank" href="https://www.watcha.fr" className="mx_Banner">
					    <div className="mx_HomePage_col mx_HomePage_header">

								<img src={require("../../../../res/img/watcha-notitle.svg")} className="mx_HomePage_logo" />

							<div>
								<h1>{_t("Welcome to Watcha")}</h1>
								<h2>{_t("Secure Digital Workplace")}</h2>
							</div>
						</div>
                        </a>
						<div className="mx_HomePage_notificationContainer">
                            <div>
							<h1 className="title">{_t("Notifications")}</h1>
                            </div>
							<NotificationPanel />
						</div>
					</div>
				</div>
			);
		}
	}
});

export default HomePage;