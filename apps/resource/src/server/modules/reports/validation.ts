export function isReportAction(value: unknown): value is
	| { action: 'create'; subject: string; message: string }
	| { action: 'reply'; id: number; message: string }
	| {
			action: 'status';
			id: number;
			status: 'open' | 'inprogress' | 'resolved';
	  } {
	if (!value || typeof value !== 'object') return false;
	const data = value as Record<string, unknown>;
	const message =
		typeof data.message === 'string' &&
		data.message.trim().length > 0 &&
		data.message.length <= 2000;
	if (data.action === 'create')
		return (
			message &&
			typeof data.subject === 'string' &&
			data.subject.trim().length >= 3 &&
			data.subject.length <= 120 &&
			String(data.message).trim().length >= 3
		);
	if (!Number.isSafeInteger(data.id) || Number(data.id) < 1) return false;
	if (data.action === 'reply') return message;
	return (
		data.action === 'status' &&
		typeof data.status === 'string' &&
		['open', 'inprogress', 'resolved'].includes(data.status)
	);
}
