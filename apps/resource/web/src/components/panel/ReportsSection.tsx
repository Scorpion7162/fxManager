import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@fxmanager/ui/components/button';
import { Input } from '@fxmanager/ui/components/input';
import { UserPermissions } from '@fxmanager/shared/constants';
import { PermissionManager } from '@fxmanager/shared/utils';
import type {
	ReportDetail,
	ReportStatus,
	ReportSummary,
} from '@fxmanager/shared/types';
import {
	Flag,
	MessageSquare,
	Plus,
	RefreshCw,
	Search,
	Send,
	CheckCircle2,
} from 'lucide-react';
import { fetchNui } from '~/utils/fetchNui';

const STATUS: Record<ReportStatus, string> = {
	open: 'Open',
	inprogress: 'In progress',
	resolved: 'Resolved',
};
const stamp = (value: number) =>
	new Date(value).toLocaleString([], {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
export function ReportsSection({
	permissions,
	initialReportId,
}: {
	permissions: number;
	initialReportId?: number;
}) {
	const staff = PermissionManager.has(permissions, UserPermissions.VIEW_REPORT);
	const canClose = PermissionManager.has(
		permissions,
		UserPermissions.CLOSE_REPORT,
	);
	const [reports, setReports] = useState<ReportSummary[]>([]);
	const [selected, setSelected] = useState<number | null>(
		initialReportId ?? null,
	);
	useEffect(() => {
		if (initialReportId !== undefined) setSelected(initialReportId);
	}, [initialReportId]);
	const loadSequence = useRef(0);
	const selectedRef = useRef(selected);
	selectedRef.current = selected;
	const [detail, setDetail] = useState<ReportDetail | null>(null);
	const [creating, setCreating] = useState(false);
	const [subject, setSubject] = useState('');
	const [message, setMessage] = useState('');
	const [draft, setDraft] = useState('');
	const [search, setSearch] = useState('');
	const [filter, setFilter] = useState<'active' | 'all' | 'resolved'>('active');
	const [loading, setLoading] = useState(true);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');
	const load = useCallback(async () => {
		const sequence = ++loadSequence.current;
		try {
			const rows = await fetchNui<ReportSummary[] | null>('get-reports', null, {
				data: [],
				delay: 100,
			});
			if (sequence !== loadSequence.current) return;
			if (!rows)
				throw new Error(
					'Reports are unavailable. Check your server connection and retry.',
				);
			setReports(rows);
			setError('');
			const id = selectedRef.current;
			if (id !== null) {
				const report = await fetchNui<ReportDetail | null>(
					'get-report',
					{ id },
					{ data: null },
				);
				if (selectedRef.current === id && sequence === loadSequence.current) {
					setDetail(report);
					if (!report)
						setError('This report is no longer available to your role.');
				}
			}
		} catch (err) {
			if (sequence !== loadSequence.current) return;
			setError(err instanceof Error ? err.message : 'Unable to load reports.');
		} finally {
			if (sequence === loadSequence.current) setLoading(false);
		}
	}, []);
	useEffect(() => {
		void load();
		let stopped = false;
		let timer: ReturnType<typeof setTimeout>;
		const poll = async () => {
			await load();
			if (!stopped) timer = setTimeout(poll, 5000);
		};
		timer = setTimeout(poll, 5000);
		return () => {
			stopped = true;
			clearTimeout(timer);
			++loadSequence.current;
		};
	}, [load]);
	useEffect(() => {
		setDetail(null);
		void load();
	}, [selected, load]);
	async function act(payload: object, after?: (id: number) => void) {
		if (pending) return;
		setPending(true);
		setError('');
		setNotice('');
		try {
			const result = await fetchNui<{
				success: boolean;
				message: string;
				id?: number;
			}>('report-action', payload, {
				data: {
					success: false,
					message: 'Submitting reports requires a connected FiveM server.',
				},
			});
			if (!result.success) throw new Error(result.message);
			setNotice(result.message);
			if (result.id !== undefined) after?.(result.id);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Request failed.');
		} finally {
			setPending(false);
		}
	}
	const active = reports.filter((r) => r.status !== 'resolved').length;
	const filtered = reports.filter(
		(r) =>
			(filter === 'all' ||
				(filter === 'active'
					? r.status !== 'resolved'
					: r.status === 'resolved')) &&
			`${r.id} ${r.subject} ${r.reporterName}`
				.toLocaleLowerCase()
				.includes(search.trim().toLocaleLowerCase()),
	);
	return (
		<section className="flex flex-col gap-4" aria-label="Reports">
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className="text-xl font-semibold">
						{staff ? 'Report desk' : 'Your reports'}
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						{staff
							? 'Triage requests, talk to players, and close the loop.'
							: 'Ask staff for help and keep the conversation in one place.'}
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={loading || pending}
						onClick={() => void load()}
					>
						<RefreshCw className="mr-2 size-4" />
						Refresh
					</Button>
					<Button
						size="sm"
						disabled={pending}
						onClick={() => {
							setCreating(true);
							setSelected(null);
							setDraft('');
							setNotice('');
						}}
					>
						<Plus className="mr-2 size-4" />
						New report
					</Button>
				</div>
			</header>
			<div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y py-3 text-sm">
				<span>
					<strong className="mr-1 text-lg tabular-nums">{active}</strong>{' '}
					awaiting resolution
				</span>
				<span className="text-muted-foreground">
					{reports.filter((r) => r.status === 'inprogress').length} in progress
				</span>
				<span className="text-muted-foreground">
					{reports.filter((r) => r.status === 'resolved').length} resolved
				</span>
				<span className="ml-auto text-xs text-muted-foreground">
					Latest 100 reports · updates every 5s
				</span>
			</div>
			{error && (
				<div
					role="alert"
					className="rounded-md border border-destructive p-3 text-sm"
				>
					{error}{' '}
					<button
						type="button"
						className="ml-2 underline"
						onClick={() => void load()}
					>
						Retry
					</button>
				</div>
			)}
			{notice && (
				<p role="status" className="flex items-center gap-2 text-sm">
					<CheckCircle2 className="size-4 text-primary" />
					{notice}
				</p>
			)}
			<div className="grid min-h-[480px] gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
				<aside className="flex min-w-0 flex-col rounded-md border">
					<div className="border-b p-3">
						<div className="relative">
							<Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
							<Input
								className="pl-9"
								aria-label="Search reports"
								placeholder="Search subject, player or report #"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
						</div>
						<div className="mt-3 flex gap-1" aria-label="Filter reports">
							{(['active', 'all', 'resolved'] as const).map((value) => (
								<button
									key={value}
									type="button"
									aria-pressed={filter === value}
									className={`rounded px-3 py-1.5 text-xs ${filter === value ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-muted'}`}
									onClick={() => setFilter(value)}
								>
									{value === 'active'
										? 'Active'
										: value === 'all'
											? 'All'
											: 'Resolved'}
								</button>
							))}
						</div>
					</div>
					<div className="max-h-[440px] overflow-y-auto">
						{filtered.map((report) => (
							<button
								key={report.id}
								type="button"
								disabled={pending}
								aria-pressed={selected === report.id}
								className={`flex w-full flex-col gap-2 border-b p-4 text-left last:border-b-0 ${selected === report.id ? 'bg-secondary' : 'hover:bg-muted/40'}`}
								onClick={() => {
									setCreating(false);
									setSelected(report.id);
									setDraft('');
									setNotice('');
								}}
							>
								<div className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
									<span>
										#{report.id} · {report.reporterName}
									</span>
									<span
										className={report.status === 'open' ? 'text-primary' : ''}
									>
										{STATUS[report.status]}
									</span>
								</div>
								<span className="break-words text-sm font-medium">
									{report.subject}
								</span>
								<time className="text-xs text-muted-foreground">
									{stamp(report.lastAction)}
								</time>
							</button>
						))}
						{loading ? (
							<p
								role="status"
								className="animate-pulse p-5 text-sm text-muted-foreground"
							>
								Loading reports…
							</p>
						) : (
							!filtered.length && (
								<div className="p-5 text-sm text-muted-foreground">
									{search
										? 'No reports match this search.'
										: filter === 'resolved'
											? 'No resolved reports yet.'
											: 'The queue is clear. Players can send a report with /report or F7.'}
								</div>
							)
						)}
					</div>
				</aside>
				<div className="flex min-w-0 flex-col rounded-md border">
					{creating ? (
						<form
							className="flex max-w-2xl flex-col gap-4 p-5"
							onSubmit={(e) => {
								e.preventDefault();
								void act({ action: 'create', subject, message }, (id) => {
									setCreating(false);
									setSubject('');
									setMessage('');
									setSelected(id);
									selectedRef.current = id;
								});
							}}
						>
							<div>
								<h3 className="text-lg font-semibold">New report</h3>
								<p className="mt-1 text-sm text-muted-foreground">
									Include what happened, where, and any relevant player IDs.
								</p>
							</div>
							<label className="flex flex-col gap-2 text-sm font-medium">
								Subject
								<Input
									required
									minLength={3}
									maxLength={120}
									value={subject}
									disabled={pending}
									onChange={(e) => setSubject(e.target.value)}
									placeholder="Briefly describe the issue"
								/>
							</label>
							<label className="flex flex-col gap-2 text-sm font-medium">
								Description
								<textarea
									required
									minLength={3}
									maxLength={2000}
									rows={7}
									className="rounded-md border bg-background p-3 font-normal"
									value={message}
									disabled={pending}
									onChange={(e) => setMessage(e.target.value)}
									placeholder="Give staff enough detail to investigate…"
								/>
							</label>
							<div className="flex gap-2">
								<Button
									type="submit"
									disabled={
										pending ||
										subject.trim().length < 3 ||
										message.trim().length < 3
									}
								>
									{pending ? 'Submitting…' : 'Submit report'}
								</Button>
								<Button
									type="button"
									variant="ghost"
									disabled={pending}
									onClick={() => setCreating(false)}
								>
									Cancel
								</Button>
							</div>
							<p className="text-xs text-muted-foreground">
								Visible to you and staff. Please allow 30 seconds between new
								reports.
							</p>
						</form>
					) : detail ? (
						<>
							<header className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
								<div className="min-w-0">
									<p className="text-xs text-muted-foreground">
										Report #{detail.id} · {detail.reporterName}
									</p>
									<h3 className="mt-1 break-words text-lg font-semibold">
										{detail.subject}
									</h3>
									<p className="mt-1 text-xs text-muted-foreground">
										Opened {stamp(detail.openedAt)} · {STATUS[detail.status]}
									</p>
								</div>
								{canClose && (
									<div className="flex gap-2">
										{detail.status === 'open' && (
											<Button
												variant="outline"
												size="sm"
												disabled={pending}
												onClick={() =>
													void act({
														action: 'status',
														id: detail.id,
														status: 'inprogress',
													})
												}
											>
												Start review
											</Button>
										)}
										<Button
											variant="outline"
											size="sm"
											disabled={pending}
											onClick={() =>
												void act({
													action: 'status',
													id: detail.id,
													status:
														detail.status === 'resolved' ? 'open' : 'resolved',
												})
											}
										>
											{detail.status === 'resolved' ? 'Reopen' : 'Resolve'}
										</Button>
									</div>
								)}
							</header>
							<div
								className="flex max-h-[340px] flex-1 flex-col gap-4 overflow-y-auto p-4"
								aria-label="Report conversation"
							>
								{detail.messages.map((item) => (
									<article
										key={item.id}
										className="border-b pb-4 last:border-0"
									>
										<div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
											<strong>{item.author}</strong>
											{item.staff && (
												<span className="rounded bg-secondary px-1.5 py-0.5">
													Staff
												</span>
											)}
											<time className="ml-auto text-muted-foreground">
												{stamp(item.timestamp)}
											</time>
										</div>
										<p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
											{item.message}
										</p>
									</article>
								))}
							</div>
							{detail.status === 'resolved' || detail.canReply === false ? (
								<p className="border-t p-4 text-sm text-muted-foreground">
									{detail.status === 'resolved'
										? 'This report is resolved.'
										: 'Your role has read-only access to this conversation.'}{' '}
									{detail.status === 'resolved' &&
										(canClose
											? 'Reopen it to continue the conversation.'
											: 'Create a new report if you still need help.')}
								</p>
							) : (
								<form
									className="mt-auto flex flex-col gap-2 border-t p-4"
									onSubmit={(e) => {
										e.preventDefault();
										void act(
											{ action: 'reply', id: detail.id, message: draft },
											() => setDraft(''),
										);
									}}
								>
									<label htmlFor="report-reply" className="text-sm font-medium">
										Reply to this report
									</label>
									<textarea
										id="report-reply"
										rows={3}
										required
										maxLength={2000}
										className="rounded-md border bg-background p-3 text-sm"
										placeholder="Write a reply…"
										value={draft}
										disabled={pending}
										onChange={(e) => setDraft(e.target.value)}
									/>
									<Button
										type="submit"
										className="self-end"
										disabled={pending || !draft.trim()}
									>
										<Send className="mr-2 size-4" />
										{pending ? 'Sending…' : 'Send reply'}
									</Button>
								</form>
							)}
						</>
					) : selected !== null ? (
						<p role="status" className="p-5 text-sm text-muted-foreground">
							Loading conversation…
						</p>
					) : (
						<div className="flex max-w-lg flex-1 flex-col justify-center gap-4 p-8">
							<Flag className="size-7 text-primary" />
							<h3 className="text-lg font-semibold">
								{staff ? 'Keep the queue moving' : 'Need a hand?'}
							</h3>
							<p className="text-sm leading-relaxed text-muted-foreground">
								{staff
									? 'Select a report to read its conversation. Mark it in progress while investigating, reply to the player, and resolve it when the issue is handled.'
									: 'Create a report to ask staff for help. Your reports and replies stay here, even after reconnecting.'}
							</p>
							<div className="flex items-start gap-3 border-t pt-4 text-sm text-muted-foreground">
								<MessageSquare className="mt-0.5 size-4 shrink-0" />
								<span>
									In a hurry? Use{' '}
									<kbd className="font-mono text-foreground">
										/report your message
									</kbd>{' '}
									in game.
								</span>
							</div>
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
