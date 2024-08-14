/*
Copyright 2022 Watcha

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

import React, { createRef } from "react";
import { debounce } from "lodash";
import { IInvite3PID } from "matrix-js-sdk/src/@types/requests";
import { Room } from "matrix-js-sdk/src/models/room";
import classNames from "classnames";

import { MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import { _t } from "../../../languageHandler";
import { findDMForUser } from "../../../utils/dm/findDMForUser";
import { getAddressType } from "../../../UserAddress";
import { inviteMultipleToRoom } from "../../../RoomInvite";
import { InviteKind } from "./InviteDialogTypes";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { privateShouldBeEncrypted } from "../../../utils/rooms";
import { UIFeature } from "../../../settings/UIFeature";
import * as Avatar from "../../../Avatar";
import AccessibleButton from "../elements/AccessibleButton";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import BaseAvatar from "../avatars/BaseAvatar";
import BaseDialog from "./BaseDialog";
import createRoom, { canEncryptToAllUsers } from "../../../createRoom";
import DialogButtons from "../elements/DialogButtons";
import dis from "../../../dispatcher/dispatcher";
import DMRoomMap from "../../../utils/DMRoomMap";
import EntityTile from "../rooms/EntityTile";
import Modal from "../../../Modal";
import SearchBox from "../../structures/SearchBox";
import SettingsStore from "../../../settings/SettingsStore";
import Spinner from "../elements/Spinner";
import Tooltip from "../elements/Tooltip";
import InvitePartnerDialog from "./watcha_InvitePartnerDialog";

const VALIDATION_THROTTLE_MS = 500;
const AVATAR_SIZE = 36;

/* eslint-disable camelcase */
interface ISearchUserDirectory {
    limited: boolean;
    results: {
        user_id: string;
        display_name?: string;
        avatar_url?: string;
        email: string;
    }[];
}
/* eslint-enable camelcase */

export interface IUser {
    address: string;
    addressType: "mx-user-id" | "email";
    displayName: string;
    avatarUrl?: string;
    email?: string;
    membership?: "invite" | "join" | "leave" | "ban";
    isKnown?: boolean;
}

interface IInviteDialogState {
    originalList: IUser[];
    suggestedList: IUser[];
    selectedList: IUser[];
    query: string;
    pendingSearch: boolean;
    busy: boolean;
    errorText?: string | null;
}


interface BaseProps {
    // Takes a boolean which is true if a user / users were invited /
    // a call transfer was initiated or false if the dialog was cancelled
    // with no action taken.
    onFinished: (success?: boolean) => void;

    // Initial value to populate the filter with
    initialText?: string;
}

interface InviteDMProps extends BaseProps {
    // The kind of invite being performed. Assumed to be InviteKind.Dm if not provided.
    kind?: InviteKind.Dm;
}

interface InviteRoomProps extends BaseProps {
    kind: InviteKind.Invite;

    // The room ID this dialog is for. Only required for InviteKind.Invite.
    roomId: string;
}

interface InviteCallProps extends BaseProps {
    kind: InviteKind.CallTransfer;

    // The call to transfer. Only required for InviteKind.CallTransfer.
    call: MatrixCall;
}

type Props = InviteDMProps | InviteRoomProps | InviteCallProps;

export default class InviteDialog extends React.PureComponent<Props, IInviteDialogState> {
    static defaultProps: Partial<Props> = {
        kind: InviteKind.Dm,
    };

    constructor(props: Props) {
        super(props);
        this.state = {
            originalList: [],
            suggestedList: [],
            selectedList: [],
            query: "",
            pendingSearch: false,
            busy: false,
            errorText: null,
        };
    }

    componentDidMount() {
        this.doUserDirectorySearch(this.state.query);
    }

