import classNames from "classnames";
import PropTypes from "prop-types";
import React, { useEffect, useRef, useState } from "react";

import { _t } from "../../../languageHandler";
import * as sdk from "../../../index";
import Field from "../elements/Field";
import SettingsStore from "../../../settings/SettingsStore";

import { refineNextcloudIframe } from "../../../utils/watcha_nextcloudUtils";
import Spinner from "../elements/watcha_DelayedSpinner";

const NextcloudShareDialog = ({
    roomId,
    targetFolder,
    setShareDialogIsBusy,
    onFinished,
}) => {
    const BaseDialog = sdk.getComponent("views.dialogs.BaseDialog");
    const DialogButtons = sdk.getComponent("views.elements.DialogButtons");

    const [nextcloudFolder, setNextcloudFolder] = useState(targetFolder);
    const [prevNextcloudFolder, setPrevNextcloudFolder] = useState(null);
    const [isBusy, setIsBusy] = useState(false);
    const [errorText, setErrorText] = useState(null);

    const [isCancel, _setIsCancel] = useState(false);
    const isCancelRef = useRef(false);

    const nextcloudIframeRef = useRef();

    useEffect(() => {
        nextcloudIframeRef.current.contentWindow.addEventListener(
            "click",
            onClick
        );
    }, []);

    const onClick = () => {
        setErrorText(null);
        setNextcloudFolder(
            nextcloudIframeRef.current.contentWindow.location.href
        );
    };

    const onOK = () => {
        setShareDialogIsBusy(true);
        setIsBusy(true);
        setErrorText(null);
        setPrevNextcloudFolder(SettingsStore.getValue("nextcloud", roomId));
        SettingsStore.setValue("nextcloud", roomId, "room", nextcloudFolder)
            .then(() => {
                if (!isCancelRef.current) {
                    onFinished(nextcloudFolder);
                    setShareDialogIsBusy(false);
                }
            })
            .catch(error => {
                console.error(error);
                if (!isCancelRef.current) {
                    setErrorText(error.message);
                    setIsBusy(false);
                    setShareDialogIsBusy(false);
                }
            });
    };

    const onCancel = () => {
        if (isBusy) {
            setIsCancel(true);
            setErrorText(_t("Cancelling…"));
            SettingsStore.setValue(
                "nextcloud",
                roomId,
                "room",
                prevNextcloudFolder
            )
                .then(() => {
                    onFinished(prevNextcloudFolder);
                })
                .catch(error => {
                    console.error(error);
                    setErrorText(error.message);
                    setIsBusy(false);
                })
                .finally(() => {
                    setShareDialogIsBusy(false);
                });
        } else {
            onFinished();
        }
    };

    const setIsCancel = value => {
        _setIsCancel(value);
        isCancelRef.current = value;
    };

    const params = new URL(nextcloudFolder).searchParams;
    const path = params.get("dir");
    const relativePath = path ? path.replace(/^\//, "") : null;

    return (
        <React.Fragment>
            <BaseDialog
                className="watcha_NextcloudShareDialog"
                title={_t("Select a Nextcloud folder to share")}
                hasCancel={false}
                {...{ onFinished }}
            >
                <div className="mx_Dialog_content">
                    <iframe
                        ref={nextcloudIframeRef}
                        src={targetFolder}
                        onLoad={() => {
                            refineNextcloudIframe(nextcloudIframeRef);
                            refineNextcloudIframe(
                                nextcloudIframeRef,
                                "/app/watcha-nextcloud-integration/shareDiablog.css"
                            );
                        }}
                    />
                    <Field
                        className={classNames({
                            watcha_NextcloudShareDialog_Field_rootSelection: !relativePath,
                        })}
                        element="input"
                        label={_t("Selected folder")}
                        value={relativePath || _t("No folder selected")}
                        disabled
                    />
                    <div className="error">{errorText}</div>
                </div>
                <DialogButtons
                    primaryButton={_t("OK")}
                    onPrimaryButtonClick={onOK}
                    primaryDisabled={isBusy || !relativePath}
                    disabled={isCancel}
                    {...{ onCancel }}
                />
            </BaseDialog>
            {isBusy && (
                <Spinner className="watcha_NextcloudShareDialog_Spinner" />
            )}
        </React.Fragment>
    );
};

NextcloudShareDialog.propTypes = {
    roomId: PropTypes.string.isRequired,
    targetFolder: PropTypes.string.isRequired,
    setShareDialogIsBusy: PropTypes.func.isRequired,
    onFinished: PropTypes.func.isRequired,
};

export default NextcloudShareDialog;
