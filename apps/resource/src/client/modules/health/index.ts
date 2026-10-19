import { Game } from '@nativewrappers/fivem';
import { CALLBACK_NAMES, EVENT_NAMES } from '@common/types';
import { ClientCallbacks } from '../../utils/callbacks';
import { NuiCallback } from '../../utils/nui-callbacks';
import { notify } from '../notifications';

interface HealTargetPayload {
	target: number | 'all' | 'self';
}

interface HealTargetResponse {
	allowed: boolean;
	success: boolean;
	error?: string;
}

function heal(showNotification: boolean = true) {
	const playerPed = Game.PlayerPed;

	if (playerPed.IsDead) {
		const { x, y, z } = playerPed.Position;
		const heading = playerPed.Heading;
		NetworkResurrectLocalPlayer(x, y, z, heading, 0, false);
	}

	playerPed.resurrect();
	playerPed.clearBloodDamage();

	if (!showNotification) return;

	notify({ title: "You've been healed", variant: 'info' });
}

NuiCallback<HealTargetPayload>('heal-target', async ({ target }, reply) => {
	const response = await ClientCallbacks.trigger<HealTargetResponse>(
		CALLBACK_NAMES.HEAL_TARGET,
		{ target },
		{ fallback: { allowed: false, success: false } },
	);

	if (!response.allowed)
		return reply({ success: false, message: 'Access Denied' });

	if (!response.success)
		return reply({
			success: false,
			message: response.error ?? 'Unable to heal target',
		});

	if (target === 'self') heal(false);

	reply({ success: true, message: 'Player healed' });
});

onNet(EVENT_NAMES.S2C_HEAL, () => heal());
