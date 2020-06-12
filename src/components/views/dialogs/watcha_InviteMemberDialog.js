/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd

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

import classNames from "classnames";
import PropTypes from "prop-types";
import React, { Component } from "react";

import { _t } from "../../../languageHandler";
import { inviteMultipleToRoom } from "../../../RoomInvite";
import { Key } from "../../../Keyboard";
import { KIND_DM } from "../../../components/views/dialogs/InviteDialog";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import * as Avatar from "../../../Avatar";
import * as Email from "../../../email";
import * as sdk from "../../../index";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import BaseAvatar from "../avatars/BaseAvatar";
import createRoom, { canEncryptToAllUsers } from "../../../createRoom";
import dis from "../../../dispatcher";
import DMRoomMap from "../../../utils/DMRoomMap";
import EntityTile from "../rooms/EntityTile";
import SettingsStore from "../../../settings/SettingsStore";
import withValidation from "../elements/Validation";

const AVATAR_SIZE = 36;

class InviteMemberDialog extends Component {
    static defaultProps = {
        kind: KIND_DM,
    };

    static propTypes = {
        // Takes an array of user IDs/emails to invite.
        onFinished: PropTypes.func.isRequired,
        // The kind of invite being performed. Assumed to be KIND_DM if not provided.
        kind: PropTypes.string,
        // The room ID this dialog is for. Only required for KIND_INVITE.
        roomId: PropTypes.string,
    };

    constructor(props) {
        super(props);
        this.state = {
            // List of UserAddressType objects representing the set of auto-completion results for the current search query
            suggestedList: [],
            // List of people that will be invited
            selectedList: [],
            // Whether a search is ongoing
            busy: false,
            // An error message generated during the user directory search
            searchError: null,
            // Whether the server supports the user_directory API
            serverSupportsUserDirectory: true,
            // The query being searched for
            query: "",
            pendingSubmission: false,
            errorText: null,
        };
    }

    componentDidMount() {
        this._doUserDirectorySearch(this.state.query);
    }

    onOk = () => this.setState({ pendingSubmission: true });

    onSearch = value => this._doUserDirectorySearch(value);

    getBaseAvatar = (user, name, url) => {
        if (!name) {
            name = user.displayName || user.address;
        }
        if (!url) {
            url = Avatar.avatarUrlForUser(user, AVATAR_SIZE, AVATAR_SIZE);
        }
        return (
            <BaseAvatar
                width={AVATAR_SIZE}
                height={AVATAR_SIZE}
                {...{ name, url }}
            />
        );
    };

    getMembership = (roomMembers, userId) => {
        for (const member of roomMembers) {
            if (member.userId === userId) {
                return member.membership;
            }
        }
    };

    getSelectedTiles = () => {
        const selectedTiles = this.state.selectedList.map(user => {
            const commonProps = {
                key: user.address,
                className: "watcha_InviteMemberDialog_EntityTile_invite",
                name: user.displayName,
                title: _t("Click to remove this invitation"),
                showPresence: false,
            };
            return user.isKnown ? (
                <EntityTile
                    {...commonProps}
                    avatarJsx={this.getBaseAvatar(user)}
                    onClick={e => this.removeFromSelectedList(user)}
                    subtextLabel={
                        user.displayName !== user.email ? user.email : undefined
                    }
                />
            ) : (
                <EntityTile
                    {...commonProps}
                    className={classNames(
                        commonProps.className,
                        "watcha_InviteMemberDialog_EntityTile_partner"
                    )}
                    subtextLabel={_t(
                        "An invitation will be sent to this email address"
                    )}
                    avatarJsx={this.getBaseAvatar(
                        user,
                        null,
                        require("../../../../res/img/watcha_paper-plane.svg")
                    )}
                    onClick={e => this.removeEmailAddressFromSelectedList(user)}
                />
            );
        });
        if (selectedTiles.length > 0) {
            return selectedTiles;
        }
    };

