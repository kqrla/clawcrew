-- undo the state the pre-fix run left behind, so the breakdown refusal can be watched cleanly
update task set state = 'ready', evidence_ref = null, completed_at = null where id = 't.code.parent';
update seat_lease set released_at = now() where task_id = 't.code.parent' and released_at is null;
insert into seat_lease (task_id, seat, kind, expires_at) values ('t.code.parent', 'seat.code', 'code', now() + interval '15 minutes');
