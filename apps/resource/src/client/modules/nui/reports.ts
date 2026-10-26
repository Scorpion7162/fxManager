import { CALLBACK_NAMES } from '@common/types';
import { ClientCallbacks } from '../../utils/callbacks';
import { NuiCallback } from '../../utils/nui-callbacks';
NuiCallback<unknown, unknown>('get-reports', async (_, reply) =>
	reply(
		await ClientCallbacks.trigger(CALLBACK_NAMES.LIST_REPORTS, null, {
			fallback: null,
			timeoutMs: 10000,
		}),
	),
);
NuiCallback<unknown, unknown>('get-report', async (payload, reply) =>
	reply(
		await ClientCallbacks.trigger(CALLBACK_NAMES.GET_REPORT, payload, {
			fallback: null,
			timeoutMs: 10000,
		}),
	),
);
NuiCallback('report-action', async (payload, reply) =>
	reply(
		await ClientCallbacks.trigger(CALLBACK_NAMES.REPORT_ACTION, payload, {
			fallback: {
				success: false,
				message: 'Report request refused or server unavailable.',
			},
			timeoutMs: 10000,
		}),
	),
);
