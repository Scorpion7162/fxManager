/**
 * Client-side vehicle management: model/type resolution, spawn/fix/delete NUI
 * callbacks, repair natives and the s2c seat handler.
 *
 * The model/type resolution (class-to-type map + known mismatches), the
 * repair natives chain and the network-id based reseating flow are derived
 * from txAdmin's vehicle implementation:
 * https://github.com/citizenfx/txAdmin/blob/master/resource/menu/client/cl_vehicle.lua
 *
 * txAdmin is MIT licensed, Copyright (c) André Tabarra
 * https://github.com/tabarra
 */
import {
	Game,
	Model,
	Vehicle,
	VehicleClass,
} from '@nativewrappers/fivem';
import { CALLBACK_NAMES, EVENT_NAMES } from '@common/types';
import { sleep } from '@common/utils';
import { ClientCallbacks } from '../../utils/callbacks';
import { NuiCallback } from '../../utils/nui-callbacks';
import { VehicleSeat } from '@nativewrappers/fivem/common-game/enums/VehicleSeat.js';

interface SpawnVehiclePayload {
	model: string;
	modelType: string;
}

interface DeleteVehiclePayload {
	networkId: number;
}

interface VehicleActionResult {
	success: boolean;
	message?: string;
}

function resolveVehicleType(model: string): string | null {
	const vehicleModel = new Model(model);
	if (!vehicleModel.IsInCdImage || !vehicleModel.IsVehicle) return null;

	// known class/type mismatches take priority over the class map, mirroring txAdmin
	if (model === 'avisa') return 'submarine'; // reads class 14 (boat)
	if (model === 'blimp') return 'heli'; // reads class 15

	switch (Vehicle.getModelClass(vehicleModel)) {
		case VehicleClass.Motorcycles:
			return 'bike';
		case VehicleClass.Boats:
			return 'boat';
		case VehicleClass.Helicopters:
			return 'heli';
		case VehicleClass.Planes:
			return 'plane';
		case VehicleClass.Trains:
			return 'train';
		default:
			return 'automobile';
	}
}

/** returns the wrapper for the vehicle the local player currently sits in */
function getCurrentVehicle(): Vehicle | null {
	return Game.PlayerPed.CurrentVehicle;
}

NuiCallback<{ model: string }>('spawn-vehicle', async ({ model }, reply) => {
	const modelType = resolveVehicleType(model);
	if (!modelType) {
		return reply({
			success: false,
			message: `Unknown vehicle model '${model}'`,
		});
	}

	const { success, message } =
		await ClientCallbacks.trigger<VehicleActionResult>(
			CALLBACK_NAMES.SPAWN_VEHICLE,
			{ model, modelType } satisfies SpawnVehiclePayload,
			{ fallback: { success: false, message: 'Spawn timed out' } },
		);

	reply({ success, message });
});

ClientCallbacks.register<VehicleActionResult>(
	CALLBACK_NAMES.FIX_VEHICLE,
	() => {
		const vehicle = getCurrentVehicle();
		if (!vehicle) {
			return { success: false, message: 'Not in a vehicle' };
		}

		vehicle.IsDriveable = true;
		vehicle.repair();
		vehicle.wash();
		vehicle.IsEngineRunning = true;
		vehicle.placeOnGround();

		return { success: true, message: 'Vehicle repaired' };
	},
);

NuiCallback<null>('fix-vehicle', async (_data, reply) => {
	const { success, message } =
		await ClientCallbacks.trigger<VehicleActionResult>(
			CALLBACK_NAMES.FIX_VEHICLE,
			null,
			{ fallback: { success: false, message: 'Fix timed out' } },
		);

	reply({ success, message });
});

NuiCallback<null>('delete-vehicle', async (_data, reply) => {
	const vehicle = getCurrentVehicle();
	if (!vehicle) {
		return reply({ success: false, message: 'Not in a vehicle' });
	}

	const { success, message } =
		await ClientCallbacks.trigger<VehicleActionResult>(
			CALLBACK_NAMES.DELETE_VEHICLE,
			{
				networkId: vehicle.NetworkId,
			} satisfies DeleteVehiclePayload,
			{ fallback: { success: false, message: 'Delete timed out' } },
		);

	reply({ success, message });
});

/** seat the local player into the spawned vehicle */
onNet(EVENT_NAMES.S2C_VEHICLE_SEAT, async (data: unknown) => {
	const { networkId, seat } = data as { networkId: number; seat: number };
	if (typeof networkId !== 'number' || typeof seat !== 'number') return;

	const seatIndex = seat;
	if (seatIndex < VehicleSeat.Driver) return;

	// the entity needs a moment to replicate to this client
	const deadline = Date.now() + 2_000;
	let vehicle = Vehicle.fromNetworkId(networkId);

	while (!vehicle && Date.now() < deadline) {
		await sleep(5);
		vehicle = Vehicle.fromNetworkId(networkId);
	}

	if (!vehicle) return;

	Game.PlayerPed.setIntoVehicle(vehicle, seatIndex);

	if (seatIndex === VehicleSeat.Driver) {
		vehicle.IsEngineRunning = true;
		vehicle.placeOnGround();
	}
});
