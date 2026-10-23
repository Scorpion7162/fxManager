import { CALLBACK_NAMES, EVENT_NAMES } from '@common/types';
import type { ClientPlayerBlipUpdate } from '@fxmanager/shared/types';
import {
	Blip,
	type BlipColor,
	BlipSprite,
	Game,
	Vector3,
} from '@nativewrappers/fivem';
import { NuiCallback } from '../../utils/nui-callbacks';
import { permissions } from '../../utils/permissions';
import { ClientCallbacks } from '../../utils/callbacks';

class BlipManager {
	public enabled = false;
	private readonly blips: Map<string, Blip> = new Map();
	private playerUpdates: ClientPlayerBlipUpdate = {};

	updatePlayerData(payload: ClientPlayerBlipUpdate) {
		this.playerUpdates = payload;
	}

	clearBlips() {
		for (const [source, blip] of Object.entries(this.blips)) {
			blip.delete();
			this.blips.delete(source);
		}
	}

	createBlip(coords: Vector3): Blip {
		const handle = AddBlipForCoord(coords.x, coords.y, coords.z);
		const blip = new Blip(handle);

		blip.Sprite = BlipSprite.Standard;
		blip.Color = 47 as BlipColor;
		blip.Scale = 1;
		SetBlipCategory(blip.Handle, 7);

		return blip;
	}

	syncBlips() {
		for (const [source, blip] of Object.entries(this.blips)) {
			if (NetworkIsPlayerActive(Number(source))) continue;

			blip.delete();
			this.blips.delete(source);
		}

		for (const [source, player] of Object.entries(this.playerUpdates)) {
			if (source === String(Game.Player.ServerId)) continue;

			const position = Vector3.fromArray(player.coords);
			let blip = this.blips.get(source);

			if (!blip?.exists()) {
				blip = this.createBlip(position);
				this.blips.set(source, blip);
			}

			blip.Position = position;
			blip.Name = `${player.username} [${source}]`;
		}
	}
}

export const blipManager = new BlipManager();

onNet(EVENT_NAMES.S2C_UPDATE_PLAYERS, (payload: ClientPlayerBlipUpdate) => {
	blipManager.updatePlayerData(payload);

	if (blipManager.enabled) blipManager.syncBlips();
});

NuiCallback<boolean, boolean>('moderation-blips', async (enabled, reply) => {
	if (!permissions.has('PLAYER_MONITORING')) return reply(false);

	const response = await ClientCallbacks.trigger<boolean>(
		CALLBACK_NAMES.TOGGLE_BLIPS,
		null,
		{ fallback: false },
	);

	if (!response) return reply(false);

	blipManager.enabled = enabled;

	if (blipManager.enabled) blipManager.syncBlips();
	else blipManager.clearBlips();

	reply(true);
});
