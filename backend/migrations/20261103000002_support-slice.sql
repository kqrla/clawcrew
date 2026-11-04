-- the segment: one support ticket, from arrival to measured outcome.
-- json is built with jsonb_build_object because a literal inside a batched query is
-- where the previous attempt died, and the error did not say which value.
create table if not exists support_ticket (
  id text primary key,
  asker text not null,
  subject text not null,
  body text not null,
  received_at timestamptz not null default now(),
  state text not null default 'open' check (state in ('open','answered','verified','closed')),
  reply_body text,
  replied_at timestamptz,
  replied_by text,
  verified_by text,
  verified_at timestamptz
);

insert into seat (id, title, home_tier, grants, model, state)
select 'seat.support', 'support responder', 't.test01.support',
  jsonb_build_object(
    'tools', jsonb_build_array('inbox.read', 'inbox.reply'),
    'scopes', jsonb_build_object('inbox.read', jsonb_build_array('inbox'), 'inbox.reply', jsonb_build_array('inbox')),
    'spendUsdPerDay', 2),
  jsonb_build_object('provider', 'scripted', 'note', 'no model key configured in the segment run'),
  'active'
on conflict (id) do nothing;

insert into seat (id, title, home_tier, grants, model, state)
select 'seat.support.qa', 'support verifier', 't.test01.support',
  jsonb_build_object(
    'tools', jsonb_build_array('inbox.read'),
    'scopes', jsonb_build_object('inbox.read', jsonb_build_array('inbox')),
    'spendUsdPerDay', 1),
  jsonb_build_object('provider', 'scripted', 'note', 'no model key configured in the segment run'),
  'active'
on conflict (id) do nothing;

insert into slice_ontology (id, slice, version, doc, doc_hash, author, status)
select 'ont.support.inbox.v1', 'support.inbox', 1,
  jsonb_build_object(
    'slice', 'support.inbox',
    'version', 1,
    'terms', jsonb_build_object('asker', 'the person who wrote in', 'reply', 'what the org sends back'),
    'acceptance', jsonb_build_object('support', jsonb_build_object('evidence', jsonb_build_array('ticket:')))),
  'segment-seed', 'operator.seed', 'active'
on conflict (id) do nothing;

insert into objective (id, version, owner_tier, statement, metric, source, baseline, target, deadline, status, self_reported, crosscheck_source)
select 'obj.support.resolved', 1, 't.test01.support',
  'every ticket that arrives is answered once and verified by a second seat',
  'tickets_closed_over_tickets_received',
  'sql:select count(*) filter (where state in (''closed'',''verified''))::numeric / greatest(count(*),1) from support_ticket',
  0, 0.95, '2027-02-01', 'active', false,
  'sql:select count(*)::numeric / greatest((select count(*) from support_ticket),1) from support_ticket where verified_by is not null'
on conflict (id, version) do nothing;

insert into support_ticket (id, asker, subject, body)
select 'tkt.1001', 'ana@example.com', 'the hoodie arrived with a torn seam',
  'it fits well and the print is great, but the left seam is open about 3cm. i can send a photo.'
on conflict (id) do nothing;
