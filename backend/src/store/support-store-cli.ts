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
      const row = marked(
        `with c as (
           update support_ticket set state = 'answered'
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
