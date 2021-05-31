import classNames from "classnames";
import PropTypes from "prop-types";
import React, { useEffect, useRef, useState } from "react";

import { _t } from "../../../languageHandler";
import { getNextcloudBaseUrl } from "../../../utils/watcha_nextcloudUtils";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import Field from "../elements/Field";
import SettingsStore from "../../../settings/SettingsStore";

import { refineNextcloudIframe } from "../../../utils/watcha_nextcloudUtils";

const NextcloudShareDialog = ({ roomId, onShare, setIsBusy, onFinished }) => {
    const [nextcloudShare, setNextcloudShare] = useState(
        SettingsStore.getValue("nextcloudShare", roomId) || new URL("apps/files/?dir=/", getNextcloudBaseUrl()).href
    );

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
        setNextcloudShare(nextcloudIframeRef.current.contentWindow.location.href);
    };

    const onOK = () => {
        setIsBusy(true);
        onFinished();
        SettingsStore.setValue("nextcloudShare", roomId, "room", nextcloudShare)
            .catch(error => {
                console.error(error);
            })
            .finally(() => {
                setIsBusy(false);
            });
    };

    const params = new URL(nextcloudShare).searchParams;
    const path = params.get("dir");
    const relativePath = path ? path.replace(/^\//, "") : null;

    return (
        <React.Fragment>
            <BaseDialog
                className="watcha_NextcloudShareDialog"
                title={_t("Select a folder to share")}
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
                </div>
                <DialogButtons
                    primaryButton={_t("OK")}
                    onPrimaryButtonClick={onOK}
                    primaryDisabled={!relativePath}
                    onCancel={onFinished}
                />
            </BaseDialog>
        </React.Fragment>
    );
};

NextcloudShareDialog.propTypes = {
    roomId: PropTypes.string.isRequired,
    onShare: PropTypes.func.isRequired,
    setIsBusy: PropTypes.func.isRequired,
    onFinished: PropTypes.func.isRequired,
};

export default NextcloudShareDialog;
