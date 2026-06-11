/*
Copyright 2024 Watcha

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

// watcha+
// Room-level message retention period. Lets a room admin define how long
// messages are kept before the server purges them. Pinned messages are always
// kept (enforced server-side in Synapse's purge logic).

import React, { ChangeEvent, useMemo, useState } from "react";
import { Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../../../languageHandler";
import Field from "../../../elements/Field";
import SettingsFieldset from "../../SettingsFieldset";
import AccessibleButton from "../../../elements/AccessibleButton";
import { Caption } from "../../../typography/Caption";
import { useMatrixClientContext } from "../../../../../contexts/MatrixClientContext";

// m.room.retention is not exposed as a constant by our matrix-js-sdk fork.
const RETENTION_EVENT_TYPE = "m.room.retention";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Preset durations expressed in days. 0 means "unlimited" (no retention).
const PRESET_DAYS = [0, 7, 30, 182, 365] as const;
const CUSTOM = "custom";

interface IProps {
    room: Room;
}

function getCurrentMaxLifetimeMs(room: Room): number | null {
    const content = room.currentState.getStateEvents(RETENTION_EVENT_TYPE, "")?.getContent();
    const maxLifetime = content?.max_lifetime;
    return typeof maxLifetime === "number" && maxLifetime > 0 ? maxLifetime : null;
}

function presetLabel(days: number): string {
    switch (days) {
        case 0:
            return _t("room_settings|security|retention_preset_unlimited");
        case 7:
            return _t("room_settings|security|retention_preset_1_week");
        case 30:
            return _t("room_settings|security|retention_preset_1_month");
        case 182:
            return _t("room_settings|security|retention_preset_6_months");
        case 365:
            return _t("room_settings|security|retention_preset_1_year");
        default:
            return String(days);
    }
}

const RoomRetentionFieldset: React.FC<IProps> = ({ room }) => {
    const cli = useMatrixClientContext();
    const canEdit = room.currentState.mayClientSendStateEvent(RETENTION_EVENT_TYPE, cli);

    // Derive the initial selection from the current room state.
    const initial = useMemo(() => {
        const maxLifetimeMs = getCurrentMaxLifetimeMs(room);
        if (maxLifetimeMs === null) {
            return { selection: "0", customDays: "" };
        }
        const days = Math.round(maxLifetimeMs / MS_PER_DAY);
        if ((PRESET_DAYS as readonly number[]).includes(days)) {
            return { selection: String(days), customDays: "" };
        }
        return { selection: CUSTOM, customDays: String(days) };
    }, [room]);

    const [selection, setSelection] = useState<string>(initial.selection);
    const [customDays, setCustomDays] = useState<string>(initial.customDays);
    const [busy, setBusy] = useState<boolean>(false);

    const onSelectionChange = (e: ChangeEvent<HTMLSelectElement>): void => {
        setSelection(e.target.value);
    };

    const onCustomDaysChange = (e: ChangeEvent<HTMLInputElement>): void => {
        setCustomDays(e.target.value);
    };

    // Resolve the chosen value into a max_lifetime in milliseconds, or null for
    // "unlimited". Returns `undefined` when the custom input is invalid.
    const resolveMaxLifetimeMs = (): number | null | undefined => {
        if (selection === CUSTOM) {
            const days = Number(customDays);
            if (!Number.isFinite(days) || days <= 0) {
                return undefined;
            }
            return Math.round(days) * MS_PER_DAY;
        }
        const days = Number(selection);
        return days > 0 ? days * MS_PER_DAY : null;
    };

    const maxLifetimeMs = resolveMaxLifetimeMs();
    const invalidCustom = selection === CUSTOM && maxLifetimeMs === undefined;

    const onSave = async (): Promise<void> => {
        if (maxLifetimeMs === undefined) return;
        setBusy(true);
        try {
            // "Unlimited" sends an empty policy: Matrix has no way to delete a
            // state event, so we fall back to the server's default policy.
            const content = maxLifetimeMs === null ? {} : { max_lifetime: maxLifetimeMs };
            // m.room.retention is not part of the typed StateEvents map.
            await cli.sendStateEvent(room.roomId, RETENTION_EVENT_TYPE as any, content, "");
        } catch (e) {
            logger.error("Failed to set room retention policy", e);
        } finally {
            setBusy(false);
        }
    };

    const presetOptions = PRESET_DAYS.map(days => (
        <option key={days} value={String(days)}>
            {presetLabel(days)}
        </option>
    ));
    presetOptions.push(
        <option key={CUSTOM} value={CUSTOM}>
            {_t("room_settings|security|retention_preset_custom")}
        </option>,
    );

    return (
        <SettingsFieldset
            legend={_t("room_settings|security|retention_legend")}
            description={_t("room_settings|security|retention_description")}
        >
            <Field
                element="select"
                label={_t("room_settings|security|retention_legend")}
                value={selection}
                onChange={onSelectionChange}
                disabled={!canEdit || busy}
            >
                {presetOptions}
            </Field>
            {selection === CUSTOM && (
                <Field
                    type="number"
                    min={1}
                    label={_t("room_settings|security|retention_custom_days_label")}
                    value={customDays}
                    onChange={onCustomDaysChange}
                    disabled={!canEdit || busy}
                />
            )}
            <Caption>{_t("room_settings|security|retention_pinned_note")}</Caption>
            {canEdit && (
                <AccessibleButton kind="primary" onClick={onSave} disabled={busy || invalidCustom}>
                    {_t("action|save")}
                </AccessibleButton>
            )}
        </SettingsFieldset>
    );
};

export default RoomRetentionFieldset;
// watcha+
