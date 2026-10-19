import { CALLBACK_NAMES, EVENT_NAMES } from '@common/types';
import { playerManager } from '../../monitoring';
import { ServerCallbacks } from '../../utils/callbacks';

interface HealTargetPayload {
	target: number | 'all' | 'self';
}

interface HealTargetResponse {
	allowed: boolean;
	success: boolean;
	error?: string;
}

function isValidPayload(payload: unknown): payload is HealTargetPayload {
	if (typeof payload !== 'object' || payload === null) return false;

	const { target } = payload as Record<string, unknown>;

	return (
		(typeof target === 'number' && Number.isInteger(target) && target > 0) ||
		target === 'all' ||
		target === 'self'
	);
}

ServerCallbacks.register<HealTargetPayload, HealTargetResponse>(
	CALLBACK_NAMES.HEAL_TARGET,
	(_source, payload) => {
		if (!isValidPayload(payload)) {
			return { allowed: false, success: false, error: 'Invalid payload' };
		}

		const { target } = payload;

		if (target === 'self') return { allowed: true, success: true };

		let targets: number[];
		if (target === 'all') {
			targets = playerManager.getPlayers();
		} else {
			// reject ids that are not valid online players
			if (!playerManager.getPlayer(target)) {
				return {
					allowed: false,
					success: false,
					error: 'Target player not found',
				};
			}
			targets = [target];
		}

		for (const id of targets) {
			emitNet(EVENT_NAMES.S2C_HEAL, id);
		}

		return { allowed: true, success: true };
	},
	{ permission: 'HEAL_PLAYERS', fallback: { allowed: false, success: false } },
);
