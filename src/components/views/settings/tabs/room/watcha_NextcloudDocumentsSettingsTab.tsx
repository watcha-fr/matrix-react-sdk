import classNames from "classnames";
import React from "react";

import { _t } from "../../../../../languageHandler";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import { useSettingValue } from "../../../../../hooks/useSettings";
import AccessibleButton from "../../../elements/AccessibleButton";
import ErrorDialog from "../../../dialogs/ErrorDialog";
import Field from "../../../elements/Field";
import Modal from "../../../../../Modal";
import SettingsStore from "../../../../../settings/SettingsStore";
import Spinner from "../../../elements/Spinner";
import NextcloudShareDialog from "../../../dialogs/watcha_NextcloudShareDialog";
import useSafeState from "../../../../../hooks/watcha_useSafeState";

interface IProps {
    roomId: string;
}

const NextcloudDocumentsSettingsTab: React.FC<IProps> = ({ roomId }) => {
    const [isBusy, setIsBusy] = useSafeState(false) as [boolean, React.Dispatch<React.SetStateAction<boolean>>];
    const nextcloudShare = useSettingValue<string>("nextcloudShare", roomId);

    const onShare = async (): Promise<void> => {
        const modal = Modal.createTrackedDialog("Nextcloud share", "", NextcloudShareDialog, { roomId });
        const [target] = await modal.finished;
        if (target) {
            _updateNextcloudShare(target);
        }
    };

    const onUnshare = (): void => {
        _updateNextcloudShare(null);
    };

    const _updateNextcloudShare = (target?: string): void => {
        setIsBusy(true);
        SettingsStore.setValue("nextcloudShare", roomId, SettingLevel.ROOM, target)
            .catch(error => {
                console.error(error);
                Modal.createTrackedDialog("[Watcha] Nextcloud share change failed", "", ErrorDialog, {
                    title: _t("Error changing Nextcloud share"),
                    description: _t("An error occurred changing the room's Nextcloud share."),
                });
            })
            .finally(() => {
                setIsBusy(false);
            });
    };

    const notice = SettingsStore.getDisplayName("nextcloudShare");

    let sharedFolderField: React.ReactNode;
    let stopSharingButton: React.ReactNode;
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
                { _t("Stop sharing") }
            </AccessibleButton>
        );
    }

    return (
        <div className="mx_SettingsTab">
            <div className="mx_SettingsTab_heading">{ _t("Document sharing") }</div>
            <div className="mx_SettingsTab_section">
                <div className="mx_SettingsTab_subsectionText">{ notice }</div>
                { sharedFolderField }
                <div className="watcha_DocumentsSettingsTab_Buttons">
                    { stopSharingButton }
                    { isBusy && <Spinner /> }
                    <AccessibleButton kind="primary" onClick={onShare} disabled={isBusy}>
                        { _t(nextcloudShare ? "Change the shared folder" : "Share a folder") }
                    </AccessibleButton>
                </div>
            </div>
        </div>
    );
};

export default NextcloudDocumentsSettingsTab;
