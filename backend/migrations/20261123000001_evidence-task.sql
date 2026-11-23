-- docs/56 addendum. evidence belongs to the task that produced it, not to the objective.
--
-- without this, a breakdown task completed on its child's artifact: both share an objective, and
-- the judge could only see the objective. the artifact proved something; it did not prove that
-- *this* task did it.
alter table evidence add column if not exists task_id text references task(id);
create index if not exists evidence_task on evidence (task_id) where task_id is not null;