    getSuggestedTiles = () => {
        const suggestedTiles = this.state.suggestedList.map(user => {
            const commonProps = {
                key: user.address,
                name: user.displayName,
                avatarJsx: this.getBaseAvatar(user),
            };
            const subtextLabel = {
                join: _t("Already room member"),
                invite: _t("Already invited"),
            };
            return subtextLabel.hasOwnProperty(user.membership) ? (
                <EntityTile
                    {...commonProps}
                    className="watcha_InviteMemberDialog_EntityTile_roomMember"
                    subtextLabel={subtextLabel[user.membership]}
                    presenceState="offline"
                    suppressOnHover={true}
                />
            ) : (
                <EntityTile
                    {...commonProps}
                    title={_t("Click to add this user to the invitation list")}
                    showPresence={false}
                    onClick={e => this.addToSelectedList(user)}
                    subtextLabel={
                        user.displayName !== user.email ? user.email : undefined
                    }
                />
            );
        });
        if (suggestedTiles.length > 0) {
            return suggestedTiles;
        }
    };

    // strongly inspired from src/components/views/dialogs/AddressPickerDialog.js
    // getUsers() is really unreliable: not all users appear according to context
    // (who does the search, new user, user who has never been invited)
    _doLocalSearch = query => {
        this.setState({
            query,
            searchError: null,
        });
        const queryLowercase = query.toLowerCase();
        const results = [];
        MatrixClientPeg.get()
            .getUsers()
            .forEach(user => {
                if (
                    user.userId.toLowerCase().indexOf(queryLowercase) === -1 &&
                    user.displayName.toLowerCase().indexOf(queryLowercase) ===
                        -1
                ) {
                    return;
                }

                // Put results in the format of the new API
                results.push({
                    user_id: user.userId,
                    display_name: user.displayName,
                    avatar_url: user.avatarUrl,
                });
            });
        this._processResults(results, query);
    };

    // strongly inspired from src/components/views/dialogs/AddressPickerDialog.js
    _doUserDirectorySearch = query => {
        this.setState({
            busy: true,
            query,
            searchError: null,
        });
        MatrixClientPeg.get()
            .searchUserDirectory({
                term: query,
                limit: Number.MAX_SAFE_INTEGER,
            })
            .then(resp => {
                // The query might have changed since we sent the request, so ignore
                // responses for anything other than the latest query.
                if (this.state.query !== query) {
                    return;
                }
                this._processResults(resp.results, query);
            })
            .catch(err => {
                console.error("Error whilst searching user directory: ", err);
                this.setState({
                    searchError: err.errcode
                        ? err.message
                        : _t("Something went wrong!"),
                });
                if (err.errcode === "M_UNRECOGNIZED") {
                    this.setState({ serverSupportsUserDirectory: false });
                    // Do a local search immediately
                    this._doLocalSearch(query);
                }
            })
            .then(() => {
                this.setState({ busy: false });
            });
    };

    // copied from src/components/views/dialogs/InviteDialog.js
    _inviteUsers = () => {
        this.setState({ busy: true });
        const targetIds = this.state.selectedList.map(user => user.address);

        const room = MatrixClientPeg.get().getRoom(this.props.roomId);
        if (!room) {
            console.error("Failed to find the room to invite users to");
            this.setState({
                busy: false,
                errorText: _t(
                    "Something went wrong trying to invite the users."
                ),
            });
            return;
        }

        inviteMultipleToRoom(this.props.roomId, targetIds)
            .then(result => {
                if (!this._shouldAbortAfterInviteError(result)) {
                    // handles setting error message too
                    this.props.onFinished();
                }
            })
            .catch(err => {
                console.error(err);
                this.setState({
                    busy: false,
                    errorText: _t(
                        "We couldn't invite those users. Please check the users you want to invite and try again."
                    ),
                });
            });
    };

    _processResults = (results, query) => {
        const suggestedList = [];
        const client = MatrixClientPeg.get();

        for (const user of results) {
            const userId = user.user_id;
            if (userId === client.credentials.userId) {
                continue; // remove the actual user from the list of users
            }
            const email = user.email;
            const displayName = user.display_name || email || userId;

            let membership;
            if (this.props.roomId) {
                const room = client.getRoom(this.props.roomId);
                const roomMembers = Object.values(room.currentState.members);
                membership = this.getMembership(roomMembers, userId);
            }

            // watcha TODO: as the upstream interface has changed, it should be simplified by removing useless fields
            if (this.state.selectedList.every(user => user.address != userId)) {
                suggestedList.push({
                    address: userId,
                    addressType: "mx-user-id",
                    avatarUrl: user.avatar_url,
                    isKnown: true,
                    displayName,
                    membership,
                    email,
                });
            }
        }

        this.setState({ suggestedList: this.sortedUserList(suggestedList) });
    };

