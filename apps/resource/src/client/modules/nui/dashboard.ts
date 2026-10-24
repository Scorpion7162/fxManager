import {
	NUI_DASHBOARD_UPDATE_EVENT,
	NUI_DASHBOARD_UNSUBSCRIBE,
	type NuiDashboardPayload,
	EMPTY_DASHBOARD,
	CALLBACK_NAMES,
	EVENT_NAMES,
} from '@common/types';
import { ClientCallbacks } from '../../utils/callbacks';
import { NuiCallback } from '../../utils/nui-callbacks';
import { permissions } from '../../utils/permissions';

NuiCallback('subscribe-dashboard', (_, cb) => {
	if (!permissions.has('PLAYER_MONITORING')) {
		cb(EMPTY_DASHBOARD as Record<string, any>);
		return;
	}

	ClientCallbacks.trigger<NuiDashboardPayload | undefined>(
		CALLBACK_NAMES.GET_DASHBOARD,
		undefined,
		{ fallback: undefined },
	).then((snapshot) => {
		cb((snapshot ?? EMPTY_DASHBOARD) as Record<string, any>);
	});
});

NuiCallback(NUI_DASHBOARD_UNSUBSCRIBE, (_, cb) => {
	if (!permissions.has('PLAYER_MONITORING')) {
		cb({});
		return;
	}

	ClientCallbacks.trigger<boolean>(
		CALLBACK_NAMES.UNSUBSCRIBE_DASHBOARD,
		undefined,
		{ fallback: false },
	).then(() => {
		cb({});
	});
});

/** forward server-side dashboard pushes to the NUI (`SendNUIMessage`) */
onNet(EVENT_NAMES.S2C_DASHBOARD_UPDATE, (payload: NuiDashboardPayload) => {
	SendNUIMessage({ action: NUI_DASHBOARD_UPDATE_EVENT, data: payload });
});
