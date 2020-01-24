import MImageBody from "./MImageBody";
import SettingsStore from "../../../settings/SettingsStore";
import { _t } from '../../../languageHandler';

class watcha_MImageBody extends MImageBody {
    render() {
        const content = this.props.mxEvent.getContent();

        if (this.state.error !== null) {
            return (
                <span className="mx_MImageBody" ref="body">
                    <img
                        src={require("../../../../res/img/warning.svg")}
                        width="16"
                        height="16"
                    />
                    {_t("Error decrypting image")}
                </span>
            );
        }

        const contentUrl = this._getContentUrl();
        let thumbUrl;
        if (this._isGif() && SettingsStore.getValue("autoplayGifsAndVideos")) {
            thumbUrl = contentUrl;
        } else {
            thumbUrl = this._getThumbUrl();
        }

        const thumbnail = this._messageContent(contentUrl, thumbUrl, content);

        return (
            <span className="mx_MImageBody" ref="body">
                {thumbnail}
            </span>
        );
    }
}

export default watcha_MImageBody;
