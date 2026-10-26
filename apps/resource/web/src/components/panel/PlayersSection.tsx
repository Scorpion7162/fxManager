import { useCallback, useEffect, useState } from 'react';
import { Button } from '@fxmanager/ui/components/button';
import { Input } from '@fxmanager/ui/components/input';
import { Search, RefreshCw, Users } from 'lucide-react';
import { UserPermissions } from '@fxmanager/shared/constants';
import { PermissionManager } from '@fxmanager/shared/utils';
import type {
	PanelPlayer,
	PlayerActionPayload,
	PlayerActionReply,
} from '@common/types';
import { fetchNui } from '~/utils/fetchNui';
import { MonitoringControls } from './MonitoringControls';
import { showNotification } from '~/store/notifications';

const PREVIEW_PLAYERS: PanelPlayer[] = [
	{ playerId: 1, serverId: 1, name: 'Scorpion', ping: 24 },
	{ playerId: 2, serverId: 12, name: 'Alex Morgan', ping: 48 },
	{ playerId: 3, serverId: 26, name: 'Taylor', ping: 112 },
];
const ACTIONS = [
	{ key: 'warn', label: 'Warn', permission: UserPermissions.WARN },
	{ key: 'kick', label: 'Kick', permission: UserPermissions.KICK },
	{ key: 'ban', label: 'Ban', permission: UserPermissions.BAN },
] as const;