    // copied from src/components/views/dialogs/InviteDialog.js
    _shouldAbortAfterInviteError(result) {
        const failedUsers = Object.keys(result.states).filter(
            a => result.states[a] === "error"
        );
        if (failedUsers.length > 0) {
            console.log("Failed to invite users: ", result);
            this.setState({
                busy: false,
                errorText: _t(
                    "Failed to invite the following users to chat: %(csvUsers)s",
                    {
                        csvUsers: failedUsers.join(", "),
                    }
                ),
            });
            return true; // abort
        }
        return false;
    }

    // copied from src/components/views/dialogs/InviteDialog.js
    _startDm = async () => {
        this.setState({ busy: true });
        const targetIds = this.state.selectedList.map(user => user.address);

        // Check if there is already a DM with these people and reuse it if possible.
        const existingRoom = DMRoomMap.shared().getDMRoomForIdentifiers(
            targetIds
        );
        if (existingRoom) {
            dis.dispatch({
                action: "view_room",
                room_id: existingRoom.roomId,
                should_peek: false,
                joining: false,
            });
            this.props.onFinished();
            return;
        }

        const createRoomOptions = { inlineErrors: true };

        if (SettingsStore.getValue("feature_cross_signing")) {
            // Check whether all users have uploaded device keys before.
            // If so, enable encryption in the new room.
            // watcha TODO: check why is it a problem
            const has3PidMembers = this.state.selectedList.some(
                user => user.addressType === "email"
            );
            if (!has3PidMembers) {
                const client = MatrixClientPeg.get();
                const allHaveDeviceKeys = await canEncryptToAllUsers(
                    client,
                    targetIds
                );
                if (allHaveDeviceKeys) {
                    createRoomOptions.encryption = true;
                }
            }
        }

        // Check if it's a traditional DM and create the room if required.
        // TODO: [Canonical DMs] Remove this check and instead just create the multi-person DM
        let createRoomPromise = Promise.resolve();
        const isSelf =
            targetIds.length === 1 &&
            targetIds[0] === MatrixClientPeg.get().getUserId();
        if (targetIds.length === 1 && !isSelf) {
            createRoomOptions.dmUserId = targetIds[0];
            createRoomPromise = createRoom(createRoomOptions);
        } else if (isSelf) {
            createRoomPromise = createRoom(createRoomOptions);
        } else {
            // Create a boring room and try to invite the targets manually.
            createRoomPromise = createRoom(createRoomOptions)
                .then(roomId => {
                    return inviteMultipleToRoom(roomId, targetIds);
                })
                .then(result => {
                    if (this._shouldAbortAfterInviteError(result)) {
                        return true; // abort
                    }
                });
        }

        // the createRoom call will show the room for us, so we don't need to worry about that.
        createRoomPromise
            .then(abort => {
                if (abort === true) return; // only abort on true booleans, not roomIds or something
                this.props.onFinished();
            })
            .catch(err => {
                console.error(err);
                this.setState({
                    busy: false,
                    errorText: _t(
                        "We couldn't create your DM. Please check the users you want to invite and try again."
                    ),
                });
            });
    };

    addEmailAddressToSelectedList = emailAddress => {
        let knownUser;
        const userId = convertEmailToUserId(emailAddress);

        for (const user of this.state.suggestedList) {
            if (user.address === userId) {
                knownUser = user;
                break;
            }
        }

        if (!knownUser) {
            const newUser = {
                address: emailAddress,
                addressType: "email",
                displayName: emailAddress,
            };
            this.setState(({ selectedList }) => ({
                selectedList: [newUser, ...selectedList],
            }));
        } else {
            this.addToSelectedList(knownUser);
        }
    };

    addToSelectedList = user => {
        this.setState(({ suggestedList, selectedList }) => {
            for (let i = 0; i < suggestedList.length; i++) {
                if (suggestedList[i] === user) {
                    suggestedList.splice(i, 1);
                    return {
                        suggestedList,
                        selectedList: [user, ...selectedList],
                    };
                }
            }
        });
    };

    removeEmailAddressFromSelectedList = user => {
        this.setState(({ selectedList }) => {
            for (let i = 0; i < selectedList.length; i++) {
                if (selectedList[i] === user) {
                    selectedList.splice(i, 1);
                    return { selectedList };
                }
            }
        });
    };

