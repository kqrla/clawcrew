select id, state, coalesce(evidence_ref, '-') as evidence_ref, coalesce(repo, '-') as repo
  from task where id like 't.code%' order by id;
select source, value, run_by from evidence where objective = 'obj.trinketeer.meeniable.code.repo' order by id;
