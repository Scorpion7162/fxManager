import { expect, mock, test } from 'bun:test';
import { UserPermissions } from '@fxmanager/shared/constants';
const handlers = new Map<
	string,
	(source: number, payload: unknown) => Promise<unknown>
>();
let permissions: number = 0;
let request: { endpoint: string; body?: Record<string, unknown> } | undefined;
mock.module('../../utils/callbacks', () => ({
	ServerCallbacks: {
		register: (
			name: string,
			handler: (source: number, payload: unknown) => Promise<unknown>,
		) => handlers.set(name, handler),
	},
}));
mock.module('../../utils/permissions', () => ({
	getPermissions: () => permissions,
}));
mock.module('../../utils/query', () => ({
	QueryManager: async (input: typeof request) => {
		request = input;
		return { id: 7 };
	},
}));
mock.module('../notifications', () => ({
	notifyAll: () => {},
	notifyPlayer: () => {},
}));
Object.assign(globalThis, {
	GetPlayerName: () => 'Player',
	GetPlayerIdentifierByType: () => 'license:test',
	RegisterCommand: () => {},
	on: () => {},
});
await import('./index');
test('public reports use the event sender and rate limit repeated submissions', async () => {
	const action = handlers.get('report-action')!;
	expect(
		await action(11, {
			action: 'create',
			subject: 'Need help',
			message: 'My vehicle is stuck.',
			by: 999,
			staff: true,
		}),
	).toMatchObject({ success: true, id: 7 });
	expect(request!.body!.by).toBe(11);
	expect(request!.body!.staff).toBeUndefined();
	expect(
		await action(11, {
			action: 'create',
			subject: 'Again',
			message: 'Still stuck.',
		}),
	).toMatchObject({ success: false });
});
test('view-only staff do not gain reply or close authority from a forged payload', async () => {
	permissions = UserPermissions.VIEW_REPORT;
	await handlers.get('report-action')!(12, {
		action: 'reply',
		id: 7,
		message: 'Forged staff reply',
		staff: true,
	});
	expect(request!.body!.staff).toBe(false);
	expect(
		await handlers.get('report-action')!(12, {
			action: 'status',
			id: 7,
			status: 'resolved',
		}),
	).toMatchObject({ success: false });
	permissions = UserPermissions.VIEW_REPORT | UserPermissions.SEND_REPORT;
	await handlers.get('report-action')!(13, {
		action: 'reply',
		id: 7,
		message: 'Allowed staff reply',
	});
	expect(request!.body!.staff).toBe(true);
});
test('list and thread access derive staff flags from server permissions', async () => {
	permissions = 0;
	await handlers.get('list-reports')!(14, { staff: true });
	expect(request!.endpoint).toContain('staff=false');
	permissions = UserPermissions.VIEW_REPORT;
	await handlers.get('get-report')!(14, { id: 7, replyStaff: true });
	expect(request!.endpoint).toContain('staff=true&replyStaff=false');
});
