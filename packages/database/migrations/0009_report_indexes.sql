CREATE INDEX reports_last_action_idx ON reports (last_action, id);
--> statement-breakpoint
CREATE INDEX reports_owner_last_action_idx ON reports (reporter_id, last_action, id);
--> statement-breakpoint
CREATE INDEX report_messages_report_idx ON report_messages (report_id, id);
