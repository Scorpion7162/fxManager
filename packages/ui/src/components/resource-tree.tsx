import { FolderIcon, Minus, Plus } from 'lucide-react';
import { Fragment, type ReactNode, useEffect, useMemo, useState } from 'react';

import { cn } from '@fxmanager/ui/lib/utils';

/** matches `[group]` tags in a resource path, e.g. `resources/[mappings]/[esx]` */
export const RESOURCE_GROUP_PATTERN = /\[([^\]]+)\]/g;

/** a resolved node of the resource tree: named folder with leaf resources and nested subfolders */
export interface ResourceTreeGroup<T> {
	name: string;
	/** full folder chain incl. this one, e.g. `'mappings/esx'` — unique, safe as key */
	id: string;
	resources: T[];
	groups: ResourceTreeGroup<T>[];
}

/**
 * Groups resources into a folder tree based on the `[group]` tags found in
 * `res.path` (e.g. `resources/[core]/[esx]/main`). Resources without any tag
 * land in the root group. Subfolders are created in order of first encounter,
 * leaf resources are sorted alphabetically within their folder.
 */
export function buildResourceTree<T extends { name: string; path: string }>(
	resources: T[],
): ResourceTreeGroup<T> {
	const root: ResourceTreeGroup<T> = {
		name: 'root',
		id: 'root',
		resources: [],
		groups: [],
	};

	/** walks (and lazily creates) the folder chain for `[a]/[b]/…` tags */
	const locate = (names: string[]) => {
		let parent = root;
		let id = '';

		for (const name of names) {
			id = id ? `${id}/${name}` : name;

			let child = parent.groups.find((g) => g.name === name);
			if (!child) {
				child = { name, id, resources: [], groups: [] };
				parent.groups.push(child);
			}

			parent = child;
		}

		return parent;
	};

	const groups: string[] = [];

	for (const res of resources) {
		groups.length = 0;

		for (const match of res.path.matchAll(RESOURCE_GROUP_PATTERN)) {
			if (typeof match[1] === 'string') {
				groups.push(match[1]);
			}
		}

		if (groups.length > 0) {
			locate(groups).resources.push(res);
		} else {
			root.resources.push(res);
		}
	}

	const sort = (group: ResourceTreeGroup<T>) => {
		group.resources.sort((a, b) => a.name.localeCompare(b.name));
		group.groups.forEach(sort);
	};
	sort(root);

	return root;
}

interface ResourceGroupNodeProps<T extends { name: string; path: string }> {
	group: ResourceTreeGroup<T>;
	renderResource: (resource: T) => ReactNode;
	/** `true` → expand all groups, `false` → collapse all, `null` → ignore */
	globalExpand: boolean | null;
	emptyGroupText?: string;
}

function ResourceGroupNode<T extends { name: string; path: string }>({
	group,
	renderResource,
	globalExpand,
	emptyGroupText,
}: ResourceGroupNodeProps<T>) {
	const [collapsed, setCollapsed] = useState(false);

	// synchronize with global expand/collapse toggle changes
	useEffect(() => {
		if (globalExpand !== null) {
			setCollapsed(!globalExpand);
		}
	}, [globalExpand]);

	const { resources, groups } = group;
	// direct leaf count, like the panel list (subfolders count themselves)
	const totalResources = resources.length;

	return (
		<div className="my-1">
			<button
				type="button"
				aria-expanded={!collapsed}
				onClick={() => setCollapsed(!collapsed)}
				className="w-full h-8 px-2 my-1 flex items-center justify-between text-left hover:bg-zinc-100 dark:hover:bg-zinc-800/60 rounded-md transition-colors group"
			>
				<div className="flex items-center gap-2">
					<FolderIcon className="size-4" />
					<span className="font-semibold text-xs tracking-wider uppercase text-zinc-600 dark:text-zinc-400">
						{group.name}
					</span>
					<span className="text-[10px] font-mono bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded-full">
						{totalResources}
					</span>
				</div>
				{collapsed ? (
					<Plus className="h-3.5 w-3.5 text-zinc-400" />
				) : (
					<Minus className="h-3.5 w-3.5 text-zinc-400" />
				)}
			</button>

			{!collapsed && (
				<div className="pl-3 ml-2.5 border-l border-zinc-200 dark:border-zinc-800 space-y-1.5 py-1 overflow-hidden">
					{resources.length > 0 && (
						<div className="flex flex-col gap-1.5">
							{resources.map((res) => (
								<Fragment key={res.name}>{renderResource(res)}</Fragment>
							))}
						</div>
					)}

					{groups.map((sub) => (
						<ResourceGroupNode
							key={sub.id}
							group={sub}
							renderResource={renderResource}
							globalExpand={globalExpand}
							emptyGroupText={emptyGroupText}
						/>
					))}
				</div>
			)}
		</div>
	);
}

export interface ResourceTreeProps<T> {
	resources: T[];
	/** renders a single leaf row; grouping, folders & counts are handled by the tree */
	renderResource: (resource: T) => ReactNode;
	/** `true` → expand all groups, `false` → collapse all, `null` → ignore */
	globalExpand?: boolean | null;
	/** text shown for folders without direct resources */
	emptyGroupText?: string;
	className?: string;
}

/**
 * Shared resource "tree": groups resources by the `[group]` tags found in
 * their `path` and renders the collapsible folder hierarchy used by both the
 * webpanel resource list and the in-game resource section. Leaf rows are
 * rendered by the caller via `renderResource`.
 */
export function ResourceTree<T extends { name: string; path: string }>({
	resources,
	renderResource,
	globalExpand = null,
	emptyGroupText,
	className,
}: ResourceTreeProps<T>) {
	const tree = useMemo(() => buildResourceTree(resources), [resources]);

	if (tree.resources.length === 0 && tree.groups.length === 0) {
		return null;
	}

	return (
		<div className={cn('grid gap-2', className)}>
			{tree.resources.length > 0 && (
				<ResourceGroupNode
					group={tree}
					renderResource={renderResource}
					globalExpand={globalExpand}
					emptyGroupText={emptyGroupText}
				/>
			)}
			{tree.groups.map((sub) => (
				<ResourceGroupNode
					key={sub.id}
					group={sub}
					renderResource={renderResource}
					globalExpand={globalExpand}
					emptyGroupText={emptyGroupText}
				/>
			))}
		</div>
	);
}
