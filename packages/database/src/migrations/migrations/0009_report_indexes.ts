import type { Migration } from '../types';
export const m0009_report_indexes: Migration = {
	version: 9,
	description: 'Index report lists and conversations',
	up: [
		'CREATE INDEX reports_last_action_idx ON reports (last_action, id)',
		'CREATE INDEX reports_owner_last_action_idx ON reports (reporter_id, last_action, id)',
		'CREATE INDEX report_messages_report_idx ON report_messages (report_id, id)',
	],
};
