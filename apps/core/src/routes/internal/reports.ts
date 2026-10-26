import { Type } from '@sinclair/typebox';
import { repo } from '@fxmanager/database';
import { resourceAuth } from '../../middleware/resource';
import type { RouteModule } from '../../types';
import type { ReportStatus } from '@fxmanager/shared/types';

const actorSchema = {
	by: Type.Integer({ minimum: 1 }),
	license: Type.String({ minLength: 1, maxLength: 100 }),
	staff: Type.Boolean(),
};
const statusSchema = Type.Union([
	Type.Literal('open'),
	Type.Literal('inprogress'),
	Type.Literal('resolved'),
]);
const handler: RouteModule['handler'] = async (fastify, { gm }) => {
	fastify.addHook('preHandler', resourceAuth);
	const actor = (source: number, license: string) =>
		gm
			.getPlayerList()
			.find(
				(player) =>
					player.serverId === source && player.identifiers.license === license,
			);
	fastify.get(
		'/',
		{
			schema: {
				querystring: Type.Object({
					by: Type.Integer({ minimum: 1 }),
					license: Type.String({ minLength: 1, maxLength: 100 }),
					staff: Type.Boolean(),
				}),
			},
		},
		(request, reply) => {
			const query = request.query as {
				by: number;
				license: string;
				staff: boolean;
				replyStaff?: boolean;
			};
			const player = actor(query.by, query.license);
			if (!player)
				return reply.code(404).send({ message: 'Player is not connected.' });
			return repo.reports.list(query.staff ? undefined : player.id);
		},
	);
	fastify.get(
		'/:id',
		{
			schema: {
				params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
				querystring: Type.Object({
					...actorSchema,
					replyStaff: Type.Optional(Type.Boolean()),
				}),
			},
		},
		(request, reply) => {
			const query = request.query as {
				by: number;
				license: string;
				staff: boolean;
				replyStaff?: boolean;
			};
			const player = actor(query.by, query.license);
			const report = repo.reports.find((request.params as { id: number }).id);
			if (!player || !report)
				return reply.code(404).send({ message: 'Report not found.' });
			if (!query.staff && report.reporterId !== player.id)
				return reply.code(403).send({ message: 'Access denied.' });
			return {
				...report,
				canReply: report.reporterId === player.id || query.replyStaff === true,
			};
		},
	);
	fastify.post(
		'/',
		{
			schema: {
				body: Type.Object({
					by: Type.Integer({ minimum: 1 }),
					license: Type.String({ minLength: 1, maxLength: 100 }),
					subject: Type.String({ minLength: 3, maxLength: 120 }),
					message: Type.String({ minLength: 3, maxLength: 2000 }),
				}),
			},
		},
		(request, reply) => {
			const body = request.body as {
				by: number;
				license: string;
				subject: string;
				message: string;
			};
			const player = actor(body.by, body.license);
			if (!player)
				return reply.code(404).send({ message: 'Player is not connected.' });
			if (body.subject.trim().length < 3 || body.message.trim().length < 3)
				return reply
					.code(400)
					.send({ message: 'Add a subject and description.' });
			return {
				id: repo.reports.create(
					player.id,
					body.subject.trim(),
					body.message.trim(),
				),
			};
		},
	);
	fastify.post(
		'/:id/messages',
		{
			schema: {
				params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
				body: Type.Object({
					...actorSchema,
					message: Type.String({ minLength: 1, maxLength: 2000 }),
				}),
			},
		},
		(request, reply) => {
			const body = request.body as {
				by: number;
				license: string;
				staff: boolean;
				message: string;
			};
			const player = actor(body.by, body.license);
			const report = repo.reports.find((request.params as { id: number }).id);
			if (!player || !report)
				return reply.code(404).send({ message: 'Report not found.' });
			if (!body.staff && report.reporterId !== player.id)
				return reply.code(403).send({ message: 'Access denied.' });
			if (!body.message.trim())
				return reply.code(400).send({ message: 'Write a reply.' });
			const admin = body.staff ? repo.admins.findByPlayerId(player.id) : null;
			if (
				!repo.reports.reply(
					report.id,
					player.id,
					admin?.id ?? null,
					body.message.trim(),
				)
			)
				return reply.code(409).send({
					message: 'This report is resolved. Reopen it before replying.',
				});
			return {
				id: report.id,
				reporterServerId: gm
					.getPlayerList()
					.find((p) => p.id === report.reporterId)?.serverId,
			};
		},
	);
	fastify.post(
		'/:id/status',
		{
			schema: {
				params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
				body: Type.Object({
					by: Type.Integer({ minimum: 1 }),
					license: Type.String({ minLength: 1, maxLength: 100 }),
					status: statusSchema,
				}),
			},
		},
		(request, reply) => {
			const body = request.body as {
				by: number;
				license: string;
				status: ReportStatus;
			};
			if (!actor(body.by, body.license))
				return reply.code(404).send({ message: 'Player is not connected.' });
			const report = repo.reports.setStatus(
				(request.params as { id: number }).id,
				body.status,
			);
			if (!report)
				return reply.code(404).send({ message: 'Report not found.' });
			return {
				id: report.id,
				reporterServerId: gm
					.getPlayerList()
					.find((p) => p.id === report.reporterId)?.serverId,
			};
		},
	);
};
export default { prefix: '/reports', handler } satisfies RouteModule;
