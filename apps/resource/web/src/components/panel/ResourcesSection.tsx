import type {
	ResourceActionReply,
	ResourcesSnapshotReply,
} from '@common/types';
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
import { AlertCircle, ChevronsUpDown, RefreshCcwIcon } from 'lucide-react';
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@fxmanager/ui/components/tooltip';
import { useEffect, useState } from 'react';

import { fetchNui } from '~/utils/fetchNui';

type FilterValue = 'all' | 'started' | 'stopped';

/** browser-dev sample data passed as fetchNui mock */
const MOCK_RESOURCES: ResourceData[] = [
	{
		name: 'fxmanager',
		version: '1.0.0',
		author: 'fxManager',
		description: 'Server management framework.',
		repository: null,
		path: 'resources/[standalone]/fxmanager',
		status: 'started',
	},
	{
		name: 'es_extended',
		version: '1.11.2',
		author: 'ESX Community',
		description: 'Inventory based roleplay framework.',
		repository: 'github.com/esx-framework/esx_core',
		path: 'resources/[esx]/[core]/es_extended',
		status: 'started',
	},
	{
		name: 'ox_inventory',
		version: '2.10.1',
		author: 'Overextended',
		description: 'Slot-based inventory with metadata.',
		repository: 'github.com/overextended/ox_inventory',
		path: 'resources/[ox]/ox_inventory',
		status: 'stopped',
	},
];

export function ResourcesSection() {
	const [resources, setResources] = useState<ResourceData[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [errored, setErrored] = useState<boolean>(false);
	const [refreshing, setRefresh] = useState<boolean>(false);
	const [searchValue, setSearchValue] = useState<string>('');
	const [filterValue, setFilterValue] = useState<FilterValue>('all');
	const [globalExpand, setGlobalExpand] = useState<boolean | null>(null);

	function refresh() {
		return fetchNui<ResourcesSnapshotReply>('get-resources', undefined, {
			data: { return: true, resources: MOCK_RESOURCES },
			delay: 600,
		}).then(
			(reply) => {
				if (reply.return) {
					setResources(reply.resources);
					setErrored(false);
				} else {
					setErrored(true);
				}
			},
			() => {
				setErrored(true);
			},
		);
	}

	async function handleAction(
		action: 'start' | 'stop' | 'refresh',
		resource?: string,
	) {
		if (refreshing) {
			return;
		}

		setRefresh(true);

		try {
			if (action === 'refresh') {
				await refresh();
				return;
			}

			const reply = await fetchNui<ResourceActionReply>('resource-action', {
				resource,
				action,
			});

			if (!reply.return) {
				// refused (permission / excluded / unknown resource)
				return;
			}

			// resource state changes are async server-side; poll after a beat
			setTimeout(() => {
				refresh().finally(() => setRefresh(false));
			}, 500);
		} finally {
			setRefresh(false);
		}
	}

	// biome-ignore lint/correctness/useExhaustiveDependencies: mount-only fetch
	useEffect(() => {
		refresh().finally(() => setLoading(false));
	}, []);

	const displayedResources = resources.filter((res) => {
		const matchesSearch =
			searchValue.trim() === '' ||
			res.name.toLowerCase().includes(searchValue.toLowerCase());

		const matchesStatus = filterValue === 'all' || res.status === filterValue;

		return matchesSearch && matchesStatus;
	});

	const isLoading = loading || refreshing;
	const isEmpty = !isLoading && displayedResources.length === 0;

	return (
		<div className="flex flex-col gap-4 text-zinc-900 dark:text-zinc-50 h-full">
			<div className="w-full border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900/50 p-4">
				<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
					<div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
						<Input
							type="text"
							onChange={(e) => setSearchValue(e.target.value)}
							disabled={isLoading}
							placeholder="Search resources..."
							className="sm:w-64"
						/>

						<Select
							value={filterValue}
							onValueChange={(v) => setFilterValue(v as FilterValue)}
							disabled={isLoading}
						>
							<SelectTrigger className="w-full sm:w-[160px]">
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
						{!isLoading && (
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
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									className="h-9 gap-1.5 bg-zinc-950 text-xs font-medium dark:text-zinc-100"
									onClick={() => setGlobalExpand((prev) => !prev)}
									disabled={isLoading}
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

						{errored && (
							<span className="flex items-center text-red-600 dark:text-red-500 gap-1 text-sm">
								<AlertCircle size={16} /> Resource list error
							</span>
						)}

						<Button
							variant="ghost"
							size="icon"
							className="h-9 w-9 bg-zinc-200/60 hover:bg-zinc-300 dark:bg-zinc-800/60 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
							onClick={() => handleAction('refresh')}
							disabled={isLoading}
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
					isLoading && 'overflow-hidden',
				)}
			>
				{isLoading ? (
					<LoadingSkeleton />
				) : isEmpty ? (
					<div className="relative overflow-hidden h-full pr-3">
						<LoadingSkeleton blur />
						<div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
							<div className="pointer-events-auto">
								<StateDisplay type="no_resources" />
							</div>
						</div>
					</div>
				) : (
					<ScrollArea className="h-full pr-3">
						<ResourceTree
							resources={displayedResources}
							renderResource={(res) => (
								<ResourceCard resource={res} handleAction={handleAction} />
							)}
							globalExpand={globalExpand}
						/>
					</ScrollArea>
				)}
			</div>
		</div>
	);
}
