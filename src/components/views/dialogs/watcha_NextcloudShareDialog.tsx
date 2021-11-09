import classNames from "classnames";
import React, { useEffect, useRef, useState } from "react";

import { _t } from "../../../languageHandler";
import { getNextcloudBaseUrl } from "../../../utils/watcha_nextcloudUtils";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import Field from "../elements/Field";
import SettingsStore from "../../../settings/SettingsStore";
import Spinner from "../elements/Spinner";

import { refineNextcloudIframe } from "../../../utils/watcha_nextcloudUtils";

interface IProps {
    roomId: string;
    onShare(): void;
    onFinished(nextcloudShare?: string): Promise<void>;
}

const NextcloudShareDialog: React.FC<IProps> = ({ roomId, onShare, onFinished }) => {
    const initialShare = useRef<string>(SettingsStore.getValue("nextcloudShare", roomId));

    const [iframeLoading, setIframeLoading] = useState(true);
    const [nextcloudShare, setNextcloudShare] = useState<string>(
        initialShare.current || new URL("apps/files/?dir=/", getNextcloudBaseUrl()).href
    );

    const nextcloudIframeRef = useRef<HTMLIFrameElement>();
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
        onFinished(nextcloudShare);
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
                    {iframeLoading && <Spinner />}
                    <iframe
                        ref={nextcloudIframeRef}
                        src={nextcloudShareRef.current}
                        className={classNames({
                            "watcha_NextcloudShareDialog_iframe-hidden": iframeLoading,
                        })}
                        onLoad={() => {
                            refineNextcloudIframe(nextcloudIframeRef.current, "/app/watcha_nextcloud/shareDiablog.css");
                            setIframeLoading(false);
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
                    primaryDisabled={!relativePath || nextcloudShare === initialShare.current}
                    onCancel={onFinished}
                />
            </BaseDialog>
        </React.Fragment>
    );
};

export default NextcloudShareDialog;
