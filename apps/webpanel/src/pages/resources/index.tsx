import { PageHeader } from '@/components/page-header';
import { useServerStateSocket } from '@/hooks/ws-channels';
import { useResourcelistSocket } from '@/hooks/ws-channels/use-resourcelist';
import { QueryService } from '@/lib/query';
import type { ResourceData } from '@fxmanager/shared/types';
import { Button } from '@fxmanager/ui/components/button';
import { Input } from '@fxmanager/ui/components/input';
import { ScrollArea } from '@fxmanager/ui/components/scroll-area';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@fxmanager/ui/components/select';
import {
	LoadingSkeleton,
	ResourceCard,
	StateDisplay,
} from '@fxmanager/ui/components/resource-card';
import { ResourceTree } from '@fxmanager/ui/components/resource-tree';
import { cn } from '@fxmanager/ui/lib/utils';
import {
	LayoutList,
	AlertCircle,
	RefreshCcwIcon,
	ChevronsUpDown,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@fxmanager/ui/components/tooltip';

export type FilterValue = 'all' | 'started' | 'stopped';

export function ResourceList() {
	const { state } = useServerStateSocket();
	const {
		resources,
		loading,
		status: resourceListStatus,
	} = useResourcelistSocket();
	const [displayedResources, setDisplayedResources] =
		useState<ResourceData[]>(resources);
	const [searchValue, setSearchValue] = useState<string>('');
	const [filterValue, setFilterValue] = useState<FilterValue>('all');
	const [refreshing, setRefresh] = useState<boolean>(false);
	const [globalExpand, setGlobalExpand] = useState<boolean | null>(null);

	useEffect(() => {
		const filtered = resources.filter((res) => {
			const matchesSearch =
				searchValue.trim() === '' ||
				res.name.toLowerCase().includes(searchValue.toLowerCase());

			const matchesStatus = filterValue === 'all' || res.status === filterValue;

			return matchesSearch && matchesStatus;
		});

		setDisplayedResources(filtered);
	}, [resources, searchValue, filterValue]);

	function handleSearch({ target }: React.ChangeEvent<HTMLInputElement>) {
		const { value } = target;
		setSearchValue(value);
	}

	async function handleAction(
		action: 'start' | 'stop' | 'refresh',
		resource?: string,
	) {
		if (state.status !== 'running') {
			toast.error('Server is not running');
			return;
		}

		if (action === 'refresh') {
			if (refreshing) {
				toast.warning('Refresh already ongoing');
				return;
			}

			setRefresh(true);
		}

		try {
			await QueryService({
				endpoint: `/resources/action/${action}`,
				method: 'POST',
				...(resource && { body: { resource } }),
			});
		} catch (err) {
			console.error(
				`Unable to execute action ${action}`,
				(err as Error).message,
			);

			toast.error(
				action === 'refresh'
					? 'Unable to refresh resource list'
					: `Unable to ${action} resource ${resource}`,
			);
		} finally {
			setRefresh(false);
		}
	}

	return (
		<div className="flex flex-col gap-4 text-zinc-900 dark:text-zinc-50 h-full p-4">
			<div className="flex justify-between items-end">
				<PageHeader
					Icon={LayoutList}
					title="Resource List"
					description="Server resources and controls."
				/>
				<div className="pb-2 text-sm font-medium">
					{resourceListStatus === 'errored' && (
						<span className="flex items-center text-red-600 dark:text-red-500 gap-1">
							<AlertCircle size={16} /> Resource list error
						</span>
					)}
				</div>
			</div>

			<div className="w-full border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900/50 p-4">
				<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
					<div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
						<Input
							type="text"
							onChange={handleSearch}
							disabled={state.status !== 'running'}
							placeholder="Search resources..."
							className="sm:w-64 bg-white dark:bg-zinc-950"
						/>

						<Select
							onValueChange={(v) => setFilterValue(v as FilterValue)}
							disabled={state.status !== 'running'}
						>
							<SelectTrigger className="w-full sm:w-[160px] bg-white dark:bg-zinc-950">
								<SelectValue placeholder="Filter status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All</SelectItem>
								<SelectItem value="started">Started</SelectItem>
								<SelectItem value="stopped">Stopped</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
						{state.status === 'running' && (
							<div className="flex items-center gap-6 text-sm mr-2">
								<div className="flex flex-col items-center">
									<span className="text-zinc-500 dark:text-zinc-400">
										Total
									</span>
									<span className="font-semibold text-zinc-900 dark:text-zinc-100">
										{resources.length}
									</span>
								</div>

								<div className="flex flex-col items-center">
									<span className="text-green-600 dark:text-green-400">
										Started
									</span>
									<span className="font-semibold text-zinc-900 dark:text-zinc-100">
										{resources.filter((res) => res.status === 'started').length}
									</span>
								</div>

								<div className="flex flex-col items-center">
									<span className="text-red-600 dark:text-red-400">
										Stopped
									</span>
									<span className="font-semibold text-zinc-900 dark:text-zinc-100">
										{resources.filter((res) => res.status === 'stopped').length}
									</span>
								</div>
							</div>
						)}

						<Tooltip>
							<TooltipTrigger>
								<Button
									variant="outline"
									size="sm"
									className="h-9 gap-1.5 bg-white dark:bg-zinc-950 text-xs font-medium"
									onClick={() => setGlobalExpand((prev) => !prev)}
									disabled={state.status !== 'running'}
									title="Expand / Collapse All"
								>
									<ChevronsUpDown className="h-4 w-4" />
									<span>Toggle All</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								Collapse / Expand all resource folders
							</TooltipContent>
						</Tooltip>

						<Button
							variant="ghost"
							size="icon"
							className="h-9 w-9 bg-zinc-200/60 hover:bg-zinc-300 dark:bg-zinc-800/60 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
							onClick={() => handleAction('refresh')}
							disabled={state.status !== 'running'}
							title="Refresh resources"
						>
							<RefreshCcwIcon
								className={cn('h-4 w-4', refreshing && 'animate-spin')}
							/>
						</Button>
					</div>
				</div>
			</div>

			<div
				className={cn(
					'flex-1 flex flex-col min-h-0 rounded-md border border-zinc-200 dark:border-zinc-800 p-4 pr-1',
					(loading || state.status !== 'running') && 'overflow-hidden',
				)}
			>
				{loading || state.status === 'starting' ? (
					<LoadingSkeleton />
				) : state.status === 'running' ? (
					<ScrollArea className="h-full pr-3">
						<ResourceTree
							resources={displayedResources}
							renderResource={(res) => (
								<ResourceCard resource={res} handleAction={handleAction} />
							)}
							globalExpand={globalExpand}
						/>
					</ScrollArea>
				) : (
					<div className="relative overflow-hidden h-full pr-3">
						<LoadingSkeleton blur />
						<div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
							<div className="pointer-events-auto">
								<StateDisplay
									type={state.status === 'crashed' ? 'crashed' : 'stopped'}
								/>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
