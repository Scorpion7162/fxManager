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
	permissions: number;
	ped?: number;
	coords?: Vector3;
}

class PlayerManager {
	private players: Map<string, TrackedPlayer> = new Map();
	private updateInterval: NodeJS.Timeout | null = null;

	addPlayer(source: number) {
		if (this.players.size === 0) this.startUpdates();

		const permissions = getPermissions(source);
		this.players.set(`${source}`, { permissions });
	}

	removePlayer(source: number) {
		this.players.delete(`${source}`);
		if (this.players.size === 0) this.clearUpdates();
	}

	updatePlayerPed(source: number | string, ped?: number) {
		source = typeof source === 'string' ? source : String(source);

		const player = this.getPlayer(source);
		if (!player) return;

		ped = ped ?? GetPlayerPed(source);
		if (ped <= 0) return;

		player.ped = ped;
	}

	updatePlayerCoords(source: number | string, coords?: Vector3) {
		source = typeof source === 'string' ? source : String(source);

		const player = this.getPlayer(source);
		if (!player?.ped) return;

		player.coords = coords ?? Vector3.fromArray(GetEntityCoords(player.ped));
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

				this.updatePlayerPed(src, ped);
				this.updatePlayerCoords(src, coords);
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
