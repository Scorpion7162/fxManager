import { useState, useEffect } from 'react';
import { Button } from '@fxmanager/ui/components/button';
import { Tags, Radar, Mic, HeartPulse } from 'lucide-react';
import { useMenuStore } from '~/store/menustore';
import { fetchNui } from '~/utils/fetchNui';
import { useNuiEvent } from '~/hooks/useNuiEvent';
import { showNotification } from '~/store/notifications';

export function MonitoringControls() {
	const { tags, blips, setTags, setBlips } = useMenuStore();
	const [count, setCount] = useState(0);
	const [pending, setPending] = useState(false);
	useNuiEvent<number>('tag-count', setCount);
	useEffect(() => {
		void fetchNui<{ count: number }>(
			'get-tag-count',
			{},
			{ data: { count: 0 } },
		).then((data) => setCount(data.count));
	}, []);
	async function toggle(kind: 'tags' | 'blips', next: boolean) {
		setPending(true);
		try {
			if (
				!(await fetchNui<boolean>(`moderation-${kind}`, next, { data: true }))
			)
				throw new Error('Permission denied or server unavailable.');
			if (kind === 'tags') setTags(next);
			else setBlips(next);
		} catch (error) {
			showNotification({
				title: 'Monitoring unavailable',
				description: error instanceof Error ? error.message : 'Request failed.',
				variant: 'error',
			});
		} finally {
			setPending(false);
		}
	}
	return (
		<div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h3 className="text-sm font-semibold">World monitoring</h3>
					<p className="mt-1 text-xs text-muted-foreground">
						Tags appear above other streamed players within 150m. They never
						label your own character.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						size="sm"
						variant={tags ? 'secondary' : 'outline'}
						aria-pressed={tags}
						disabled={pending}
						onClick={() => void toggle('tags', !tags)}
					>
						<Tags className="mr-2 size-4" />
						Tags {tags ? 'on' : 'off'}
					</Button>
					<Button
						size="sm"
						variant={blips ? 'secondary' : 'outline'}
						aria-pressed={blips}
						disabled={pending}
						onClick={() => void toggle('blips', !blips)}
					>
						<Radar className="mr-2 size-4" />
						Blips {blips ? 'on' : 'off'}
					</Button>
				</div>
			</div>
			<div className="flex flex-wrap gap-x-5 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
				<span className="flex items-center gap-1.5">
					<HeartPulse className="size-3.5" />
					Health bar + armour value
				</span>
				<span className="flex items-center gap-1.5">
					<Mic className="size-3.5" />
					Voice icon while speaking
				</span>
				<span>{tags ? `${count} nearby player tags` : 'Tags disabled'}</span>
			</div>
		</div>
	);
}
