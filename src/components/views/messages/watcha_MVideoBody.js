import MVideoBody from "./MVideoBody";
import SettingsStore from "../../../settings/SettingsStore";
import { _t } from "../../../languageHandler";

class watcha_MVideoBody extends MVideoBody {
    render() {
        const content = this.props.mxEvent.getContent();

        if (this.state.error !== null) {
            return (
                <span className="mx_MVideoBody" ref="body">
                    <img
                        src={require("../../../../res/img/warning.svg")}
                        width="16"
                        height="16"
                    />
                    {_t("Error decrypting video")}
                </span>
            );
        }

        if (content.file !== undefined && this.state.decryptedUrl === null) {
            // Need to decrypt the attachment
            // The attachment is decrypted in componentDidMount.
            // For now add an img tag with a spinner.
            return (
                <span className="mx_MVideoBody" ref="body">
                    <div
                        className="mx_MImageBody_thumbnail mx_MImageBody_thumbnail_spinner"
                        ref="image"
                    >
                        <img
                            src={require("../../../../res/img/spinner.gif")}
                            alt={content.body}
                            width="16"
                            height="16"
                        />
                    </div>
                </span>
            );
        }

        const contentUrl = this._getContentUrl();
        const thumbUrl = this._getThumbUrl();
        const autoplay = SettingsStore.getValue("autoplayGifsAndVideos");
        let height = null;
        let width = null;
        let poster = null;
        let preload = "metadata";
        if (content.info) {
            const scale = this.thumbScale(
                content.info.w,
                content.info.h,
                480,
                360
            );
            if (scale) {
                width = Math.floor(content.info.w * scale);
                height = Math.floor(content.info.h * scale);
            }

            if (thumbUrl) {
                poster = thumbUrl;
                preload = "none";
            }
        }
        return (
            <span className="mx_MVideoBody">
                <video
                    className="mx_MVideoBody"
                    src={contentUrl}
                    alt={content.body}
                    controls
                    preload={preload}
                    muted={autoplay}
                    autoPlay={autoplay}
                    height={height}
                    width={width}
                    poster={poster}
                ></video>
            </span>
        );
    }
}

export default watcha_MVideoBody;