    removeFromSelectedList = user => {
        this.setState(({ suggestedList, selectedList }) => {
            for (let i = 0; i < selectedList.length; i++) {
                if (selectedList[i] === user) {
                    suggestedList = this.sortedUserList([
                        ...suggestedList,
                        user,
                    ]);
                    selectedList.splice(i, 1);
                    return { suggestedList, selectedList };
                }
            }
        });
    };

    resume = () => this.setState({ pendingSubmission: false });

    sortedUserList = list => {
        return list.slice().sort((a, b) => {
            const nameA = a.displayName.toLowerCase();
            const nameB = b.displayName.toLowerCase();
            let comp;
            if (nameA < nameB) {
                comp = -1;
            } else if (nameA > nameB) {
                comp = 1;
            } else {
                comp = 0;
            }
            return comp;
        });
    };

    render() {
        const BaseDialog = sdk.getComponent("views.dialogs.BaseDialog");
        const DialogButtons = sdk.getComponent("views.elements.DialogButtons");

        const suggestedTiles = this.getSuggestedTiles();
        const selectedTiles = this.getSelectedTiles();

        let title;
        let roomMembers;
        let invite;

        if (this.props.kind === KIND_DM) {
            title = _t("Start a private conversation");
            invite = this._startDm;
        } else {
            // KIND_INVITE
            const room = MatrixClientPeg.get().getRoom(this.props.roomId);
            title = _t(
                "Invite in the <strong>%(roomName)s</strong> room",
                { roomName: room.name },
                { strong: label => <strong>{label}</strong> }
            );
            roomMembers = Object.values(room.currentState.members);
            invite = this._inviteUsers;
        }

        return (
            <BaseDialog
                className="watcha_InviteMemberDialog"
                onFinished={this.props.onFinished}
                {...{ title }}
            >
                <div className="mx_Dialog_content">
                    <div className="watcha_InviteMemberDialog_sourceContainer">
                        <Section
                            className="watcha_InviteMemberDialog_Section_suggestedList"
                            header={_t("Invite users")}
                        >
                            <SuggestedList
                                busy={this.state.busy}
                                onSearch={this.onSearch}
                                query={this.state.query}
                            >
                                {suggestedTiles}
                            </SuggestedList>
                        </Section>
                        <Section
                            className="watcha_InviteMemberDialog_Section_emailInvitation"
                            header={_t("Invite by email")}
                        >
                            <EmailInvitation
                                {...{ roomMembers }}
                                selectedList={this.state.selectedList}
                                addEmailAddressToSelectedList={
                                    this.addEmailAddressToSelectedList
                                }
                            />
                        </Section>
                    </div>
                    <Section header={_t("Invitation list")}>
                        <SelectedList
                            pendingSubmission={this.state.pendingSubmission}
                            resume={this.resume}
                            {...{ invite }}
                        >
                            {selectedTiles}
                        </SelectedList>
                    </Section>
                </div>
                <div className="error">{this.state.errorText}</div>
                <DialogButtons
                    primaryButton={_t("OK")}
                    onPrimaryButtonClick={this.onOk}
                    onCancel={this.props.onFinished}
                />
            </BaseDialog>
        );
    }
}

class EmailInvitation extends Component {
    static propTypes = {
        addEmailAddressToSelectedList: PropTypes.func.isRequired,
        selectedList: PropTypes.arrayOf(PropTypes.object).isRequired,
        roomMembers: PropTypes.arrayOf(PropTypes.object),
    };

    constructor(props) {
        super(props);
        this.state = {
            emailAddress: "",
            isValid: false,
            emailLooksValid: false,
            pendingSubmission: false,
        };
    }

    onChange = event => {
        this.setState({ emailAddress: event.target.value });
    };

    onClick = () => {
        this.setState({ pendingSubmission: true }, async () => {
            await this.submit();
            this.setState({ pendingSubmission: false });
        });
    };

    onKeyDown = event => {
        if (event.key === Key.ENTER) {
            this.onClick();
            event.preventDefault();
            event.stopPropagation();
        }
    };

    onValidate = async fieldState => {
        const result = await this._validationRules(fieldState);
        const emailLooksValid = Email.looksValid(this._fieldRef.input.value);
        this.setState({
            isValid: result.valid,
            emailLooksValid,
        });
        return result;
    };

