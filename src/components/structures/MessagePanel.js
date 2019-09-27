/*
Copyright 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd

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

/* global Velocity */

import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import shouldHideEvent from '../../shouldHideEvent';
import {wantsDateSeparator} from '../../DateUtils';
import sdk from '../../index';

import MatrixClientPeg from '../../MatrixClientPeg';
import SettingsStore from '../../settings/SettingsStore';

const CONTINUATION_MAX_INTERVAL = 5 * 60 * 1000; // 5 minutes
const continuedTypes = ['m.sticker', 'm.room.message'];

const isMembershipChange = (e) => e.getType() === 'm.room.member' || e.getType() === 'm.room.third_party_invite';

/* (almost) stateless UI component which builds the event tiles in the room timeline.
 */
module.exports = React.createClass({
    displayName: 'MessagePanel',

    propTypes: {
        // true to give the component a 'display: none' style.
        hidden: PropTypes.bool,

        // true to show a spinner at the top of the timeline to indicate
        // back-pagination in progress
        backPaginating: PropTypes.bool,

        // true to show a spinner at the end of the timeline to indicate
        // forward-pagination in progress
        forwardPaginating: PropTypes.bool,

        // the list of MatrixEvents to display
        events: PropTypes.array.isRequired,

        // ID of an event to highlight. If undefined, no event will be highlighted.
        highlightedEventId: PropTypes.string,

        // The room these events are all in together, if any.
        // (The notification panel won't have a room here, for example.)
        room: PropTypes.object,

        // Should we show URL Previews
        showUrlPreview: PropTypes.bool,

        // event after which we should show a read marker
        readMarkerEventId: PropTypes.string,

        // whether the read marker should be visible
        readMarkerVisible: PropTypes.bool,

        // the userid of our user. This is used to suppress the read marker
        // for pending messages.
        ourUserId: PropTypes.string,

        // true to suppress the date at the start of the timeline
        suppressFirstDateSeparator: PropTypes.bool,

        // whether to show read receipts
        showReadReceipts: PropTypes.bool,

        // true if updates to the event list should cause the scroll panel to
        // scroll down when we are at the bottom of the window. See ScrollPanel
        // for more details.
        stickyBottom: PropTypes.bool,

        // callback which is called when the panel is scrolled.
        onScroll: PropTypes.func,

        // callback which is called when more content is needed.
        onFillRequest: PropTypes.func,

        // className for the panel
        className: PropTypes.string.isRequired,

        // shape parameter to be passed to EventTiles
        tileShape: PropTypes.string,

        // show twelve hour timestamps
        isTwelveHour: PropTypes.bool,

        // show timestamps always
        alwaysShowTimestamps: PropTypes.bool,

        // helper function to access relations for an event
        getRelationsForEvent: PropTypes.func,

        // whether to show reactions for an event
        showReactions: PropTypes.bool,
    },

    componentWillMount: function() {
        // the event after which we put a visible unread marker on the last
        // render cycle; null if readMarkerVisible was false or the RM was
        // suppressed (eg because it was at the end of the timeline)
        this.currentReadMarkerEventId = null;

        // the event after which we are showing a disappearing read marker
        // animation
        this.currentGhostEventId = null;

        // opaque readreceipt info for each userId; used by ReadReceiptMarker
        // to manage its animations
        this._readReceiptMap = {};

        // Track read receipts by event ID. For each _shown_ event ID, we store
        // the list of read receipts to display:
        //   [
        //       {
        //           userId: string,
        //           member: RoomMember,
        //           ts: number,
        //       },
        //   ]
        // This is recomputed on each render. It's only stored on the component
        // for ease of passing the data around since it's computed in one pass
        // over all events.
        this._readReceiptsByEvent = {};

        // Track read receipts by user ID. For each user ID we've ever shown a
        // a read receipt for, we store an object:
        //   {
        //       lastShownEventId: string,
        //       receipt: {
        //           userId: string,
        //           member: RoomMember,
        //           ts: number,
        //       },
        //   }
        // so that we can always keep receipts displayed by reverting back to
        // the last shown event for that user ID when needed. This may feel like
        // it duplicates the receipt storage in the room, but at this layer, we
        // are tracking _shown_ event IDs, which the JS SDK knows nothing about.
        // This is recomputed on each render, using the data from the previous
        // render as our fallback for any user IDs we can't match a receipt to a
        // displayed event in the current render cycle.
        this._readReceiptsByUserId = {};

        // Remember the read marker ghost node so we can do the cleanup that
        // Velocity requires
        this._readMarkerGhostNode = null;

        // Cache hidden events setting on mount since Settings is expensive to
        // query, and we check this in a hot code path.
        this._showHiddenEventsInTimeline =
            SettingsStore.getValue("showHiddenEventsInTimeline");

        this._isMounted = true;
    },

    componentWillUnmount: function() {
        this._isMounted = false;
    },

    /* get the DOM node representing the given event */
    getNodeForEventId: function(eventId) {
        if (!this.eventNodes) {
            return undefined;
        }

        return this.eventNodes[eventId];
    },

    /* return true if the content is fully scrolled down right now; else false.
     */
    isAtBottom: function() {
        return this.refs.scrollPanel
            && this.refs.scrollPanel.isAtBottom();
    },

    /* get the current scroll state. See ScrollPanel.getScrollState for
     * details.
     *
     * returns null if we are not mounted.
     */
    getScrollState: function() {
        if (!this.refs.scrollPanel) { return null; }
        return this.refs.scrollPanel.getScrollState();
    },

    // returns one of:
    //
    //  null: there is no read marker
    //  -1: read marker is above the window
    //   0: read marker is within the window
    //  +1: read marker is below the window
    getReadMarkerPosition: function() {
        const readMarker = this.refs.readMarkerNode;
        const messageWrapper = this.refs.scrollPanel;

        if (!readMarker || !messageWrapper) {
            return null;
        }

        const wrapperRect = ReactDOM.findDOMNode(messageWrapper).getBoundingClientRect();
        const readMarkerRect = readMarker.getBoundingClientRect();

        // the read-marker pretends to have zero height when it is actually
        // two pixels high; +2 here to account for that.
        if (readMarkerRect.bottom + 2 < wrapperRect.top) {
            return -1;
        } else if (readMarkerRect.top < wrapperRect.bottom) {
            return 0;
        } else {
            return 1;
        }
    },

    /* jump to the top of the content.
     */
    scrollToTop: function() {
        if (this.refs.scrollPanel) {
            this.refs.scrollPanel.scrollToTop();
        }
    },

    /* jump to the bottom of the content.
     */
    scrollToBottom: function() {
        if (this.refs.scrollPanel) {
            this.refs.scrollPanel.scrollToBottom();
        }
    },

    /**
     * Page up/down.
     *
     * @param {number} mult: -1 to page up, +1 to page down
     */
    scrollRelative: function(mult) {
        if (this.refs.scrollPanel) {
            this.refs.scrollPanel.scrollRelative(mult);
        }
    },

    /**
     * Scroll up/down in response to a scroll key
     *
     * @param {KeyboardEvent} ev: the keyboard event to handle
     */
    handleScrollKey: function(ev) {
        if (this.refs.scrollPanel) {
            this.refs.scrollPanel.handleScrollKey(ev);
        }
    },

    /* jump to the given event id.
     *
     * offsetBase gives the reference point for the pixelOffset. 0 means the
     * top of the container, 1 means the bottom, and fractional values mean
     * somewhere in the middle. If omitted, it defaults to 0.
     *
     * pixelOffset gives the number of pixels *above* the offsetBase that the
     * node (specifically, the bottom of it) will be positioned. If omitted, it
     * defaults to 0.
     */
    scrollToEvent: function(eventId, pixelOffset, offsetBase) {
        if (this.refs.scrollPanel) {
            this.refs.scrollPanel.scrollToToken(eventId, pixelOffset, offsetBase);
        }
    },

    scrollToEventIfNeeded: function(eventId) {
        const node = this.eventNodes[eventId];
        if (node) {
            node.scrollIntoView({block: "nearest", behavior: "instant"});
        }
    },

    /* check the scroll state and send out pagination requests if necessary.
     */
    checkFillState: function() {
        if (this.refs.scrollPanel) {
            this.refs.scrollPanel.checkFillState();
        }
    },

    _isUnmounting: function() {
        return !this._isMounted;
    },

    // TODO: Implement granular (per-room) hide options
    _shouldShowEvent: function(mxEv) {
        if (mxEv.sender && MatrixClientPeg.get().isUserIgnored(mxEv.sender.userId)) {
            return false; // ignored = no show (only happens if the ignore happens after an event was received)
        }

        if (this._showHiddenEventsInTimeline) {
            return true;
        }

        const EventTile = sdk.getComponent('rooms.EventTile');
        if (!EventTile.haveTileForEvent(mxEv)) {
            return false; // no tile = no show
        }

        // Always show highlighted event
        if (this.props.highlightedEventId === mxEv.getId()) return true;

        return !shouldHideEvent(mxEv);
    },

    _getEventTiles: function() {
        const DateSeparator = sdk.getComponent('messages.DateSeparator');
        const MemberEventListSummary = sdk.getComponent('views.elements.MemberEventListSummary');

        this.eventNodes = {};

        let visible = false;
        let i;

        // first figure out which is the last event in the list which we're
        // actually going to show; this allows us to behave slightly
        // differently for the last event in the list. (eg show timestamp)
        //
        // we also need to figure out which is the last event we show which isn't
        // a local echo, to manage the read-marker.
        let lastShownEvent;

        let lastShownNonLocalEchoIndex = -1;
        for (i = this.props.events.length-1; i >= 0; i--) {
            const mxEv = this.props.events[i];
            if (!this._shouldShowEvent(mxEv)) {
                continue;
            }

            if (lastShownEvent === undefined) {
                lastShownEvent = mxEv;
            }

            if (mxEv.status) {
                // this is a local echo
                continue;
            }

            lastShownNonLocalEchoIndex = i;
            break;
        }

        const ret = [];

        let prevEvent = null; // the last event we showed

        // assume there is no read marker until proven otherwise
        let readMarkerVisible = false;

        // if the readmarker has moved, cancel any active ghost.
        if (this.currentReadMarkerEventId && this.props.readMarkerEventId &&
                this.props.readMarkerVisible &&
                this.currentReadMarkerEventId !== this.props.readMarkerEventId) {
            this.currentGhostEventId = null;
        }

        this._readReceiptsByEvent = {};
        if (this.props.showReadReceipts) {
            this._readReceiptsByEvent = this._getReadReceiptsByShownEvent();
        }

        for (i = 0; i < this.props.events.length; i++) {
            const mxEv = this.props.events[i];
            const eventId = mxEv.getId();
            const last = (mxEv === lastShownEvent);

            const wantTile = this._shouldShowEvent(mxEv);

            // Wrap consecutive member events in a ListSummary, ignore if redacted
            if (isMembershipChange(mxEv) && wantTile) {
                let readMarkerInMels = false;
                const ts1 = mxEv.getTs();
                // Ensure that the key of the MemberEventListSummary does not change with new
                // member events. This will prevent it from being re-created unnecessarily, and
                // instead will allow new props to be provided. In turn, the shouldComponentUpdate
                // method on MELS can be used to prevent unnecessary renderings.
                //
                // Whilst back-paginating with a MELS at the top of the panel, prevEvent will be null,
                // so use the key "membereventlistsummary-initial". Otherwise, use the ID of the first
                // membership event, which will not change during forward pagination.
                const key = "membereventlistsummary-" + (prevEvent ? mxEv.getId() : "initial");

                if (this._wantsDateSeparator(prevEvent, mxEv.getDate())) {
                    const dateSeparator = <li key={ts1+'~'}><DateSeparator key={ts1+'~'} ts={ts1} /></li>;
                    ret.push(dateSeparator);
                }

                // If RM event is the first in the MELS, append the RM after MELS
                if (mxEv.getId() === this.props.readMarkerEventId) {
                    readMarkerInMels = true;
                }

                const summarisedEvents = [mxEv];
                for (;i + 1 < this.props.events.length; i++) {
                    const collapsedMxEv = this.props.events[i + 1];

                    // Ignore redacted/hidden member events
                    if (!this._shouldShowEvent(collapsedMxEv)) {
                        // If this hidden event is the RM and in or at end of a MELS put RM after MELS.
                        if (collapsedMxEv.getId() === this.props.readMarkerEventId) {
                            readMarkerInMels = true;
                        }
                        continue;
                    }

                    if (!isMembershipChange(collapsedMxEv) ||
                        this._wantsDateSeparator(mxEv, collapsedMxEv.getDate())) {
                        break;
                    }

                    // If RM event is in MELS mark it as such and the RM will be appended after MELS.
                    if (collapsedMxEv.getId() === this.props.readMarkerEventId) {
                        readMarkerInMels = true;
                    }

                    summarisedEvents.push(collapsedMxEv);
                }

                let highlightInMels = false;

                // At this point, i = the index of the last event in the summary sequence
                let eventTiles = summarisedEvents.map((e) => {
                    if (e.getId() === this.props.highlightedEventId) {
                        highlightInMels = true;
                    }
                    // In order to prevent DateSeparators from appearing in the expanded form
                    // of MemberEventListSummary, render each member event as if the previous
                    // one was itself. This way, the timestamp of the previous event === the
                    // timestamp of the current event, and no DateSeparator is inserted.
                    return this._getTilesForEvent(e, e, e === lastShownEvent);
                }).reduce((a, b) => a.concat(b));

                if (eventTiles.length === 0) {
                    eventTiles = null;
                }

                ret.push(<MemberEventListSummary key={key}
                    events={summarisedEvents}
                    onToggle={this._onHeightChanged} // Update scroll state
                    startExpanded={highlightInMels}
                >
                        { eventTiles }
                </MemberEventListSummary>);

                if (readMarkerInMels) {
                    ret.push(this._getReadMarkerTile(visible));
                }

                prevEvent = mxEv;
                continue;
            }

            if (wantTile) {
                // make sure we unpack the array returned by _getTilesForEvent,
                // otherwise react will auto-generate keys and we will end up
                // replacing all of the DOM elements every time we paginate.
                ret.push(...this._getTilesForEvent(prevEvent, mxEv, last));
                prevEvent = mxEv;
            }

            let isVisibleReadMarker = false;

            if (eventId === this.props.readMarkerEventId) {
                visible = this.props.readMarkerVisible;

                // if the read marker comes at the end of the timeline (except
                // for local echoes, which are excluded from RMs, because they
                // don't have useful event ids), we don't want to show it, but
                // we still want to create the <li/> for it so that the
                // algorithms which depend on its position on the screen aren't
                // confused.
                if (i >= lastShownNonLocalEchoIndex) {
                    visible = false;
                }
                ret.push(this._getReadMarkerTile(visible));
                readMarkerVisible = visible;
                isVisibleReadMarker = visible;
            }

            // XXX: there should be no need for a ghost tile - we should just use a
            // a dispatch (user_activity_end) to start the RM animation.
            if (eventId === this.currentGhostEventId) {
                // if we're showing an animation, continue to show it.
                ret.push(this._getReadMarkerGhostTile());
            } else if (!isVisibleReadMarker &&
                       eventId === this.currentReadMarkerEventId) {
                // there is currently a read-up-to marker at this point, but no
                // more. Show an animation of it disappearing.
                ret.push(this._getReadMarkerGhostTile());
                this.currentGhostEventId = eventId;
            }
        }

        this.currentReadMarkerEventId = readMarkerVisible ? this.props.readMarkerEventId : null;
        return ret;
    },

    _getTilesForEvent: function(prevEvent, mxEv, last) {
        const EventTile = sdk.getComponent('rooms.EventTile');
        const DateSeparator = sdk.getComponent('messages.DateSeparator');
        const ret = [];

        const isEditing = this.props.editState &&
            this.props.editState.getEvent().getId() === mxEv.getId();
        // is this a continuation of the previous message?
        let continuation = false;

        // Some events should appear as continuations from previous events of
        // different types.

        const eventTypeContinues =
            prevEvent !== null &&
            continuedTypes.includes(mxEv.getType()) &&
            continuedTypes.includes(prevEvent.getType());

        // if there is a previous event and it has the same sender as this event
        // and the types are the same/is in continuedTypes and the time between them is <= CONTINUATION_MAX_INTERVAL
        if (prevEvent !== null && prevEvent.sender && mxEv.sender && mxEv.sender.userId === prevEvent.sender.userId &&
            (mxEv.getType() === prevEvent.getType() || eventTypeContinues) &&
            (mxEv.getTs() - prevEvent.getTs() <= CONTINUATION_MAX_INTERVAL)) {
            continuation = true;
        }

/*
        // Work out if this is still a continuation, as we are now showing commands
        // and /me messages with their own little avatar. The case of a change of
        // event type (commands) is handled above, but we need to handle the /me
        // messages seperately as they have a msgtype of 'm.emote' but are classed
        // as normal messages
        if (prevEvent !== null && prevEvent.sender && mxEv.sender
                && mxEv.sender.userId === prevEvent.sender.userId
                && mxEv.getType() == prevEvent.getType()
                && prevEvent.getContent().msgtype === 'm.emote') {
            continuation = false;
        }
*/

        // local echoes have a fake date, which could even be yesterday. Treat them
        // as 'today' for the date separators.
        let ts1 = mxEv.getTs();
        let eventDate = mxEv.getDate();
        if (mxEv.status) {
            eventDate = new Date();
            ts1 = eventDate.getTime();
        }

        // do we need a date separator since the last event?
        if (this._wantsDateSeparator(prevEvent, eventDate)) {
            const dateSeparator = <li key={ts1}><DateSeparator key={ts1} ts={ts1} /></li>;
            ret.push(dateSeparator);
            continuation = false;
        }

        const eventId = mxEv.getId();
        const highlight = (eventId === this.props.highlightedEventId);

        // we can't use local echoes as scroll tokens, because their event IDs change.
        // Local echos have a send "status".
        const scrollToken = mxEv.status ? undefined : eventId;

        const readReceipts = this._readReceiptsByEvent[eventId];

        ret.push(
            <li key={eventId}
                ref={this._collectEventNode.bind(this, eventId)}
                data-scroll-tokens={scrollToken}
            >
                <EventTile mxEvent={mxEv}
                    continuation={continuation}
                    isRedacted={mxEv.isRedacted()}
                    replacingEventId={mxEv.replacingEventId()}
                    editState={isEditing && this.props.editState}
                    onHeightChanged={this._onHeightChanged}
                    readReceipts={readReceipts}
                    readReceiptMap={this._readReceiptMap}
                    showUrlPreview={this.props.showUrlPreview}
                    checkUnmounting={this._isUnmounting}
                    eventSendStatus={mxEv.getAssociatedStatus()}
                    tileShape={this.props.tileShape}
                    isTwelveHour={this.props.isTwelveHour}
                    permalinkCreator={this.props.permalinkCreator}
                    last={last}
                    isSelectedEvent={highlight}
                    getRelationsForEvent={this.props.getRelationsForEvent}
                    showReactions={this.props.showReactions}
                />
            </li>,
        );

        return ret;
    },

    _wantsDateSeparator: function(prevEvent, nextEventDate) {
        if (prevEvent == null) {
            // first event in the panel: depends if we could back-paginate from
            // here.
            return !this.props.suppressFirstDateSeparator;
        }
        return wantsDateSeparator(prevEvent.getDate(), nextEventDate);
    },

    // Get a list of read receipts that should be shown next to this event
    // Receipts are objects which have a 'userId', 'roomMember' and 'ts'.
    _getReadReceiptsForEvent: function(event) {
        const myUserId = MatrixClientPeg.get().credentials.userId;

        // get list of read receipts, sorted most recent first
        const { room } = this.props;
        if (!room) {
            return null;
        }
        const receipts = [];
        room.getReceiptsForEvent(event).forEach((r) => {
            if (!r.userId || r.type !== "m.read" || r.userId === myUserId) {
                return; // ignore non-read receipts and receipts from self.
            }
            if (MatrixClientPeg.get().isUserIgnored(r.userId)) {
                return; // ignore ignored users
            }
            const member = room.getMember(r.userId);
            receipts.push({
                userId: r.userId,
                roomMember: member,
                ts: r.data ? r.data.ts : 0,
            });
        });
        return receipts;
    },

    // Get an object that maps from event ID to a list of read receipts that
    // should be shown next to that event. If a hidden event has read receipts,
    // they are folded into the receipts of the last shown event.
    _getReadReceiptsByShownEvent: function() {
        const receiptsByEvent = {};
        const receiptsByUserId = {};

        let lastShownEventId;
        for (const event of this.props.events) {
            if (this._shouldShowEvent(event)) {
                lastShownEventId = event.getId();
            }
            if (!lastShownEventId) {
                continue;
            }

            const existingReceipts = receiptsByEvent[lastShownEventId] || [];
            const newReceipts = this._getReadReceiptsForEvent(event);
            receiptsByEvent[lastShownEventId] = existingReceipts.concat(newReceipts);

            // Record these receipts along with their last shown event ID for
            // each associated user ID.
            for (const receipt of newReceipts) {
                receiptsByUserId[receipt.userId] = {
                    lastShownEventId,
                    receipt,
                };
            }
        }

        // It's possible in some cases (for example, when a read receipt
        // advances before we have paginated in the new event that it's marking
        // received) that we can temporarily not have a matching event for
        // someone which had one in the last. By looking through our previous
        // mapping of receipts by user ID, we can cover recover any receipts
        // that would have been lost by using the same event ID from last time.
        for (const userId in this._readReceiptsByUserId) {
            if (receiptsByUserId[userId]) {
                continue;
            }
            const { lastShownEventId, receipt } = this._readReceiptsByUserId[userId];
            const existingReceipts = receiptsByEvent[lastShownEventId] || [];
            receiptsByEvent[lastShownEventId] = existingReceipts.concat(receipt);
            receiptsByUserId[userId] = { lastShownEventId, receipt };
        }
        this._readReceiptsByUserId = receiptsByUserId;

        // After grouping receipts by shown events, do another pass to sort each
        // receipt list.
        for (const eventId in receiptsByEvent) {
            receiptsByEvent[eventId].sort((r1, r2) => {
                return r2.ts - r1.ts;
            });
        }

        return receiptsByEvent;
    },

    _getReadMarkerTile: function(visible) {
        let hr;
        if (visible) {
            hr = <hr className="mx_RoomView_myReadMarker"
                    style={{opacity: 1, width: '99%'}}
                />;
        }

        return (
            <li key="_readupto" ref="readMarkerNode"
                  className="mx_RoomView_myReadMarker_container">
                { hr }
            </li>
        );
    },

    _startAnimation: function(ghostNode) {
        if (this._readMarkerGhostNode) {
            Velocity.Utilities.removeData(this._readMarkerGhostNode);
        }
        this._readMarkerGhostNode = ghostNode;

        if (ghostNode) {
            // eslint-disable-next-line new-cap
            Velocity(ghostNode, {opacity: '0', width: '10%'},
                     {duration: 400, easing: 'easeInSine',
                      delay: 1000});
        }
    },

    _getReadMarkerGhostTile: function() {
        const hr = <hr className="mx_RoomView_myReadMarker"
                  style={{opacity: 1, width: '99%'}}
                  ref={this._startAnimation}
            />;

        // give it a key which depends on the event id. That will ensure that
        // we get a new DOM node (restarting the animation) when the ghost
        // moves to a different event.
        return (
            <li key={"_readuptoghost_"+this.currentGhostEventId}
                  className="mx_RoomView_myReadMarker_container">
                { hr }
            </li>
        );
    },

    _collectEventNode: function(eventId, node) {
        this.eventNodes[eventId] = node;
    },

    // once dynamic content in the events load, make the scrollPanel check the
    // scroll offsets.
    _onHeightChanged: function() {
        const scrollPanel = this.refs.scrollPanel;
        if (scrollPanel) {
            scrollPanel.checkScroll();
        }
    },

    _onTypingShown: function() {
        const scrollPanel = this.refs.scrollPanel;
        // this will make the timeline grow, so checkScroll
        scrollPanel.checkScroll();
        if (scrollPanel && scrollPanel.getScrollState().stuckAtBottom) {
            scrollPanel.preventShrinking();
        }
    },

    _onTypingHidden: function() {
        const scrollPanel = this.refs.scrollPanel;
        if (scrollPanel) {
            // as hiding the typing notifications doesn't
            // update the scrollPanel, we tell it to apply
            // the shrinking prevention once the typing notifs are hidden
            scrollPanel.updatePreventShrinking();
            // order is important here as checkScroll will scroll down to
            // reveal added padding to balance the notifs disappearing.
            scrollPanel.checkScroll();
        }
    },

    updateTimelineMinHeight: function() {
        const scrollPanel = this.refs.scrollPanel;

        if (scrollPanel) {
            const isAtBottom = scrollPanel.isAtBottom();
            const whoIsTyping = this.refs.whoIsTyping;
            const isTypingVisible = whoIsTyping && whoIsTyping.isVisible();
            // when messages get added to the timeline,
            // but somebody else is still typing,
            // update the min-height, so once the last
            // person stops typing, no jumping occurs
            if (isAtBottom && isTypingVisible) {
                scrollPanel.preventShrinking();
            }
        }
    },

    onTimelineReset: function() {
        const scrollPanel = this.refs.scrollPanel;
        if (scrollPanel) {
            scrollPanel.clearPreventShrinking();
        }
    },

    render: function() {
        const ScrollPanel = sdk.getComponent("structures.ScrollPanel");
        const WhoIsTypingTile = sdk.getComponent("rooms.WhoIsTypingTile");
        const Spinner = sdk.getComponent("elements.Spinner");
        let topSpinner;
        let bottomSpinner;
        if (this.props.backPaginating) {
            topSpinner = <li key="_topSpinner"><Spinner /></li>;
        }
        if (this.props.forwardPaginating) {
            bottomSpinner = <li key="_bottomSpinner"><Spinner /></li>;
        }

        const style = this.props.hidden ? { display: 'none' } : {};

        const className = classNames(
            this.props.className,
            {
                "mx_MessagePanel_alwaysShowTimestamps": this.props.alwaysShowTimestamps,
            },
        );

        let whoIsTyping;
        if (this.props.room && !this.props.tileShape) {
            whoIsTyping = (<WhoIsTypingTile
                room={this.props.room}
                onShown={this._onTypingShown}
                onHidden={this._onTypingHidden}
                ref="whoIsTyping" />
            );
        }

        return (
            <ScrollPanel ref="scrollPanel" className={className}
                    onScroll={this.props.onScroll}
                    onResize={this.onResize}
                    onFillRequest={this.props.onFillRequest}
                    onUnfillRequest={this.props.onUnfillRequest}
                    style={style}
                    stickyBottom={this.props.stickyBottom}
                    resizeNotifier={this.props.resizeNotifier}>
                { topSpinner }
                { this._getEventTiles() }
                { whoIsTyping }
                { bottomSpinner }
            </ScrollPanel>
        );
    },
});
