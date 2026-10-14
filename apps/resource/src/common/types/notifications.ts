/** Visual style of a notification entry in the viewport */
export type NotificationVariant = 'info' | 'success' | 'warning' | 'error';

/** GTA5 frontend sound pair, played when the notification appears. Optional, silent if omitted */
export interface NotificationSound {
	/** e.g. 'TOGGLE_ON' */
	ref: string;
	/** e.g. 'HUD_FRONTEND_DEFAULT_SOUNDSET' */
	set: string;
}

export interface NotificationPayload {
	title: string;
	description?: string;
	variant?: NotificationVariant;
	/**
	 * ms before auto-dismiss. `0` / `null` means the entry never auto-dismisses
	 * (persistent banner) and is only removed by an explicit clear
	 * default: 5000
	 */
	duration?: number | null;
	sound?: NotificationSound;
}

export const NUI_NOTIFICATION_EVENT = 'notification';

/**
 * Bare NUI message pushed by the client script into the web UI.
 * A `show` op(eration) with an `id` targets a persistent (keyed) entry. Calling it again
 * with the same id updates the entry in place instead of stacking a new one
 */
export type NuiNotificationMessage =
	| { op: 'show'; id?: string; data: NotificationPayload }
	| { op: 'clear-persistent'; id: string }
	| { op: 'clear-all-persistent' };
