import classNames from "classnames";
import PropTypes from "prop-types";
import React, { useEffect, useRef, useState } from "react";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import Field from "../elements/Field";
import Modal from "../../../Modal";
import SettingsStore from "../../../settings/SettingsStore";
import Spinner from "../elements/Spinner";

import NextcloudShareDialog from "../dialogs/watcha_NextcloudShareDialog";

function useSafeState(initialState) {
    const isMounted = useRef();
    const [state, setState] = useState(initialState);
    useEffect(() => {
        isMounted.current = true;
        return () => (isMounted.current = false);
    }, []);
    const _setState = value => {
        if (isMounted.current) {
            return setState(value);
        }
    };
    return [state, _setState];
}

const NextcloudSettings = ({ roomId }) => {
    const [nextcloudShare, setNextcloudShare] = useState(SettingsStore.getValue("nextcloudShare", roomId));
    const [isBusy, setIsBusy] = useSafeState(false);
    const [errorText, setErrorText] = useState(null);

    useEffect(() => {
        const _nextcloudShareWatcherRef = SettingsStore.watchSetting(
            "nextcloudShare",
            roomId,
            (originalSettingName, changedInRoomId, atLevel, newValAtLevel, newValue) => {
                setNextcloudShare(newValAtLevel);
            }
        );
        return () => {
            SettingsStore.unwatchSetting(_nextcloudShareWatcherRef);
        };
    }, [roomId]);

    const onShare = () => {
        setErrorText(null);
        const modal = Modal.createTrackedDialog("Nextcloud share", "", NextcloudShareDialog, {
            roomId,
            onShare,
            setIsBusy,
        });
    };

    const onUnshare = () => {
        setIsBusy(true);
        setErrorText(null);
        SettingsStore.setValue("nextcloudShare", roomId, "room", null)
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
    if (nextcloudShare) {
        const params = new URL(nextcloudShare).searchParams;
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
            <AccessibleButton kind="danger_outline" onClick={onUnshare} disabled={isBusy}>
                {_t("Stop sharing")}
            </AccessibleButton>
        );
    }

    return (
        <React.Fragment>
            <div className="mx_SettingsTab_section mx_SettingsTab_subsectionText">{notice}</div>
            {sharedFolderField}
            <div className="error">{errorText}</div>
            <div className="watcha_NextcloudSettings_Buttons">
                {stopSharingButton}
                {isBusy && <Spinner />}
                <AccessibleButton kind="primary" onClick={onShare} disabled={isBusy}>
                    {_t(nextcloudShare ? "Change the shared folder" : "Share a folder")}
                </AccessibleButton>
            </div>
        </React.Fragment>
    );
};

NextcloudSettings.propTypes = {
    roomId: PropTypes.string.isRequired,
};

export default NextcloudSettings;
