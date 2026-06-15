/*
Copyright 2022 Watcha

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

import React, { useEffect, useState } from "react";
import classNames from "classnames";

import { _t } from "../../languageHandler";
import { UIFeature } from "../../settings/UIFeature";
import { useSettingValue } from "../../hooks/useSettings";
import BaseCard from "../views/right_panel/BaseCard";
import AccessibleButton from "../views/elements/AccessibleButton";
import defaultDispatcher from "../../dispatcher/dispatcher";
import SettingsStore from "../../settings/SettingsStore";
import Spinner from "../views/elements/Spinner";
import {
    getDocumentWidgetUrl,
    getNextcloudBaseUrl,
    isNextcloudSessionWarm,
    warmUpNextcloudSession,
    WIDGET_READY_MESSAGE,
} from "../../utils/watcha_nextcloudUtils";

// Delay after which, if the embedded widget hasn't signalled readiness, we assume
// the in-iframe SSO redirect was blocked (LNA over VPN) and offer a manual warm-up.
const WIDGET_READY_TIMEOUT_MS = 7000;

export default ({ roomId, initialTabId, empty, emptyClass, onClose }) => {
    // Reactive Nextcloud warm-up:
    // We load the iframe directly. The connector posts WIDGET_READY_MESSAGE once the
    // Nextcloud page has loaded inside the iframe. If that signal arrives (the common
    // case: off-VPN, or session already warm), no popup is ever shown. If it does NOT
    // arrive within WIDGET_READY_TIMEOUT_MS (in-iframe SSO blocked by LNA on VPN), we
    // surface a button that runs a top-level warm-up popup on user click.
    const [iframeReady, setIframeReady] = useState(false);
    const [showWarmupButton, setShowWarmupButton] = useState(false);
    const [warmingUp, setWarmingUp] = useState(false);
    const [reloadNonce, setReloadNonce] = useState(0);
    const nextcloudShare = useSettingValue("nextcloudShare", roomId);

    useEffect(() => {
        if (!nextcloudShare) {
            return;
        }
        setIframeReady(false);
        setShowWarmupButton(false);

        const expectedOrigin = getNextcloudBaseUrl().origin;
        let timer;
        const onMessage = event => {
            if (event.origin === expectedOrigin && event.data === WIDGET_READY_MESSAGE) {
                clearTimeout(timer);
                setIframeReady(true);
                setShowWarmupButton(false);
            }
        };
        window.addEventListener("message", onMessage);
        // Once the session has been warmed up in this tab, the iframe loads with the
        // Nextcloud cookie and the in-iframe SSO is no longer blocked, so we never need
        // to surface the button again on reopen (avoids re-prompting VPN users who
        // already warmed up). The flag is cleared when the tab is closed.
        if (!isNextcloudSessionWarm()) {
            timer = setTimeout(() => setShowWarmupButton(true), WIDGET_READY_TIMEOUT_MS);
        }

        return () => {
            window.removeEventListener("message", onMessage);
            clearTimeout(timer);
        };
    }, [nextcloudShare, reloadNonce]);

    const onWarmupClick = async () => {
        setShowWarmupButton(false);
        setWarmingUp(true);
        await warmUpNextcloudSession();
        setWarmingUp(false);
        // Reload the iframe so it retries with the now-warm Nextcloud session.
        setReloadNonce(n => n + 1);
    };

    const onRoomSettingsClick = () => {
        const payload = {
            action: "open_room_settings",
            initial_tab_id: initialTabId,
        };
        defaultDispatcher.dispatch(payload);
    };

    let panel;
    if (SettingsStore.getValue(UIFeature.watcha_Nextcloud)) {
        if (nextcloudShare && warmingUp) {
            panel = <Spinner />;
        } else if (nextcloudShare && showWarmupButton) {
            // The widget never signalled readiness (in-iframe SSO blocked on VPN):
            // offer a manual, user-triggered top-level warm-up.
            panel = (
                <div className="mx_RoomView_messagePanel mx_RoomView_messageListWrapper">
                    <div className="mx_RoomView_empty">
                        <div className={classNames("mx_RightPanel_empty", emptyClass)}>
                            <h2>{ _t("watcha|document_sharing") }</h2>
                            <p>{ _t("watcha|enable_document_access_prompt") }</p>
                            <AccessibleButton kind="primary" onClick={onWarmupClick}>
                                { _t("watcha|enable_document_access") }
                            </AccessibleButton>
                        </div>
                    </div>
                </div>
            );
        } else if (nextcloudShare) {
            panel = (
                <>
                    { !iframeReady && <Spinner /> }
                    <iframe
                        key={reloadNonce}
                        id="watcha_NextcloudPanel"
                        className={classNames("watcha_NextcloudPanel", {
                            "watcha_NextcloudPanel-hidden": !iframeReady,
                        })}
                        src={getDocumentWidgetUrl(nextcloudShare)}
                        title={_t("watcha|document_sharing")}
                    />
                </>
            );
        } else {
            let hint;
            if (SettingsStore.canSetValue("nextcloudShare", roomId, "room")) {
                hint = _t(
                    "You can share a resource from room <span>settings </span>",
                    {},
                    {
                        span: sub => (
                            <span className="watcha_NextcloudPanel_settingsIcon-noWrap" onClick={onRoomSettingsClick}>
                                { sub }
                            </span>
                        ),
                    },
                );
            }
            panel = (
                <div className="mx_RoomView_messagePanel mx_RoomView_messageListWrapper">
                    <div className="mx_RoomView_empty">
                        <div className={classNames("mx_RightPanel_empty", emptyClass)}>
                            <h2>{ empty }</h2>
                            <p>{ hint }</p>
                        </div>
                    </div>
                </div>
            );
        }
    }
    return (
        <BaseCard
            className="mx_FilePanel"
            withoutScrollContainer
            {...{ onClose }}
        >
            { panel }
        </BaseCard>
    );
};
