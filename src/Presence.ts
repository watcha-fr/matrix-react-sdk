/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import { logger } from "matrix-js-sdk/src/logger";
import { SetPresence } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "./MatrixClientPeg";
import dis from "./dispatcher/dispatcher";
import Timer from "./utils/Timer";
import { ActionPayload } from "./dispatcher/payloads";
import SettingsStore from "./settings/SettingsStore"; // watcha+
import { SettingLevel } from "./settings/SettingLevel"; // watcha+

// Time in ms after that a user is considered as unavailable/away
const UNAVAILABLE_TIME_MS = 3 * 60 * 1000; // 3 mins

// watcha+
// Statut de présence pouvant être choisi manuellement par l'utilisateur.
// "online" et "unavailable" sont des états standards Matrix ; "busy" relève de MSC3026
// (org.matrix.msc3026.busy) et doit être activé côté Synapse (experimental_features.msc3026_enabled).
export type ManualPresence = "online" | "unavailable" | "org.matrix.msc3026.busy";
export const ManualPresence = {
    Available: "online",
    Away: "unavailable",
    Busy: "org.matrix.msc3026.busy",
} as const satisfies Record<string, ManualPresence>;
const MANUAL_PRESENCE_SETTING = "watcha_manualPresence";
// +watcha

class Presence {
    private unavailableTimer: Timer | null = null;
    private dispatcherRef: string | null = null;
    private state: SetPresence | null = null;
    private manualPresence: ManualPresence | null = null; // watcha+

    /**
     * Start listening the user activity to evaluate his presence state.
     * Any state change will be sent to the homeserver.
     */
    public async start(): Promise<void> {
        this.unavailableTimer = new Timer(UNAVAILABLE_TIME_MS);
        // the user_activity_start action starts the timer
        this.dispatcherRef = dis.register(this.onAction);
        // watcha+
        // Réapplique un éventuel statut choisi manuellement lors d'une session précédente,
        // afin qu'il survive à un rechargement de la page.
        const savedPresence = SettingsStore.getValue(MANUAL_PRESENCE_SETTING) as ManualPresence | null;
        if (savedPresence) {
            await this.setManualPresence(savedPresence, { persist: false });
        }
        // +watcha
        while (this.unavailableTimer) {
            try {
                await this.unavailableTimer.finished();
                // watcha+ : ne pas écraser un statut choisi manuellement par l'utilisateur
                if (this.manualPresence) continue;
                // +watcha
                this.setState(SetPresence.Unavailable);
            } catch (e) {
                /* aborted, stop got called */
            }
        }
    }

    /**
     * Stop tracking user activity
     */
    public stop(): void {
        if (this.dispatcherRef) {
            dis.unregister(this.dispatcherRef);
            this.dispatcherRef = null;
        }
        if (this.unavailableTimer) {
            this.unavailableTimer.abort();
            this.unavailableTimer = null;
        }
    }

    /**
     * Get the current presence state.
     * @returns {string} the presence state (see PRESENCE enum)
     */
    public getState(): SetPresence | null {
        return this.state;
    }

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === "user_activity") {
            // watcha+ : un statut manuel verrouille la détection automatique
            if (this.manualPresence) return;
            // +watcha
            this.setState(SetPresence.Online);
            this.unavailableTimer?.restart();
        }
    };

    // watcha+
    /**
     * Get the presence state explicitly chosen by the user, if any.
     * @returns the manual presence (disponible / absent / occupé) or null when in automatic mode.
     */
    public getManualPresence(): ManualPresence | null {
        return this.manualPresence;
    }

    /**
     * Set (or clear) the presence state explicitly chosen by the user.
     * While a manual presence is set, the automatic activity-based detection is suspended.
     * @param presence the chosen presence, or null to resume automatic detection.
     * @param persist whether to persist the choice so it survives a page reload (default: true).
     */
    public async setManualPresence(presence: ManualPresence | null, { persist = true } = {}): Promise<void> {
        this.manualPresence = presence;

        if (persist) {
            await SettingsStore.setValue(MANUAL_PRESENCE_SETTING, null, SettingLevel.DEVICE, presence);
        }

        if (MatrixClientPeg.safeGet().isGuest()) {
            return; // don't try to set presence when a guest; it won't work.
        }

        // État effectif à pousser au serveur ; en mode automatique (null) on repart de "online".
        const target: ManualPresence = presence ?? ManualPresence.Available;

        // Aligne la présence de synchronisation (paramètre set_presence des /sync), qui n'accepte
        // que online/unavailable/offline. Pour "busy" on laisse la synchro sur "online".
        if (target === ManualPresence.Away) {
            await this.setState(SetPresence.Unavailable);
        } else {
            this.state = null; // force le ré-envoi même si déjà "online" (cas sortie de "busy")
            await this.setState(SetPresence.Online);
        }

        // Un setPresence direct (PUT /presence/{userId}/status) est INDISPENSABLE pour sortir de
        // l'état "busy" : Synapse protège "busy" contre l'écrasement par le set_presence des /sync
        // (MSC3026). Sans cet appel, le statut "occupé" resterait collé côté serveur.
        try {
            await MatrixClientPeg.safeGet().setPresence({ presence: target });
            logger.debug("Manual presence:", presence ?? "automatic");
        } catch (err) {
            logger.error("Failed to set manual presence:", err);
        }

        // Reprise de la détection automatique d'inactivité.
        if (presence === null) {
            this.unavailableTimer?.restart();
        }
    }
    // +watcha

    /**
     * Set the presence state.
     * If the state has changed, the homeserver will be notified.
     * @param {string} newState the new presence state (see PRESENCE enum)
     */
    private async setState(newState: SetPresence): Promise<void> {
        if (newState === this.state) {
            return;
        }

        const oldState = this.state;
        this.state = newState;

        if (MatrixClientPeg.safeGet().isGuest()) {
            return; // don't try to set presence when a guest; it won't work.
        }

        try {
            await MatrixClientPeg.safeGet().setSyncPresence(this.state);
            logger.debug("Presence:", newState);
        } catch (err) {
            logger.error("Failed to set presence:", err);
            this.state = oldState;
        }
    }
}

export default new Presence();
