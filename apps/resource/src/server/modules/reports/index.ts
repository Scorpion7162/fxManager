import { CALLBACK_NAMES } from '@common/types';
import type { ReportDetail, ReportSummary } from '@fxmanager/shared/types';
import { PermissionManager } from '@fxmanager/shared/utils';
import { UserPermissions } from '@fxmanager/shared/constants';
import { ServerCallbacks } from '../../utils/callbacks';
import { getPermissions } from '../../utils/permissions';
import { QueryManager } from '../../utils/query';
import { notifyAll, notifyPlayer } from '../notifications';
import { isReportAction } from './validation';

const pending = new Set<number>();
const lastSubmission = new Map<number, number>();
const lastReply = new Map<number, number>();
const canViewAll = (source: number) =>
	PermissionManager.has(getPermissions(source), UserPermissions.VIEW_REPORT);
const canReplyAll = (source: number) =>
	canViewAll(source) &&
	PermissionManager.has(getPermissions(source), UserPermissions.SEND_REPORT);
const query = <T>(source: number, endpoint: string) =>
	QueryManager<T>({
		endpoint: `/reports/${endpoint}${endpoint.includes('?') ? '&' : '?'}by=${source}&license=${encodeURIComponent(GetPlayerIdentifierByType(String(source), 'license') ?? '')}&staff=${canViewAll(source)}${endpoint ? `&replyStaff=${canReplyAll(source)}` : ''}`,
		method: 'GET',
		signal: AbortSignal.timeout(8000),
	});
const fallback = {
	success: false,
	message: 'Report request refused or server unavailable.',
};

ServerCallbacks.register<null, ReportSummary[] | null>(
	CALLBACK_NAMES.LIST_REPORTS,
	(source) => query(source, ''),
	{ fallback: null },
);
ServerCallbacks.register<unknown, ReportDetail | null>(
	CALLBACK_NAMES.GET_REPORT,
	(source, data) => {
		if (
			!data ||
			typeof data !== 'object' ||
			!Number.isSafeInteger((data as { id?: unknown }).id) ||
			Number((data as { id: number }).id) < 1
		)
			return null;
		return query(source, String((data as { id: number }).id));
	},
	{ fallback: null },
);

async function reportAction(source: number, payload: unknown) {
	if (!GetPlayerName(String(source)) || !isReportAction(payload))
		return { success: false, message: 'Invalid report request.' };
	if (
		payload.action === 'status' &&
		!PermissionManager.has(getPermissions(source), UserPermissions.CLOSE_REPORT)
	)
		return {
			success: false,
			message: 'Your role cannot change report status.',
		};
	const license = GetPlayerIdentifierByType(String(source), 'license');
	const now = Date.now();
	if (
		payload.action === 'create' &&
		now - (lastSubmission.get(source) ?? 0) < 30000
	)
		return {
			success: false,
			message: 'Wait 30 seconds before submitting another report.',
		};
	if (payload.action === 'reply' && now - (lastReply.get(source) ?? 0) < 1000)
		return { success: false, message: 'Please wait before replying again.' };
	if (pending.has(source))
		return { success: false, message: 'A report request is already pending.' };
	pending.add(source);
	try {
		const endpoint =
			payload.action === 'create'
				? ''
				: `${payload.id}/${payload.action === 'reply' ? 'messages' : 'status'}`;
		const body =
			payload.action === 'create'
				? {
						by: source,
						subject: payload.subject.trim(),
						message: payload.message.trim(),
					}
				: payload.action === 'reply'
					? {
							by: source,
							staff: canReplyAll(source),
							message: payload.message.trim(),
						}
					: { by: source, status: payload.status };
		const result = await QueryManager<{
			id: number;
			reporterServerId?: number;
		}>({
			endpoint: `/reports/${endpoint}`,
			method: 'POST',
			body: { ...body, license },
			signal: AbortSignal.timeout(8000),
		});
		if (GetPlayerIdentifierByType(String(source), 'license') !== license)
			return fallback;
		if (payload.action === 'create') {
			lastSubmission.set(source, Date.now());
			notifyAll(
				{
					title: `New report #${result.id}`,
					description: payload.subject.trim(),
					variant: 'info',
				},
				{ permission: 'VIEW_REPORT' },
			);
		}
		if (payload.action === 'reply') lastReply.set(source, Date.now());
		if (
			payload.action !== 'create' &&
			result.reporterServerId &&
			result.reporterServerId !== source
		)
			notifyPlayer(result.reporterServerId, {
				title:
					payload.action === 'reply'
						? `New reply to report #${result.id}`
						: `Report #${result.id} updated`,
				description: 'Open Reports with F7 to see the latest update.',
				variant: 'info',
			});
		return {
			success: true,
			message:
				payload.action === 'create'
					? `Report #${result.id} submitted.`
					: payload.action === 'reply'
						? 'Reply sent.'
						: 'Report status updated.',
			id: result.id,
		};
	} catch (error) {
		return {
			success: false,
			message: error instanceof Error ? error.message : fallback.message,
		};
	} finally {
		pending.delete(source);
	}
}
ServerCallbacks.register(CALLBACK_NAMES.REPORT_ACTION, reportAction, {
	fallback,
});
RegisterCommand(
	'report',
	async (source: number, args: string[]) => {
		if (source < 1) return;
		const text = args.join(' ').trim();
		if (text.length < 3)
			return notifyPlayer(source, {
				title: 'Report an issue',
				description:
					'Use /report followed by a description, or open Reports with F7.',
				variant: 'info',
			});
		const result = await reportAction(source, {
			action: 'create',
			subject: text.slice(0, 120),
			message: text,
		});
		notifyPlayer(source, {
			title: result.message,
			variant: result.success ? 'success' : 'error',
		});
	},
	false,
);
on('playerDropped', () => {
	lastSubmission.delete(globalThis.source);
	lastReply.delete(globalThis.source);
});
