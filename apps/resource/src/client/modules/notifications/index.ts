import {
	EVENT_NAMES,
	NUI_NOTIFICATION_EVENT,
	type NuiNotificationMessage,
	type NotificationPayload,
	type NotificationSound,
} from '@common/types';

/** Plays the optional GTA frontend sound attached to a notification payload */
function playSound(sound: NotificationSound | undefined) {
	if (!sound) return;
	PlaySoundFrontend(-1, sound.ref, sound.set, true);
}

function pushToNui(message: NuiNotificationMessage) {
	SendNUIMessage({
		action: NUI_NOTIFICATION_EVENT,
		data: message,
	});
}

/**
 * Shows a transient status toast on this player's screen (vehicle spawned,
 * repaired, player names toggled, ...)
 * Auto-dismisses after its duration
 */
export function notify(payload: NotificationPayload): void {
	playSound(payload.sound);
	pushToNui({ op: 'show', data: payload });
}

/**
 * Shows (or updates) a keyed never-auto-dismissing banner, e.g. the noclip
 * indicator. Only `clearPersistentNotification` removes it
 */
export function showPersistentNotification(
	id: string,
	payload: NotificationPayload,
): void {
	playSound(payload.sound);
	pushToNui({ op: 'show', id, data: payload });
}

/** Clears a keyed persistent banner. No-op when nothing is keyed under `id` */
export function clearPersistentNotification(id: string): void {
	pushToNui({ op: 'clear-persistent', id });
}

/** Clears every persistent banner currently showing */
export function clearAllPersistentNotifications(): void {
	pushToNui({ op: 'clear-all-persistent' });
}

/** Relays server-pushed notifications (exports.notifyUser / notifyAll) */
onNet(EVENT_NAMES.S2C_NOTIFICATION, (payload: NotificationPayload) => {
	notify(payload);
});
