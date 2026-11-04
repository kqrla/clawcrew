import { CheckpointRun } from '../domain/checkpoints.js';
import { SeatStanding } from '../domain/strikes.js';
import { SupportStore, SupportTicket } from '../domain/support.js';
import { cell, lit, marked, sql } from './sql-cli.js';

const SEP = "chr(31)";

export function createSupportStoreCli(seat: string): SupportStore {
  return {
    async claimOpenTicket(): Promise<SupportTicket | null> {
      // open -> answered inside the same statement, so the claim and the state
      // change cannot disagree
      // a data-modifying CTE has to be top level, so this statement is written out
      // rather than wrapped by cell()
      // a claim is a lease, so a claim nobody is holding comes back first. this is what
      // a killed process leaves: a customer in answered-with-no-reply, invisible to every
      // future run. the earlier guard only covered exits the code could catch.
      sql(
        `update support_ticket set state = 'open', claimed_at = null
          where state = 'answered' and reply_body is null
            and (claimed_at is null or claimed_at < now() - interval '10 minutes')`,
      );
      const row = marked(
        `with c as (
           update support_ticket set state = 'answered', claimed_at = now()
           where id = (select id from support_ticket where state = 'open' order by received_at limit 1)
             and state = 'open'
           returning id, asker, subject, body)
         select '##' || coalesce((select id || ${SEP} || asker || ${SEP} || subject || ${SEP} || body from c), '') || '##' as k`,
      );
      if (!row) return null;
      const [id, asker, subject, body] = row.split('\u001f');
      return { id: id!, asker: asker!, subject: subject!, body: body!, state: 'answered' };
    },

    async release(ticketId, at) {
      sql(`update support_ticket set state = 'open', replied_at = null where id = ${lit(ticketId)} and reply_body is null and state = 'answered'`);
    },

    async saveReply(ticketId, body, by, provider, at) {
      sql(`update support_ticket set reply_body = ${lit(body)}, replied_by = ${lit(by)}, provider = ${lit(provider)}, replied_at = ${lit(at)} where id = ${lit(ticketId)}`);
    },

    async saveEvidence(ticketId, runs: CheckpointRun[]) {
      const brief = JSON.stringify({ ticket: ticketId, checkpoints: runs.map((r) => ({ id: r.checkpoint, passed: r.passed, by: r.by, at: r.at })) });
      sql(
        `insert into task (id, owner_tier, state, kind, evidence_ref, brief, surfaces, completed_at)
         values (${lit('t.' + ticketId)}, 't.test01.support', 'done', 'support', ${lit('ticket:' + ticketId)},
                 ${lit(brief)}::jsonb, array['support.inbox'], ${lit(runs[0]?.at ?? null)})
         on conflict (id) do update set state = excluded.state, evidence_ref = excluded.evidence_ref,
           brief = excluded.brief, completed_at = excluded.completed_at`,
      );
    },

    async markVerified(ticketId, by, at) {
      sql(`update support_ticket set state = 'verified', verified_by = ${lit(by)}, verified_at = ${lit(at)} where id = ${lit(ticketId)} and reply_body is not null and state = 'answered'`);
    },

    async standing(): Promise<SeatStanding> {
      const raw = cell(`coalesce(state || '|' || strikes, '')`, `seat where id = ${lit(seat)}`);
      const [state, strikes] = raw.split('|');
      return { seat, state: (state || 'active') as SeatStanding['state'], strikes: Number(strikes ?? 0) };
    },

    async spentToday(seat, dayStart) {
      // settled amounts plus open reservations, because an unspent reservation is money
      // that is already promised
      const raw = cell(
        `(coalesce(sum(coalesce(settled_amount, amount)) filter (where state <> 'released'), 0) / 100.0)::text`,
        `budget_reservation where run_ref like 'tkt.%' and started_at >= ${lit(dayStart)}`,
      );
      return Number(raw || 0);
    },

    async reserveSpend(seat, usd, ref, at) {
      // a reservation belongs to a policy, so the seat's daily one is created here rather
      // than left to a seeding step nobody remembers to run
      const policyId = `pol.${seat}.usd_cents.day`;
      sql(
        `insert into budget_policy (id, scope, scope_id, metric, window_kind, amount, hard_stop)
         values (${lit(policyId)}, 'seat', ${lit(seat)}, 'usd_cents', 'day', 200, true)
         on conflict (id) do nothing`,
      );
      sql(
        `insert into budget_reservation (id, policy_id, agent_id, run_ref, amount, state, started_at)
         values (${lit(`res.${ref}.${Date.parse(at)}`)}, ${lit(policyId)}, ${lit(seat)}, ${lit(ref)}, ${Math.round(usd * 100)}, 'held', ${lit(at)})
         on conflict (id) do nothing`,
      );
    },

    async settleSpend(ref, usd, at) {
      sql(
        `update budget_reservation set settled_amount = ${Math.round(usd * 100)}, state = ${usd > 0 ? "'settled'" : "'released'"},
           settled_at = ${lit(at)} where run_ref = ${lit(ref)} and state = 'held'`,
      );
    },

    async recordRefusal(_seat, codes, at) {
      for (const code of codes) {
        sql(`insert into seat_strike (seat, code, at) values (${lit(seat)}, ${lit(code)}, ${lit(at)})`);
      }
      sql(`update seat set strikes = (select count(*) from seat_strike where seat = ${lit(seat)}) where id = ${lit(seat)}`);
    },

    async freeze(_seat, at) {
      sql(`update seat set state = 'frozen', frozen_at = ${lit(at)} where id = ${lit(seat)}`);
    },
  };
}

/** the objective this segment is measured by, read the same way a stranger would */
export function readResolved(): { value: number; raw: string } {
  const raw = cell(
    `coalesce(round(count(*) filter (where state in ('closed','verified'))::numeric / greatest(count(*),1), 4)::text, '0')`,
    'support_ticket',
  );
  const witnessed = cell(
    `coalesce(round(count(*) filter (where verified_by is not null)::numeric / greatest(count(*),1), 4)::text, '0')`,
    'support_ticket',
  );
  return { value: Number(raw), raw: `${raw} primary / ${witnessed} witness` };
}