    showInvitePartnerDialog = () => {
        const { roomId } = this.props;
        const { originalList, suggestedList, selectedList } = this.state;
        const room = MatrixClientPeg.get()?.getRoom(roomId);
        Modal.createDialog(InvitePartnerDialog, {
            room,
            originalList,
            suggestedList,
            selectedList,
            addEmailAddressToSelectedList: this.addEmailAddressToSelectedList,
        });
    };

    onSearch = debounce((term: string) => {
        this.doUserDirectorySearch(term);
    }, VALIDATION_THROTTLE_MS);

    onOk = () => {
        this.setState({ busy: true });
    };

    resume = () => {
        this.setState({ busy: false });
    };

    addEmailAddressToSelectedList = (emailAddress: any) => {
        let knownUser;
        const { originalList } = this.state;
        for (const user of originalList) {
            if (user.email === emailAddress) {
                knownUser = user;
                break;
            }
        }

        if (!knownUser) {
            const newUser = {
                address: emailAddress,
                addressType: "email",
                displayName: emailAddress,
            } as IUser;
            this.setState(({ selectedList }) => ({
                selectedList: [newUser, ...selectedList],
            }));
        } else {
            this.addToSelectedList(knownUser);
        }
    };

    addToSelectedList = (user: any) => {
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
            return {};
        });
    };

    removeEmailAddressFromSelectedList = (user: any) => {
        this.setState(({ selectedList }) => {
            for (let i = 0; i < selectedList.length; i++) {
                if (selectedList[i] === user) {
                    selectedList.splice(i, 1);
                    return { selectedList };
                }
            }
            return {};
        });
    };

    removeFromSelectedList = (user: any) => {
        this.setState(({ suggestedList, selectedList }) => {
            for (let i = 0; i < selectedList.length; i++) {
                if (selectedList[i] === user) {
                    suggestedList = this.getSortedUserList([...suggestedList, user]);
                    selectedList.splice(i, 1);
                    return { suggestedList, selectedList };
                }
            }
            return {};
        });
    };

    getSortedUserList = (list: any[]) => {
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

    getSuggestedTiles = () => {
        const { suggestedList } = this.state;
        const suggestedTiles = suggestedList.map(user => {
            const commonProps = {
                key: user.address,
                name: user.displayName,
                avatarJsx: this.getBaseAvatar(user),
            };
            const subtextLabel = {
                join: _t("watcha|already_room_member"),
                invite: _t("watcha|already_invited"),
            };
            return subtextLabel.hasOwnProperty(user.membership) ? (
                <EntityTile
                    {...commonProps}
                    className="watcha_InviteDialog_EntityTile_roomMember"
                    subtextLabel={subtextLabel[user.membership]}
                    presenceState="offline"
                    suppressOnHover={true}
                />
            ) : (
                <EntityTile
                    {...commonProps}
                    subtextLabel={user.displayName !== user.email ? user.email : undefined}
                    title={_t("Click to add this user to the invitation list")}
                    showPresence={false}
                    onClick={() => {
                        this.addToSelectedList(user);
                    }}
                />
            );
        });
        if (suggestedTiles.length > 0) {
            return suggestedTiles;
        }
    };

    getSelectedTiles = () => {
        const { selectedList } = this.state;
        const selectedTiles = selectedList.map(user => {
            const commonProps = {
                key: user.address,
                className: "watcha_InviteDialog_EntityTile_invite",
                name: user.displayName,
                title: _t("Click to remove this invitation"),
                showPresence: false,
            };
            return user.isKnown ? (
                <EntityTile
                    {...commonProps}
                    subtextLabel={user.displayName !== user.email ? user.email : undefined}
                    avatarJsx={this.getBaseAvatar(user)}
                    onClick={() => {
                        this.removeFromSelectedList(user);
                    }}
                />
            ) : (
                <EntityTile
                    {...commonProps}
                    className={classNames(commonProps.className, "watcha_InviteDialog_EntityTile_partner")}
                    subtextLabel={_t("An invitation will be sent to this email address")}
                    avatarJsx={this.getBaseAvatar(
                        user,
                        null,
                        /* eslint-disable-next-line @typescript-eslint/no-var-requires */
                        require("../../../../res/img/watcha/watcha_paper-plane.svg").default,
                    )}
                    onClick={() => {
                        this.removeEmailAddressFromSelectedList(user);
                    }}
                />
            );
        });
        if (selectedTiles.length > 0) {
            return selectedTiles;
        }
    };

    getBaseAvatar = (user, name?: string, url?: string) => {
        if (!name) {
            name = user.displayName || user.address;
        }
        if (!url) {
            url = Avatar.avatarUrlForUser(user, AVATAR_SIZE, AVATAR_SIZE);
        }
        return <BaseAvatar width={AVATAR_SIZE} height={AVATAR_SIZE} {...{ name, url }} />;
    };

    // come from src/components/views/dialogs/AddressPickerDialog.js
    doUserDirectorySearch(query) {
        this.setState({
            query,
            pendingSearch: true,
        });
        MatrixClientPeg.get()
            .searchUserDirectory({
                term: query,
                limit: 500,
            })
            .then((resp: ISearchUserDirectory) => {
                // The query might have changed since we sent the request, so ignore
                // responses for anything other than the latest query.
                if (this.state.query !== query) {
                    return;
                }
                this.processResults(resp.results, query);
            })
            .catch(err => {
                console.error("Error whilst searching user directory: ", err);
                this.setState({ errorText: err.errcode ? err.message : _t("Something went wrong!") });
            })
            .then(() => {
                this.setState({ pendingSearch: false });
            });
    }

    // inspired from src/components/views/dialogs/AddressPickerDialog.js
    processResults = (results, query) => {
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
                membership = room.getMember(userId)?.membership;
            }

            // TODO: as the upstream interface has changed, it should be simplified by removing useless fields
            if (this.state.selectedList.every(user => user.address != userId)) {
                suggestedList.push({
                    address: userId,
                    addressType: "mx-user-id",
                    displayName,
                    avatarUrl: user.avatar_url,
                    email,
                    membership,
                    isKnown: true,
                });
            }
        }

        this.setState({ suggestedList: this.getSortedUserList(suggestedList) });

        if (!this.state.originalList.length) {
            this.setState({ originalList: suggestedList });
        }
    };

    // come from src/components/views/dialogs/InviteDialog.tsx
    startDm = async () => {
        this.setState({ busy: true });
        const client = MatrixClientPeg.get();
        // const targets = this._convertFilter();
        // const targetIds = targets.map(t => t.userId);
        const targets = this.state.selectedList;
        const targetIds = targets.map(user => user.address);

        // Check if there is already a DM with these people and reuse it if possible.
        let existingRoom: Room;
        if (targetIds.length === 1) {
            existingRoom = findDMForUser(client, targetIds[0]);
        } else {
            existingRoom = DMRoomMap.shared().getDMRoomForIdentifiers(targetIds);
        }
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

        const createRoomOptions = { inlineErrors: true } as any; // XXX: Type out `createRoomOptions`

        if (privateShouldBeEncrypted()) {
            // Check whether all users have uploaded device keys before.
            // If so, enable encryption in the new room.
            // const has3PidMembers = targets.some(t => t instanceof ThreepidMember);
            const has3PidMembers = targets.some(user => user.addressType === "email");
            if (!has3PidMembers) {
                const allHaveDeviceKeys = await canEncryptToAllUsers(client, targetIds);
                if (allHaveDeviceKeys) {
                    createRoomOptions.encryption = true;
                }
            }
        }

        // Check if it's a traditional DM and create the room if required.
        // TODO: [Canonical DMs] Remove this check and instead just create the multi-person DM
        try {
            const isSelf = targetIds.length === 1 && targetIds[0] === client.getUserId();
            if (targetIds.length === 1 && !isSelf) {
                createRoomOptions.dmUserId = targetIds[0];
            }

            if (targetIds.length > 1) {
                createRoomOptions.createOpts = targetIds.reduce(
                    (roomOptions, address) => {
                        const type = getAddressType(address);
                        if (type === "email") {
                            const invite: IInvite3PID = {
                                // id_server: client.getIdentityServerUrl(true),
                                id_server: "fake-is.watcha.fr", // until we have an IS
                                medium: "email",
                                address,
                            };
                            roomOptions.invite_3pid.push(invite);
                        } else if (type === "mx-user-id") {
                            roomOptions.invite.push(address);
                        }
                        return roomOptions;
                    },
                    { invite: [], invite_3pid: [] },
                );
            }

            await createRoom(createRoomOptions);
            this.props.onFinished();
        } catch (err) {
            console.error(err);
            this.setState({
                busy: false,
                errorText: _t("We couldn't create your DM."),
            });
        }
    };

    // come from src/components/views/dialogs/InviteDialog.tsx
    inviteUsers = () => {
        this.setState({ busy: true });
        // this._convertFilter();
        // const targets = this._convertFilter();
        // const targetIds = targets.map(t => t.userId);
        const { selectedList } = this.state;
        const targetIds = selectedList.map(user => user.address);

        const room = MatrixClientPeg.get().getRoom(this.props.roomId);
        if (!room) {
            console.error("Failed to find the room to invite users to");
            this.setState({
                busy: false,
                errorText: _t("Something went wrong trying to invite the users."),
            });
            return;
        }

        inviteMultipleToRoom(this.props.roomId, targetIds)
            .then(result => {
                if (!this.shouldAbortAfterInviteError(result)) {
                    // handles setting error message too
                    this.props.onFinished();
                }
            })
            .catch(err => {
                console.error(err);
                this.setState({
                    busy: false,
                    errorText: _t(
                        "We couldn't invite those users. Please check the users you want to invite and try again.",
                    ),
                });
            });
    };

    // come from src/components/views/dialogs/InviteDialog.tsx
    shouldAbortAfterInviteError(result) {
        const failedUsers = Object.keys(result.states).filter(a => result.states[a] === "error");
        if (failedUsers.length > 0) {
            this.setState({
                busy: false,
                errorText: _t(
                    "The following users might not exist or are invalid, and cannot be invited: %(csvNames)s",
                    {
                        csvNames: failedUsers.join(", "),
                    },
                ),
            });
            return true; // abort
        }
        return false;
    }

    render() {
        const { kind, roomId, onFinished } = this.props;
        const { pendingSearch, query, busy, errorText } = this.state;

        const suggestedTiles = this.getSuggestedTiles();
        const selectedTiles = this.getSelectedTiles();

        let title;
        let invite;

        if (kind === InviteKind.Dm) {
            title = _t("Start chat");
            invite = this.startDm;
        } else {
            // KIND_INVITE
            const room = MatrixClientPeg.get().getRoom(roomId);
            title = _t(
                "Invite to <span>%(roomName)s</span>",
                { roomName: room.name },
                { span: label => <span className="mx_RoomHeader_settingsHint">{ label }</span> },
            );
            invite = this.inviteUsers;
        }

        return (
            <BaseDialog className="watcha_InviteDialog" {...{ title, onFinished }}>
                <div className="mx_Dialog_content">
                    <div className="watcha_InviteDialog_userLists">
                        <Section header={_t("User directory")}>
                            <SuggestedList onSearch={this.onSearch} emptyQuery={!!query} {...{ pendingSearch }}>
                                { suggestedTiles }
                            </SuggestedList>
                        </Section>
                        <Section header={_t("Invitation list")}>
                            <SelectedList resume={this.resume} {...{ busy, invite }}>
                                { selectedTiles }
                            </SelectedList>
                        </Section>
                    </div>
                    { SettingsStore.getValue(UIFeature.watcha_Partner) &&
                        <AccessibleButton
                            className="watcha_InviteDialog_invitePartnerButton"
                            onClick={this.showInvitePartnerDialog}
                        >
                            <>
                                { _t(
                                    "You want to collaborate with a partner from outside your organisation: " +
                                    "invite them by e-mail",
                                ) }
                                <img src={require("../../../../res/img/watcha/watcha_paper-plane.svg").default} />
                            </>
                        </AccessibleButton>
                    }
                </div>
                <div className="error">{ errorText }</div>
                <DialogButtons
                    primaryButton={_t("OK")}
                    disabled={busy}
                    onPrimaryButtonClick={this.onOk}
                    onCancel={onFinished}
                />
                { busy ? (
                    <div className="watcha_InviteDialog_Spinner">
                        <Spinner />
                    </div>
                ) : null }
            </BaseDialog>
        );
    }
}

