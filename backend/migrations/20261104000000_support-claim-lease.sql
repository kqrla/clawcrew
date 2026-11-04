-- a claim is a lease. a process that dies mid-turn must not hold a customer forever.
alter table support_ticket add column if not exists claimed_at timestamptz;
