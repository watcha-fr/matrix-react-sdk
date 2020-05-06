/*
Copyright 2019 New Vector Ltd

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
import ReactDOM from 'react-dom';
import ReactTestUtils from 'react-dom/test-utils';
import sdk from '../../../skinned-sdk';
import SdkConfig from '../../../../src/SdkConfig';
import {mkServerConfig} from "../../../test-utils";

const Login = sdk.getComponent(
    'structures.auth.Login',
);

describe('Login', function() {
    let parentDiv;

    beforeEach(function() {
        parentDiv = document.createElement('div');
        document.body.appendChild(parentDiv);
    });

    afterEach(function() {
        ReactDOM.unmountComponentAtNode(parentDiv);
        parentDiv.remove();
    });

    function render() {
        return ReactDOM.render(<Login
            serverConfig={mkServerConfig("https://matrix.org", "https://vector.im")}
            onLoggedIn={() => {}}
            onRegisterClick={() => {}}
            onServerConfigChange={() => {}}
        />, parentDiv);
    }

    it('should show form with change server link', function() {
        const root = render();

        // Set non-empty flows & matrixClient to get past the loading spinner
        root.setState({
            currentFlow: "m.login.password",
        });

        const form = ReactTestUtils.findRenderedComponentWithType(
            root,
            sdk.getComponent('auth.PasswordLogin'),
        );
        expect(form).toBeTruthy();

        const changeServerLink = ReactTestUtils.findRenderedDOMComponentWithClass(
            root,
            'mx_AuthBody_editServerDetails',
        );
        expect(changeServerLink).toBeTruthy();
    });

    it('should show form without change server link when custom URLs disabled', function() {
        jest.spyOn(SdkConfig, "get").mockReturnValue({
            disable_custom_urls: true,
        });

        const root = render();

        // Set non-empty flows & matrixClient to get past the loading spinner
        root.setState({
            currentFlow: "m.login.password",
        });

        const form = ReactTestUtils.findRenderedComponentWithType(
            root,
            sdk.getComponent('auth.PasswordLogin'),
        );
        expect(form).toBeTruthy();

        const changeServerLinks = ReactTestUtils.scryRenderedDOMComponentsWithClass(
            root,
            'mx_AuthBody_editServerDetails',
        );
        expect(changeServerLinks).toHaveLength(0);
    });
});
