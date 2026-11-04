-- who wrote the words. a rule and a model must not be indistinguishable afterwards.
alter table support_ticket add column if not exists provider text;
