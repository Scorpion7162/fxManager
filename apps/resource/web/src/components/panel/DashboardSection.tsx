import { Badge } from '@fxmanager/ui/components/badge';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@fxmanager/ui/components/card';
import {
	Area,
	AreaChart,
	CartesianGrid,
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	type TooltipContentProps,
	XAxis,
	YAxis,
} from '@fxmanager/ui/components/chart';
import { Button } from '@fxmanager/ui/components/button';
import { ScrollArea } from '@fxmanager/ui/components/scroll-area';
import { cn } from '@fxmanager/ui/lib/utils';
import {
	AlertCircleIcon,
	ArrowDownAZIcon,
	ArrowDown01Icon,
	ClockIcon,
	Flag,
	Shield,
	User,
	UserX,
	Activity,
	ChevronRightIcon,
	MessageCircle,
	Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@fxmanager/ui/components/skeleton';

import {
	MOCK_CAPACITY,
	MOCK_CHART,
	MOCK_PAYLOAD,
	NUI_DASHBOARD_SUBSCRIBE,
	NUI_DASHBOARD_UPDATE_EVENT,
	type NuiDashboardPayload,
	type NuiDashboardReport,
} from './dashboard-data';
import { useNuiEvent } from '~/hooks/useNuiEvent';
import { fetchNui } from '~/utils/fetchNui';

/** Reports recap: quick metrics + latest active tickets, above the chart */
const REPORTS_MAX_ROWS = 5;

function ReportsRecap({
	reports,
	className = '',
}: {
	reports: NuiDashboardReport[];
	className?: string;
}) {
	const activeReports = reports.slice(0, REPORTS_MAX_ROWS);
	const unreadTotal = reports.reduce((sum, r) => sum + r.unread, 0);

	return (
		<Card size="sm" className={cn('bg-card/50 py-4', className)}>
			<CardHeader className="flex flex-col gap-1 px-3 py-0">
				<div className="flex w-full items-center justify-between gap-2">
					<CardTitle className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
						<Flag className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
						Reports
						<Badge
							variant="outline"
							className="px-1.5 text-[10px] leading-none tabular-nums"
						>
							{reports.length}
						</Badge>
						{unreadTotal > 0 && (
							<Badge
								variant="secondary"
								className="gap-1 px-1.5 text-[10px] leading-none tabular-nums"
							>
								<MessageCircle className="h-2.5 w-2.5" />
								{unreadTotal}
							</Badge>
						)}
					</CardTitle>

					<Button
						variant="ghost"
						size="icon-xs"
						className="text-muted-foreground/60 hover:text-foreground"
						title="View all reports"
					>
						<ChevronRightIcon />
					</Button>
				</div>

				<CardDescription className="text-[11px] text-muted-foreground/60">
					Latest active tickets.
				</CardDescription>
			</CardHeader>

			<CardContent className="flex min-h-0 flex-1 flex-col px-2 pb-2">
				{activeReports.length === 0 ? (
					<div className="flex flex-1 items-center justify-center">
						<p className="text-sm text-muted-foreground">No active reports.</p>
					</div>
				) : (
					<ul className="flex min-h-0 flex-1 flex-col divide-y divide-border/50">
						{activeReports.map((report) => (
							<li key={report.id} className="flex flex-1 items-center">
								<button
									type="button"
									className="flex w-full justify-between gap-3 py-1.5 text-left"
									title={`Open report #${report.id} (live data pending)`}
								>
									<span className="flex min-w-0 items-center gap-2 text-sm leading-none">
										<Flag
											className={cn(
												'h-3 w-3 shrink-0',
												report.unread > 0
													? 'text-amber-400'
													: 'text-muted-foreground/40',
											)}
										/>
										<span className="shrink-0 font-mono text-xs text-muted-foreground/60">
											#{report.id}
										</span>
										<span className="truncate font-medium text-card-foreground">
											{report.subject}
										</span>
									</span>

									<span className="flex shrink-0 items-center gap-3 text-xs tabular-nums">
										{report.unread > 0 && (
											<span className="flex items-center gap-1 text-amber-400">
												<MessageCircle className="h-3 w-3" />
												{report.unread}
											</span>
										)}
										<span className="text-muted-foreground/60">
											{report.age}
										</span>
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

// helpers

const chartConfig = {
	players: {
		color: 'orange',
	},
} satisfies ChartConfig;

function pingColor(ping?: number): string {
	if (ping === undefined) return 'text-zinc-500';
	if (ping < 80) return 'text-emerald-400';
	if (ping < 150) return 'text-yellow-400';
	return 'text-red-500';
}

function formatDuration(ms: number, showSeconds: boolean = true): string {
	const totalSeconds = Math.floor(ms / 1000);
	const h = Math.floor(totalSeconds / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = totalSeconds % 60;

	if (!showSeconds) {
		if (h > 0) return `${h}h ${m}m`;
		return `${m}m`;
	}

	if (h > 0) return `${h}h ${m}m`;
	if (m > 0) return `${m}m ${s}s`;
	return `${s}s`;
}

function PlayerTooltip({ active, payload, label }: TooltipContentProps) {
	const playerPayload = payload?.find((p) => p.dataKey === 'players');
	const isVisible = active && playerPayload?.value !== undefined;

	if (!isVisible) return null;

	return (
		<div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-sm">
			<span className="text-muted-foreground">{label}</span>
			<span className="mx-1.5 text-border">|</span>
			<span className="font-bold">{playerPayload.value} players</span>
		</div>
	);
}

// endregion

type PlayerSortMode = 'id' | 'name';

function DashboardSkeleton() {
	return (
		<div className="flex h-full flex-col gap-2">
			{/* stat strip */}
			<div className="grid h-fit grid-cols-3 gap-2">					<Card size="sm" className="bg-card/50 py-3">
						<CardHeader className="flex flex-row items-center justify-start gap-2 px-3 py-0">
							<User className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
							<CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
								Players
							</CardTitle>
						</CardHeader>
						<CardContent className="px-3 py-0">
							<Skeleton className="mt-1 h-7 w-16 rounded-md bg-border/50" />
						</CardContent>
					</Card>
				<Card size="sm" className="bg-card/50 py-3">
					<CardHeader className="flex flex-row items-center justify-start gap-2 px-3 py-0">
						<ClockIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
						<CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">								Uptime
							</CardTitle>
						</CardHeader>
						<CardContent className="px-3 py-0">
							<Skeleton className="mt-1 h-7 w-12 rounded-md bg-border/50" />
						</CardContent>
				</Card>
				<Card size="sm" className="bg-card/50 py-3">
					<CardHeader className="flex flex-row items-center justify-start gap-2 px-3 py-0">
						<Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
						<CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">								Admins Online
							</CardTitle>
						</CardHeader>
						<CardContent className="px-3 py-0">
							<Skeleton className="mt-1 h-7 w-12 rounded-md bg-border/50" />
						</CardContent>
				</Card>
			</div>

			{/* players + chart/reports */}
			<div className="grid min-h-0 flex-1 grid-cols-3 gap-2">
				<Card size="sm" className="bg-card/50 flex min-h-0 flex-col py-4">
					<CardHeader className="flex-col gap-1 px-3 py-0">
						<div className="flex w-full items-center justify-between gap-2">
							<CardTitle className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
								<Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
								Players Online
								<Skeleton className="h-4 w-7 rounded-sm bg-border/50" />
							</CardTitle>
							<Skeleton className="h-8 w-25 rounded-md bg-border/50" />
						</div>
						<CardDescription className="text-[11px] text-muted-foreground/60">
							Connected players on the server.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex min-h-0 flex-1 flex-col px-2 pb-0">
						<Skeleton className="min-h-0 flex-1 rounded-md bg-border/50" />
					</CardContent>
				</Card>

				{/* right column */}
				<div className="flex col-span-2 min-h-0 flex-col gap-2">
					<Card size="sm" className="bg-card/50 flex min-h-0 flex-1 flex-col py-4">
						<CardHeader className="flex flex-row items-center justify-start gap-2 px-3 py-0">
							<Activity className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
							<CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
								Player Activity
							</CardTitle>
						</CardHeader>
						<CardDescription className="px-3 py-0 text-[11px] text-muted-foreground/60">
							Players over the last hour.
						</CardDescription>
						<CardContent className="flex min-h-0 flex-1 flex-col px-1 pb-0">
							<Skeleton className="min-h-0 flex-1 rounded-md bg-border/50" />
						</CardContent>
					</Card>

					<Card size="sm" className="bg-card/50 flex min-h-0 flex-1 flex-col py-4">
						<CardHeader className="flex flex-col gap-1 px-3 py-0">
							<div className="flex w-full items-center justify-between gap-2">
								<CardTitle className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
									<Flag className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
									Reports
									<Skeleton className="h-4 w-4 rounded-sm bg-border/50" />
								</CardTitle>
								<Skeleton className="size-6 rounded-md bg-border/50" />
							</div>
							<CardDescription className="text-[11px] text-muted-foreground/60">
								Latest active tickets.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-2">
							<Skeleton className="h-4 w-full rounded bg-border/50" />
							<Skeleton className="h-4 w-11/12 rounded bg-border/50" />
							<Skeleton className="h-4 w-10/12 rounded bg-border/50" />
							<Skeleton className="h-4 w-9/12 rounded bg-border/50" />
							<Skeleton className="h-4 w-11/12 rounded bg-border/50" />
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

export function DashboardSection() {
	// server ID ascending initially; the toggle switches to name sorting
	const [sortMode, setSortMode] = useState<PlayerSortMode>('id');
	const [dashboard, setDashboard] = useState<NuiDashboardPayload | null>(null);
	const [errored, setErrored] = useState(false);
	const [attempt, setAttempt] = useState(0);

	// pushes once subscription is active via client.lua
	useNuiEvent<NuiDashboardPayload>(NUI_DASHBOARD_UPDATE_EVENT, setDashboard);

	// biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is a retry trigger
	// bumped by the button below, not a read dependency
	useEffect(() => {
		setErrored(false);
		let cancelled = false;

		fetchNui<NuiDashboardPayload>(NUI_DASHBOARD_SUBSCRIBE, undefined, {
			data: MOCK_PAYLOAD,
			delay: 300,
		})
			.then((payload) => {
				if (!cancelled) setDashboard(payload);
			})
			.catch(() => {
				if (!cancelled) setErrored(true);
			});

		return () => {
			// drop a late resolution if the component unmounted meanwhile
			cancelled = true;
		};
	}, [attempt]);

	const hasData = dashboard !== null;

	const players = useMemo(() => {
		if (dashboard === null) return [];
		if (sortMode === 'name') {
			return [...dashboard.players].sort(
				(a, b) => a.name.localeCompare(b.name) || a.serverId - b.serverId,
			);
		}
		return [...dashboard.players].sort((a, b) => a.serverId - b.serverId);
	}, [sortMode, dashboard]);

	// never passes undefined stats down to the cards
	const stats = useMemo(() => {
		return (
			dashboard?.stats ?? {
				players: 0,
				capacity: MOCK_CAPACITY,
				admins: 0,
			}
		);
	}, [dashboard]);

	if (!hasData) {
		return errored ? (
			<div className="flex h-full flex-col items-center justify-center gap-2 text-center">
				<AlertCircleIcon className="h-5 w-5 text-muted-foreground/40" />
				<p className="text-sm text-muted-foreground">
					Unable to load dashboard data.
				</p>
				<Button
					variant="outline"
					size="sm"
					className="bg-zinc-950 dark:text-zinc-100"
					onClick={() => setAttempt((n) => n + 1)}
				>
					Retry
				</Button>
			</div>
		) : (
			<DashboardSkeleton />
		);
	}

	return (
		<div className="flex h-full flex-col gap-3 text-muted-foreground">
			{/* stat strip */}
			<div className="grid grid-cols-3 gap-2">
				<Card size="sm" className="bg-card/50 py-3">
					<CardHeader className="flex flex-row items-center justify-start gap-2 px-3 py-0">
						<User className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
						<CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
							Players
						</CardTitle>
					</CardHeader>
					<CardContent className="px-3 py-0">
						<div className="text-xl font-bold tracking-tight leading-none text-card-foreground">
							<span className="tabular-nums"> {stats.players}</span>
							<span className="text-sm font-medium text-muted-foreground/70">
								{' '}
								/{stats.capacity}
							</span>
						</div>
					</CardContent>
				</Card>

				<Card size="sm" className="bg-card/50 py-3">
					<CardHeader className="flex flex-row items-center justify-start gap-2 px-3 py-0">
						<ClockIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
						<CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
							Uptime
						</CardTitle>
					</CardHeader>
					<CardContent className="px-3 py-0">
						{/* uptime has no in-game data feed yet */}
						<div className="text-xl font-bold tracking-tight leading-none text-card-foreground">
							—
						</div>
					</CardContent>
				</Card>

				<Card size="sm" className="bg-card/50 py-3">
					<CardHeader className="flex flex-row items-center justify-start gap-2 px-3 py-0">
						<Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
						<CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
							Admins Online
						</CardTitle>
					</CardHeader>
					<CardContent className="px-3 py-0">
						<div className="flex items-baseline gap-2">
							<span className="text-xl font-bold tracking-tight leading-none text-card-foreground tabular-nums">
								{' '}
								{stats.admins}
							</span>
							<span className="text-sm font-medium text-muted-foreground/70">
								active
							</span>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* body: player list first, compact chart aside */}
			<div className="grid min-h-0 flex-1 grid-cols-3 gap-2">
				<Card size="sm" className="bg-card/50 flex min-h-0 flex-col py-4">
					<CardHeader className="flex-col gap-1 px-3 py-0">
						<div className="flex w-full items-center justify-between gap-2">
							<CardTitle className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
								<Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
								Players Online
								<Badge
									variant="outline"
									className="px-1.5 text-[10px] leading-none tabular-nums"
								>
									{players.length}
								</Badge>
							</CardTitle>

							<Button
								variant="outline"
								className="w-25"
								onClick={() =>
									setSortMode((mode) => (mode === 'id' ? 'name' : 'id'))
								}
							>
								{sortMode === 'id' ? <ArrowDown01Icon /> : <ArrowDownAZIcon />}
								{/*<span>Sort by {sortMode === 'id' ? 'name' : 'server ID'}</span>*/}
							</Button>
						</div>

						<CardDescription className="text-[11px] text-muted-foreground/60">
							Connected players on the server.
						</CardDescription>
					</CardHeader>

					<CardContent className="flex min-h-0 flex-1 flex-col px-2 pb-0">
						{players.length === 0 ? (
							<div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
								<UserX className="h-5 w-5 text-muted-foreground/40" />
								<p className="text-sm text-muted-foreground">
									No players currently online.
								</p>
							</div>
						) : (
							<ScrollArea type="always" className="min-h-0 flex-1">
								<ul className="px-1 divide-y divide-border/50">
									{players.map((player) => (
										<li
											key={player.serverId}
											className="flex items-center justify-between gap-3 py-2.5 first:pt-1 last:pb-1"
										>
											<span className="flex min-w-0 items-center gap-2 text-sm leading-none">
												<span className="w-10 shrink-0 text-right font-mono text-xs text-muted-foreground/60 tabular-nums">
													{player.serverId}
												</span>
												<span className="truncate font-medium text-card-foreground">
													{player.name}
												</span>
											</span>

											<span className="flex shrink-0 items-center gap-4 text-xs tabular-nums">
												<span className="text-muted-foreground/70">
													{formatDuration(player.duration, false)}
												</span>
												<span
													className={`w-12 text-right ${pingColor(player.ping)}`}
												>
													{player.ping !== undefined ? `${player.ping}ms` : '—'}
												</span>
											</span>
										</li>
									))}
								</ul>
							</ScrollArea>
						)}
					</CardContent>
				</Card>

				{/* right column: reports recap above the player activity chart */}
				<div className="flex col-span-2 min-h-0 flex-col gap-2">
					<Card
						size="sm"
						className="bg-card/50 flex min-h-0 flex-1 flex-col py-4"
					>
						<CardHeader className="flex flex-row items-center justify-start gap-2 px-3 py-0">
							<Activity className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
							<CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
								Player Activity
							</CardTitle>
						</CardHeader>
						<CardDescription className="px-3 py-0 text-[11px] text-muted-foreground/60">
							Players over the last hour.
						</CardDescription>

						<CardContent className="min-h-0 px-1 pb-0">
							{' '}
							{MOCK_CHART.length === 0 ? (
								<div className="flex items-center justify-center text-sm text-muted-foreground">
									Collecting player samples…
								</div>
							) : (
								<ChartContainer config={chartConfig} className="h-full w-full">
									<AreaChart
										accessibilityLayer
										data={MOCK_CHART}
										margin={{
											top: 10,
											right: 8,
											left: -16,
											bottom: 0,
										}}
									>
										<CartesianGrid
											vertical={false}
											className="stroke-muted/30"
										/>
										<XAxis
											dataKey="time"
											tickLine={false}
											axisLine={false}
											tickMargin={8}
											interval="preserveStartEnd"
											minTickGap={40}
										/>
										<YAxis
											dataKey="players"
											tickLine={false}
											axisLine={false}
											allowDecimals={false}
										/>
										<ChartTooltip cursor={false} content={PlayerTooltip} />
										<defs>
											<linearGradient
												id="fillPlayers"
												x1="0"
												y1="0"
												x2="0"
												y2="1"
											>
												<stop
													offset="5%"
													stopColor="var(--color-players)"
													stopOpacity={0.4}
												/>
												<stop
													offset="95%"
													stopColor="var(--color-players)"
													stopOpacity={0.0}
												/>
											</linearGradient>
										</defs>
										<Area
											dataKey="players"
											type="monotone"
											fill="url(#fillPlayers)"
											stroke="var(--color-players)"
											strokeWidth={2}
											stackId="a"
										/>
									</AreaChart>
								</ChartContainer>
							)}
						</CardContent>
					</Card>

					<ReportsRecap reports={dashboard.reports} className="flex-1" />
				</div>
			</div>
		</div>
	);
}
