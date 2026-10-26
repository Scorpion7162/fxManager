import {
	CALLBACK_NAMES,
	EVENT_NAMES,
	EMPTY_DASHBOARD,
	type NuiDashboardPlayer,
	type NuiDashboardPlayerHistorySnapshot,
	type NuiDashboardSnapshot,
	type NuiDashboardStats,
	type NuiDashboardUpdate,
} from '@common/types';
import { playerManager, type PlayerCountSample } from '../../monitoring';
import { ServerCallbacks } from '../../utils/callbacks';

/** No need to query via native every cycle */
const capacity = GetConvarInt('sv_maxclients', 64);

/** sources with an open dashboard, receiving the monitor-tick push feed */
const subscribers = new Set<string>();

/**
 * ts of the last chart bucket included in a push feed message, or null before
 * the first push this session. Subscribers seed from their initial snapshot,
 * so the feed only carries history deltas after it.
 */
let pushedHistoryUntil: number | null = null;

const serverStartTime = Date.now() - GetGameTimer();

export function buildDashboardSnapshot(): NuiDashboardSnapshot {
	const players = collectDashboardPlayers();

	return {
		type: 'snapshot',
		stats: buildStats(players),
		players,
		playerHistory: chartBuckets(playerManager.getRawPlayerHistory()),
		reports: [],
	};
}

function buildStats(players: NuiDashboardPlayer[]): NuiDashboardStats {
	return {
		serverStartTime,
		players: players.length,
		capacity,
		admins: players.filter((player) => player.staff).length,
	};
}

/** open the push feed for the requesting player and return the initial data */
export function subscribeDashboard(source: number): NuiDashboardSnapshot {
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

function pushDashboardUpdate(): void {
	if (subscribers.size === 0) return;

	// only the chart points completed since the previous push are sent;
	// viewers already hold the full history from their snapshot
	const history = chartBuckets(playerManager.getRawPlayerHistory());
	const lastPushed = pushedHistoryUntil;
	pushedHistoryUntil = history.at(-1)?.ts ?? pushedHistoryUntil;

	// every subscriber seeded from a snapshot, so repeats are harmless:
	// baseline only ever excludes history the viewer cannot have yet
	const baseline = lastPushed ?? Number.NEGATIVE_INFINITY;
	const newHistory = history.filter((point) => point.ts > baseline);
	const players = collectDashboardPlayers();

	const update: NuiDashboardUpdate = {
		type: 'update',
		stats: buildStats(players),
		players,
		playerHistory: newHistory,
	};

	for (const source of subscribers) {
		emitNet(EVENT_NAMES.S2C_DASHBOARD_UPDATE, source, update);
	}
}

/**
 * Dashboard chart resolution: raw monitor samples are decimated into
 * 1-minute buckets (mean player count) so the chart carries ~60 points/hour
 * instead of the full 5 s sample feed.
 */
const CHART_BUCKET_MS = 60_000;

function chartBuckets(
	samples: PlayerCountSample[],
): NuiDashboardPlayerHistorySnapshot[] {
	const buckets = new Map<number, { sum: number; count: number }>();

	for (const sample of samples) {
		const ts = Math.floor(sample.ts / CHART_BUCKET_MS) * CHART_BUCKET_MS;
		const bucket = buckets.get(ts) ?? { sum: 0, count: 0 };
		bucket.sum += sample.players;
		bucket.count++;
		buckets.set(ts, bucket);
	}

	return [...buckets.entries()]
		.map(
			([ts, { sum, count }]): NuiDashboardPlayerHistorySnapshot => ({
				ts,
				players: Math.round(sum / count),
			}),
		)
		.sort((a, b) => a.ts - b.ts);
}

/** dashboard player rows, rebuilt fresh on every snapshot/push */
function collectDashboardPlayers(): NuiDashboardPlayer[] {
	return playerManager.getPlayers().flatMap((source): NuiDashboardPlayer[] => {
		const player = playerManager.getPlayer(source);
		if (!player) return [];

		return [
			{
				serverId: source,
				name: player.name,
				staff: player.staff,
				ping: player.ping,
				joinedAt: player.joinedAt ?? Date.now(),
			},
		];
	});
}

// the push feed reuses the 5 s player-monitor cadence
playerManager.onTick(pushDashboardUpdate);

/** subscribe + initial snapshot for a dashboard viewer, gated on monitoring */
ServerCallbacks.register<undefined, NuiDashboardSnapshot>(
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
