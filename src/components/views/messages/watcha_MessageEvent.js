import MessageEvent from "./MessageEvent";
import sdk from "../../../index";
import { _t } from "../../../languageHandler";

class watcha_MImageBody extends MessageEvent {
    render() {
        const UnknownBody = sdk.getComponent("messages.UnknownBody");

        const bodyTypes = {
            "m.text": sdk.getComponent("messages.TextualBody"),
            "m.notice": sdk.getComponent("messages.TextualBody"),
            "m.emote": sdk.getComponent("messages.TextualBody"),
            "m.image": sdk.getComponent("messages.watcha_MImageBody"),
            "m.file": sdk.getComponent("messages.MFileBody"),
            "m.audio": sdk.getComponent("messages.watcha_MAudioBody"),
            "m.video": sdk.getComponent("messages.watcha_MVideoBody")
        };
        const evTypes = {
            "m.sticker": sdk.getComponent("messages.MStickerBody")
        };

        const content = this.props.mxEvent.getContent();
        const type = this.props.mxEvent.getType();
        const msgtype = content.msgtype;
        let BodyType = UnknownBody;
        if (!this.props.mxEvent.isRedacted()) {
            // only resolve BodyType if event is not redacted
            if (type && evTypes[type]) {
                BodyType = evTypes[type];
            } else if (msgtype && bodyTypes[msgtype]) {
                BodyType = bodyTypes[msgtype];
            } else if (content.url) {
                // Fallback to MFileBody if there's a content URL
                BodyType = bodyTypes["m.file"];
            }
        }

        return (
            <BodyType
                ref="body"
                mxEvent={this.props.mxEvent}
                highlights={this.props.highlights}
                highlightLink={this.props.highlightLink}
                showUrlPreview={this.props.showUrlPreview}
                tileShape={this.props.tileShape}
                maxImageHeight={this.props.maxImageHeight}
                replacingEventId={this.props.replacingEventId}
                editState={this.props.editState}
                onHeightChanged={this.props.onHeightChanged}
            />
        );
    }
}

export default watcha_MImageBody;
