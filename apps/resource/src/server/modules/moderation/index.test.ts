import { afterEach, expect, mock, test } from 'bun:test';
import { UserPermissions } from '@fxmanager/shared/constants';
const registrations = new Map<
	string,
	{
		handler: (source: number, payload: unknown) => Promise<unknown>;
		options: { permission: string };
	}
>();
let permissions = UserPermissions.MASTER;
let request: unknown;
let fail = false;
mock.module('../../utils/callbacks', () => ({
	ServerCallbacks: {
		register: (
			name: string,
			handler: (source: number, payload: unknown) => Promise<unknown>,
			options: { permission: string },
		) => registrations.set(name, { handler, options }),
	},
}));
mock.module('../../utils/permissions', () => ({
	getPermissions: () => permissions,
}));
mock.module('../../utils/query', () => ({
	QueryManager: async (input: unknown) => {
		request = input;
		if (fail) throw new Error('Core unavailable');
		return [];
	},
}));
Object.assign(globalThis, {
	on: () => {},
	GetPlayerName: () => 'Online player',
	GetCurrentResourceName: () => 'fxmanager',
});
await import('./index');
const action = () =>
	registrations.get('player-action')!.handler(1, {
		target: 12,
		playerId: 44,
		action: 'warn',
		reason: '  Rule violation  ',
		by: 99,
	});
afterEach(() => {
	permissions = UserPermissions.MASTER;
	request = undefined;
	fail = false;
});
test('both roster and actions require server-side monitoring permission', () => {
	expect(registrations.get('list-players')!.options.permission).toBe(
		'PLAYER_MONITORING',
	);
	expect(registrations.get('player-action')!.options.permission).toBe(
		'PLAYER_MONITORING',
	);
});
test('monitoring permission alone cannot perform moderation', async () => {
	permissions = UserPermissions.PLAYER_MONITORING;
	expect(await action()).toMatchObject({ success: false });
	expect(request).toBeUndefined();
});
test('uses stable player identity and the actual event sender as issuer', async () => {
	expect(await action()).toMatchObject({ success: true });
	expect(request).toMatchObject({
		endpoint: '/ingame/warn',
		method: 'POST',
		body: { target: { playerId: 44 }, reason: 'Rule violation', by: 1 },
	});
});
test('core failure is returned without claiming success', async () => {
	fail = true;
	expect(await action()).toEqual({
		success: false,
		message: 'Core unavailable',
	});
	fail = false;
	expect(await action()).toMatchObject({ success: true });
});
