import Matrix from "matrix-js-sdk";
const EventTimeline = Matrix.EventTimeline;

import sdk from "../../index";
import SettingsStore from "../../settings/SettingsStore";
import TimelinePanel from "./TimelinePanel";
import { _t } from "../../languageHandler";

import FileExplorer from "./watcha_FileExplorer";

const PAGINATE_SIZE = 1000;

const DEBUG = false;

let debuglog = function() {};
if (DEBUG) {
    // using bind means that we get to keep useful line numbers in the console
    debuglog = console.log.bind(console);
}

class WatchaTimelinePanel extends TimelinePanel {
    constructor(props) {
        super(props);
        this.state = { isLoading: true };
    }

    componentWillMount() {
        super.componentWillMount();
        // Cache hidden events setting on mount since Settings is expensive to
        // query, and we check this in a hot code path.
        this._showHiddenEventsInTimeline = SettingsStore.getValue(
            "showHiddenEventsInTimeline"
        );
    }

    componentDidMount() {
        this.fill();
    }

    fill() {
        if (this.unmounted) {
            return;
        }
        this.onMessageListFillRequest(true).then(hasMoreResults => {
            if (hasMoreResults) {
                this.fill();
            } else {
                this.setState({ isLoading: false });
            }
        });
    }

    // set off a pagination request.
    onMessageListFillRequest = (backwards) => {
        if (!this._shouldPaginate()) return Promise.resolve(false);

        const dir = backwards ? EventTimeline.BACKWARDS : EventTimeline.FORWARDS;
        const canPaginateKey = backwards ? 'canBackPaginate' : 'canForwardPaginate';
        const paginatingKey = backwards ? 'backPaginating' : 'forwardPaginating';

        if (!this.state[canPaginateKey]) {
            debuglog("TimelinePanel: have given up", dir, "paginating this timeline");
            return Promise.resolve(false);
        }

        if (!this._timelineWindow.canPaginate(dir)) {
            debuglog("TimelinePanel: can't", dir, "paginate any further");
            this.setState({[canPaginateKey]: false});
            return Promise.resolve(false);
        }

        debuglog("TimelinePanel: Initiating paginate; backwards:"+backwards);
        this.setState({[paginatingKey]: true});

        return this._timelineWindow.paginate(dir, PAGINATE_SIZE).then((r) => {
            if (this.unmounted) { return; }

            debuglog("TimelinePanel: paginate complete backwards:"+backwards+"; success:"+r);

            const { events, liveEvents } = this._getEvents();
            const newState = {
                [paginatingKey]: false,
                [canPaginateKey]: r,
                events,
                liveEvents,
            };

            // moving the window in this direction may mean that we can now
            // paginate in the other where we previously could not.
            const otherDirection = backwards ? EventTimeline.FORWARDS : EventTimeline.BACKWARDS;
            const canPaginateOtherWayKey = backwards ? 'canForwardPaginate' : 'canBackPaginate';
            if (!this.state[canPaginateOtherWayKey] &&
                    this._timelineWindow.canPaginate(otherDirection)) {
                debuglog('TimelinePanel: can now', otherDirection, 'paginate again');
                newState[canPaginateOtherWayKey] = true;
            }

            // Don't resolve until the setState has completed: we need to let
            // the component update before we consider the pagination completed,
            // otherwise we'll end up paginating in all the history the js-sdk
            // has in memory because we never gave the component a chance to scroll
            // itself into the right place
            return new Promise((resolve) => {
                this.setState(newState, () => {
                    resolve(r);
                });
            });
        });
    }

    onRoomTimeline = (ev, room, toStartOfTimeline, removed, data) => {
        // ignore events for other timeline sets
        if (data.timeline.getTimelineSet() !== this.props.timelineSet) return;

        // ignore anything but real-time updates at the end of the room:
        // updates from pagination will happen when the paginate completes.
        if (toStartOfTimeline || !data || !data.liveEvent) return;

        // tell the timeline window to try to advance itself, but not to make
        // an http request to do so.
        this._timelineWindow.paginate(EventTimeline.FORWARDS, 1, false)
    }

    render() {
        const Loader = sdk.getComponent("elements.Spinner");

        if (this.state.isLoading) {
            return (
                <div className="mx_RoomView_messagePanelSpinner">
                    <Loader />
                </div>
            );
        }

        if (
            this.state.events.length == 0 &&
            !this.state.canBackPaginate &&
            this.props.empty
        ) {
            return (
                <div
                    className={
                        this.props.className + " mx_RoomView_messageListWrapper"
                    }
                >
                    <div className="mx_RoomView_empty">{this.props.empty}</div>
                </div>
            );
        }

        return (
            <FileExplorer
                events={this.state.events}
                showTwelveHour={this.state.isTwelveHour}
            />
        );
    }
}

export default WatchaTimelinePanel;
