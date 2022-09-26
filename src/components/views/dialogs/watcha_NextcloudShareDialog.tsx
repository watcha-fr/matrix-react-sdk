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

import classNames from "classnames";
import React, { useContext, useEffect, useRef, useState } from "react";

import { _t } from "../../../languageHandler";
import { WidgetType } from "../../../widgets/WidgetType";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import ErrorDialog from "../dialogs/ErrorDialog";
import Field from "../elements/Field";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import Modal from "../../../Modal";
import SettingsStore from "../../../settings/SettingsStore";
import Spinner from "../elements/Spinner";
import WidgetUtils from "../../../utils/WidgetUtils";
import { getNextcloudBaseUrl, getDocumentSelectorUrl } from "../../../utils/watcha_nextcloudUtils";

interface IProps {
    roomId: string;
    onFinished(): Promise<void>;
}

const NextcloudShareDialog: React.FC<IProps> = ({ roomId, onFinished }) => {
    const client = useContext(MatrixClientContext);
    const initUrlRef = useRef(getDocumentSelectorUrl(SettingsStore.getValue("nextcloudShare", roomId)));
    const urlRef = useRef(initUrlRef.current);
    const [widgetUrl, setWidgetUrl] = useState(initUrlRef.current);

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
            setWidgetUrl(url);
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
                setWidgetUrl(url);
            },
        );
        return () => {
            SettingsStore.unwatchSetting(_nextcloudShareWatcherRef);
        };
    }, [roomId]);

    const onOK = () => {
        const userId = client.getUserId();
        const ts = Date.now();
        const widgetId = `nextcloud_document_${userId}_${ts}`;
        const widgetType = WidgetType.NEXTCLOUD_DOCUMENT;
        const widgetData = {};

        WidgetUtils.setRoomWidget(roomId, widgetId, widgetType, widgetUrl, "Documents", widgetData)
            .catch(e => {
                if (e.errcode === "M_FORBIDDEN") {
                    Modal.createDialog(ErrorDialog, {
                        title: _t("Permission Required"),
                        description: _t("You do not have permission to share documents in this room"),
                    });
                }
            })
            .finally(() => {
                onFinished();
            });
    };

    const onCancel = () => {
        onFinished();
    };

    const params = new URL(widgetUrl).searchParams;
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
                    { busy && <Spinner /> }
                    <iframe
                        className={classNames({
                            "watcha_NextcloudShareDialog_iframe-hidden": busy,
                        })}
                        src={urlRef.current}
                        onLoad={() => {
                            setBusy(false);
                        }}
                        title={_t("Document sharing")}
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
                    primaryDisabled={!relativePath || widgetUrl === initUrlRef.current}
                    {...{ onCancel }}
                />
            </BaseDialog>
        </React.Fragment>
    );
};

export default NextcloudShareDialog;
