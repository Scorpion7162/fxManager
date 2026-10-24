import type { HTMLAttributes } from 'react';

import { cn } from '@fxmanager/ui/lib/utils';

function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			data-slot="skeleton"
			className={cn('animate-pulse rounded-md bg-muted', className)}
			{...props}
		/>
	);
}

export { Skeleton };
