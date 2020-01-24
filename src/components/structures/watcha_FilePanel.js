import sdk from '../../index';
import MatrixClientPeg from '../../MatrixClientPeg';
import { _t } from '../../languageHandler';
import FilePanel from './FilePanel';

class WatchaFilePanel extends FilePanel {
    render() {
        if (MatrixClientPeg.get().isGuest()) {
            return <div className="mx_FilePanel mx_RoomView_messageListWrapper">
                <div className="mx_RoomView_empty">
                { _t("You must <a>register</a> to use this functionality",
                    {},
                    { 'a': (sub) => <a href="#/register" key="sub">{ sub }</a> })
                }
                </div>
            </div>;
        } else if (this.noRoom) {
            return <div className="mx_FilePanel mx_RoomView_messageListWrapper">
                <div className="mx_RoomView_empty">{ _t("You must join the room to see its files") }</div>
            </div>;
        }

        // wrap a TimelinePanel with the jump-to-event bits turned off.
        const TimelinePanel = sdk.getComponent("structures.watcha_TimelinePanel");
        const Loader = sdk.getComponent("elements.Spinner");

        if (this.state.timelineSet) {
            // console.log("rendering TimelinePanel for timelineSet " + this.state.timelineSet.room.roomId + " " +
            //             "(" + this.state.timelineSet._timelines.join(", ") + ")" + " with key " + this.props.roomId);
            return (
                <TimelinePanel key={"filepanel_" + this.props.roomId}
                    className="mx_FilePanel"
                    manageReadReceipts={false}
                    manageReadMarkers={false}
                    timelineSet={this.state.timelineSet}
                    showUrlPreview = {false}
                    tileShape="file_grid"
                    resizeNotifier={this.props.resizeNotifier}
                    empty={_t('There are no visible files in this room')}
                />
            );
        } else {
            return (
                <div className="mx_FilePanel">
                    <Loader />
                </div>
            );
        }
    }
}

export default WatchaFilePanel;
