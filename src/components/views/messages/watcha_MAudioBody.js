import MAudioBody from "./MAudioBody";
import { _t } from "../../../languageHandler";

class watcha_MAudioBody extends MAudioBody {
    render() {
        const content = this.props.mxEvent.getContent();

        if (this.state.error !== null) {
            return (
                <span className="mx_MAudioBody" ref="body">
                    <img
                        src={require("../../../../res/img/warning.svg")}
                        width="16"
                        height="16"
                    />
                    {_t("Error decrypting audio")}
                </span>
            );
        }

        if (content.file !== undefined && this.state.decryptedUrl === null) {
            // Need to decrypt the attachment
            // The attachment is decrypted in componentDidMount.
            // For now add an img tag with a 16x16 spinner.
            // Not sure how tall the audio player is so not sure how tall it should actually be.
            return (
                <span className="mx_MAudioBody">
                    <img
                        src={require("../../../../res/img/spinner.gif")}
                        alt={content.body}
                        width="16"
                        height="16"
                    />
                </span>
            );
        }

        const contentUrl = this._getContentUrl();

        return (
            <span className="mx_MAudioBody">
                <audio src={contentUrl} controls />
            </span>
        );
    }
}

export default watcha_MAudioBody;
