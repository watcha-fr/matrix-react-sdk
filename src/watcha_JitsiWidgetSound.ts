/*
Fichier spécifique Watcha.

Joue une notification sonore lorsqu'une personne lance un widget Jitsi
(conférence audio/vidéo) dans une salle dont l'utilisateur est membre.

Comportement :
 - sonne dans toutes les salles « join » (pas seulement la salle affichée) ;
 - ne sonne pas pour la personne qui a lancé le widget (l'émetteur) ;
 - ne sonne pas pendant la synchronisation initiale (évite de sonner au démarrage
   pour les widgets Jitsi déjà présents) ;
 - respecte le réglage « Notifications sonores » (audioNotificationsEnabled) ;
 - réutilise le son de sonnerie d'appel, joué une seule fois.
*/

import { ClientEvent, MatrixEvent, RoomStateEvent, SyncState } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";

import { MatrixClientPeg } from "./MatrixClientPeg";
import LegacyCallHandler, { AudioID } from "./LegacyCallHandler";
import Notifier from "./Notifier";
import { WidgetType } from "./widgets/WidgetType";

const WIDGET_STATE_EVENT_TYPE = "im.vector.modular.widgets";

class WatchaJitsiWidgetSound {
    private isSyncing = false;

    public start(): void {
        const cli = MatrixClientPeg.safeGet();
        cli.on(RoomStateEvent.Events, this.onRoomStateEvent);
        cli.on(ClientEvent.Sync, this.onSyncStateChange);
        this.isSyncing = false;
    }

    public stop(): void {
        const cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener(RoomStateEvent.Events, this.onRoomStateEvent);
            cli.removeListener(ClientEvent.Sync, this.onSyncStateChange);
        }
        this.isSyncing = false;
    }

    // L'état « Syncing » n'est atteint qu'une fois la synchronisation initiale terminée :
    // on s'en sert pour ignorer le backlog d'événements reçus au démarrage.
    private onSyncStateChange = (state: SyncState): void => {
        if (state === SyncState.Syncing) {
            this.isSyncing = true;
        } else if (state === SyncState.Stopped || state === SyncState.Error) {
            this.isSyncing = false;
        }
    };

    private onRoomStateEvent = (ev: MatrixEvent): void => {
        if (!this.isSyncing) return; // pas de son pour les widgets déjà présents au démarrage
        if (!Notifier.isAudioEnabled()) return; // respecte le réglage « Notifications sonores »
        if (ev.getType() !== WIDGET_STATE_EVENT_TYPE) return;

        // À la suppression d'un widget, le contenu est vide : WidgetType.JITSI.matches renvoie false.
        const content = ev.getContent();
        if (!WidgetType.JITSI.matches(content.type)) return;

        const cli = MatrixClientPeg.get();
        if (!cli) return;

        // Ne pas sonner pour la personne qui a lancé le widget.
        if (ev.getSender() === cli.getUserId()) return;

        // Ne sonner que pour les salles dont on est réellement membre.
        const roomId = ev.getRoomId();
        const room = roomId ? cli.getRoom(roomId) : null;
        if (room?.getMyMembership() !== KnownMembership.Join) return;

        logger.debug(`WatchaJitsiWidgetSound: widget Jitsi lancé dans ${roomId} par ${ev.getSender()}`);
        LegacyCallHandler.instance.play(AudioID.JitsiStart);
    };
}

const instance = new WatchaJitsiWidgetSound();
export default instance;
