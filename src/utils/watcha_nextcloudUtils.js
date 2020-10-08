export function refineNextcloudIframe(
    iframeRef,
    cssLinkHref = "/app/watcha-nextcloud-integration/base.css"
) {
    const cssLink = document.createElement("link");
    cssLink.href = cssLinkHref;
    cssLink.rel = "stylesheet";
    cssLink.type = "text/css";
    const iframeDoc = iframeRef.current.contentDocument;
    iframeDoc.head.appendChild(cssLink);
    iframeDoc.getElementById("header").style.display = "none";
}
