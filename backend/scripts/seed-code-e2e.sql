-- docs/56 acceptance fixture: one code task that names a repo, one that is a breakdown.
insert into objective (id, version, statement, metric, source, baseline, target, deadline, status)
values ('obj.trinketeer.meeniable.code.repo', 1, 'ship code', 'commits', 'git', 0, 5, now() + interval '30 days', 'active')
on conflict (id, version) do nothing;

insert into task (id, objective_id, objective_version, kind, state, brief, claim_deadline_at, next_action_at, repo)
values ('t.code.e2e', 'obj.trinketeer.meeniable.code.repo', 1, 'code', 'ready', 'prove the producer', now() + interval '1 day', now(), '/home/tenki/clawcrew')
on conflict (id) do nothing;

insert into task (id, objective_id, objective_version, kind, state, brief, claim_deadline_at, next_action_at)
values ('t.code.parent', 'obj.trinketeer.meeniable.code.repo', 1, 'code', 'ready', 'improve the storefront', now() + interval '1 day', now())
on conflict (id) do nothing;

insert into task (id, objective_id, objective_version, kind, state, brief, claim_deadline_at, next_action_at, parent_task, repo)
values ('t.code.parent.1', 'obj.trinketeer.meeniable.code.repo', 1, 'code', 'ready', 'the actual commit', now() + interval '1 day', now(), 't.code.parent', '/home/tenki/clawcrew')
on conflict (id) do nothing;

insert into seat_shift (seat, slice, on_call) values ('seat.code', 'code', true)
on conflict (seat) do update set on_call = true;

insert into seat_lease (task_id, seat, kind, expires_at)
values ('t.code.e2e', 'seat.code', 'code', now() + interval '15 minutes'),
       ('t.code.parent', 'seat.code', 'code', now() + interval '15 minutes')
on conflict do nothing;
