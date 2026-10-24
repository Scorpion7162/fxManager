import type {
	ClientPlayerBlipUpdate,
	PlayerUpdatePackage,
} from '@fxmanager/shared/types';
import { QueryManager } from '../utils/query';
import { getPermissions } from '../utils/permissions';
import { EVENT_NAMES, type UserPermissionKey } from '@common/types';
import { PermissionManager } from '@fxmanager/shared/utils';
import { UserPermissions } from '@fxmanager/shared/constants';
import { IsInDevelopment } from '@common/utils';
import { Vector3 } from '@nativewrappers/fivem';

export interface PlayerFilter {
	/** only return sources holding this permission (master admins always match) */
	permission?: UserPermissionKey;
}

export interface TrackedPlayer {
	name: string;
	staff: boolean;
	permissions: number;
	joinedAt?: number;
	ped?: number;
	coords?: Vector3;
	ping?: number;
	health?: number;
}

class PlayerManager {
	private players: Map<string, TrackedPlayer> = new Map();
	private updateInterval: NodeJS.Timeout | null = null;
	private tickListeners = new Set<() => void>();

	addPlayer(source: number) {
		if (this.players.size === 0) this.startUpdates();

		const name = GetPlayerName(String(source));
		const permissions = getPermissions(source);
		this.players.set(`${source}`, {
			permissions,
			name,
			staff: permissions !== 0,
			joinedAt: Date.now(),
		});
	}

	removePlayer(source: number) {
		this.players.delete(`${source}`);
		if (this.players.size === 0) this.clearUpdates();
	}

	updatePlayer(source: string | number, data: Partial<TrackedPlayer>) {
		source = typeof source === 'string' ? source : String(source);

		const player = this.getPlayer(source);
		if (!player) return;

		const updates: Partial<TrackedPlayer> = {};

		if (data.name !== undefined) {
			if (typeof data.name === 'string' && data.name.trim().length > 0) {
				updates.name = data.name.trim();
			}
		}

		if (data.staff !== undefined) {
			updates.staff = Boolean(data.staff);
		}

		if (data.permissions !== undefined) {
			if (typeof data.permissions === 'number' && !isNaN(data.permissions)) {
				updates.permissions = Math.max(0, data.permissions);
			}
		}

		if (data.ped !== undefined) {
			const ped = data.ped ?? GetPlayerPed(source);
			if (ped > 0) {
				updates.ped = ped;
			}
		}

		if (data.coords !== undefined) {
			if (data.coords) {
				updates.coords = data.coords;
			}
		}

		if (data.ping !== undefined) {
			if (typeof data.ping === 'number' && data.ping >= 0) {
				updates.ping = data.ping;
			}
		}

		if (data.health !== undefined) {
			if (typeof data.health === 'number' && data.health >= 0) {
				updates.health = data.health;
			}
		}

		Object.assign(player, updates);

		return player;
	}

	dropAll(reason: string): number {
		const ids = [...this.players.keys()];
		for (const id of ids) DropPlayer(id, reason);
		return ids.length;
	}

	getPlayer(source: number | string) {
		return this.players.get(
			typeof source === 'string' ? source : String(source),
		);
	}

	isAllowed(source: number | string, permission: UserPermissionKey) {
		const player = this.players.get(
			typeof source === 'string' ? source : String(source),
		);

		if (!player) return false;

		return PermissionManager.has(
			player.permissions,
			UserPermissions[permission],
		);
	}

	/**
	 * Tracked player sources as numbers. Optionally filter by a permission
	 * (bitfield check against the cached snapshot).
	 */
	getPlayers(filter?: PlayerFilter): number[] {
		const sources = [...this.players.keys()].map(Number);

		const { permission } = filter ?? {};
		if (!permission) return sources;

		return sources.filter((src) => this.isAllowed(src, permission));
	}

	/** capture the player's ped once it spawned (called on playerJoined) */
	updatePlayerPed(source: number | string) {
		const src = String(source);
		const ped = GetPlayerPed(src);
		if (ped > 0) this.updatePlayer(src, { ped });
	}

	/**
	 * Register a listener fired at the end of every monitor tick
	 */
	onTick(listener: () => void): () => void {
		this.tickListeners.add(listener);
		return () => this.tickListeners.delete(listener);
	}

	private startUpdates() {
		this.updateInterval = setInterval(async () => {
			const updatePacket: PlayerUpdatePackage = {};
			const clientUpdatePacket: ClientPlayerBlipUpdate = {};

			for (const src of this.players.keys()) {
				const ped = GetPlayerPed(src);
				if (ped <= 0) continue; // sanity check

				const health = GetEntityHealth(ped);
				const ping = GetPlayerPing(src);
				const coords = Vector3.fromArray(GetEntityCoords(ped));
				const coordsArray = coords.toArray();

				updatePacket[src] = [health, ping, coordsArray];
				clientUpdatePacket[src] = {
					username: GetPlayerName(src),
					coords: coordsArray,
				};

				this.updatePlayer(src, { ped, coords, health, ping });
			}

			if (Object.keys(updatePacket).length === 0)
				return console.warn('NO DATA FOR UPDATE INTERVAL');

			this.getPlayers({ permission: 'PLAYER_MONITORING' }).forEach((src) => {
				emitNet(EVENT_NAMES.S2C_UPDATE_PLAYERS, src, clientUpdatePacket);
			});

			await QueryManager({
				endpoint: '/players/update',
				method: 'POST',
				body: { payload: updatePacket },
			});

			for (const listener of this.tickListeners) listener();
		}, 5_000);
	}

	private clearUpdates() {
		if (!this.updateInterval) return;
		clearInterval(this.updateInterval);
		this.updateInterval = null;
	}
}

export const playerManager = new PlayerManager();

if (IsInDevelopment()) {
	const players = getPlayers();

	for (const id of players) {
		playerManager.addPlayer(parseInt(id, 10));
	}

	console.log(
		'[DEV] PLayerManager: added',
		players.length,
		'players to monitor',
	);
}
