/**
 * Server-side vehicle management: spawn (via CreateVehicleServerSetter + routing
 * bucket fix), fix authorization and validated deletion.
 *
 * The spawn/replace/fix/delete flow is derived from txAdmin's vehicle
 * implementation:
 * https://github.com/citizenfx/txAdmin/blob/master/resource/menu/server/sv_vehicle.lua
 *
 * txAdmin is MIT licensed, Copyright (c) André Tabarra
 * https://github.com/tabarra
 */
import { CALLBACK_NAMES, EVENT_NAMES } from '@common/types';
import { sleep } from '@common/utils';
import { playerManager } from '../../monitoring';
import { ServerCallbacks } from '../../utils/callbacks';

interface SpawnVehiclePayload {
	model: string;
	modelType: string;
}

interface VehicleActionResult {
	success: boolean;
	message?: string;
}

interface DeleteVehiclePayload {
	networkId: number;
}

/** vehicle-script entity types accepted by CreateVehicleServerSetter */
const VALID_MODEL_TYPES = new Set([
	'automobile',
	'bike',
	'boat',
	'heli',
	'plane',
	'submarine',
	'trailer',
	'train',
	'quadbike',
	'amphibious_automobile',
	'amphibious_quadbike',
	'blimp',
]);

const MODEL_PATTERN = /^[a-zA-Z0-9_]+$/;
const SPAWN_WAIT_MS = 2_000;
const SPAWN_WAIT_STEP_MS = 5;

interface OccupantSeat {
	seat: number;
	/** server ped handle of the occupant, resolved to a player source below */
	pedHandle: number;
}

/** Record every occupant (seat -> ped handle) of a vehicle. */
function collectOccupants(vehicle: number): OccupantSeat[] {
	const occupants: OccupantSeat[] = [];

	// seats -1 (driver) .. 8 cover every scripted vehicle;
	// each occupant is forwarded its own seat later, order here does not matter
	for (let seat = -1; seat <= 8; seat++) {
		const pedHandle = GetPedInVehicleSeat(vehicle, seat);
		if (pedHandle > 0) occupants.push({ seat, pedHandle });
	}

	return occupants;
}

/** Map a wrapper ped handle to the source id of the player it belongs to. */
function findPlayerByPed(pedHandle: number): number | undefined {
	for (const source of playerManager.getPlayers()) {
		if (GetPlayerPed(String(source)) === pedHandle) return source;
	}
	return undefined;
}

function emitSeat(targetSource: number, networkId: number, seat: number): void {
	emitNet(EVENT_NAMES.S2C_VEHICLE_SEAT, targetSource, { networkId, seat });
}

ServerCallbacks.register<SpawnVehiclePayload, VehicleActionResult>(
	CALLBACK_NAMES.SPAWN_VEHICLE,
	async (source, payload) => {
		const src = String(source);
		const { model, modelType } = payload ?? ({} as SpawnVehiclePayload);

		if (
			typeof model !== 'string' ||
			!MODEL_PATTERN.test(model) ||
			typeof modelType !== 'string' ||
			!VALID_MODEL_TYPES.has(modelType)
		) {
			return { success: false, message: 'Invalid vehicle model' };
		}

		const ped = GetPlayerPed(src);
		if (ped === 0) {
			return { success: false, message: 'Player ped not found' };
		}

		const coords = GetEntityCoords(ped) as [number, number, number];
		const heading = GetEntityHeading(ped);
		const bucket = GetPlayerRoutingBucket(src);

		// Replace-in-place: capture occupants + velocity of the current vehicle,
		const oldVehicle = GetVehiclePedIsIn(ped, false);
		let oldVelocity: { x: number; y: number; z: number } | undefined;
		let occupants: OccupantSeat[] = [];

		if (oldVehicle && oldVehicle > 0) {
			const [vx, vy, vz] = GetEntityVelocity(oldVehicle) as [
				number,
				number,
				number,
			];
			oldVelocity = { x: vx, y: vy, z: vz };
			// record occupants before the entity is deleted, they cannot be inspected after
			occupants = collectOccupants(oldVehicle);
			DeleteEntity(oldVehicle);
		}

		const newVehicle = CreateVehicleServerSetter(
			model,
			modelType,
			coords[0],
			coords[1],
			coords[2],
			heading,
		);

		// server-created model data can stream in late; give it a grace window
		const deadline = Date.now() + SPAWN_WAIT_MS;
		while (!DoesEntityExist(newVehicle) && Date.now() < deadline) {
			await sleep(SPAWN_WAIT_STEP_MS);
		}

		if (!DoesEntityExist(newVehicle)) {
			return { success: false, message: `Failed to spawn vehicle '${model}'` };
		}

		// created in the server's default bucket; move it into the requester's
		SetEntityRoutingBucket(newVehicle, bucket);

		// carry the old vehicle's momentum over so the swap feels seamless
		if (oldVelocity) {
			SetEntityVelocity(
				newVehicle,
				oldVelocity.x,
				oldVelocity.y,
				oldVelocity.z,
			);
		}

		const networkId = NetworkGetNetworkIdFromEntity(newVehicle);

		// each occupant's own client does the actual seating
		for (const { seat, pedHandle } of occupants) {
			const playerSource = findPlayerByPed(pedHandle);
			if (!playerSource) continue;

			emitSeat(playerSource, networkId, seat);
		}

		// requester is not an occupant of the old vehicle: seat them as driver
		if (!occupants.some(({ pedHandle }) => pedHandle === ped)) {
			emitNet(EVENT_NAMES.S2C_VEHICLE_SEAT, source, { networkId, seat: -1 });
		}

		return { success: true, message: `Vehicle spawned: ${model}` };
	},
	{
		permission: 'VEHICLE_MANAGEMENT',
		fallback: { success: false, message: 'Missing permission' },
	},
);

ServerCallbacks.register<null, VehicleActionResult>(
	CALLBACK_NAMES.FIX_VEHICLE,
	async (source) => {
		const result = await ServerCallbacks.trigger<VehicleActionResult>(
			source,
			CALLBACK_NAMES.FIX_VEHICLE,
			null,
		);

		return result ?? { success: false, message: 'Vehicle fix failed' };
	},
	{
		permission: 'VEHICLE_MANAGEMENT',
		fallback: { success: false, message: 'Missing permission' },
	},
);

ServerCallbacks.register<DeleteVehiclePayload, VehicleActionResult>(
	CALLBACK_NAMES.DELETE_VEHICLE,
	(source, payload) => {
		const { networkId } = payload ?? ({} as DeleteVehiclePayload);

		if (typeof networkId !== 'number' || !Number.isInteger(networkId)) {
			return { success: false, message: 'Invalid vehicle reference' };
		}

		// wrapper validates that the network id actually resolves to an entity
		const vehicle = NetworkGetEntityFromNetworkId(networkId);
		if (!vehicle || vehicle === 0 || !DoesEntityExist(vehicle)) {
			return { success: false, message: 'Vehicle not found' };
		}

		// requester must be driving it: net ids are guessable
		if (GetPedInVehicleSeat(vehicle, -1) !== GetPlayerPed(String(source))) {
			return { success: false, message: 'Not the driver of that vehicle' };
		}

		DeleteEntity(vehicle);

		return { success: true, message: 'Vehicle deleted' };
	},
	{
		permission: 'VEHICLE_MANAGEMENT',
		fallback: { success: false, message: 'Missing permission' },
	},
);
