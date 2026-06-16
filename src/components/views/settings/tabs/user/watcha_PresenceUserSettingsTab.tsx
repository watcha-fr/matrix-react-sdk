/*
Copyright 2026 Watcha

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

import React, { useCallback, useState } from "react";
import classNames from "classnames";

import { _t } from "../../../../../languageHandler";
import Presence, { ManualPresence } from "../../../../../Presence";
import StyledRadioButton from "../../../elements/StyledRadioButton";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import SettingsSubsection from "../../shared/SettingsSubsection";

// Valeur de remplacement pour le mode automatique (un <input radio> ne peut pas porter `null`).
const AUTOMATIC = "automatic";

interface PresenceOption {
    // valeur du radio ; null = mode automatique
    value: ManualPresence | null;
    label: string;
    // suffixe de la classe CSS de la pastille de couleur
    dot: "available" | "busy" | "away" | "auto";
}

const PresenceUserSettingsTab: React.FC = () => {
    const [current, setCurrent] = useState<ManualPresence | null>(Presence.getManualPresence());

    const options: PresenceOption[] = [
        { value: ManualPresence.Available, label: _t("presence|online"), dot: "available" },
        { value: ManualPresence.Busy, label: _t("presence|busy"), dot: "busy" },
        { value: ManualPresence.Away, label: _t("presence|away"), dot: "away" },
        { value: null, label: _t("watcha|status_automatic"), dot: "auto" },
    ];

    const onChange = useCallback((presence: ManualPresence | null): void => {
        setCurrent(presence);
        Presence.setManualPresence(presence);
    }, []);

    return (
        <SettingsTab>
            <SettingsSection heading={_t("watcha|status_title")}>
                <SettingsSubsection description={_t("watcha|status_description")}>
                    {options.map((option) => (
                        <StyledRadioButton
                            key={option.value ?? AUTOMATIC}
                            className="watcha_PresenceUserSettingsTab_option"
                            name="watcha_manualPresence"
                            value={option.value ?? AUTOMATIC}
                            checked={current === option.value}
                            onChange={() => onChange(option.value)}
                        >
                            <span
                                className={classNames(
                                    "watcha_PresenceUserSettingsTab_dot",
                                    `watcha_PresenceUserSettingsTab_dot_${option.dot}`,
                                )}
                            />
                            {option.label}
                        </StyledRadioButton>
                    ))}
                </SettingsSubsection>
            </SettingsSection>
        </SettingsTab>
    );
};

export default PresenceUserSettingsTab;
