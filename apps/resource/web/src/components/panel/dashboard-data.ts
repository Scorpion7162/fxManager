import type {
	NuiDashboardPayload,
	NuiDashboardPlayer,
	NuiDashboardReport,
} from '@common/types';

// re-exported so views (and the client Lua bridge) agree on the contract
export {
	NUI_DASHBOARD_SUBSCRIBE,
	NUI_DASHBOARD_UNSUBSCRIBE,
	NUI_DASHBOARD_UPDATE_EVENT,
} from '@common/types';
export type {
	NuiDashboardPayload,
	NuiDashboardPlayer,
	NuiDashboardReport,
	NuiDashboardStats,
} from '@common/types';

/**
 * Browser-dev mock data, consumed only when `isEnvBrowser()` is true (the
 * in-game dashboard relies entirely on the real subscribe/push feed).
 */
/** server slot capacity; live pushes provide real values */
export const MOCK_CAPACITY = 128;

export const MOCK_REPORTS: NuiDashboardReport[] = [
	{ id: 1, subject: 'DV abuse at scene', unread: 2, age: '12m' },
	{ id: 2, subject: 'Teleport exploit claim', unread: 1, age: '38m' },
	{ id: 400, subject: "It's Andreutu not Andretutu", unread: 0, age: '04m' },
	{ id: 404, subject: 'FJamZoo is trolling me', unread: 0, age: '24m' },
	{ id: 5, subject: 'Cayo heist crash repeat', unread: 0, age: '1h 04m' },
];

export const MOCK_PLAYERS: NuiDashboardPlayer[] = [
	{ serverId: 4, name: 'Vexy', staff: true, ping: 42, duration: 4_020_000 },
	{ serverId: 12, name: 'kartal', ping: 63, duration: 2_470_000 },
	{
		serverId: 31,
		name: 'El-Rizzo',
		staff: true,
		ping: 88,
		duration: 1_110_000,
	},
	{ serverId: 7, name: 'mika.wav', staff: true, ping: 114, duration: 940_000 },
	{
		serverId: 55,
		name: 'a_very_long_player_name',
		ping: 163,
		duration: 512_000,
	},
	{ serverId: 19, name: 'Thomazzinho', ping: 71, duration: 305_000 },
	{ serverId: 28, name: 'deconned', duration: 121_000 },
	{ serverId: 44, name: 'lil_deadpool', ping: 203, duration: 47_000 },
	// extra rows (incl. 5-digit ids) to exercise scroll + id alignment
	{ serverId: 61, name: 'k1llua', staff: true, ping: 47, duration: 823_000 },
	{ serverId: 77, name: 'Fedde', ping: 96, duration: 664_000 },
	{ serverId: 90, name: 'rivera', ping: 128, duration: 240_000 },
	{ serverId: 133, name: 'N0va', duration: 198_000 },
	{ serverId: 244, name: 'seenz_03', ping: 66, duration: 161_000 },
	{ serverId: 512, name: 'boob1337', ping: 91, duration: 1005_000 },
	{ serverId: 743, name: 'TatoLoko', ping: 154, duration: 88_000 },
	{ serverId: 1337, name: 'nyx', ping: 53, duration: 74_000 },
	{
		serverId: 2099,
		name: 'mireles.gg',
		staff: true,
		ping: 118,
		duration: 62_000,
	},
	{ serverId: 4102, name: 'zabokado', duration: 47_000 },
	{ serverId: 5143, name: 'fuely', ping: 39, duration: 33_000 },
	{ serverId: 8951, name: 'ZERSTORER', ping: 177, duration: 26_000 },
	{ serverId: 10247, name: 'deus_Ex_M', ping: 242, duration: 9_000 },
];

/** full mock snapshot used by `DashboardSection` only in the browser */
export const MOCK_PAYLOAD: NuiDashboardPayload = {
	stats: {
		players: MOCK_PLAYERS.length,
		capacity: MOCK_CAPACITY,
		admins: MOCK_PLAYERS.filter((p) => p.staff).length,
	},
	players: MOCK_PLAYERS,
	reports: MOCK_REPORTS,
};

/**
 * The player-activity chart has no in-game feed yet, so it stays mocked in
 * the browser only (in-game the chart shows its "Collecting samples" state).
 * When a real sample feed exists, mirror it into a `{ time; players }`
 * array and drop these helpers.
 */
function generateSamples(
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

const clockFmt = new Intl.DateTimeFormat([], {
	hour: '2-digit',
	minute: '2-digit',
});

export const MOCK_CHART: { time: string; players: number }[] = generateSamples(
	60,
	50,
	14,
).map((players, i) => ({
	time: clockFmt.format(Date.now() - (59 - i) * 60_000),
	players,
}));