export function PlayersSection({ permissions }: { permissions: number }) {
	const [query, setQuery] = useState('');
	const [players, setPlayers] = useState<PanelPlayer[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [selected, setSelected] = useState<PanelPlayer | null>(null);
	const [action, setAction] = useState<PlayerActionPayload['action']>(
		ACTIONS.find((item) => PermissionManager.has(permissions, item.permission))
			?.key ?? 'warn',
	);
	const [reason, setReason] = useState('');
	const [duration, setDuration] = useState(86400);
	const [pending, setPending] = useState(false);
	const load = useCallback(async () => {
		try {
			const data = await fetchNui<PanelPlayer[] | null>('get-players', null, {
				data: PREVIEW_PLAYERS,
				delay: 150,
			});
			if (!data)
				throw new Error(
					'Player list unavailable. Check your permissions and server connection.',
				);
			setPlayers(data);
			setError('');
		} catch (error) {
			setError(
				error instanceof Error ? error.message : 'Unable to load players.',
			);
		} finally {
			setLoading(false);
		}
	}, []);
	useEffect(() => {
		void load();
		const timer = setInterval(load, 5000);
		return () => clearInterval(timer);
	}, [load]);
	const liveSelected =
		players.find(
			(p) =>
				p.playerId === selected?.playerId && p.serverId === selected?.serverId,
		) ?? selected;
	const filtered = players.filter(
		(player) =>
			player.name
				.toLocaleLowerCase()
				.includes(query.trim().toLocaleLowerCase()) ||
			String(player.serverId) === query.trim(),
	);
	const connected =
		selected &&
		players.some(
			(player) =>
				player.serverId === selected.serverId &&
				player.playerId === selected.playerId,
		);
	async function submit() {
		if (!selected || pending || !connected || !reason.trim()) return;
		setPending(true);
		try {
			const reply = await fetchNui<PlayerActionReply>(
				'player-action',
				{
					playerId: selected.playerId,
					target: selected.serverId,
					action,
					reason: reason.trim(),
					...(action === 'ban' ? { durationSeconds: duration } : {}),
				},
				{
					data: {
						success: false,
						message:
							'Browser preview: moderation requires a connected FiveM server.',
					},
				},
			);
			if (!reply.success) throw new Error(reply.message);
			showNotification({ title: reply.message, variant: 'success' });
			setSelected(null);
			setReason('');
			void load();
		} catch (error) {
			showNotification({
				title: 'Action failed',
				description:
					error instanceof Error ? error.message : 'Server unavailable.',
				variant: 'error',
			});
		} finally {
			setPending(false);
		}
	}
	return (
		<section className="flex flex-col gap-5" aria-label="Player moderation">
			<header className="flex items-center justify-between gap-4">
				<div>
					<h2 className="text-xl font-semibold">
						Players{' '}
						<span className="ml-2 text-sm font-normal text-muted-foreground">
							{players.length} online
						</span>
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Find a player and review the target before taking action.
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => void load()}
					disabled={loading}
				>
					<RefreshCw className="mr-2 size-4" />
					Refresh
				</Button>
			</header>
			<MonitoringControls />
			<div className="flex flex-wrap gap-x-6 gap-y-2 border-y py-3 text-sm">
				<span>
					<strong className="mr-1 text-lg">{players.length}</strong> connected
				</span>
				<span className="text-muted-foreground">
					{players.filter((p) => p.inVehicle).length} in vehicles
				</span>
				<span className="text-muted-foreground">
					{players.filter((p) => p.ping >= 150).length} high latency
				</span>
				<span className="ml-auto text-xs text-muted-foreground">
					Live state Â· refreshes every 5s
				</span>
			</div>
			<div className="relative max-w-lg">
				<Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
				<Input
					aria-label="Search players by name or server ID"
					className="pl-9"
					placeholder="Search by name or exact server IDâ€¦"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
			</div>
			{error && (
				<div
					role="alert"
					className="rounded-md border border-destructive p-3 text-sm"
				>
					{error}{' '}
					<Button variant="ghost" size="sm" onClick={() => void load()}>
						Retry
					</Button>
				</div>
			)}
			<div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
				<div className="overflow-x-auto rounded-md border">
					<table className="w-full text-left text-sm">
						<thead className="bg-muted/40 text-muted-foreground">
							<tr>
								<th className="px-4 py-3 font-medium">Player</th>
								<th className="px-4 py-3 font-medium">Server ID</th>
								<th className="px-4 py-3 font-medium">State</th>
								<th className="px-4 py-3 font-medium">Vitals</th>
								<th className="px-4 py-3 font-medium">Ping</th>
								<th className="px-4 py-3">
									<span className="sr-only">Actions</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((player) => (
								<tr
									key={player.serverId}
									className={`border-t ${selected?.serverId === player.serverId ? 'bg-secondary' : 'hover:bg-muted/30'}`}
								>
									<td className="max-w-[240px] break-words px-4 py-3 font-medium">
										{player.name}
									</td>
									<td className="px-4 py-3 font-mono tabular-nums">
										#{player.serverId}
									</td>
									<td className="px-4 py-3 text-xs">
										{player.health === undefined
											? 'Spawning'
											: player.health <= 0
												? 'Dead'
												: player.inVehicle
													? 'In vehicle'
													: 'On foot'}
										<span className="mt-1 block text-muted-foreground">
											Bucket {player.bucket ?? 'â€”'}
										</span>
									</td>
									<td className="px-4 py-3 text-xs tabular-nums">
										{player.health === undefined
											? 'â€”'
											: `${player.health}/${(player.maxHealth ?? 200)} HP`}
										<span className="mt-1 block text-muted-foreground">
											{player.armour ?? 0} armour
										</span>
									</td>
									<td className="px-4 py-3 tabular-nums">{player.ping} ms</td>
									<td className="px-4 py-3 text-right">
										<Button
											variant="outline"
											size="sm"
											disabled={pending}
											onClick={() => {
												setSelected(player);
												setReason('');
											}}
										>
											Manage<span className="sr-only"> {player.name}</span>
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{loading ? (
						<div
							role="status"
							className="animate-pulse p-8 text-sm text-muted-foreground"
						>
							Loading connected playersâ€¦
						</div>
					) : (
						!filtered.length && (
							<div className="p-8 text-center text-sm text-muted-foreground">
								{query
									? 'No players match. Try a name or exact server ID.'
									: 'No players are connected.'}
							</div>
						)
					)}
				</div>
				<aside className="rounded-md border p-4" aria-label="Selected player">
					{!selected ? (
						<div className="flex flex-col gap-3 py-6 text-sm text-muted-foreground">
							<Users className="size-6" />
							<h3 className="font-semibold text-foreground">Select a player</h3>
							<p>
								Choose Manage to warn, kick, or ban. Only actions allowed by
								your role are available.
							</p>
						</div>
					) : (
						<form
							onSubmit={(event) => {
								event.preventDefault();
								void submit();
							}}
							className="flex flex-col gap-4"
						>
							<div>
								<h3 className="break-words text-lg font-semibold">
									{selected.name}
								</h3>
								<p className="text-sm text-muted-foreground">
									Server ID #{selected.serverId}
								</p>
							</div>
							{liveSelected && (
								<dl className="grid grid-cols-2 gap-3 border-y py-3 text-xs">
									<div>
										<dt className="text-muted-foreground">Health</dt>
										<dd className="mt-1 font-medium">
											{liveSelected.health === undefined
												? 'â€”'
												: liveSelected.health}{' '}
											/ {(liveSelected.maxHealth ?? 200)}
										</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">Armour</dt>
										<dd className="mt-1 font-medium">
											{liveSelected.armour ?? 0}
										</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">Connection</dt>
										<dd className="mt-1 font-medium">{liveSelected.ping} ms</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">Routing bucket</dt>
										<dd className="mt-1 font-medium">
											{liveSelected.bucket ?? 'â€”'}
										</dd>
									</div>
								</dl>
							)}
							{!connected && (
								<p role="alert" className="text-sm text-destructive">
									This player disconnected. Select a connected player.
								</p>
							)}
							<label className="flex flex-col gap-2 text-sm font-medium">
								Action
								<select
									className="h-10 rounded-md border bg-background px-3"
									value={action}
									disabled={pending}
									onChange={(event) =>
										setAction(
											event.target.value as PlayerActionPayload['action'],
										)
									}
								>
									<option value="" disabled>
										Choose action
									</option>
									{ACTIONS.filter((item) =>
										PermissionManager.has(permissions, item.permission),
									).map((item) => (
										<option value={item.key} key={item.key}>
											{item.label}
										</option>
									))}
								</select>
							</label>
							{action === 'ban' && (
								<label className="flex flex-col gap-2 text-sm font-medium">
									Ban duration
									<select
										className="h-10 rounded-md border bg-background px-3"
										value={duration}
										disabled={pending}
										onChange={(event) =>
											setDuration(Number(event.target.value))
										}
									>
										<option value={3600}>1 hour</option>
										<option value={86400}>1 day</option>
										<option value={604800}>7 days</option>
										<option value={2592000}>30 days</option>
										<option value={0}>Permanent</option>
									</select>
								</label>
							)}
							<label className="flex flex-col gap-2 text-sm font-medium">
								Reason
								<textarea
									required
									maxLength={500}
									rows={4}
									className="resize-y rounded-md border bg-background p-3 font-normal"
									placeholder="Explain the rule violationâ€¦"
									value={reason}
									disabled={pending}
									onChange={(event) => setReason(event.target.value)}
								/>
							</label>
							<p className="text-xs text-muted-foreground">
								{action === 'warn'
									? 'Records a warning in the player history.'
									: action === 'kick'
										? 'Disconnects this player immediately.'
										: `Disconnects this player and blocks rejoining ${duration === 0 ? 'permanently' : 'for the selected duration'}.`}{' '}
								Your action and reason are recorded.
							</p>
							<Button
								type="submit"
								variant={action === 'warn' ? 'default' : 'destructive'}
								disabled={
									pending ||
									!connected ||
									!reason.trim() ||
									!ACTIONS.some(
										(item) =>
											item.key === action &&
											PermissionManager.has(permissions, item.permission),
									)
								}
							>
								{pending ? 'Submittingâ€¦' : `Confirm ${action}`}
							</Button>
							<Button
								type="button"
								variant="ghost"
								disabled={pending}
								onClick={() => setSelected(null)}
							>
								Cancel
							</Button>
						</form>
					)}
				</aside>
			</div>
		</section>
	);
}
