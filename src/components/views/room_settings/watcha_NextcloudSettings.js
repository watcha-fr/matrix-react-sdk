import classNames from "classnames";
import PropTypes from "prop-types";
import React, { useRef, useState } from "react";

import { _t } from "../../../languageHandler";
import * as sdk from "../../../index";
import AccessibleButton from "../elements/AccessibleButton";
import Field from "../elements/Field";
import Modal from "../../../Modal";
import SettingsStore from "../../../settings/SettingsStore";

import Spinner from "../elements/watcha_DelayedSpinner";

const NextcloudSettings = ({ roomId }) => {
    const [nextcloudFolder, setNextcloudFolder] = useState(
        SettingsStore.getValue("nextcloudShare", roomId)
    );
    const [isBusy, setIsBusy] = useState(false);
    const [errorText, setErrorText] = useState(null);

    const shareDialogIsBusyRef = useRef(false);

    const onShare = () => {
        setErrorText(null);
        const NextcloudShareDialog = sdk.getComponent(
            "dialogs.watcha_NextcloudShareDialog"
        );
        const targetFolder =
            nextcloudFolder ||
            new URL("nextcloud/apps/files/?dir=/", window.location.origin).href;
        const setShareDialogIsBusy = value => {
            shareDialogIsBusyRef.current = value;
        };
        const options = {
            onBeforeClose: reason => {
                return reason == "backgroundClick" &&
                    shareDialogIsBusyRef.current
                    ? false
                    : true;
            },
        };
        const modal = Modal.appendTrackedDialog(
            "Nextcloud share",
            "",
            NextcloudShareDialog,
            { roomId, targetFolder, setShareDialogIsBusy },
            /*className=*/ null,
            options
        );
        modal.finished.then(([selectedFolder]) => {
            if (selectedFolder) {
                setNextcloudFolder(selectedFolder);
            }
        });
    };

    const onUnshare = () => {
        setIsBusy(true);
        setErrorText(null);
        SettingsStore.setValue("nextcloudShare", roomId, "room", null)
            .then(() => {
                setNextcloudFolder(null);
            })
            .catch(error => {
                console.error(error);
                setErrorText(error.message);
            })
            .finally(() => {
                setIsBusy(false);
            });
    };

    const notice = SettingsStore.getDisplayName("nextcloudShare");

    let sharedFolderField;
    let stopSharingButton;
    if (nextcloudFolder) {
        const params = new URL(nextcloudFolder).searchParams;
        const path = params.get("dir");
        const relativePath = path ? path.replace(/^\//, "") : null;
        sharedFolderField = (
            <Field
                className={classNames({
                    watcha_NextcloudShareDialog_Field_rootSelection: !relativePath,
                })}
                element="input"
                label={_t("Shared folder")}
                value={relativePath}
                disabled
            />
        );
        stopSharingButton = (
            <AccessibleButton
                kind="danger_outline"
                onClick={onUnshare}
                disabled={isBusy}
            >
                {_t("Stop sharing")}
            </AccessibleButton>
        );
    }

    return (
        <React.Fragment>
            <span className="watcha_NextcloudSettings_Notice">{notice}</span>
            {sharedFolderField}
            <div className="error">{errorText}</div>
            <div className="watcha_NextcloudSettings_Buttons">
                {stopSharingButton}
                {isBusy && <Spinner />}
                <AccessibleButton
                    kind="primary"
                    onClick={onShare}
                    disabled={isBusy}
                >
                    {_t(
                        nextcloudFolder
                            ? "Change the shared folder"
                            : "Share a folder"
                    )}
                </AccessibleButton>
            </div>
        </React.Fragment>
    );
};

NextcloudSettings.propTypes = {
    roomId: PropTypes.string.isRequired,
};

export default NextcloudSettings;
