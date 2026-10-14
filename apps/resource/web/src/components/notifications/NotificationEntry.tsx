import { CheckCircle2, Info, TriangleAlert, XCircle } from 'lucide-react';
import type { NotificationVariant } from '@common/types';
import type { NotificationEntry as NotificationEntryData } from '~/store/notifications';

interface NotificationEntryProps {
	entry: NotificationEntryData;
}

const VARIANTS: Record<
	NotificationVariant,
	{ Icon: typeof Info; textClass: string; barClass: string }
> = {
	info: { Icon: Info, textClass: 'text-foreground', barClass: 'bg-card/75' },
	success: {
		Icon: CheckCircle2,
		textClass: 'text-foreground',
		barClass: 'bg-emerald-600',
	},
	warning: {
		Icon: TriangleAlert,
		textClass: 'text-foreground',
		barClass: 'bg-primary',
	},
	error: {
		Icon: XCircle,
		textClass: 'text-foreground',
		barClass: 'bg-destructive',
	},
};

/** slide/fade animation tokens */
const ENTER_CLASS = 'animate-in fade-in slide-in-from-top-2 duration-200';
const EXIT_CLASS = 'animate-out fade-out slide-out-to-top-2 duration-200';

export function NotificationEntry({ entry }: NotificationEntryProps) {
	const { Icon, barClass, textClass } = VARIANTS[entry.variant];

	return (
		<div
			role="status"
			className={`pointer-events-auto relative w-80 max-w-[90vw] overflow-hidden rounded-lg ${barClass} text-card-foreground shadow-2xl ${
				entry.state === 'leaving' ? EXIT_CLASS : ENTER_CLASS
			}`}
		>
			<div className="flex items-center gap-2.5 py-2.5 px-4">
				<Icon className={`h-4 w-4 shrink-0 ${textClass}`} />
				<div className={`min-w-0 ${textClass}`}>
					<p className="text-sm font-semibold leading-tight">{entry.title}</p>
					{entry.description && (
						<p className="mt-0.5 text-xs leading-snug text-muted-foreground">
							{entry.description}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