    _validationRules = withValidation({
        rules: [
            {
                key: "notNull",
                test: async ({ value }) => !!value,
            },
            {
                key: "isValidOnSubmit",
                test: async ({ value }) =>
                    !value ||
                    !this.state.pendingSubmission ||
                    Email.looksValid(value),
                invalid: () => _t("Please enter a valid email address"),
            },
            {
                key: "emailAlreadyInInvitations",
                test: async ({ value }) =>
                    !value ||
                    !this.props.selectedList.some(
                        user => user.address === value
                    ),
                invalid: () =>
                    _t(
                        "You have already added this email address to the invitation list"
                    ),
            },
            {
                key: "userAlreadyInInvitations",
                test: async ({ value }) =>
                    !value ||
                    !this.props.selectedList.some(
                        user => user.email === value
                    ),
                invalid: () =>
                    _t(
                        "This email address belongs to a user you have already added to the invitation list"
                    ),
            },
            {
                key: "alreadyRoomMember",
                test: async ({ value }) =>
                    !value ||
                    !this.props.roomMembers ||
                    !this.props.roomMembers.some(
                        user =>
                            user.userId === convertEmailToUserId(value) &&
                            user.membership === "join"
                    ),
                invalid: () =>
                    _t(
                        "This email address belongs to a user who is already a room member"
                    ),
            },
            {
                key: "alreadySentInvitation",
                test: async ({ value }) =>
                    !value ||
                    !this.props.roomMembers ||
                    !this.props.roomMembers.some(
                        user =>
                            user.userId === convertEmailToUserId(value) &&
                            user.membership === "invite"
                    ),
                invalid: () =>
                    _t(
                        "An invitation has already been sent to this email address"
                    ),
            },
        ],
    });

    submit = async () => {
        const activeElement = document.activeElement;
        if (activeElement) {
            activeElement.blur();
        }

        const field = this._fieldRef;
        await field.validate({ allowEmpty: false });

        // Validation and state updates are async, so we need to wait for them to complete
        // first. Queue a `setState` callback and wait for it to resolve.
        await new Promise(resolve => this.setState({}, resolve));

        if (this.state.isValid) {
            this.props.addEmailAddressToSelectedList(this.state.emailAddress);
            this.setState({ emailAddress: "" });
        }
        field.focus();
        if (!this.state.isValid) {
            field.validate({ allowEmpty: false, focused: true });
        }
    };

    render() {
        const Field = sdk.getComponent("views.elements.Field");

        return (
            <div className="watcha_EmailInvitation">
                <div
                    className="watcha_InviteMemberDialog_emailAddressContainer"
                    onKeyDown={this.onKeyDown}
                >
                    <Field
                        id="emailAddress"
                        ref={ref => (this._fieldRef = ref)}
                        label={_t("Email")}
                        placeholder={_t("joe@example.com")}
                        value={this.state.emailAddress}
                        onChange={this.onChange}
                        onValidate={this.onValidate}
                        className="mx_CreateRoomDialog_name"
                    />
                    <div
                        className={classNames(
                            "watcha_InviteMemberDialog_addEmailAddressButton",
                            {
                                watcha_InviteMemberDialog_addEmailAddressButton_valid:
                                    this.state.isValid &&
                                    this.state.emailLooksValid,
                            }
                        )}
                        title={_t(
                            "Add an email address to the invitation list"
                        )}
                        onClick={this.onClick}
                    >
                        <span />
                    </div>
                </div>
            </div>
        );
    }
}

function Section({ className, header, children }) {
    return (
        <div
            className={classNames(
                "watcha_InviteMemberDialog_Section",
                className
            )}
        >
            <h2>{header}</h2>
            {children}
        </div>
    );
}

Section.propTypes = {
    header: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
};

function SuggestedList({ busy, query, onSearch, children }) {
    const Spinner = sdk.getComponent("views.elements.Spinner");
    const SearchBox = sdk.getComponent("structures.SearchBox");

    const hint = busy ? (
        <Spinner />
    ) : (
        <p>
            {_t(
                query
                    ? "No users match your search."
                    : "No user can be invited to join this room from the directory."
            )}
        </p>
    );

    return (
        <div className="watcha_InviteMemberDialog_SuggestedList">
            <SearchBox placeholder={_t("Filter users")} onSearch={onSearch} />
            <AutoHideScrollbar>{children || hint}</AutoHideScrollbar>
        </div>
    );
}

