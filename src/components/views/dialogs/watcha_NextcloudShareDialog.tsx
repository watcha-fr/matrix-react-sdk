import classNames from "classnames";
import React, { useEffect, useRef, useState } from "react";

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import Field from "../elements/Field";
import SettingsStore from "../../../settings/SettingsStore";
import Spinner from "../elements/Spinner";

import { getNextcloudBaseUrl, getDocumentSelectorUrl } from "../../../utils/watcha_nextcloudUtils";

interface IProps {
    roomId: string;
    onFinished(target?: string): Promise<void>;
}

const NextcloudShareDialog: React.FC<IProps> = ({ roomId, onFinished }) => {
    const initUrlRef = useRef(getDocumentSelectorUrl(SettingsStore.getValue("nextcloudShare", roomId)));
    const urlRef = useRef(initUrlRef.current);
    const [target, setTarget] = useState(initUrlRef.current);

    const [busy, setBusy] = useState(true);

    // intercept URL changes reported by the iframe
    useEffect(() => {
        function receiveMessage(event: MessageEvent) {
            const { data, origin } = event;
            if (
                typeof data !== "string" ||
                data.startsWith("setImmediate") ||
                origin !== getNextcloudBaseUrl().origin
            ) {
                return;
            }
            const url = getDocumentSelectorUrl(data);
            setTarget(url);
        }
        window.addEventListener("message", receiveMessage, false);
        return () => {
            window.removeEventListener("message", receiveMessage);
        };
    }, []);

    useEffect(() => {
        const _nextcloudShareWatcherRef = SettingsStore.watchSetting(
            "nextcloudShare",
            roomId,
            (originalSettingName, changedInRoomId, atLevel, newValAtLevel, newValue) => {
                const url = getDocumentSelectorUrl(newValAtLevel);
                initUrlRef.current = url;
                urlRef.current = url;
                setTarget(url);
            }
        );
        return () => {
            SettingsStore.unwatchSetting(_nextcloudShareWatcherRef);
        };
    }, [roomId]);

    const onOK = () => {
        onFinished(target);
    };

    const params = new URL(target).searchParams;
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
                    {busy && <Spinner />}
                    <iframe
                        className={classNames({
                            "watcha_NextcloudShareDialog_iframe-hidden": busy,
                        })}
                        src={urlRef.current}
                        onLoad={() => {
                            setBusy(false);
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
                    primaryDisabled={!relativePath || target === initUrlRef.current}
                    onCancel={onFinished}
                />
            </BaseDialog>
        </React.Fragment>
    );
};

export default NextcloudShareDialog;
