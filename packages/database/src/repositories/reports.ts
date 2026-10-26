import { desc, eq } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type * as schema from '../schema';
import { players, reports, reportMessages } from '../schema';
import type {
	ReportDetail,
	ReportStatus,
	ReportSummary,
} from '@fxmanager/shared/types';

export function createReportsRepository(db: BunSQLiteDatabase<typeof schema>) {
	const selection = {
		id: reports.id,
		reporterId: reports.reporterId,
		reporterName: players.name,
		subject: reports.subject,
		status: reports.status,
		openedAt: reports.openedAt,
		lastAction: reports.lastAction,
	};
	const serialize = (row: {
		id: number;
		reporterId: number;
		reporterName: string;
		subject: string;
		status: string;
		openedAt: Date;
		lastAction: Date;
	}): ReportSummary => ({
		...row,
		status: row.status as ReportStatus,
		openedAt: row.openedAt.getTime(),
		lastAction: row.lastAction.getTime(),
	});
	function list(ownerId?: number): ReportSummary[] {
		return db
			.select(selection)
			.from(reports)
			.innerJoin(players, eq(players.id, reports.reporterId))
			.where(
				ownerId === undefined ? undefined : eq(reports.reporterId, ownerId),
			)
			.orderBy(desc(reports.lastAction), desc(reports.id))
			.limit(100)
			.all()
			.map(serialize);
	}
	function find(id: number): ReportDetail | null {
		const row = db
			.select(selection)
			.from(reports)
			.innerJoin(players, eq(players.id, reports.reporterId))
			.where(eq(reports.id, id))
			.get();
		if (!row) return null;
		const messages = db
			.select({
				id: reportMessages.id,
				author: players.name,
				adminId: reportMessages.adminId,
				message: reportMessages.message,
				timestamp: reportMessages.timestamp,
			})
			.from(reportMessages)
			.leftJoin(players, eq(players.id, reportMessages.playerId))
			.where(eq(reportMessages.reportId, id))
			.orderBy(desc(reportMessages.id))
			.limit(200)
			.all()
			.reverse();
		return {
			...serialize(row),
			messages: messages.map(({ adminId, timestamp, ...message }) => ({
				...message,
				author: message.author ?? 'Deleted player',
				staff: adminId !== null,
				timestamp: timestamp.getTime(),
			})),
		};
	}
	function create(
		reporterId: number,
		subject: string,
		message: string,
	): number {
		return db.transaction((tx) => {
			const now = new Date();
			const report = tx
				.insert(reports)
				.values({
					reporterId,
					subject,
					status: 'open',
					openedAt: now,
					lastAction: now,
				})
				.returning({ id: reports.id })
				.get();
			tx.insert(reportMessages)
				.values({
					reportId: report.id,
					playerId: reporterId,
					message,
					timestamp: now,
				})
				.run();
			return report.id;
		});
	}
	function reply(
		id: number,
		playerId: number,
		adminId: number | null,
		message: string,
	) {
		return db.transaction((tx) => {
			const row = tx.select().from(reports).where(eq(reports.id, id)).get();
			if (!row || row.status === 'resolved') return false;
			const now = new Date();
			tx.insert(reportMessages)
				.values({ reportId: id, playerId, adminId, message, timestamp: now })
				.run();
			tx.update(reports)
				.set({ lastAction: now })
				.where(eq(reports.id, id))
				.run();
			return true;
		});
	}
	function setStatus(id: number, status: ReportStatus) {
		return db
			.update(reports)
			.set({ status, lastAction: new Date() })
			.where(eq(reports.id, id))
			.returning({ id: reports.id, reporterId: reports.reporterId })
			.get();
	}
	return { list, find, create, reply, setStatus };
}
