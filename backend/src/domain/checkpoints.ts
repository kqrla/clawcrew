/**
 * docs/38. a task is not done because the seat says so. it is done because every
 * checkpoint the kind of work declares has a passing run, with a reference, and at
 * least one of them was run by somebody other than the seat that did the work.
 *
 * this is the same sentence as custody's evidence rule, extended to the several
 * steps a real piece of work has: built, checked, and accepted are three different
 * claims and only the last one means anything to a customer.
 */
import { TaskKind, evidenceFits } from './ontology.js';

export interface Checkpoint {
  id: string;
  /** what this step proves, in one line, for the person reading the refusal */
  proves: string;
  /** checkpoint ids that must pass first */
  after?: string[];
  /** may the seat that did the work also sign this one off? */
  selfSignable?: boolean;
}

/** the default chain per kind of work. a slice may add steps, never remove one. */
export const KIND_CHECKPOINTS: Record<TaskKind, Checkpoint[]> = {
  code: [
    { id: 'built', proves: 'the thing runs' },
    { id: 'tested', proves: 'a check that could fail passed', after: ['built'], selfSignable: false },
    // the chain stops at this slice's surface. "deployed" is evidenced by `deploy:`,
    // which is ops work on runtime.deploy, and a code seat cannot sign for it.
    { id: 'merged', proves: 'it is on the branch we deploy from', after: ['tested'] },
  ],
  design: [
    { id: 'drafted', proves: 'an asset exists' },
    { id: 'licenced', proves: 'every part has a licence record', after: ['drafted'], selfSignable: false },
    { id: 'approved', proves: 'the slice that consumes it accepted it', after: ['licenced'] },
  ],
  research: [
    { id: 'asked', proves: 'the question is stated' },
    { id: 'sourced', proves: 'a citation resolves', after: ['asked'] },
    { id: 'reproduced', proves: 'somebody re-ran the query', after: ['sourced'], selfSignable: false },
  ],
  security: [
    { id: 'scanned', proves: 'a scan ran against the deployed surface' },
    { id: 'triaged', proves: 'findings are classified', after: ['scanned'] },
    { id: 'cleared', proves: 'nothing above threshold is open', after: ['triaged'], selfSignable: false },
  ],
  financial: [
    { id: 'priced', proves: 'a provider object exists with an amount' },
    { id: 'authorised', proves: 'the amount is inside the ceiling', after: ['priced'], selfSignable: false },
    { id: 'settled', proves: 'the provider reports it settled', after: ['authorised'], selfSignable: false },
  ],
  media: [
    { id: 'produced', proves: 'an asset exists' },
    { id: 'consented', proves: 'every person in it is on record', after: ['produced'], selfSignable: false },
    { id: 'published', proves: 'it resolves at a public address', after: ['consented'] },
  ],
  ops: [
    { id: 'configured', proves: 'the runtime exists' },
    { id: 'observed', proves: 'a check read it from outside', after: ['configured'], selfSignable: false },
    { id: 'handed', proves: 'an on-call lease was taken', after: ['observed'] },
  ],
  accounting: [
    { id: 'recorded', proves: 'the entry exists' },
    { id: 'reconciled', proves: 'it matches a provider statement', after: ['recorded'], selfSignable: false },
  ],
  support: [
    { id: 'answered', proves: 'a reply was sent' },
    { id: 'closed', proves: 'the asker confirmed, or the thread went quiet', after: ['answered'], selfSignable: false },
  ],
  doc: [
    { id: 'written', proves: 'the page exists' },
    { id: 'sourced', proves: 'every claim on it cites something', after: ['written'], selfSignable: false },
    { id: 'resolves', proves: 'the page loads where it is linked', after: ['sourced'] },
  ],

};

export interface CheckpointRun {
  checkpoint: string;
  passed: boolean;
  /** a reference, not a sentence. a checkpoint passed on prose did not pass */
  evidence?: string;
  by: string;
  at: string;
}

export interface Completion {
  ok: boolean;
  unmet: { checkpoint: string; why: string }[];
  /** checkpoints that passed but on somebody's own say-so */
  selfSigned: string[];
}

export interface CompletionContext {
  kind: TaskKind;
  seat: string;
  /** the slice's additions, if it declares any */
  extra?: Checkpoint[];
  ontology?: unknown;
}

export function evaluateCompletion(ctx: CompletionContext, runs: CheckpointRun[]): Completion {
  const chain = [...(KIND_CHECKPOINTS[ctx.kind] ?? []), ...(ctx.extra ?? [])].sort((a, b) =>
    (a.after?.length ?? 0) - (b.after?.length ?? 0),
  );
  const unmet: { checkpoint: string; why: string }[] = [];
  const selfSigned: string[] = [];
  const passed = new Set<string>();

  for (const cp of chain) {
    const latest = [...runs].reverse().find((r) => r.checkpoint === cp.id);
    if (!latest || !latest.passed) {
      unmet.push({ checkpoint: cp.id, why: latest ? 'failed' : 'never ran' });
      continue;
    }
    const deps = cp.after ?? [];
    if (!deps.every((d) => passed.has(d))) {
      unmet.push({ checkpoint: cp.id, why: 'out_of_order' });
      continue;
    }
    // ticked in the wrong sequence is the failure this chain exists to catch:
    // deployed before tested means the test ran against something else
    const latestOf = (id: string) => [...runs].reverse().find((r) => r.checkpoint === id && r.passed);
    const early = deps.find((d) => {
      const dAt = latestOf(d)?.at;
      return dAt !== undefined && dAt > latest.at;
    });
    if (early) {
      unmet.push({ checkpoint: cp.id, why: 'out_of_order' });
      continue;
    }
    const fit = evidenceFits(ctx.kind, latest.evidence ?? '', ctx.ontology as never);
    if (!fit.ok) {
      unmet.push({ checkpoint: cp.id, why: fit.reason ?? 'evidence_does_not_fit' });
      continue;
    }
    if (cp.selfSignable === false && latest.by === ctx.seat) {
      selfSigned.push(cp.id);
      unmet.push({ checkpoint: cp.id, why: 'self_signed' });
      continue;
    }
    passed.add(cp.id);
  }

  return { ok: unmet.length === 0, unmet, selfSigned };
}
