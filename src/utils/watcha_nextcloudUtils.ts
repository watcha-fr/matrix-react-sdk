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

export function getDocumentSelectorUrl(shareUrl: string, skipDirParam = true) {
    return getDocumentWidgetUrl(shareUrl, [RefineTargets.DocumentSelector], skipDirParam);
}

export function getDocumentWidgetUrl(shareUrl: string, refineTargets: RefineTargets[] = [], skipDirParam = true) {
    let path = "/";
    let fileId = null;
    if (shareUrl) {
        const url = new URL(shareUrl);
        path = url.searchParams.get("dir");
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
        if (key == "dir" && skipDirParam && searchParams.get("fileid")) {
            continue;
        }
        url.searchParams.append(key, value);
    }
    for (const target of refineTargets) {
        url.searchParams.append(target, "");
    }
    return url.toString();
}
