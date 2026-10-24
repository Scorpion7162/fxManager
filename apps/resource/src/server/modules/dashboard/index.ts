import {
	CALLBACK_NAMES,
	EVENT_NAMES,
	EMPTY_DASHBOARD,
	type NuiDashboardPayload,
	type NuiDashboardPlayer,
} from '@common/types';
import { playerManager } from '../../monitoring';
import { ServerCallbacks } from '../../utils/callbacks';

/** sources with an open dashboard, receiving the monitor-tick push feed */
const subscribers = new Set<string>();

const serverStartTime = Date.now() - GetGameTimer();

export function buildDashboardSnapshot(): NuiDashboardPayload {
	const players: NuiDashboardPlayer[] = playerManager
		.getPlayers()
		.flatMap((source) => {
			const player = playerManager.getPlayer(source);
			if (!player) return [];

			return [
				{
					serverId: source,
					name: player.name,
					staff: player.staff,
					ping: player.ping,
					joinedAt: player.joinedAt ?? Date.now(),
				} satisfies NuiDashboardPlayer,
			];
		});

	return {
		stats: {
			serverStartTime,
			players: players.length,
			capacity: GetConvarInt('sv_maxclients', 64),
			admins: players.filter((player) => player.staff).length,
		},
		players,
		reports: [],
	};
}

/** open the push feed for the requesting player and return the initial data */
export function subscribeDashboard(source: number): NuiDashboardPayload {
	subscribers.add(String(source));
	return buildDashboardSnapshot();
}

/** close the push feed for the requesting player */
export function unsubscribeDashboard(source: number | string): void {
	subscribers.delete(String(source));
}

// subscriptions die with the player regardless of the explicit unsubscribe
on('playerDropped', () => {
	subscribers.delete(String(globalThis.source));
});

function pushDashboardSnapshot(): void {
	if (subscribers.size === 0) return;

	const snapshot = buildDashboardSnapshot();
	for (const source of subscribers) {
		emitNet(EVENT_NAMES.S2C_DASHBOARD_UPDATE, source, snapshot);
	}
}

// the push feed reuses the 5 s player-monitor cadence
playerManager.onTick(pushDashboardSnapshot);

/** subscribe + initial snapshot for a dashboard viewer, gated on monitoring */
ServerCallbacks.register<undefined, NuiDashboardPayload>(
	CALLBACK_NAMES.GET_DASHBOARD,
	(source) => subscribeDashboard(source),
	{ permission: 'PLAYER_MONITORING', fallback: EMPTY_DASHBOARD },
);

/** stop the push feed for a closing dashboard view, gated on monitoring */
ServerCallbacks.register<undefined, boolean>(
	CALLBACK_NAMES.UNSUBSCRIBE_DASHBOARD,
	(source) => {
		unsubscribeDashboard(source);
		return true;
	},
	{ permission: 'PLAYER_MONITORING', fallback: false },
);
