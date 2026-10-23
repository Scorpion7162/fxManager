import type { ResourceData } from '@fxmanager/shared/types';
import { CALLBACK_NAMES } from '@common/types';
import { ServerCallbacks } from '../utils/callbacks';
import { getResourcesData } from '../utils/resources';

export interface ResourceSnapshot {
	resources: ResourceData[];
}

interface DoResourceActionInput {
	resource: string;
	action: 'start' | 'stop';
}

/**
 * Full resource list of the running server, filtered the same way the
 * monitoring layer excludes internal resources.
 */
ServerCallbacks.register<undefined, ResourceData[]>(
	CALLBACK_NAMES.LIST_RESOURCES,
	() => getResourcesData() as ResourceData[],
	{ permission: 'RESOURCE_LIST', fallback: [] },
);

/**
 * Start or stop a resource requested by a player's UI. Returned boolean
 * reports whether the action was accepted (the state change is async).
 */
ServerCallbacks.register<DoResourceActionInput, boolean>(
	CALLBACK_NAMES.RESOURCE_ACTION,
	(_, data) => {
		if (
			typeof data?.resource !== 'string' ||
			data.resource.length === 0 ||
			(data.action !== 'start' && data.action !== 'stop')
		) {
			throw new Error('Invalid resource action payload.');
		}

		// null → excluded internal resource or unknown resource
		if (!getResourcesData(data.resource)) return false;

		if (data.action === 'start') {
			StartResource(data.resource);
		} else {
			StopResource(data.resource);
		}

		return true;
	},
	{ permission: 'RESOURCE_LIST', fallback: false },
);
