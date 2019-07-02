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
import {AutoDiscovery} from "matrix-js-sdk";
import {_t, _td, newTranslatableError} from "../languageHandler";
import {makeType} from "./TypeUtils";
import SdkConfig from "../SdkConfig";

const LIVELINESS_DISCOVERY_ERRORS = [
    AutoDiscovery.ERROR_INVALID_HOMESERVER,
    AutoDiscovery.ERROR_INVALID_IDENTITY_SERVER,
];

export class ValidatedServerConfig {
    hsUrl: string;
    hsName: string;
    hsNameIsDifferent: string;

    isUrl: string;
    identityEnabled: boolean;

    isDefault: boolean;
}

export default class AutoDiscoveryUtils {
    /**
     * Checks if a given error or error message is considered an error
     * relating to the liveliness of the server. Must be an error returned
     * from this AutoDiscoveryUtils class.
     * @param {string|Error} error The error to check
     * @returns {boolean} True if the error is a liveliness error.
     */
    static isLivelinessError(error: string|Error): boolean {
        if (!error) return false;
        return !!LIVELINESS_DISCOVERY_ERRORS.find(e => e === error || e === error.message);
    }

    /**
     * Gets the common state for auth components (login, registration, forgot
     * password) for a given validation error.
     * @param {Error} err The error encountered.
     * @param {string} pageName The page for which the error should be customized to. See
     * implementation for known values.
     * @returns {*} The state for the component, given the error.
     */
    static authComponentStateForError(err: Error, pageName="login"): Object {
        let title = _t("Cannot reach homeserver");
        let body = _t("Ensure you have a stable internet connection, or get in touch with the server admin");
        if (!AutoDiscoveryUtils.isLivelinessError(err)) {
            title = _t("Your Riot is misconfigured");
            body = _t(
                "Ask your Riot admin to check <a>your config</a> for incorrect or duplicate entries.",
                {}, {
                    a: (sub) => {
                        return <a
                            href="https://github.com/vector-im/riot-web#configjson"
                            target="_blank"
                            rel="noopener"
                        >{sub}</a>;
                    },
                },
            );
        }

        let isFatalError = true;
        const errorMessage = err.message ? err.message : err;
        /*
        if (errorMessage === AutoDiscovery.ERROR_INVALID_IDENTITY_SERVER) {
            isFatalError = false;
            title = _t("Cannot reach identity server");

            // It's annoying having a ladder for the third word in the same sentence, but our translations
            // don't make this easy to avoid.
            if (pageName === "register") {
                body = _t(
                    "You can register, but some features will be unavailable until the identity server is " +
                    "back online. If you keep seeing this warning, check your configuration or contact a server " +
                    "admin.",
                );
            } else if (pageName === "reset_password") {
                body = _t(
                    "You can reset your password, but some features will be unavailable until the identity " +
                    "server is back online. If you keep seeing this warning, check your configuration or contact " +
                    "a server admin.",
                );
            } else {
                body = _t(
                    "You can log in, but some features will be unavailable until the identity server is " +
                    "back online. If you keep seeing this warning, check your configuration or contact a server " +
                    "admin.",
                );
            }
        }
        */

        return {
            serverIsAlive: false,
            serverErrorIsFatal: isFatalError,
            serverDeadError: (
                <div>
                    <strong>{title}</strong>
                    <div>{body}</div>
                </div>
            ),
        };
    }

