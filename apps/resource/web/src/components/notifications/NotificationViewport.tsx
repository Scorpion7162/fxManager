import { createPortal } from 'react-dom';
import { MAX_VISIBLE, useNotifications } from '~/store/notifications';
import { NotificationEntry } from './NotificationEntry';

/**
 * Stacks notifications top-center above every other UI element (menu, panel,
 * noclip controls). Persistent entries always claim the visible slots; extra
 * transient entries collapse into a "+N more" chip until older ones leave.
 */
export function NotificationViewport() {
	const entries = useNotifications();
	const visible = entries.slice(0, MAX_VISIBLE);
	const overflow = entries.length - visible.length;

	return createPortal(
		<div className="pointer-events-none fixed inset-x-0 top-4 z-[9999] flex flex-col items-center gap-2">
			{visible.map((entry) => (
				<NotificationEntry key={entry.id} entry={entry} />
			))}
			{overflow > 0 && (
				<div className="rounded-full border bg-card/95 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground shadow-lg">
					+{overflow} more
				</div>
			)}
		</div>,
		document.body,
	);
}
