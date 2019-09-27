/*
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

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import MatrixClientPeg from '../../../MatrixClientPeg';

export default class ReactionTooltipButton extends React.PureComponent {
    static propTypes = {
        mxEvent: PropTypes.object.isRequired,
        // The reaction content / key / emoji
        content: PropTypes.string.isRequired,
        title: PropTypes.string,
        // A possible Matrix event if the current user has voted for this type
        myReactionEvent: PropTypes.object,
    };

    onClick = (ev) => {
        const { mxEvent, myReactionEvent, content } = this.props;
        if (myReactionEvent) {
            MatrixClientPeg.get().redactEvent(
                mxEvent.getRoomId(),
                myReactionEvent.getId(),
            );
        } else {
            MatrixClientPeg.get().sendEvent(mxEvent.getRoomId(), "m.reaction", {
                "m.relates_to": {
                    "rel_type": "m.annotation",
                    "event_id": mxEvent.getId(),
                    "key": content,
                },
            });
        }
    }

    render() {
        const { content, myReactionEvent } = this.props;

        const classes = classNames({
            mx_ReactionTooltipButton: true,
            mx_ReactionTooltipButton_selected: !!myReactionEvent,
        });

        return <span className={classes}
            data-key={content}
            title={this.props.title}
            aria-hidden={true}
            onClick={this.onClick}
        >
            {content}
        </span>;
    }
}