    /**
     * Validates a server configuration, using a pair of URLs as input.
     * @param {string} homeserverUrl The homeserver URL.
     * @param {string} identityUrl The identity server URL.
     * @param {boolean} syntaxOnly If true, errors relating to liveliness of the servers will
     * not be raised.
     * @returns {Promise<ValidatedServerConfig>} Resolves to the validated configuration.
     */
    static async validateServerConfigWithStaticUrls(
        homeserverUrl: string, identityUrl: string, syntaxOnly = false): ValidatedServerConfig {
        if (!homeserverUrl) {
            throw newTranslatableError(_td("No homeserver URL provided"));
        }

        const wellknownConfig = {
            "m.homeserver": {
                base_url: homeserverUrl,
            },
            "m.identity_server": {
                base_url: identityUrl,
            },
        };

        const result = await AutoDiscovery.fromDiscoveryConfig(wellknownConfig);

        const url = new URL(homeserverUrl);
        const serverName = url.hostname;

        return AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, result, syntaxOnly);
    }

    /**
     * Validates a server configuration, using a homeserver domain name as input.
     * @param {string} serverName The homeserver domain name (eg: "matrix.org") to validate.
     * @param {boolean} syntaxOnly If true, errors relating to liveliness of the servers will
     * not be raised.
     * @returns {Promise<ValidatedServerConfig>} Resolves to the validated configuration.
     */
    static async validateServerName(serverName: string, syntaxOnly=false): ValidatedServerConfig {
        const result = await AutoDiscovery.findClientConfig(serverName);
        return AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, result);
    }

    /**
     * Validates a server configuration, using a pre-calculated AutoDiscovery result as
     * input.
     * @param {string} serverName The domain name the AutoDiscovery result is for.
     * @param {*} discoveryResult The AutoDiscovery result.
     * @param {boolean} syntaxOnly If true, errors relating to liveliness of the servers will
     * not be raised.
     * @returns {Promise<ValidatedServerConfig>} Resolves to the validated configuration.
     */
    static buildValidatedConfigFromDiscovery(
        serverName: string, discoveryResult, syntaxOnly=false): ValidatedServerConfig {
        if (!discoveryResult || !discoveryResult["m.homeserver"]) {
            // This shouldn't happen without major misconfiguration, so we'll log a bit of information
            // in the log so we can find this bit of codee but otherwise tell teh user "it broke".
            console.error("Ended up in a state of not knowing which homeserver to connect to.");
            throw newTranslatableError(_td("Unexpected error resolving homeserver configuration"));
        }

        const hsResult = discoveryResult['m.homeserver'];
        const isResult = discoveryResult['m.identity_server'];

        // Validate the identity server first because an invalid identity server causes
        // and invalid homeserver, which may not be picked up correctly.

        // Note: In the cases where we rely on this pre-populated "https://vector.im" (namely
        // lack of identity server provided by the discovery method), we intentionally do not
        // validate it. We already know the IS is an IS, and this helps some off-the-grid usage
        // of Riot.
        let preferredIdentityUrl = "https://vector.im";
        if (isResult && isResult.state === AutoDiscovery.SUCCESS) {
            preferredIdentityUrl = isResult["base_url"];
        } else if (isResult && isResult.state !== AutoDiscovery.PROMPT) {
            console.error("Error determining preferred identity server URL:", isResult);
            if (!syntaxOnly || !AutoDiscoveryUtils.isLivelinessError(isResult.error)) {
                if (AutoDiscovery.ALL_ERRORS.indexOf(isResult.error) !== -1) {
                    throw newTranslatableError(isResult.error);
                }
                throw newTranslatableError(_td("Unexpected error resolving identity server configuration"));
            } // else the error is not related to syntax - continue anyways.

            // rewrite homeserver error if we don't care about problems
            if (syntaxOnly) {
                hsResult.error = AutoDiscovery.ERROR_INVALID_IDENTITY_SERVER;

                // Also use the user's supplied identity server if provided
                if (isResult["base_url"]) preferredIdentityUrl = isResult["base_url"];
            }
        }

        if (hsResult.state !== AutoDiscovery.SUCCESS) {
            console.error("Error processing homeserver config:", hsResult);
            if (!syntaxOnly || !AutoDiscoveryUtils.isLivelinessError(hsResult.error)) {
                if (AutoDiscovery.ALL_ERRORS.indexOf(hsResult.error) !== -1) {
                    throw newTranslatableError(hsResult.error);
                }
                throw newTranslatableError(_td("Unexpected error resolving homeserver configuration"));
            } // else the error is not related to syntax - continue anyways.
        }

        const preferredHomeserverUrl = hsResult["base_url"];
        let preferredHomeserverName = serverName ? serverName : hsResult["server_name"];

        const url = new URL(preferredHomeserverUrl);
        if (!preferredHomeserverName) preferredHomeserverName = url.hostname;

        // It should have been set by now, so check it
        if (!preferredHomeserverName) {
            console.error("Failed to parse homeserver name from homeserver URL");
            throw newTranslatableError(_td("Unexpected error resolving homeserver configuration"));
        }

        return makeType(ValidatedServerConfig, {
            hsUrl: preferredHomeserverUrl,
            hsName: preferredHomeserverName,
            hsNameIsDifferent: url.hostname !== preferredHomeserverName,
            isUrl: preferredIdentityUrl,
            identityEnabled: !SdkConfig.get()['disable_identity_server'],
            isDefault: false,
        });
    }
}
