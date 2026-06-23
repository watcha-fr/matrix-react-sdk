/*
Fichier spécifique Watcha.

Fermeture automatique des widgets Jitsi « épinglés » (hors video rooms) une fois la
conférence terminée : le widget est retiré du salon quand le DERNIER participant quitte.

Pourquoi pas un simple comptage Jitsi ?
  Au moment où un participant raccroche, son instance Jitsi locale se démonte et
  `getParticipantsInfo()` s'effondre immédiatement à [] : depuis le poste du partant, on ne
  « voit » plus les distants. N'importe qui qui part croit donc être seul. Le comptage local
  est structurellement inutilisable pour décider « suis-je le dernier ? ».

Mécanisme retenu (fiable, basé sur l'état partagé du salon Matrix) :
  - À la connexion (action JoinCall), chaque client inscrit sa présence dans l'état du salon.
  - Au raccrochage (action HangupCall), il retire sa présence puis, s'il ne reste plus aucun
    participant connecté (état partagé, fiable), il retire le widget — ce que voient tous les membres.

Contrainte de permissions :
  Dans ces salons, `state_default` vaut 50 : un type de state event *custom* exigerait PL50, que les
  membres normaux (PL0) n'ont pas. Le SEUL type de state event écrivable en PL0 est
  `im.vector.modular.widgets` (PL explicitement abaissé à 0 pour permettre à tous de lancer un Jitsi).
  On stocke donc la présence comme des events `im.vector.modular.widgets` :
    - avec une state_key PAR UTILISATEUR (préfixée) → aucune écriture concurrente sur la même clé
      (pas de course, contrairement à une liste unique partagée) ;
    - avec un contenu SANS `type` ni `url` → ignoré des listes de widgets
      (cf. WidgetUtils.getRoomWidgets qui filtre sur `content.type && content.url`).
  Ainsi le suivi fonctionne pour tous les membres qui peuvent déjà lancer/fermer le Jitsi.

Robustesse aux crashes : chaque présence porte une expiration (`expires_ts`) rafraîchie
périodiquement tant qu'on est en appel. Une présence expirée n'est plus comptée ; si un client
disparaît sans raccrocher proprement, sa présence s'éteint d'elle-même.
*/

import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";

import WidgetUtils from "./utils/WidgetUtils";
import { isVideoRoom } from "./utils/video-rooms";

// Type de state event PL0 réutilisé pour porter la présence (cf. en-tête).
const WIDGET_STATE_EVENT_TYPE = "im.vector.modular.widgets";
// Préfixe de state_key des marqueurs de présence (distinct des IDs de widgets réels).
// Exporté pour que le rendu de timeline (TextForEvent) puisse masquer ces events (sinon ils
// s'afficheraient comme « Widget supprimé par X » à chaque connexion/raccrochage).
export const PRESENCE_STATE_KEY_PREFIX = "re.watcha.jitsi.presence|";
// Durée de validité d'une présence et période de rafraîchissement (3/4 de l'expiration).
const PRESENCE_EXPIRY_MS = 60 * 60 * 1000; // 1 h
const PRESENCE_REFRESH_MS = (PRESENCE_EXPIRY_MS * 3) / 4; // 45 min

interface PresenceContent {
    widgetId?: string;
    devices?: string[];
    // eslint-disable-next-line camelcase
    expires_ts?: number;
}

// Timers de rafraîchissement de présence, par conférence (clé = `${roomId}|${widgetId}`).
const refreshTimers = new Map<string, number>();

function timerKey(roomId: string, widgetId: string): string {
    return `${roomId}|${widgetId}`;
}

function presenceStateKey(userId: string): string {
    return PRESENCE_STATE_KEY_PREFIX + userId;
}

function now(): number {
    return Date.now();
}

/**
 * Lit notre présence courante, applique `fn` à la liste de nos devices connectés, et réécrit
 * l'état. Renvoie la nouvelle liste de devices, ou null si l'on n'est pas membre du salon.
 */
async function writeMyDevices(
    client: MatrixClient,
    roomId: string,
    widgetId: string,
    fn: (devices: string[]) => string[],
): Promise<string[] | null> {
    const room = client.getRoom(roomId);
    if (!room || room.getMyMembership() !== KnownMembership.Join) return null;

    const userId = client.getSafeUserId();
    const stateKey = presenceStateKey(userId);
    const ev = room.currentState.getStateEvents(WIDGET_STATE_EVENT_TYPE, stateKey);
    const content = ev?.getContent<PresenceContent>();
    const valid =
        !!content &&
        content.widgetId === widgetId &&
        typeof content.expires_ts === "number" &&
        content.expires_ts > now() &&
        Array.isArray(content.devices);
    const devices = valid ? content!.devices!.filter((d) => typeof d === "string") : [];

    const newDevices = fn(devices);
    const newContent: PresenceContent = { widgetId, devices: newDevices, expires_ts: now() + PRESENCE_EXPIRY_MS };
    await client.sendStateEvent(roomId, WIDGET_STATE_EVENT_TYPE, newContent, stateKey);
    return newDevices;
}

