import type { UserPermissions } from '@fxmanager/shared/constants';
import type { ResourceData } from '@fxmanager/shared/types';

export interface CallbackPayload<T = unknown> {
	requestId: string;
	name: string;
	payload: T;
}

export interface CallbackResponse<T = unknown> {
	requestId: string;
	success: boolean;
	data?: T;
	error?: string;
}

export const EVENT_NAMES = {
	CLIENT_TO_SERVER_REQ: 'fxmanager:cb:c2s:req',
	CLIENT_TO_SERVER_RES: 'fxmanager:cb:c2s:res',
	SERVER_TO_CLIENT_REQ: 'fxmanager:cb:s2c:req',
	SERVER_TO_CLIENT_RES: 'fxmanager:cb:s2c:res',

	/** server -> client notification that the player's permissions changed */
	S2C_PERMISSIONS_UPDATED: 'fxmanager:s2c:permissions:updated',

	/** server -> client push of a notification payload for the player's NUI */
	S2C_NOTIFICATION: 'fxmanager:s2c:notification',

	/** server -> client command telling the receiving player to heal themselves */
	S2C_HEAL: 'fxmanager:s2c:player:heal',

	/** server -> client command telling the receiving player to seat into a spawned vehicle */
	S2C_VEHICLE_SEAT: 'fxmanager:s2c:vehicle:seat',

	/** server -> client update event for updating the data of currently connected players */
	S2C_UPDATE_PLAYERS: 'fxmanager:s2c:monitoring:update',

	/** server -> client push of a dashboard snapshot to subscribed panel players */
	S2C_DASHBOARD_UPDATE: 'fxmanager:s2c:dashboard:update',
} as const;

/** callback names registered on the server and triggered by the client */
export const CALLBACK_NAMES = {
	/** fetch the calling player's permission snapshot (bitfield + ace keys) */
	GET_PERMISSIONS: 'get-permissions',
	TOGGLE_NOCLIP: 'toggle-noclip',
	TELEPORT_COORDS: 'teleport-coords',
	/** fetch the full resource list of the running server */
	LIST_RESOURCES: 'list-resources',
	/** start or stop a single resource on the server */
	RESOURCE_ACTION: 'resource-action',
	HEAL_TARGET: 'heal-target',
	SPAWN_VEHICLE: 'spawn-vehicle',
	FIX_VEHICLE: 'fix-vehicle',
	DELETE_VEHICLE: 'delete-vehicle',
	/** subscribe the calling player to the dashboard snapshot + push feed */
	GET_DASHBOARD: 'get-dashboard',
	/** stop the dashboard push feed for the calling player */
	UNSUBSCRIBE_DASHBOARD: 'unsubscribe-dashboard',
	TOGGLE_BLIPS: 'toggle-blips',
} as const;

/** bare NUI callback action used for the SendNUIMessage permissions push */
export const NUI_PERMISSIONS_EVENT = 'permissions';

/** SendNUIMessage action pushing a full dashboard snapshot to the NUI */
export const NUI_DASHBOARD_UPDATE_EVENT = 'dashboard';

/** NUI callback the dashboard calls once to receive the initial snapshot and open the update feed */
export const NUI_DASHBOARD_SUBSCRIBE = 'subscribe-dashboard';

/** NUI callback fired when the dashboard view unmounts to stop the push feed */
export const NUI_DASHBOARD_UNSUBSCRIBE = 'unsubscribe-dashboard';

// region dashboard snapshot payload (client runtime -> NUI)
/** stats strip on the dashboard; live values once a push is wired server-side */
export interface NuiDashboardStats {
	/** serverstart time */
	serverStartTime: number;
	players: number;
	capacity: number;
	admins: number;
}

/** single connected player for the dashboard list */
export interface NuiDashboardPlayer {
	serverId: number;
	name: string;
	/** reports/monitoring staff flag (bitfield check server-side) */
	staff?: boolean;
	/** server ping in ms, absent until the first monitor tick provides it */
	ping?: number;
	/** timestamp of their moment of conenction */
	joinedAt: number;
}

/** single active report ticket for the dashboard recap */
export interface NuiDashboardReport {
	id: number;
	subject: string;
	/** count of unseen follow-up messages on the ticket */
	unread: number;
	/** pre-formatted relative age, e.g. "12m" */
	age: string;
}

/** full dashboard snapshot; sent on join and whenever any piece changes */
export interface NuiDashboardPayload {
	stats: NuiDashboardStats;
	players: NuiDashboardPlayer[];
	reports: NuiDashboardReport[];
}
// endregion

/** zeroed snapshot used when a dashboard request is refused/has no data yet */
export const EMPTY_DASHBOARD: NuiDashboardPayload = {
	stats: { players: 0, capacity: 0, admins: 0, serverStartTime: Date.now() },
	players: [],
	reports: [],
};

export interface PermissionSnapshot {
	/** raw UserPermissions bitfield, see @fxmanager/shared/constants */
	permissions: number;
}

export interface ResourcesSnapshotReply {
	return: boolean;
	resources: ResourceData[];
}

export interface ResourceActionReply {
	return: boolean;
}

export type UserPermissionKey = keyof typeof UserPermissions;
