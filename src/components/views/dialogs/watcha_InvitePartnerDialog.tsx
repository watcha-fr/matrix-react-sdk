import React, { createRef } from "react";

import { Room } from "matrix-js-sdk/src/models/room";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";

import { _t } from "../../../languageHandler";
import { Key } from "../../../Keyboard";
import * as Email from "../../../email";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import Field from "../elements/Field";
import withValidation from "../elements/Validation";

import { IUser } from "./watcha_InviteDialog";

interface IProps {
    room?: Room;
    originalList: IUser[];
    suggestedList: IUser[];
    selectedList: IUser[];
    addEmailAddressToSelectedList: (emailAddress: string) => void;
    onFinished(): void;
}

interface IState {
    emailAddress: string;
    isValid: boolean;
    pendingSubmission: boolean;
}

export default class InvitePartnerDialog extends React.Component<IProps, IState> {
    private fieldRef: React.RefObject<Field> = createRef();

    constructor(props) {
        super(props);
        this.state = {
            emailAddress: "",
            isValid: false,
            pendingSubmission: false,
        };
    }

    public componentDidMount() {
        this.fieldRef.current.focus();
    }

    private onChange = event => {
        this.setState({ emailAddress: event.target.value });
    };

    private onOk = () => {
        this.setState({ pendingSubmission: true }, async () => {
            await this.submit();
        });
    };

    private onKeyDown = event => {
        if (event.key === Key.ENTER) {
            this.onOk();
            event.preventDefault();
            event.stopPropagation();
        } else {
            this.setState({ pendingSubmission: false });
        }
    };

    private onValidate = async fieldState => {
        const result = await this._validationRules(fieldState);
        this.setState({
            isValid: result.valid,
        });
        return result;
    };

    private _validationRules = withValidation<this, { value: string }>({
        deriveData: async ({ value }) => ({ value }),
        rules: [
            {
                key: "notNull",
                test: ({ value }) => !!value,
            },
            {
                key: "validUponSubmission",
                skip: () => !this.state.pendingSubmission,
                test: ({ value }) => Email.looksValid(value),
                invalid: () => _t("Please enter a valid email address"),
                final: true,
            },
            {
                key: "notMine",
                test: async ({ value }) => !(await Email.isMine(value)),
                invalid: () => _t("This email address is already bound to your account"),
                final: true,
            },
            {
                key: "notForbiddenDomain",
                skip: ({ value }) =>
                    this.props.selectedList.some(user => user.email === value) ||
                    this.props.suggestedList.some(user => user.email === value),
                test: ({ value }) => !Email.hasForbiddenDomainForPartner(value),
                invalid: ({ value }) =>
                    _t(
                        "Users with an email address belonging to this domain <b></b> should not be invited as external partners",
                        {},
                        { b: () => <b>{value.split("@")[1]}</b> }
                    ),
                final: true,
            },
            {
                key: "emailNotInInvitations",
                test: async ({ value }) => !this.props.selectedList.some(user => user.address === value),
                invalid: () => _t("You have already added this email address to the invitation list"),
                final: true,
            },
            {
                key: "userNotInInvitations",
                test: async ({ value }) => !this.props.selectedList.some(user => user.email === value),
                invalid: () => _t("This email address belongs to a user you have already added to the invitation list"),
                final: true,
            },
            {
                key: "notRoomMember",
                skip: () => !this.props.room,
                test: async ({ value }) => !this.isMemberWithMembership(value, "join"),
                invalid: () => _t("This email address belongs to a user who is already a room member"),
                final: true,
            },
            {
                key: "notInvited",
                skip: () => !this.props.room,
                test: async ({ value }) => !this.isMemberWithMembership(value, "invite"),
                invalid: () => _t("This email address belongs to a user already invited to this room"),
                final: true,
            },
        ],
    });

    private isMemberWithMembership = (emailAddress: string, membership: "join" | "invite"): boolean => {
        const user = this.getUserFromEmailAddress(emailAddress);
        if (!user) {
            return false;
        }
        const { room } = this.props;
        const members = room.getMembersWithMembership(membership);
        return members.some((member: RoomMember) => member.userId === user.address);
    };

    private getUserFromEmailAddress = (emailAddress: string) => {
        const { originalList } = this.props;
        for (const user of originalList) {
            if (user.email === emailAddress) {
                return user;
            }
        }
    };

    private submit = async () => {
        const { addEmailAddressToSelectedList, onFinished } = this.props;
        const { emailAddress } = this.state;

        const field = this.fieldRef.current;
        await field.validate({ allowEmpty: false });

        // Validation and state updates are async, so we need to wait for them to complete
        // first. Queue a `setState` callback and wait for it to resolve.
        await new Promise<void>(resolve => {
            this.setState({}, resolve);
        });

        if (this.state.isValid) {
            addEmailAddressToSelectedList(emailAddress);
            onFinished();
        } else {
            field.focus();
            if (!this.state.isValid) {
                field.validate({ allowEmpty: false, focused: true });
            }
        }
    };

    public render() {
        const { onFinished } = this.props;
        const { emailAddress } = this.state;

        return (
            <BaseDialog
                className="watcha_InvitePartnerDialog"
                title={_t("Invite by email")}
                onKeyDown={this.onKeyDown}
                onFinished={onFinished}
            >
                <div className="mx_Dialog_content">
                    <Field
                        id="emailAddress"
                        ref={this.fieldRef}
                        label={_t("Email")}
                        placeholder={_t("joe@example.com")}
                        value={emailAddress}
                        onChange={this.onChange}
                        onValidate={this.onValidate}
                    />
                </div>
                <DialogButtons primaryButton={_t("OK")} onPrimaryButtonClick={this.onOk} onCancel={onFinished} />
            </BaseDialog>
        );
    }
}