interface ISectionProps {
    className?: string;
    header: string;
}

const Section: React.FC<ISectionProps> = ({ className, header, children }) => (
    <div className={classNames("watcha_InviteDialog_Section", className)}>
        <h2>{ header }</h2>
        { children }
    </div>
);

interface ISuggestedListProps {
    pendingSearch?: boolean;
    emptyQuery?: boolean;
    onSearch: (term: string) => void;
}

const SuggestedList: React.FC<ISuggestedListProps> = ({ pendingSearch, children, emptyQuery, onSearch }) => {
    let content;
    if (pendingSearch) {
        content = <Spinner />;
    } else if (children) {
        content = <AutoHideScrollbar>{ children }</AutoHideScrollbar>;
    } else {
        content = (
            <div className="watcha_InviteDialog_list_hint">
                <span>
                    { _t(
                        emptyQuery
                            ? "No users match your search."
                            : "No user can be invited to join this room from the directory.",
                    ) }
                </span>
            </div>
        );
    }

    return (
        <div className="watcha_InviteDialog_list">
            <SearchBox placeholder={_t("Filter users")} onSearch={onSearch} />
            { content }
        </div>
    );
};

interface ISelectedListProps {
    busy: boolean;
    invite(): void;
    resume(): void;
}

interface ISelectedListState {
    feedback?: React.ReactChild;
}

