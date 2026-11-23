-- docs/56. a code task names one repo, or it is not a code task yet.
--
-- how far up the breakdown a task sits decides whether it can name a repo: a task that is
-- "improve the storefront" cannot, because it is several repositories' worth of decisions away
-- from an artifact. such a task is a breakdown, not work, and handing it to a seat manufactures
-- evidence nobody can compute. so the column is nullable and the producer refuses, with a reason
-- that says which of the two cases it is.
alter table task add column if not exists repo text;
-- breakdown is a relationship, not a convention: a task with children is a plan
alter table task add column if not exists parent_task text references task(id);
create index if not exists task_parent on task (parent_task) where parent_task is not null;
create index if not exists task_repo on task (repo) where repo is not null;
