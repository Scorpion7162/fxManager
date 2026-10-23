import { CALLBACK_NAMES, type ResourceActionReply, type ResourcesSnapshotReply } from '@common/types';
import { ClientCallbacks } from '../../utils/callbacks';
import { NuiCallback } from '../../utils/nui-callbacks';
import { permissions } from '../../utils/permissions';
import { ResourceData } from '@fxmanager/shared/types';

/** NUI request for the full resource list; gated on the RESOURCE_LIST permission */
NuiCallback('get-resources', (_, cb) => {
	if (!permissions.has('RESOURCE_LIST')) {
		cb({ return: false, resources: [] } satisfies ResourcesSnapshotReply);
		return;
	}

	ClientCallbacks.trigger<ResourceData[]>(
		CALLBACK_NAMES.LIST_RESOURCES,
		undefined,
		{ fallback: [] },
	).then((resources) => {
		cb({
			return: true,
			resources,
		} satisfies ResourcesSnapshotReply);
	});
});

/** NUI request to start/stop a single resource */
NuiCallback(
	'resource-action',
	(data: { resource: string; action: 'start' | 'stop' }, cb) => {
		if (!permissions.has('RESOURCE_LIST')) {
			cb({ return: false } satisfies ResourceActionReply);
			return;
		}

		ClientCallbacks.trigger<boolean>(
			CALLBACK_NAMES.RESOURCE_ACTION,
			data,
			// untrusted NUI input: the server callback validates the payload shape
			{ fallback: false },
		).then((accepted) => {
			cb({ return: accepted } satisfies ResourceActionReply);
		});
	},
);
