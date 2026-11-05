-- docs/49. the board starts as the org that exists in tackle/: a directive, departments with
-- seats, and the wings that report sideways.
insert into org_node (id, kind, label, parent, x, y) values
  ('directive',            'tier',       'directive',            null,        400,  40),
  ('dept.support',         'department', 'support',              'directive', 200, 160),
  ('dept.code',            'department', 'code',                 'directive', 400, 160),
  ('dept.accounting',      'department', 'accounting',           'directive', 600, 160),
  ('seat.support',         'seat',       'seat · support',       'dept.support',    200, 260),
  ('seat.code',            'seat',       'seat · code',          'dept.code',       400, 260),
  ('seat.accounting',      'seat',       'seat · accounting',    'dept.accounting', 600, 260),
  ('wing.audit',           'wing',       'audit (weekly)',       'directive', 800, 160),
  ('wing.oncall',          'wing',       'on-call (lease)',      'directive', 800, 260),
  ('bloc.storefront',      'bloc',       'bloc · storefront',    'directive', 400, 360)
on conflict (id) do nothing;
