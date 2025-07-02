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

import React, { useEffect, useState } from "react";
import classNames from "classnames";

import { _t } from "../../languageHandler";
import { UIFeature } from "../../settings/UIFeature";
import { useSettingValue } from "../../hooks/useSettings";
import BaseCard from "../views/right_panel/BaseCard";
import defaultDispatcher from "../../dispatcher/dispatcher";
import SettingsStore from "../../settings/SettingsStore";
import Spinner from "../views/elements/Spinner";
import { getDocumentWidgetUrl } from "../../utils/watcha_nextcloudUtils";

export default ({ roomId, initialTabId, empty, emptyClass, onClose }) => {
    const [iframeLoading, setIframeLoading] = useState(true);
    const nextcloudShare = useSettingValue("nextcloudShare", roomId);

    useEffect(() => {
        if (nextcloudShare) {
            setIframeLoading(true);
        }
    }, [nextcloudShare]);

    const onRoomSettingsClick = () => {
        const payload = {
            action: "open_room_settings",
            initial_tab_id: initialTabId,
        };
        defaultDispatcher.dispatch(payload);
    };

    let panel;
    if (SettingsStore.getValue(UIFeature.watcha_Nextcloud)) {
        if (nextcloudShare) {
            panel = (
                <>
                    { iframeLoading && <Spinner /> }
                    <iframe
                        id="watcha_NextcloudPanel"
                        className={classNames("watcha_NextcloudPanel", {
                            "watcha_NextcloudPanel-hidden": iframeLoading,
                        })}
                        src={getDocumentWidgetUrl(nextcloudShare)}
                        onLoad={() => {
                            setIframeLoading(false);
                        }}
                        title={_t("Document sharing")}
                    />
                </>
            );
        } else {
            let hint;
            if (SettingsStore.canSetValue("nextcloudShare", roomId, "room")) {
                hint = _t(
                    "You can share a resource from room <span>settings </span>",
                    {},
                    {
                        span: sub => (
                            <span className="watcha_NextcloudPanel_settingsIcon-noWrap" onClick={onRoomSettingsClick}>
                                { sub }
                            </span>
                        ),
                    },
                );
            }
            panel = (
                <div className="mx_RoomView_messagePanel mx_RoomView_messageListWrapper">
                    <div className="mx_RoomView_empty">
                        <div className={classNames("mx_RightPanel_empty", emptyClass)}>
                            <h2>{ empty }</h2>
                            <p>{ hint }</p>
                        </div>
                    </div>
                </div>
            );
        }
    }
    return (
        <BaseCard
            className="mx_FilePanel"
            withoutScrollContainer
            {...{ onClose }}
        >
            { panel }
        </BaseCard>
    );
};
