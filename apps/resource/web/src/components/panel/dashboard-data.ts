import type {
	NuiDashboardPlayer,
	NuiDashboardPlayerHistorySnapshot,
	NuiDashboardReport,
	NuiDashboardSnapshot,
} from '@common/types';

// re-exported so views (and the client Lua bridge) agree on the contract
export {
	EMPTY_DASHBOARD,
	NUI_DASHBOARD_SUBSCRIBE,
	NUI_DASHBOARD_UNSUBSCRIBE,
	NUI_DASHBOARD_UPDATE_EVENT,
} from '@common/types';
export type {
	NuiDashboardEvent,
	NuiDashboardPlayer,
	NuiDashboardPlayerHistorySnapshot,
	NuiDashboardReport,
	NuiDashboardSnapshot,
	NuiDashboardStats,
	NuiDashboardUpdate,
} from '@common/types';

/**
 * Browser-dev mock data, consumed only when `isEnvBrowser()` is true (the
 * in-game dashboard relies entirely on the real subscribe/push feed).
 */
/** server slot capacity; live pushes provide real values */
const MOCK_CAPACITY = 128;

const MOCK_REPORTS: NuiDashboardReport[] = [
	{ id: 1, subject: 'DV abuse at scene', unread: 2, age: '12m' },
	{ id: 2, subject: 'Teleport exploit claim', unread: 1, age: '38m' },
	{ id: 400, subject: "It's Andreutu not Andretutu", unread: 0, age: '04m' },
	{ id: 404, subject: 'FJamZoo is trolling me', unread: 0, age: '24m' },
	{ id: 5, subject: 'Cayo heist crash repeat', unread: 0, age: '1h 04m' },
];

const MOCK_PLAYERS: NuiDashboardPlayer[] = [
	{ serverId: 2, name: 'Maximus', staff: true, ping: 35, joinedAt: 5_120_000 },
	{ serverId: 5, name: 'andreutu', staff: true, ping: 48, joinedAt: 4_850_000 },
	{ serverId: 9, name: 'FjamZoo', staff: true, ping: 22, joinedAt: 4_310_000 },
	{ serverId: 14, name: 'IgnoranceIsBliss', ping: 75, joinedAt: 3_900_000 },
	{ serverId: 18, name: 'Sava Wu', ping: 112, joinedAt: 3_450_000 },
	{ serverId: 22, name: 'Simon', ping: 64, joinedAt: 3_100_000 },
	{ serverId: 29, name: 'EdenDelire', ping: 95, joinedAt: 2_850_000 },
	{ serverId: 35, name: 'Pitchou', ping: 500, joinedAt: 2_400_000 },
	{ serverId: 42, name: 'RijayJH', ping: 58, joinedAt: 2_150_000 },
	{ serverId: 50, name: 'Sebbi', ping: 82, joinedAt: 1_900_000 },
	{ serverId: 65, name: 'Snowy', staff: true, ping: 44, joinedAt: 1_750_000 },
	{ serverId: 82, name: 'STEF0245', ping: 145, joinedAt: 1_520_000 },
	{ serverId: 105, name: 'Zurax', ping: 90, joinedAt: 1_340_000 },
	{ serverId: 120, name: 'aj', ping: 38, joinedAt: 1_200_000 },
	{ serverId: 156, name: 'Arius', ping: 104, joinedAt: 1_050_000 },
	{ serverId: 210, name: 'Boost', ping: 72, joinedAt: 920_000 },
	{ serverId: 340, name: 'Codexis', ping: 69, joinedAt: 810_000 },
	{ serverId: 480, name: 'davinski06', ping: 115, joinedAt: 700_000 },
	{ serverId: 620, name: 'dilax', ping: 42, joinedAt: 610_000 },
	{ serverId: 890, name: 'Jošt', ping: 99, joinedAt: 540_000 },
	{ serverId: 1150, name: 'JUST ME', ping: 150, joinedAt: 480_000 },
	{ serverId: 1420, name: 'Juustomies', ping: 122, joinedAt: 410_000 },
	{ serverId: 2300, name: 'kr3mu', ping: 51, joinedAt: 350_000 },
	{ serverId: 3100, name: 'max', ping: 79, joinedAt: 290_000 },
	{ serverId: 4500, name: 'Nur Rifqi Alhusaini', ping: 188, joinedAt: 210_000 },
	{ serverId: 6200, name: 'sasDragon ♡ 🐉🌸', ping: 65, joinedAt: 150_000 },
	{
		serverId: 8400,
		name: 'Scorpion',
		staff: true,
		ping: 400,
		joinedAt: 110_000,
	},
	{ serverId: 11200, name: 'Snipz', staff: true, ping: 134, joinedAt: 450_000 },
];

/**
 * Mock player history as raw `{ ts, players }` samples
 */
export function createMockHistory(): NuiDashboardPlayerHistorySnapshot[] {
	return mockChartSamples(60, 50, 14).map((players, i) => ({
		ts: Math.floor(Date.now() / 60_000) * 60_000 - (59 - i) * 60_000,
		players,
	}));
}

/** full mock snapshot used by `DashboardSection` only in the browser */
export function createMockDashboard(): NuiDashboardSnapshot {
	const players = MOCK_PLAYERS.map((player) => ({
		...player,
		joinedAt: Date.now() - player.joinedAt,
	}));

	return {
		type: 'snapshot',
		stats: {
			serverStartTime: Date.now() - 3 * 60_000,
			players: players.length,
			capacity: MOCK_CAPACITY,
			admins: players.filter((p) => p.staff).length,
		},
		players,
		playerHistory: createMockHistory(),
		reports: MOCK_REPORTS,
	};
}

/**
 * The player-activity chart has no in-game feed yet, so it stays mocked in
 * the browser only (in-game the chart shows its "Collecting samples" state
 * until the real history arrives with the snapshot).
 */
function mockChartSamples(
	count: number,
	start: number,
	spread: number,
): number[] {
	let seed = 42;
	const players: number[] = [];
	for (let i = 0; i < count; i++) {
		seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
		const jitter = (seed / 2_147_483_648 - 0.5) * spread;
		const ideal = start + Math.sin((i / count) * Math.PI) * start * 0.5;
		const prev = players[i - 1];
		players.push(
			Math.max(0, Math.round((prev ?? ideal) * 0.7 + ideal * 0.3 + jitter)),
		);
	}
	return players;
}
