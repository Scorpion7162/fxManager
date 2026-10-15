import {
	EVENT_NAMES,
	type NotificationPayload,
	type UserPermissionKey,
} from '@common/types';
import { playerManager } from '../../monitoring';

export interface NotifyAllOptions {
	/** broadcast only to players holding this permission */
	permission?: UserPermissionKey;
}

/**
 * Pushes a notification to a single client.
 */
export function notifyPlayer(
	source: number | string,
	payload: NotificationPayload,
): void {
	TriggerClientEvent(EVENT_NAMES.S2C_NOTIFICATION, source, payload);
}

/**
 * Broadcasts a notification to all players, optionally restricted
 * to players holding the given permission (e.g. staff-only DMs / report
 * thread updates).
 */
export function notifyAll(
	payload: NotificationPayload,
	opts: NotifyAllOptions = {},
): void {
	console.log('NotifyAll was called')
	for (const source of playerManager.getPlayers({
		permission: opts.permission,
	})) {
		console.log('sending payload to', source);
		TriggerClientEvent(EVENT_NAMES.S2C_NOTIFICATION, source, payload);
	}
}
