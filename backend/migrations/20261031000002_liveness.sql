-- docs/25: the work row becomes the unit of custody.
--
-- three of the four liveness invariants are enforced here rather than in code,
-- because a constraint cannot be forgotten by a future caller:
--   iv.  no silent terminal state      -> done needs evidence, cancelled needs a reason
--   ii.  no unclaimable work           -> a ready row must carry a claim deadline
--   --   no unnumbered row             -> non-terminal rows need next_action_at

alter table task add column if not exists next_action_at      timestamptz;
alter table task add column if not exists claim_deadline_at   timestamptz;
alter table task add column if not exists progress_version    int not null default 0;
alter table task add column if not exists progress_at         timestamptz;
alter table task add column if not exists attempts            int not null default 0;
alter table task add column if not exists max_attempts        int not null default 3;
alter table task add column if not exists evidence_ref        text;
alter table task add column if not exists cancelled_reason    text;
alter table task add column if not exists cancelled_by        text;
alter table task add column if not exists blocking_reason     text;
alter table task add column if not exists surfaces            text[] not null default '{}';
-- custody of the work itself, distinct from the shift lease in `lease`
alter table task add column if not exists custody_holder      text references seat(id);
alter table task add column if not exists custody_expires_at  timestamptz;
alter table task add column if not exists custody_renewals    int not null default 0;

-- v0.1 states -> custody states
alter table task drop constraint if exists task_state_check;
update task set state = case state
    when 'open'        then 'ready'
    when 'in_progress' then 'leased'
    when 'partial'     then 'blocked'
    else state end
  where state in ('open', 'in_progress', 'partial');

-- rows that predate the deadline rule are given one rather than deleted
update task
   set next_action_at = now() + interval '15 minutes'
 where state not in ('done', 'cancelled') and next_action_at is null;
update task
   set claim_deadline_at = next_action_at
 where state = 'ready' and claim_deadline_at is null;

alter table task add constraint task_state_check
  check (state in ('ready', 'leased', 'blocked', 'done', 'cancelled'));

alter table task add constraint task_done_evidence
  check (state <> 'done' or evidence_ref is not null);
alter table task add constraint task_cancelled_reason
  check (state <> 'cancelled' or (cancelled_reason is not null and cancelled_by is not null));
alter table task add constraint task_leased_custody
  check (state <> 'leased' or custody_expires_at is not null);
alter table task add constraint task_ready_claimable
  check (state <> 'ready' or claim_deadline_at is not null);
alter table task add constraint task_nonterminal_deadline
  check (state in ('done', 'cancelled') or next_action_at is not null);

create index if not exists task_sweep
  on task (state, next_action_at) where state in ('ready', 'leased', 'blocked');
create index if not exists task_custody_expiry
  on task (custody_expires_at) where state = 'leased';
