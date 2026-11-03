alter table seat add column if not exists strikes int not null default 0;
alter table seat add column if not exists frozen_at timestamptz;

create table if not exists seat_strike (
  id bigserial primary key,
  seat text not null references seat(id),
  code text not null,
  tool text,
  at timestamptz not null default now()
);
create index if not exists seat_strike_by_seat on seat_strike (seat, at desc);

-- the seat count and the log cannot disagree: the column is derived, and this is how
create or replace view seat_standing as
select s.id as seat, s.state, s.home_tier,
       (select count(*)::int from seat_strike k where k.seat = s.id) as strikes,
       (select k.code from seat_strike k where k.seat = s.id order by k.at desc limit 1) as last_code,
       (select max(k.at) from seat_strike k where k.seat = s.id) as last_strike_at
from seat s;

create or replace view frozen_seats as
select * from seat_standing where state = 'frozen';
