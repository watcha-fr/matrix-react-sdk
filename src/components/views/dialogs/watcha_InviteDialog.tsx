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
import { IInviteResult, inviteMultipleToRoom } from "../../../RoomInvite";
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
    results: IUserDirectoryResult[];
}

interface IUserDirectoryResult {
    user_id: string;
    display_name?: string;
    avatar_url?: string;
    email?: string;
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
        initialText: "",
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

        if (props.kind === InviteKind.Invite && !props.roomId) {
            throw new Error("When using InviteKind.Invite a roomId is required for an InviteDialog");
        }
        
    }

    componentDidMount() {
        this.doUserDirectorySearch(this.state.query);
    }

    showInvitePartnerDialog = () => {
        if (this.props.kind === InviteKind.Invite) {
            const { originalList, suggestedList, selectedList } = this.state;
            const room = MatrixClientPeg.get()?.getRoom(this.props.roomId) || undefined;
            Modal.createDialog(InvitePartnerDialog, {
                room,
                originalList,
                suggestedList,
                selectedList,
                addEmailAddressToSelectedList: this.addEmailAddressToSelectedList,
            });
        }
        else if(this.props.kind === InviteKind.Dm) {
            const { originalList, suggestedList, selectedList } = this.state;
            Modal.createDialog(InvitePartnerDialog, {
                originalList,
                suggestedList,
                selectedList,
                addEmailAddressToSelectedList: this.addEmailAddressToSelectedList,
            });
        }
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

    addToSelectedList = (user: IUser) => {
        this.setState(({ suggestedList, selectedList }) => {
            const updatedSuggestedList = [...suggestedList];
            const index = updatedSuggestedList.findIndex((u) => u === user);
            if (index !== -1) {
                updatedSuggestedList.splice(index, 1);
                return {
                    suggestedList: updatedSuggestedList,
                    selectedList: [user, ...selectedList],
                };
            }
            return null;
        });
    };
    

    removeEmailAddressFromSelectedList = (user: IUser) => {
        this.setState(({ selectedList }) => {
            const updatedSelectedList = [...selectedList];
            const index = updatedSelectedList.findIndex((u) => u === user);
            if (index !== -1) {
                updatedSelectedList.splice(index, 1);
                return { selectedList: updatedSelectedList };
            }
            return null;
        });
    };
    

    removeFromSelectedList = (user: IUser) => {
        this.setState(({ suggestedList, selectedList }) => {
            const updatedSelectedList = [...selectedList];
            const index = updatedSelectedList.findIndex((u) => u === user);
    
            if (index !== -1) {
                updatedSelectedList.splice(index, 1);
                const updatedSuggestedList = this.getSortedUserList([...suggestedList, user]);
                return {
                    suggestedList: updatedSuggestedList,
                    selectedList: updatedSelectedList,
                };
            }
            return null;
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
            return user.membership && subtextLabel.hasOwnProperty(user.membership) && (user.membership === "join" || user.membership === "invite") ? (
                <EntityTile
                    {...commonProps}
                    userId={user.address}
                    className="watcha_InviteDialog_EntityTile_roomMember"
                    subtextLabel={subtextLabel[user.membership]}
                    presenceState="offline"
                />
            ) : (
                <EntityTile
                    {...commonProps}
                    userId={user.address}
                    subtextLabel={user.displayName !== user.email ? user.email : undefined}
                    title={_t("watcha|invite_user")}
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
                title: _t("watcha|remove_invitation"),
                showPresence: false,
            };
            return user.isKnown ? (
                <EntityTile
                    {...commonProps}
                    userId={user.address}
                    subtextLabel={user.displayName !== user.email ? user.email : undefined}
                    avatarJsx={this.getBaseAvatar(user)}
                    onClick={() => {
                        this.removeFromSelectedList(user);
                    }}
                />
            ) : (
                <EntityTile
                    {...commonProps}
                    userId={user.address}
                    className={classNames(commonProps.className, "watcha_InviteDialog_EntityTile_partner")}
                    subtextLabel={_t("watcha|send_invitation_mail")}
                    avatarJsx={this.getBaseAvatar(
                        user,
                        undefined,
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

    getBaseAvatar = (user: IUser, name?: string, url?: string) => {
        if (!name) {
            name = user.displayName || user.address;
        }
        if (!url) {
            url = Avatar.avatarUrlForUser(user, AVATAR_SIZE, AVATAR_SIZE) ?? undefined;
        }
        return <BaseAvatar size={`${AVATAR_SIZE}px`} {...{ name, url }} />;
    };

    // come from src/components/views/dialogs/AddressPickerDialog.js
    doUserDirectorySearch(query: string) {
        this.setState({
            query,
            pendingSearch: true,
        });
        MatrixClientPeg.get()!
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
                if(err.errcode === "M_FORBIDDEN"){
                    this.setState({ errorText: _t("watcha|error_start_dm") });
                }
                else {
                    this.setState({ errorText: err.errcode ? err.message : _t("error|something_went_wrong") });
                }
            })
            .then(() => {
                this.setState({ pendingSearch: false });
            });
    }

    // inspired from src/components/views/dialogs/AddressPickerDialog.js
    processResults = (results: IUserDirectoryResult[], query: string) => {
        const suggestedList: IUser[] = [];
        const client = MatrixClientPeg.get();

        for (const user of results) {
            const userId = user.user_id;
            if (client && userId === client.credentials.userId) {
                continue; // remove the actual user from the list of users
            }
            const email = user.email;
            const displayName = user.display_name || email || userId;

            let membership: "invite" | "join" | "leave" | "ban" | undefined;
            if (this.props.kind === InviteKind.Invite) {
                const room = client?.getRoom(this.props.roomId);
                membership = room?.getMember(userId)?.membership as "invite" | "join" | "leave" | "ban" | undefined;
            }

            const addressType: "mx-user-id" | "email" = user.email ? "email" : "mx-user-id";

            // TODO: as the upstream interface has changed, it should be simplified by removing useless fields
            if (this.state.selectedList.every(user => user.address != userId)) {
                suggestedList.push({
                    address: userId,
                    addressType,
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
        let existingRoom: Room | undefined | null;
        if (targetIds.length === 1 && client) {
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

        if (client && privateShouldBeEncrypted(client)) {
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
            if(client){
                const isSelf = targetIds.length === 1 && targetIds[0] === client.getUserId();
                if (targetIds.length === 1 && !isSelf) {
                    createRoomOptions.dmUserId = targetIds[0];
                }

                if (targetIds.length > 1) {
                    createRoomOptions.createOpts = targetIds.reduce<{
                        invite_3pid: IInvite3PID[];
                        invite: string[];
                    }>(
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

                await createRoom(client, createRoomOptions);
                this.props.onFinished();
            }
        } catch (err) {
            console.error(err);
            this.setState({
                busy: false,
                errorText: _t("invite|error_dm"),
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
        if (this.props.kind === InviteKind.Invite) {
            const client = MatrixClientPeg.get();
            const room = client?.getRoom(this.props.roomId);
            if (!room) {
                console.error("Failed to find the room to invite users to");
                this.setState({
                    busy: false,
                    errorText: _t("invite|error_find_room"),
                });
                return;
            }
            if(client){
                inviteMultipleToRoom(client, this.props.roomId, targetIds, true)
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
                                "invite|error_invite",
                            ),
                        });
                    });
            }
        }
    };

    // come from src/components/views/dialogs/InviteDialog.tsx
    shouldAbortAfterInviteError(result: IInviteResult) {
        const failedUsers = Object.keys(result.states).filter(a => result.states[a] === "error");
        if (failedUsers.length > 0) {
            this.setState({
                busy: false,
                errorText: _t(
                    "invite|error_find_user_description",
                    {
                        csvNames: failedUsers.join(", "),
                    },
                ),
            });
            return true; // abort
        }
        return false;
    }

    render(): React.ReactNode {
        const { onFinished } = this.props;
        const { pendingSearch, query, busy, errorText } = this.state;

        const suggestedTiles = this.getSuggestedTiles();
        const selectedTiles = this.getSelectedTiles();

        let title;
        let invite;

        if (this.props.kind === InviteKind.Dm){
            title = _t("action|start_chat");
            //invite = this.inviteUsers;
            invite = this.startDm;
        } else if (this.props.kind === InviteKind.Invite) {
            // KIND_INVITE
            const roomId = this.props.roomId;
            const room = MatrixClientPeg.get()?.getRoom(roomId);
            const isSpace = room?.isSpaceRoom();
            title = isSpace
                ? _t("invite|to_space", {
                      spaceName: room?.name || _t("common|unnamed_space"),
                  })
                : _t("invite|to_room", {
                      roomName: room?.name || _t("common|unnamed_room"),
                  });
            invite = this.inviteUsers;
        }

        return (
            <BaseDialog className="watcha_InviteDialog" {...{ title, onFinished }}>
                <div className="mx_Dialog_content">
                    <div className="watcha_InviteDialog_userLists">
                        <Section header={_t("invite|transfer_user_directory_tab")}>
                            <SuggestedList onSearch={this.onSearch} emptyQuery={!!query} {...{ pendingSearch }}>
                                { suggestedTiles }
                            </SuggestedList>
                        </Section>
                        <Section header={_t("watcha|invitation_list")}>
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
                                { _t("watcha|invtation_externe",) }
                                <img src={require("../../../../res/img/watcha/watcha_paper-plane.svg").default} />
                            </>
                        </AccessibleButton>
                    }
                </div>
                <div className="error">{ errorText }</div>
                <DialogButtons
                    primaryButton={_t("action|ok")}
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
                            ? "watcha|no_users_match"
                            : "watcha|no_user_can_be_invited",
                    ) }
                </span>
            </div>
        );
    }

    return (
        <div className="watcha_InviteDialog_list">
            <SearchBox placeholder={_t("watcha|filter_users")} onSearch={onSearch} />
            { content }
        </div>
    );
};

interface ISelectedListProps {
    busy: boolean;
    invite?: () => void;
    resume(): void;
}

interface ISelectedListState {
    feedback?: React.ReactChild;
}

class SelectedList extends React.Component<ISelectedListProps, ISelectedListState> {
    private containerRef: React.RefObject<HTMLDivElement> = createRef();

    constructor(props: ISelectedListProps) {
        super(props);
        this.state = { feedback: undefined };
    }

    public componentDidUpdate(prevProps: ISelectedListProps) {
        const { busy } = this.props;
        if (busy && !prevProps.busy) {
            this.validate();
        }
    }

    private onBlur = () => {
        this.setState({ feedback: undefined });
    };

    private validate() {
        const { invite, resume, children } = this.props;
        if (Array.isArray(children) && children.length) {
            invite?.();
        } else {
            const feedback = (
                <div className="mx_Validation">
                    <ul className="mx_Validation_details">
                        <li className="mx_Validation_detail mx_Validation_invalid">
                            { _t("watcha|select_one_or_more_users") }
                        </li>
                    </ul>
                </div>
            );
            this.setState({ feedback });
            this.containerRef.current!.focus();
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
                <span>{ _t("watcha|invite_dialog", {}, { br: () => <br /> }) }</span>
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