SuggestedList.defaultProps = {
    query: "",
};

SuggestedList.propTypes = {
    busy: PropTypes.bool,
    query: PropTypes.string,
    onSearch: PropTypes.func.isRequired,
    children: PropTypes.node,
};

class SelectedList extends Component {
    static propTypes = {
        pendingSubmission: PropTypes.bool.isRequired,
        invite: PropTypes.func.isRequired,
        resume: PropTypes.func.isRequired,
        children: PropTypes.node,
    };

    constructor() {
        super();
        this.state = {
            valid: false,
            feedback: null,
            feedbackVisible: false,
        };
    }

    componentDidUpdate(prevProps) {
        if (
            prevProps.pendingSubmission !== this.props.pendingSubmission &&
            this.props.pendingSubmission
        ) {
            this.validate({ focused: true }).then(valid => {
                if (valid) {
                    this.props.invite();
                } else {
                    this.div.focus();
                    this.props.resume();
                }
            });
        }
    }

    onBlur = () => {
        this.setState({ feedbackVisible: false });
    };

    _validationRules = withValidation({
        rules: [
            {
                key: "emptyInvitList",
                test: async ({ value }) =>
                    Array.isArray(value) && value.length > 0,
                invalid: () =>
                    _t(
                        "Please add people to the invitation list before validating the form"
                    ),
            },
        ],
    });

    async validate({ focused, allowEmpty = false }) {
        const value = this.props.children;
        const { valid, feedback } = await this._validationRules({
            value,
            focused,
            allowEmpty,
        });
        if (feedback) {
            this.setState({ feedback, feedbackVisible: true });
        } else {
            this.setState({ feedbackVisible: false });
        }
        return valid;
    }

    render() {
        const hint = (
            <div className="watcha_InviteMemberDialog_SelectedList_hint">
                <p>
                    {_t(
                        "Select the person you want to invite from the <strong>Invite users</strong> list.",
                        {},
                        { strong: label => <strong>{label}</strong> }
                    )}
                </p>
                <p>
                    {_t(
                        "If the person to invite is not in the list, enter their email address in the <strong>Invite by email</strong> field.",
                        {},
                        { strong: label => <strong>{label}</strong> }
                    )}
                </p>
                <p>
                    {_t(
                        "When you validate this form, an email will be sent to them, so that they can join the room."
                    )}
                </p>
            </div>
        );

        const feedbackVisible = this.state.feedbackVisible;
        const divClasses = classNames(
            "watcha_InviteMemberDialog_SelectedList",
            {
                watcha_InviteMemberDialog_SelectedList_invalid: feedbackVisible,
            }
        );

        const Tooltip = sdk.getComponent("elements.Tooltip");
        const tooltip = (
            <Tooltip
                tooltipClassName={"mx_Field_tooltip"}
                visible={this.state.feedbackVisible}
                label={this.state.feedback}
            />
        );

        return (
            <div
                ref={ref => (this.div = ref)}
                className={divClasses}
                onBlur={this.onBlur}
                tabIndex="-1"
            >
                <AutoHideScrollbar>
                    {this.props.children || hint}
                </AutoHideScrollbar>
                {tooltip}
            </div>
        );
    }
}

function convertEmailToUserId(email) {
    // follows the spec defined at https://github.com/watcha-fr/devops/blob/master/doc_email_userId.md
    // on the server watcha.bar.com (as per mx_hs_url var) :
    //      - converts foo@bar.com to @foo:watcha.bar.com (email of somebody on the company)
    //      - converts foo@gmail.com to @foo/gmail.com:watcha.bar.com (email of an external partner)

    const parts = email.split("@");
    let userId = "@" + parts[0];

    let homeServerDomain = MatrixClientPeg.get().getDomain();

    if (parts.length > 1) {
        const host = parts[1];

        // remove http:// or https:// at the beginning of the server name
        homeServerDomain = homeServerDomain.replace(/^https?:[/]{2}/, "");

        // remove port number and the trailing slash if any at the end of the server name (mostly useful for dev environments)
        homeServerDomain = homeServerDomain.replace(/(:[\d]+)?[/]?$/, "");

        // determine if the email NOT belongs to somebody of the company
        if (!RegExp(`${host}$`).test(homeServerDomain)) {
            userId += "/" + host;
        }
    }
    userId += ":" + homeServerDomain;
    return userId;
}

export default InviteMemberDialog;
