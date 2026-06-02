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

import { getNextcloudWellKnown } from "./WellKnownUtils";
import SdkConfig from "../SdkConfig";

export const CALENDAR_EVENT_TYPE = "watcha.room.nextcloud_calendar";

export enum StateKeys {
    VEVENT_VTODO = "VEVENT_VTODO",
    VEVENT = "VEVENT",
    VTODO = "VTODO",
}

export enum AppNames {
    Files = "files",
    Calendar = "calendar",
    Tasks = "tasks",
}

export enum RefineTargets {
    Widget = "watcha_widget",
    DocumentSelector = "watcha_doc-selector",
}

export function getNextcloudBaseUrl() {
    const url = new URL(
        SdkConfig.get().watcha_nextcloud_base_url ||
            getNextcloudWellKnown()?.base_url ||
            window.location.origin + "/nextcloud",
    );
    if (!url.pathname.endsWith("/")) {
        url.pathname += "/";
    }
    return url;
}

// Nextcloud SSO session warm-up.
//
// When Element is reached over a "public" address but the Nextcloud SSO chain
// (Nextcloud -> Keycloak -> CAS) ends on a host resolved to a private/local IP
// (typically over VPN), the browser's Local Network Access / Private Network
// Access protection blocks the SSO redirect performed *from within the iframe*.
// A top-level browsing context is NOT subject to this restriction, so we run
// the SSO flow once in a popup to establish the Nextcloud session cookie; the
// embedded iframe then loads Nextcloud directly without re-triggering the
// blocked redirect.
const WARMUP_PARAM = "watcha_warmup";
const WARMUP_MESSAGE = "watcha_warmup-ok";
const WARMUP_TIMEOUT_MS = 20000;
// Persisted in sessionStorage so the warm-up popup runs at most once per browser
// tab session (and not again on every reload, since the Nextcloud session cookie
// survives reloads). Cleared automatically when the tab is closed.
const WARMUP_FLAG = "watcha_nc_session_warm";

export function isNextcloudSessionWarm(): boolean {
    try {
        return sessionStorage.getItem(WARMUP_FLAG) === "1";
    } catch (e) {
        return false;
    }
}

export function getWarmupUrl(): string {
    const url = getNextcloudBaseUrl();
    url.pathname += `apps/${AppNames.Files}`;
    url.searchParams.append(WARMUP_PARAM, "");
    return url.toString();
}

/**
 * Open a top-level popup that walks the Nextcloud SSO chain to establish the
 * session cookie. Resolves to true once the connector signals completion,
 * false if the popup was blocked, closed manually, or timed out.
 *
 * Must be called from a user gesture (e.g. a click) to avoid being blocked by
 * the browser's popup blocker.
 */
export function warmUpNextcloudSession(): Promise<boolean> {
    return new Promise<boolean>(resolve => {
        const popup = window.open(getWarmupUrl(), "watcha_nc_warmup", "width=520,height=640");
        if (!popup) {
            // Popup blocked: the caller should offer a manual, user-triggered warm-up.
            resolve(false);
            return;
        }

        const expectedOrigin = getNextcloudBaseUrl().origin;
        let settled = false;

        const finish = (success: boolean): void => {
            if (settled) {
                return;
            }
            settled = true;
            window.removeEventListener("message", onMessage);
            clearInterval(pollClosed);
            clearTimeout(timeout);
            try {
                popup.close();
            } catch (e) {
                // Cross-origin while still on the IdP: closing may throw, ignore.
            }
            if (success) {
                try {
                    sessionStorage.setItem(WARMUP_FLAG, "1");
                } catch (e) {
                    // sessionStorage unavailable: warm-up will simply re-run next open.
                }
            }
            resolve(success);
        };

        const onMessage = (event: MessageEvent): void => {
            if (event.origin === expectedOrigin && event.data === WARMUP_MESSAGE) {
                finish(true);
            }
        };
        window.addEventListener("message", onMessage);

        // If the user closes the popup manually we stop waiting (failure).
        const pollClosed = setInterval(() => {
            if (popup.closed) {
                finish(false);
            }
        }, 500);

        const timeout = setTimeout(() => finish(false), WARMUP_TIMEOUT_MS);
    });
}

export function getDocumentSelectorUrl(shareUrl: string, skipDirParam = true) {
    return getDocumentWidgetUrl(shareUrl, [RefineTargets.DocumentSelector], skipDirParam);
}

export function getDocumentWidgetUrl(shareUrl: string, refineTargets: RefineTargets[] = [], skipDirParam = true) {
    let path = "/";
    let fileId = null;
    if (shareUrl) {
        const url = new URL(shareUrl);
        path = url.searchParams.get("dir")!;
        fileId = url.searchParams.get("fileid");
    }
    const appName = AppNames.Files;
    const searchParams = new Map([["dir", path]]);
    if (fileId) {
        searchParams.set("fileid", fileId);
    }
    return getWidgetUrl(appName, searchParams, refineTargets, skipDirParam);
}

export function getWidgetUrl(
    appName: AppNames,
    searchParams = new Map<string, string>(),
    refineTargets: RefineTargets[] = [],
    skipDirParam = false,
) {
    refineTargets = [RefineTargets.Widget, ...refineTargets];
    return getIframeUrl(appName, searchParams, refineTargets, skipDirParam);
}

function getIframeUrl(
    appName: AppNames,
    searchParams = new Map<string, string>(),
    refineTargets: RefineTargets[] = [],
    skipDirParam = false,
) {
    const url = getNextcloudBaseUrl();
    url.pathname += `apps/${appName}`;
    for (const [key, value] of searchParams.entries()) {
        /* watcha!
        if (key == "dir" && skipDirParam && searchParams.get("fileid")) {
            continue;
        } !watcha */
        url.searchParams.append(key, value);
    }
    for (const target of refineTargets) {
        url.searchParams.append(target, "");
    }
    return url.toString();
}
