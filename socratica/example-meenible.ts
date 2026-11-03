/**
 * the first real question socratica gets, run on the ten measures meenible cannot
 * compute yet. every candidate is a gauge that has failed at least once, so the room
 * is choosing which blindness to end first.
 */
import { Candidate, Seat, deliberate, dispatchNext } from './deliberate.js';

const c = (id: string, slice: string, title: string, costHours: number, over: Partial<Candidate> = {}): Candidate => ({
  id, slice, title, costHours, ...over,
});

const candidates: Candidate[] = [
  c('g.financials', 'financials.rails', 'verify the live quote and payment rail', 6, { blocksLaunch: true }),
  c('g.security', 'security.controls', 'scan findings above threshold', 5),
  c('g.design', 'design.studio', 'licence and hash check over the catalog', 8, { blocksLaunch: true }),
  c('g.operations', 'operations.runtime', 'checks passing across a window', 4),
  c('g.accounting', 'accounting.books', 'ledger reconciliation for the period', 9, { dependsOn: ['g.financials'] }),
  c('g.support', 'support.inbox', 'tickets closed by a non-author', 7, { dependsOn: ['g.operations'] }),
  c('g.docs', 'documentation.site', 'pages resolving with claims sourced', 6),
  c('g.research', 'research.analysis', 'memos whose query reproduces', 12),
  c('g.media', 'media.studio', 'assets with consent on record', 10, { dependsOn: ['g.design'] }),
  c('g.revenue', 'financials.rails', 'paid charges, counted at the provider', 3, { blocksLaunch: true }),
];

const f = (id: string, evidence: string, statement: string) =>
  ({ id, kind: 'fact' as const, statement, evidence, confidence: 0.8, by: 'seat' });

const seats: Seat[] = [
  {
    seat: 'seat.financials',
    interest: 'the ceiling and the price decide whether any of this is a business',
    positions: [
      { candidate: 'g.financials', stance: 'do-first', claim: f('a1', 'http:GET quote', 'no quote means no ceiling') },
      { candidate: 'g.revenue', stance: 'do-first', claim: f('a2', 'http:GET charges', 'revenue is the kill criterion') },
      { candidate: 'g.accounting', stance: 'do-first', claim: f('a3', 'sql:select count(*) from ledger_unmatched', 'unmatched money is invisible money') },
      { candidate: 'g.media', stance: 'do-later', claim: f('a4', 'run:asset verify', 'media is not on the path to an order'), falsifier: 'the storefront needs a hero asset to take payment' },
    ],
  },
  {
    seat: 'seat.security',
    interest: 'a shipped part without a licence record is the company-ending risk',
    positions: [
      { candidate: 'g.design', stance: 'do-first', claim: f('b1', 'run:catalog verify', 'licence is the launch blocker') },
      { candidate: 'g.security', stance: 'do-first', claim: f('b2', 'run:scan report', 'secrets leak in build scripts first') },
      { candidate: 'g.media', stance: 'never', claim: f('b3', 'run:asset verify', 'asset tooling widens the attack surface'), falsifier: 'every asset is licenced and served from our own bucket' },
      { candidate: 'g.research', stance: 'do-later', claim: f('b4', 'run:sheet verify', 'research has no external dependency yet'), falsifier: 'a decision is blocked on a number we do not have' },
    ],
  },
  {
    seat: 'seat.operations',
    interest: 'nothing should be built that cannot be seen failing at 3am',
    positions: [
      { candidate: 'g.operations', stance: 'do-first', claim: f('c1', 'run:check run', 'checks are how we notice anything') },
      { candidate: 'g.support', stance: 'do-first', claim: f('c2', 'sql:select count(*) from ticket', 'a queue nobody counts is a queue nobody answers') },
      { candidate: 'g.research', stance: 'never', claim: f('c3', 'run:sheet verify', 'no operational failure has ever been caused by a memo'), falsifier: 'a metric disagrees with its witness and we cannot say why' },
      { candidate: 'g.docs', stance: 'do-later', claim: f('c4', 'run:docs crawl', 'docs rot when the surface moves'), falsifier: 'the surface stops changing for a week' },
    ],
  },
  {
    seat: 'seat.design',
    interest: 'the catalog is the product, and it is also the thing that gets us sued',
    positions: [
      { candidate: 'g.design', stance: 'do-first', claim: f('d1', 'run:catalog verify', 'the check is the licence record') },
      { candidate: 'g.media', stance: 'do-first', claim: f('d2', 'run:asset verify', 'a figure with no photograph sells nothing') },
      { candidate: 'g.docs', stance: 'do-first', claim: f('d3', 'run:docs crawl', 'the room needs words before it has pictures') },
    ],
  },
];

const plan = deliberate({ question: 'which blindness do we end first', candidates, seats });
const top = plan.order.slice(0, 4).map((o, i) => `${i + 1}. ${o.candidate} (score ${o.score})`);
console.log('ORDER\n' + top.join('\n'));
console.log('\nDEFERRED');
for (const d of plan.deferred) console.log(`- ${d.candidate}: ${d.because} -> re-enters when ${d.falsifier}`);
console.log('\nOMITTED');
for (const o of plan.omitted) console.log(`- ${o.candidate}: ${o.because}`);
console.log('\nDISSENT (kept on the record)');
for (const d of plan.dissent) console.log(`- ${d.seat} on ${d.candidate}: ${d.claim.statement}`);
console.log('\nfaults: ' + (plan.faults.length ? plan.faults.join(', ') : 'none'));
console.log('next dispatch: ' + JSON.stringify(dispatchNext(plan, [])));