class SelectedList extends React.Component<ISelectedListProps, ISelectedListState> {
    private containerRef: React.RefObject<HTMLDivElement> = createRef();

    constructor(props) {
        super(props);
        this.state = { feedback: null };
    }

    public componentDidUpdate(prevProps) {
        const { busy } = this.props;
        if (busy && !prevProps.busy) {
            this.validate();
        }
    }

    private onBlur = () => {
        this.setState({ feedback: null });
    };

    private validate() {
        const { invite, resume, children } = this.props;
        if (Array.isArray(children) && children.length) {
            invite();
        } else {
            const feedback = (
                <div className="mx_Validation">
                    <ul className="mx_Validation_details">
                        <li className="mx_Validation_detail mx_Validation_invalid">
                            { _t("Please select one or more users before submitting") }
                        </li>
                    </ul>
                </div>
            );
            this.setState({ feedback });
            this.containerRef.current.focus();
            resume();
        }
    }

    public render() {
        const { children } = this.props;
        const { feedback } = this.state;

        const className = classNames("watcha_InviteDialog_list", {
            watcha_InviteDialog_list_invalid: !!feedback,
        });

        const content = children ? (
            <AutoHideScrollbar>{ children }</AutoHideScrollbar>
        ) : (
            <div className="watcha_InviteDialog_list_hint">
                <span>{ _t("Select users<br/>Invite them<br/>Collaborate!", {}, { br: () => <br /> }) }</span>
            </div>
        );

        return (
            <div
                ref={this.containerRef}
                className={className}
                onBlur={this.onBlur}
                tabIndex={-1} // mandatory for `onBlur` to be effective
            >
                { content }
                <Tooltip
                    tooltipClassName="mx_Field_tooltip"
                    visible={!!feedback}
                    label={feedback}
                    alignment={Tooltip.Alignment.Right}
                />
            </div>
        );
    }
}
