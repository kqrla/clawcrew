-- docs/54 addendum. the rename repointed tasks but not evidence, so every objective looked
-- unmeasured after it: the proof was still filed under the old name. evidence is append-only
-- about what was computed, but the name it was computed *for* is a reference, and a rename has
-- to carry it or the ledger reads as empty.
update evidence set objective = replace(objective, 'obj.meenible', 'obj.trinketeer.meeniable')
 where objective like 'obj.meenible%';

update metric_reading set objective_id = replace(objective_id, 'obj.meenible', 'obj.trinketeer.meeniable')
 where objective_id like 'obj.meenible%';

update project_slice set objective_id = replace(objective_id, 'obj.meenible', 'obj.trinketeer.meeniable')
 where objective_id like 'obj.meenible%';
-- the one active objective with no line was created by hand against meeniable's inbox before the
-- catalog existed. it is a support objective, and support is meeniable's work, so say so.
update objective set product_line = 'trinketeer.meeniable'
 where product_line is null and id = 'obj.support.resolved';