/**
 * Nombre de devices connectés des AUTRES utilisateurs pour cette conférence (présences valides,
 * membres encore dans le salon). On exclut notre propre marqueur, dont on connaît déjà l'état local.
 */
function countOtherActiveDevices(client: MatrixClient, roomId: string, widgetId: string, excludeUserId: string): number {
    const room = client.getRoom(roomId);
    if (!room) return 0;

    const t = now();
    let total = 0;
    for (const ev of room.currentState.getStateEvents(WIDGET_STATE_EVENT_TYPE)) {
        const stateKey = ev.getStateKey();
        if (!stateKey || !stateKey.startsWith(PRESENCE_STATE_KEY_PREFIX)) continue; // pas un marqueur de présence
        const userId = stateKey.slice(PRESENCE_STATE_KEY_PREFIX.length);
        if (userId === excludeUserId) continue;

        const content = ev.getContent<PresenceContent>();
        const member = room.getMember(userId);
        if (
            content.widgetId === widgetId &&
            typeof content.expires_ts === "number" &&
            content.expires_ts > t &&
            Array.isArray(content.devices) &&
            member?.membership === KnownMembership.Join
        ) {
            total += content.devices.filter((d) => typeof d === "string").length;
        }
    }
    return total;
}

/** À appeler quand on rejoint la conférence (action JoinCall). */
export function watchaJitsiPresenceOnJoin(client: MatrixClient, roomId: string, widgetId: string): void {
    const room = client.getRoom(roomId);
    if (!room || isVideoRoom(room)) return; // les video rooms sont gérées par JitsiCall

    const deviceId = client.getDeviceId();
    if (!deviceId) return;

    const addMe = (devices: string[]): string[] => (devices.includes(deviceId) ? devices : [...devices, deviceId]);

    writeMyDevices(client, roomId, widgetId, addMe).catch((e) =>
        logger.error("watcha: échec de l'inscription de présence Jitsi", e),
    );

    // Rafraîchir l'expiration tant qu'on est en appel, pour ne pas être considéré parti lors d'un long appel.
    const key = timerKey(roomId, widgetId);
    if (!refreshTimers.has(key)) {
        const timer = window.setInterval(() => {
            // Si le widget a disparu (p. ex. fermé à la main pendant l'appel), l'iframe est détruite
            // sans envoyer HangupCall : on ne reçoit donc pas onHangup. On se nettoie ici → on arrête
            // de rafraîchir et on retire notre présence. (Le marqueur résiduel serait de toute façon
            // sans effet car filtré par widgetId, et finirait par expirer.)
            const r = client.getRoom(roomId);
            const widgetStillExists = !!r && WidgetUtils.getRoomWidgets(r).some((w) => w.getStateKey() === widgetId);
            if (!widgetStillExists) {
                watchaStopPresenceRefresh(roomId, widgetId);
                writeMyDevices(client, roomId, widgetId, () => []).catch(() => {});
                return;
            }
            writeMyDevices(client, roomId, widgetId, addMe).catch((e) =>
                logger.error("watcha: échec du rafraîchissement de présence Jitsi", e),
            );
        }, PRESENCE_REFRESH_MS);
        refreshTimers.set(key, timer);
    }
}

function watchaStopPresenceRefresh(roomId: string, widgetId: string): void {
    const key = timerKey(roomId, widgetId);
    const timer = refreshTimers.get(key);
    if (timer !== undefined) {
        clearInterval(timer);
        refreshTimers.delete(key);
    }
}

/** À appeler quand on quitte la conférence (action HangupCall). */
export async function watchaJitsiPresenceOnHangup(client: MatrixClient, roomId: string, widgetId: string): Promise<void> {
    const room = client.getRoom(roomId);
    if (!room || isVideoRoom(room)) return;

    watchaStopPresenceRefresh(roomId, widgetId);

    const deviceId = client.getDeviceId();
    if (!deviceId) return;

    let myDevices: string[] | null;
    try {
        myDevices = await writeMyDevices(client, roomId, widgetId, (devices) => devices.filter((d) => d !== deviceId));
    } catch (e) {
        logger.error("watcha: échec du retrait de présence Jitsi", e);
        return;
    }
    if (myDevices === null) return; // pas membre du salon

    // On s'appuie sur la nouvelle liste de NOS devices (sûre, calculée localement) + ceux des autres
    // (lus dans l'état partagé). S'il ne reste personne → on est le dernier → on retire le widget.
    const userId = client.getSafeUserId();
    const remaining = myDevices.length + countOtherActiveDevices(client, roomId, widgetId, userId);
    if (remaining > 0) return;

    if (!room.currentState.maySendStateEvent(WIDGET_STATE_EVENT_TYPE, userId)) return;
    try {
        await WidgetUtils.setRoomWidget(client, roomId, widgetId);
    } catch (e) {
        logger.error(`watcha: échec de la fermeture automatique du widget Jitsi ${widgetId}`, e);
    }
}
