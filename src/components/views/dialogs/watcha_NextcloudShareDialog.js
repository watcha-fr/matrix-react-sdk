import classNames from "classnames";
import PropTypes from "prop-types";
import React, { useEffect, useRef, useState } from "react";

import { _t } from "../../../languageHandler";
import { getNextcloudBaseUrl } from "../../../utils/watcha_nextcloudUtils";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import Field from "../elements/Field";
import SettingsStore from "../../../settings/SettingsStore";
import Spinner from "../elements/Spinner";

import { refineNextcloudIframe } from "../../../utils/watcha_nextcloudUtils";

const NextcloudShareDialog = ({ roomId, onShare, setShareDialogIsBusy, onFinished }) => {
    const [nextcloudShare, setNextcloudShare] = useState(
        SettingsStore.getValue("nextcloudShare", roomId) || new URL("apps/files/?dir=/", getNextcloudBaseUrl()).href
    );
    const [prevNextcloudShare, setPrevNextcloudShare] = useState(null);
    const [isBusy, setIsBusy] = useState(false);
    const [errorText, setErrorText] = useState(null);

    const [isCancel, _setIsCancel] = useState(false);
    const isCancelRef = useRef(false);

    const nextcloudIframeRef = useRef();
    const nextcloudShareRef = useRef(nextcloudShare);

    useEffect(() => {
        nextcloudIframeRef.current.contentWindow.addEventListener("click", onClick);
        const _nextcloudShareWatcherRef = SettingsStore.watchSetting("nextcloudShare", roomId, () => {
            // HACK: bypass loss of event listener when iframe source is updated manually
            onFinished()
                .then(() => onShare())
                .catch(error => console.error(error));
        });
        return () => {
            nextcloudIframeRef.current.contentWindow.removeEventListener("click", onClick);
            SettingsStore.unwatchSetting(_nextcloudShareWatcherRef);
        };
    }, [roomId, onShare, onFinished]);

    const onClick = () => {
        setErrorText(null);
        setNextcloudShare(nextcloudIframeRef.current.contentWindow.location.href);
    };

    const onOK = () => {
        setShareDialogIsBusy(true);
        setIsBusy(true);
        setErrorText(null);
        setPrevNextcloudShare(SettingsStore.getValue("nextcloudShare", roomId));
        SettingsStore.setValue("nextcloudShare", roomId, "room", nextcloudShare)
            .then(() => {
                if (!isCancelRef.current) {
                    onFinished(nextcloudShare);
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
            SettingsStore.setValue("nextcloudShare", roomId, "room", prevNextcloudShare)
                .then(() => {
                    onFinished(prevNextcloudShare);
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

    const params = new URL(nextcloudShare).searchParams;
    const path = params.get("dir");
    const relativePath = path ? path.replace(/^\//, "") : null;

    return (
        <React.Fragment>
            <BaseDialog
                className="watcha_NextcloudShareDialog"
                title={_t("Select a folder to share")}
                hasCancel={false}
                {...{ onFinished }}
            >
                <div className="mx_Dialog_content">
                    <iframe
                        ref={nextcloudIframeRef}
                        src={nextcloudShareRef.current}
                        onLoad={() => {
                            refineNextcloudIframe(nextcloudIframeRef);
                            refineNextcloudIframe(nextcloudIframeRef, "/app/watcha_nextcloud/shareDiablog.css");
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
            {isBusy && <Spinner imgClassName="watcha_NextcloudShareDialog_Spinner" />}
        </React.Fragment>
    );
};

NextcloudShareDialog.propTypes = {
    roomId: PropTypes.string.isRequired,
    onShare: PropTypes.func.isRequired,
    setShareDialogIsBusy: PropTypes.func.isRequired,
    onFinished: PropTypes.func.isRequired,
};

export default NextcloudShareDialog;
