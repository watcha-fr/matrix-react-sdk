/*
Copyright 2017 New Vector Ltd
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
import sdk from '../../../index';
import ScalarAuthClient from '../../../ScalarAuthClient';
import { _t } from '../../../languageHandler';
import { showIntegrationsManager } from '../../../integrations/integrations';

export default class ManageIntegsButton extends React.Component {
    constructor(props) {
        super(props);
    }

    onManageIntegrations = (ev) => {
        ev.preventDefault();

        showIntegrationsManager({ room: this.props.room });
    };

    render() {
        let integrationsButton = <div />;
        if (ScalarAuthClient.isPossible()) {
            const AccessibleButton = sdk.getComponent("elements.AccessibleButton");
            integrationsButton = (
                <AccessibleButton
                    className='mx_RoomHeader_button mx_RoomHeader_manageIntegsButton'
                    title={_t("Manage Integrations")}
                    onClick={this.onManageIntegrations}
                />
            );
        }

        return integrationsButton;
    }
}

ManageIntegsButton.propTypes = {
    room: PropTypes.object.isRequired,
};
