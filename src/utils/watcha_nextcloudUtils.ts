import { getNextcloudWellKnown } from "./WellKnownUtils";
import SdkConfig from "../SdkConfig";

export function getNextcloudBaseUrl(): string {
    const nextcloudBaseUrl: string =
        SdkConfig.get().watcha_nextcloud_base_url ||
        getNextcloudWellKnown()?.base_url ||
        window.location.origin + "/nextcloud";
    return nextcloudBaseUrl.endsWith("/") ? nextcloudBaseUrl : nextcloudBaseUrl + "/";
}

export function refineNextcloudIframe(iframeRef, cssLinkHref = "/app/watcha_nextcloud/base.css"): void {
    const cssLink = document.createElement("link");
    cssLink.href = cssLinkHref;
    cssLink.rel = "stylesheet";
    cssLink.type = "text/css";
    const iframeDoc = iframeRef.current.contentDocument;
    iframeDoc.head.appendChild(cssLink);
    iframeDoc.getElementById("header").style.display = "none";
}
