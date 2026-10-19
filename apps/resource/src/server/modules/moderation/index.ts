// src/server/modules/noclip.ts
import { CALLBACK_NAMES } from '@common/types';
import { ServerCallbacks } from '../../utils/callbacks';

ServerCallbacks.register<null, boolean>(
	CALLBACK_NAMES.TOGGLE_BLIPS,
	async (_source: number) => {
		return true;
	},
	{
		permission: 'PLAYER_MONITORING',
		fallback: false,
	},
);
