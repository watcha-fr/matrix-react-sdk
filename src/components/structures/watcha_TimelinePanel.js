/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

/*

This file is entirely copied from ./TimelinePanel.js by watcha
with some adaptations. Should be cleaned up later :)

*/

import Matrix from "matrix-js-sdk";
const EventTimeline = Matrix.EventTimeline;

import MatrixClientPeg from "../../MatrixClientPeg";
import sdk from "../../index";
import SettingsStore from "../../settings/SettingsStore";
import TimelinePanel from "./TimelinePanel";
import { _t } from "../../languageHandler";

import FileExplorer from "./watcha_FileExplorer";

const PAGINATE_SIZE = 1000;
const INITIAL_SIZE = 1000;

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

    _loadTimeline = (eventId, pixelOffset, offsetBase) => {
        this._timelineWindow = new Matrix.TimelineWindow(
            MatrixClientPeg.get(), this.props.timelineSet,
            {windowLimit: this.props.timelineCap});

        const onLoaded = () => {
            // clear the timeline min-height when
            // (re)loading the timeline
            if (this.refs.messagePanel) {
                this.refs.messagePanel.onTimelineReset();
            }
            this._reloadEvents();

            // If we switched away from the room while there were pending
            // outgoing events, the read-marker will be before those events.
            // We need to skip over any which have subsequently been sent.
            this._advanceReadMarkerPastMyEvents();

            this.setState({
                canBackPaginate: this._timelineWindow.canPaginate(EventTimeline.BACKWARDS),
                canForwardPaginate: this._timelineWindow.canPaginate(EventTimeline.FORWARDS),
                timelineLoading: false,
            }, () => {
                this.fill();
            });
        };

        const onError = (error) => {
            this.setState({ timelineLoading: false });
            console.error(
                `Error loading timeline panel at ${eventId}: ${error}`,
            );
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");

            let onFinished;

            // if we were given an event ID, then when the user closes the
            // dialog, let's jump to the end of the timeline. If we weren't,
            // something has gone badly wrong and rather than causing a loop of
            // undismissable dialogs, let's just give up.
            if (eventId) {
                onFinished = () => {
                    // go via the dispatcher so that the URL is updated
                    dis.dispatch({
                        action: 'view_room',
                        room_id: this.props.timelineSet.room.roomId,
                    });
                };
            }
            let message;
            if (error.errcode == 'M_FORBIDDEN') {
                message = _t(
                    "Tried to load a specific point in this room's timeline, but you " +
                    "do not have permission to view the message in question.",
                );
            } else {
                message = _t(
                    "Tried to load a specific point in this room's timeline, but was " +
                    "unable to find it.",
                );
            }
            Modal.createTrackedDialog('Failed to load timeline position', '', ErrorDialog, {
                title: _t("Failed to load timeline position"),
                description: message,
                onFinished: onFinished,
            });
        };

        // if we already have the event in question, TimelineWindow.load
        // returns a resolved promise.
        //
        // In this situation, we don't really want to defer the update of the
        // state to the next event loop, because it makes room-switching feel
        // quite slow. So we detect that situation and shortcut straight to
        // calling _reloadEvents and updating the state.

        const timeline = this.props.timelineSet.getTimelineForEvent(eventId);
        if (timeline) {
            // This is a hot-path optimization by skipping a promise tick
            // by repeating a no-op sync branch in TimelineSet.getTimelineForEvent & MatrixClient.getEventTimeline
            this._timelineWindow.load(eventId, INITIAL_SIZE); // in this branch this method will happen in sync time
            onLoaded();
        } else {
            const prom = this._timelineWindow.load(eventId, INITIAL_SIZE);
            this.setState({
                events: [],
                liveEvents: [],
                canBackPaginate: false,
                canForwardPaginate: false,
                timelineLoading: true,
            });
            prom.then(onLoaded, onError);
        }
    }

    onRoomTimeline = (ev, room, toStartOfTimeline, removed, data) => {
        // ignore events for other timeline sets
        if (data.timeline.getTimelineSet() !== this.props.timelineSet) return;

        // ignore anything but real-time updates at the end of the room:
        // updates from pagination will happen when the paginate completes.
        if (toStartOfTimeline || !data || !data.liveEvent) return;

        // tell the timeline window to try to advance itself, but not to make
        // an http request to do so.
        this._timelineWindow.paginate(EventTimeline.FORWARDS, 1, false).then(() => {
            if (this.unmounted) { return; }

            const { events, liveEvents } = this._getEvents();

            this.setState({
                events,
                liveEvents,
            });
        });
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

        // despite having been filtered on the server side,
        // the timeline contains events other than m.room.message,
        // especially events related to widgets, so we have to filter
        // it again to avoid the app from crashing
        const events = this.state.events.filter(
            ev => ev.getType() === "m.room.message"
        );

        if (
            events.length == 0 &&
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
                {...{events}}
                showTwelveHour={this.state.isTwelveHour}
            />
        );
    }
}

export default WatchaTimelinePanel;
