import { expect, test } from 'bun:test';
import { isReportAction } from './validation';
test('rejects empty text, oversized payloads, forged actions and invalid IDs', () => {
	for (const input of [
		null,
		{},
		{ action: 'delete', id: 1 },
		{ action: 'create', subject: '  ', message: 'Text' },
		{ action: 'create', subject: 'Valid', message: 'x'.repeat(2001) },
		{ action: 'reply', id: -1, message: 'Text' },
		{ action: 'reply', id: 1, message: '   ' },
		{ action: 'status', id: 1, status: 'deleted' },
	])
		expect(isReportAction(input)).toBe(false);
	expect(
		isReportAction({
			action: 'create',
			subject: 'Need help',
			message: 'My car is stuck.',
		}),
	).toBe(true);
	expect(
		isReportAction({ action: 'status', id: 1, status: 'inprogress' }),
	).toBe(true);
});
