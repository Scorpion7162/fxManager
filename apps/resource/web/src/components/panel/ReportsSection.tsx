import { Card, CardContent } from '@fxmanager/ui/components/card';
import { Flag } from 'lucide-react';

export function ReportsSection() {
	return (
		<div className="text-sm text-muted-foreground">
			<Card className="bg-card/50">
				<CardContent>
					<div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
						<Flag className="h-6 w-6 text-muted-foreground/40" />
						<p className="text-sm font-medium text-muted-foreground">
							Reports are coming in a future update
						</p>
						<p className="max-w-md text-xs text-muted-foreground/80 leading-relaxed">
							The in-game reporting panel and staff review tools are planned for
							a later release and are out of scope for v1.
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
