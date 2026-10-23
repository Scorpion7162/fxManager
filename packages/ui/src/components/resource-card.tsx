import {
	AlertCircle,
	FileQuestionMark,
	Package,
	Play,
	RefreshCcwIcon,
	Square,
	User,
} from 'lucide-react';

import { Badge } from '@fxmanager/ui/components/badge';
import { Button } from '@fxmanager/ui/components/button';
import { Skeleton } from '@fxmanager/ui/components/skeleton';
import { cn } from '@fxmanager/ui/lib/utils';

/** the resource shape the shared card renders; webpanel `ResourceData` satisfies it */
export interface ResourceCardResource {
	name: string;
	version: string | null;
	author: string | null;
	description: string | null;
	status: 'started' | 'stopped';
}

export type ResourceCardAction = 'start' | 'stop' | 'refresh';

export type ResourceCardActionHandler = (
	action: ResourceCardAction,
	resource?: string,
) => void;

export const RESOURCE_STATE_CONFIG = {
	stopped: {
		icon: Square,
		title: 'Server Stopped',
		description:
			'The server is currently offline. Start it to view and manage resources.',
		styles: 'bg-zinc-200 dark:bg-zinc-700/40 text-zinc-600 dark:text-zinc-400',
		titleStyle: 'text-zinc-900 dark:text-zinc-200',
	},
	crashed: {
		icon: AlertCircle,
		title: 'Server Crashed',
		description:
			'The server process terminated unexpectedly. Check logs for more details.',
		styles: 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-500',
		titleStyle: 'text-red-600 dark:text-red-500',
	},
	no_resources: {
		icon: FileQuestionMark,
		title: 'No Resources',
		description: 'No resources were found on the server.',
		styles: 'bg-zinc-200 dark:bg-zinc-700/40 text-zinc-600 dark:text-zinc-400',
		titleStyle: 'text-zinc-900 dark:text-zinc-200',
	},
} as const;

export type ResourceDisplayState = keyof typeof RESOURCE_STATE_CONFIG;

export function formatVersion(version: string) {
	if (version.startsWith('v')) return version;
	return `v${version}`;
}

export function ResourceCard({
	resource,
	handleAction,
}: {
	resource: ResourceCardResource;
	handleAction: ResourceCardActionHandler;
}) {
	const isStarted = resource.status === 'started';

	return (
		<div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 px-3 py-2.5 rounded-md hover:bg-zinc-100/80 dark:hover:bg-zinc-900 transition-colors group">
			<div className="flex items-center gap-3 min-w-0 flex-1">
				<div
					className={cn(
						'p-1.5 rounded-md shrink-0',
						isStarted
							? 'bg-green-500/10 text-green-600 dark:text-green-400'
							: 'bg-zinc-200/60 dark:bg-zinc-800 text-zinc-500',
					)}
				>
					<Package size={16} />
				</div>

				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2 flex-wrap">
						<h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
							{resource.name}
						</h3>
						{resource.version && (
							<span className="text-[10px] font-mono bg-zinc-200/70 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400">
								{formatVersion(resource.version)}
							</span>
						)}
						{resource.author && (
							<span className="text-xs text-zinc-400 dark:text-zinc-500 hidden lg:flex items-center gap-1">
								<User size={10} /> {resource.author}
							</span>
						)}
					</div>

					{resource.description && (
						<p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-xl">
							{resource.description}
						</p>
					)}
				</div>
			</div>

			<div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-200 dark:border-zinc-800">
				<Badge
					variant={isStarted ? 'success' : 'secondary'}
					className="h-6 px-2 text-[11px] font-medium capitalize flex items-center gap-1.5 shrink-0"
				>
					{isStarted ? (
						<Play size={10} className="fill-current" />
					) : (
						<Square size={10} className="fill-current" />
					)}
					{resource.status}
				</Badge>

				<div className="flex items-center gap-1 bg-zinc-200/50 dark:bg-zinc-800/50 p-0.5 rounded-md border border-zinc-200/80 dark:border-zinc-800">
					{isStarted ? (
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7 text-blue-600 dark:text-blue-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
							title="Restart Resource"
							onClick={() => handleAction('start', resource.name)}
						>
							<RefreshCcwIcon size={14} />
						</Button>
					) : (
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7 text-green-600 dark:text-green-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
							title="Start Resource"
							onClick={() => handleAction('start', resource.name)}
						>
							<Play size={14} />
						</Button>
					)}

					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7 text-red-600 dark:text-red-400 disabled:opacity-30 hover:bg-zinc-200 dark:hover:bg-zinc-700"
						disabled={!isStarted}
						title="Stop Resource"
						onClick={() => handleAction('stop', resource.name)}
					>
						<Square size={14} />
					</Button>
				</div>
			</div>
		</div>
	);
}

export function ResourceCardSkeleton() {
	const skeletonBg = 'bg-zinc-300 dark:bg-zinc-800/80';
	return (
		<div className="bg-zinc-300/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-800 p-4 mr-2 rounded-lg animate-pulse">
			<div className="flex items-start justify-between">
				<div className="space-y-2 w-full">
					<div className="flex items-center gap-2">
						<Skeleton className={`h-4 w-4 rounded ${skeletonBg}`} />
						<Skeleton className={`h-4 w-32 ${skeletonBg}`} />
						<Skeleton className={`h-4 w-12 rounded ${skeletonBg}`} />
					</div>

					<Skeleton className={`h-3 w-3/4 ${skeletonBg}`} />
					<Skeleton className={`h-3 w-2/3 ${skeletonBg}`} />

					<div className="flex gap-4 mt-2">
						<Skeleton className={`h-3 w-24 ${skeletonBg}`} />
						<Skeleton className={`h-3 w-40 ${skeletonBg}`} />
					</div>
				</div>

				<div className="flex flex-col items-center gap-4 p-2">
					<Skeleton className={`h-6 w-24 rounded ${skeletonBg}`} />

					<div className="flex gap-2">
						<Skeleton className={`h-8 w-8 rounded ${skeletonBg}`} />
						<Skeleton className={`h-8 w-8 rounded ${skeletonBg}`} />
					</div>
				</div>
			</div>
		</div>
	);
}

export function LoadingSkeleton({ blur }: { blur?: boolean }) {
	return (
		<div className={blur ? 'grid gap-4 blur-sm' : 'grid gap-4'}>
			{Array.from({ length: 6 }).map((_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: immutable array
				<ResourceCardSkeleton key={i} />
			))}
		</div>
	);
}

export function StateDisplay({ type }: { type: ResourceDisplayState }) {
	const config = RESOURCE_STATE_CONFIG[type];
	const Icon = config.icon;

	return (
		<div className="flex flex-row justify-center items-center text-center gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-8 py-10 rounded-xl shadow-sm dark:shadow-none">
			<div className={`p-4 rounded-full ${config.styles}`}>
				<Icon size={28} />
			</div>

			<div className="space-y-1 text-start">
				<h3 className={`text-lg font-semibold ${config.titleStyle}`}>
					{config.title}
				</h3>
				<p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
					{config.description}
				</p>
			</div>
		</div>
	);
}
