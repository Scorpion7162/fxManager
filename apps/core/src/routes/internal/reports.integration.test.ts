import { afterAll, expect, mock, test } from 'bun:test';
import Fastify from 'fastify';
import { Database } from 'bun:sqlite';
import { createRequire } from 'node:module';
const { drizzle } = createRequire(
	new URL('../../../../../packages/database/package.json', import.meta.url),
)('drizzle-orm/bun-sqlite');
import * as schema from '@fxmanager/database/schema';
import {
	migrations,
	runMigrations,
} from '../../../../../packages/database/src/migrations';
import { createReportsRepository } from '../../../../../packages/database/src/repositories/reports';
const sqlite = new Database(':memory:');
runMigrations(sqlite, migrations);
const db = drizzle(sqlite, { schema });
const alice = db
	.insert(schema.players)
	.values({ name: 'Alice' })
	.returning()
	.get().id;
const bob = db
	.insert(schema.players)
	.values({ name: 'Bob' })
	.returning()
	.get().id;
const reports = createReportsRepository(db);
mock.module('@fxmanager/database', () => ({
	repo: { reports, admins: { findByPlayerId: () => null } },
}));
mock.module('../../modules/config/manager', () => ({
	ConfigManager: {
		getInstance: () => ({
			getSystemValues: () => ({ resourceApiToken: 'test-token' }),
		}),
	},
}));
const { default: routes } = await import('./reports');
const app = Fastify();
await app.register(routes.handler, {
	prefix: '/reports',
	gm: {
		getPlayerList: () => [
			{ id: alice, serverId: 11, identifiers: { license: 'license:test' } },
			{ id: bob, serverId: 22, identifiers: { license: 'license:test' } },
		],
	},
	pm: {},
} as never);
await app.ready();
afterAll(async () => {
	await app.close();
	sqlite.close();
});
const call = (
	method: 'GET' | 'POST',
	url: string,
	payload?: object,
	token = true,
) =>
	app.inject({
		method,
		url: `/reports${url}${method === 'GET' ? '&license=license:test' : ''}`,
		headers: token ? { 'x-resource-token': 'test-token' } : {},
		payload: payload ? { license: 'license:test', ...payload } : undefined,
	});
test('requires the resource token', async () => {
	expect(
		(await call('GET', '/?by=11&staff=false', undefined, false)).statusCode,
	).toBe(401);
});
test('creates, reads, replies, resolves and reopens a persistent report', async () => {
	const created = await call('POST', '/', {
		by: 11,
		subject: 'Stuck vehicle',
		message: 'Car fell through the road.',
	});
	expect(created.statusCode).toBe(200);
	const { id } = created.json();
	expect(
		(await call('GET', `/${id}?by=11&staff=false`)).json().messages.length,
	).toBe(1);
	expect(
		(
			await call('POST', `/${id}/messages`, {
				by: 22,
				staff: true,
				message: 'On my way.',
			})
		).statusCode,
	).toBe(200);
	expect(
		(await call('POST', `/${id}/status`, { by: 22, status: 'resolved' }))
			.statusCode,
	).toBe(200);
	expect(
		(
			await call('POST', `/${id}/messages`, {
				by: 11,
				staff: false,
				message: 'More details.',
			})
		).statusCode,
	).toBe(409);
	expect(
		(await call('POST', `/${id}/status`, { by: 22, status: 'open' }))
			.statusCode,
	).toBe(200);
	expect(reports.find(id)!.messages[1]!.message).toBe('On my way.');
});
test('ordinary players cannot list, read or reply to someone else’s report', async () => {
	const id = reports.create(alice, 'Private request', 'Private details.');
	expect(
		(await call('GET', '/?by=22&staff=false')).json<unknown[]>(),
	).toHaveLength(0);
	expect((await call('GET', `/${id}?by=22&staff=false`)).statusCode).toBe(403);
	expect(
		(
			await call('POST', `/${id}/messages`, {
				by: 22,
				staff: false,
				message: 'Forged reply.',
			})
		).statusCode,
	).toBe(403);
	expect((await call('GET', `/${id}?by=22&staff=true`)).statusCode).toBe(200);
	expect(
		(await call('GET', `/${id}?by=22&staff=true&replyStaff=false`)).json<{
			canReply: boolean;
		}>().canReply,
	).toBe(false);
	expect(
		(await call('GET', `/${id}?by=11&staff=false`)).json<{
			canReply: boolean;
		}>().canReply,
	).toBe(true);
});
test('validates missing actors and malformed report input', async () => {
	expect(
		(
			await call('POST', '/', {
				by: 999,
				subject: 'Need help',
				message: 'Valid details.',
			})
		).statusCode,
	).toBe(404);
	expect(
		(await call('POST', '/', { by: 11, subject: '   ', message: '   ' }))
			.statusCode,
	).toBe(400);
	expect(
		(await call('POST', '/1/status', { by: 11, status: 'deleted' })).statusCode,
	).toBe(400);
});

test('rejects a reused source with a different license', async () => {
	expect(
		(
			await call('POST', '/', {
				by: 11,
				license: 'license:replacement',
				subject: 'Valid subject',
				message: 'Valid message',
			})
		).statusCode,
	).toBe(404);
});
