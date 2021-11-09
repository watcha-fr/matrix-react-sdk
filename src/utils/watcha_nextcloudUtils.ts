import { getNextcloudWellKnown } from "./WellKnownUtils";
import SdkConfig from "../SdkConfig";

export const CALENDAR_EVENT_TYPE = "watcha.room.nextcloud_calendar";

export enum StateKeys {
    VEVENT_VTODO = "VEVENT_VTODO",
    VEVENT = "VEVENT",
    VTODO = "VTODO",
}

export function getNextcloudBaseUrl(): string {
    const nextcloudBaseUrl: string =
        SdkConfig.get().watcha_nextcloud_base_url ||
        getNextcloudWellKnown()?.base_url ||
        window.location.origin + "/nextcloud";
    return nextcloudBaseUrl.endsWith("/") ? nextcloudBaseUrl : nextcloudBaseUrl + "/";
}

export function refineNextcloudIframe(iframe: HTMLIFrameElement, cssLinkHref: string): void {
    const cssLink = document.createElement("link");
    cssLink.href = cssLinkHref;
    cssLink.rel = "stylesheet";
    cssLink.type = "text/css";
    const iframeDoc = iframe.contentDocument;
    iframeDoc.head.appendChild(cssLink);
}
