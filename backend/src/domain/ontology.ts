/**
 * docs/29. a slice carries its own vocabulary; every slice carries the same
 * skeleton.
 *
 * three sources, one piece each:
 *   - salesforce (ontology anatomy): class, individual, relation, axiom, and the
 *     property that makes a graph survivable where a taxonomy is not, growth by
 *     adding a node rather than reorganising a branch.
 *   - memorium (ao3 tag wrangling): canonical terms with aliases, parent for
 *     branches and subbranches, exclusions, weighted associations, and relevance
 *     that varies by perspective. the alias is provenance; the canonical term is
 *     a resolution, not a replacement.
 *   - kiro (spec driven development): requirements/design/tasks and the
 *     current/expected/unchanged repair variant, kept as a shape and detached
 *     from its assumption that the artifact is a file.
 *
 * nothing here knows what a repo is.
 */
import { createHash } from 'node:crypto';
import { canonical } from '../crypto/identity.js';

/** the spectrum, weakest to strongest. the depth a slice needs is a choice. */
export type OntologyDepth = 'picklist' | 'taxonomy' | 'thesaurus' | 'graph';

export type TermStatus = 'canonical' | 'candidate' | 'deprecated';

/**
 * what kind of work this is. this is the axis the factory was missing: every
 * gate, every evidence scheme and every acceptance test was written for `code`
 * and silently applied to a deal.
 */
export const TASK_KINDS = [
  'code',
  'doc',
  'data',
  'deal',
  'design',
  'research',
  'support',
  'ops',
] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export interface Term {
  /** slug. the canonical name, and the only thing other documents cite */
  id: string;
  label: string;
  /** raw phrasings that resolve here. kept forever: they are how the org talks */
  aliases?: string[];
  /** branch and subbranch. null is a root */
  parent?: string | null;
  /** mutually exclusive with this term */
  excludes?: string[];
  related?: string[];
  category?: string;
  status?: TermStatus;
  /** what a deprecated term became */
  replacedBy?: string;
  /** 0..1, how much this term matters when resolving for a given seat */
  relevance?: Record<string, number>;
}

export interface Acceptance {
  /** the schemes a completion reference may use, e.g. `commit:`, `url:` */
  evidence: string[];
  /** what the gate computes, in words a reviewer can check */
  gate: string;
}

export interface SliceOntology {
  slice: string;
  version: number;
  depth: OntologyDepth;
  /** the task kinds this slice accepts. a slice that runs deals says so */
  kinds: TaskKind[];
  classes: string[];
  actions: string[];
  /**
   * statements that constrain the graph, in words. not executable: an axiom is
   * a thing a reviewer can check and a gate can sometimes test, and pretending
   * otherwise would mean inventing a rule language nobody asked for.
   */
  axioms?: string[];
  terms: Term[];
  /** keyed by kind: a slice can accept code and deals on quite different terms */
  acceptance: Partial<Record<TaskKind, Acceptance>>;
  /** who published this version, and when. a document without an author is a rumour */
  author?: string;
  publishedAt?: string;
}

/**
 * the default evidence scheme per kind. a slice may narrow this, never widen it
 * to a scheme outside `allowedEvidence`. widening is how a commit hash comes to
 * certify a deal.
 */
export const KIND_EVIDENCE: Record<TaskKind, string[]> = {
  code: ['commit:', 'run:'],
  doc: ['url:', 'artifact:'],
  data: ['sql:', 'artifact:'],
  deal: ['crm:'],
  design: ['artifact:', 'asset:'],
  research: ['source:', 'url:'],
  support: ['ticket:'],
  ops: ['run:', 'sql:'],
};

const SCHEME = /^([a-z]+):\S.*$/;

export function schemeOf(ref: string): string | null {
  const m = SCHEME.exec(ref.trim());
  return m ? `${m[1]}:` : null;
}

const normalise = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const slug = normalise;

export type Resolution =
  | {
      ok: true;
      term: Term;
      /** how it was matched, which is the audit trail for a normalisation */
      via: 'id' | 'label' | 'alias';
      confidence: number;
      /** the raw input, preserved. never dropped */
      raw: string;
      /** the seat-specific weight, when the term declares one */
      relevance?: number;
    }
  | { ok: false; reason: string; raw: string; candidates: Term[] };

/**
 * resolve what a seat wrote to a canonical term. unknown is a refusal, not an
 * invention: the caller files a proposal, and the proposal carries the raw term.
 */
export function resolve(ontology: SliceOntology, raw: string, opts: { seat?: string } = {}): Resolution {
  const wanted = normalise(raw);
  if (wanted.length === 0) return { ok: false, reason: 'empty_term', raw, candidates: [] };

  const live = ontology.terms.filter((t) => t.status !== 'candidate');

  const hit = (t: Term, via: 'id' | 'label' | 'alias', confidence: number): Resolution => {
    if (t.status === 'deprecated') {
      return {
        ok: false,
        reason: `term_deprecated${t.replacedBy ? `:use:${t.replacedBy}` : ''}`,
        raw,
        candidates: [t],
      };
    }
    const relevance = opts.seat ? t.relevance?.[opts.seat] : undefined;
    return {
      ok: true,
      term: t,
      via,
      confidence,
      raw,
      ...(relevance !== undefined ? { relevance } : {}),
    };
  };

  for (const t of live) if (normalise(t.id) === wanted) return hit(t, 'id', 1);
  for (const t of live) if (normalise(t.label) === wanted) return hit(t, 'label', 1);
  for (const t of live) {
    if ((t.aliases ?? []).some((a) => normalise(a) === wanted)) return hit(t, 'alias', 0.95);
  }

  // nothing exact: offer the candidates a human or an agent would look at,
  // ranked by token overlap. this is deliberately not fuzzy matching: a 0.6
  // confidence resolution written into the record is a guess with provenance.
  const tokens = new Set(wanted.split(' '));
  const scored = live
    .map((t) => {
      const theirTokens = new Set(normalise([t.label, ...(t.aliases ?? [])].join(' ')).split(' '));
      const shared = [...tokens].filter((x) => theirTokens.has(x)).length;
      return { t, shared };
    })
    .filter((s) => s.shared > 0)
    .sort((a, b) => b.shared - a.shared || a.t.id.localeCompare(b.t.id))
    .slice(0, 5)
    .map((s) => s.t);

  return { ok: false, reason: 'unknown_term', raw, candidates: scored };
}

export interface Proposal {
  slice: string;
  ontologyVersion: number;
  /** what the seat actually wrote. the reason this exists at all */
  raw: string;
  normalised: string;
  by: string;
  intent?: string;
  candidates: string[];
  at: string;
}

/** growing the vocabulary is a proposal with provenance, never a silent insert. */
export function propose(
  ontology: SliceOntology,
  raw: string,
  by: string,
  opts: { intent?: string; at?: string } = {},
): Proposal {
  const found = resolve(ontology, raw);
  const candidates = found.ok ? [found.term.id] : found.candidates.map((t) => t.id);
  return {
    slice: ontology.slice,
    ontologyVersion: ontology.version,
    raw,
    normalised: normalise(raw),
    by,
    ...(opts.intent !== undefined ? { intent: opts.intent } : {}),
    candidates,
    at: opts.at ?? new Date(0).toISOString(),
  };
}

/**
 * a completion reference must be the kind of evidence the kind of work produces.
 * this is the single line that stops a deal being closed with a commit hash.
 */
export function evidenceFits(
  kind: TaskKind,
  ref: string,
  ontology?: SliceOntology,
  opts: { kind?: TaskKind } = {},
): { ok: true; scheme: string } | { ok: false; reason: string } {
  const scheme = schemeOf(ref);
  if (!scheme) return { ok: false, reason: 'evidence_not_a_reference' };

  const allowed = ontology?.acceptance?.[kind]?.evidence ?? KIND_EVIDENCE[kind];
  if (!allowed) return { ok: false, reason: `no_evidence_scheme:${kind}` };
  if (!allowed.includes(scheme)) {
    return { ok: false, reason: `evidence_kind_mismatch:${kind}_expects_${allowed.join('|')}` };
  }
  // a slice may narrow the default, never widen it past what the kind allows
  const universal = KIND_EVIDENCE[kind];
  if (universal && !universal.includes(scheme)) {
    return { ok: false, reason: `slice_widened_${kind}_past_${universal.join('|')}` };
  }
  return { ok: true, scheme };
}

export interface OntologyFault {
  rule: string;
  detail: string;
}

/** structure only: this is what makes a document safe to publish a version of. */
export function validate(ontology: SliceOntology): OntologyFault[] {
  const faults: OntologyFault[] = [];

  if (!ontology.slice?.trim()) faults.push({ rule: 'slice_required', detail: 'slice' });
  if (!Number.isInteger(ontology.version) || ontology.version < 1) {
    faults.push({ rule: 'version_must_be_positive_integer', detail: String(ontology.version) });
  }
  if (ontology.kinds.length === 0) {
    faults.push({ rule: 'kinds_required', detail: 'a slice that does no work has no ontology' });
  }

  const seen = new Set<string>();
  for (const t of ontology.terms) {
    const id = slug(t.id);
    if (!id) faults.push({ rule: 'term_id_required', detail: JSON.stringify(t.label) });
    if (seen.has(id)) faults.push({ rule: 'duplicate_term', detail: id });
    seen.add(id);

    if (t.status === 'deprecated' && !t.replacedBy) {
      faults.push({ rule: 'deprecated_needs_replacement', detail: id });
    }
    if (t.parent) {
      if (slug(t.parent) === id) faults.push({ rule: 'self_parent', detail: id });
      if (!ontology.terms.some((other) => slug(other.id) === slug(t.parent!))) {
        faults.push({ rule: 'unknown_parent', detail: `${id} -> ${t.parent}` });
      }
    }
    for (const ex of t.excludes ?? []) {
      if (slug(ex) === id) faults.push({ rule: 'self_exclusion', detail: id });
      if (!ontology.terms.some((other) => slug(other.id) === slug(ex))) {
        faults.push({ rule: 'unknown_exclusion', detail: `${id} x ${ex}` });
      }
    }
    for (const [seat, weight] of Object.entries(t.relevance ?? {})) {
      if (!(weight >= 0 && weight <= 1)) {
        faults.push({ rule: 'relevance_out_of_range', detail: `${id}/${seat}=${weight}` });
      }
    }
  }

  // a cycle of parents is a graph that cannot be walked top-down
  for (const t of ontology.terms) {
    const path = new Set<string>([slug(t.id)]);
    let cursor = t.parent ? slug(t.parent) : null;
    while (cursor) {
      if (path.has(cursor)) {
        faults.push({ rule: 'parent_cycle', detail: `${slug(t.id)} -> ${cursor}` });
        break;
      }
      path.add(cursor);
      const next = ontology.terms.find((other) => slug(other.id) === cursor);
      cursor = next?.parent ? slug(next.parent) : null;
    }
  }

  for (const [i, axiom] of (ontology.axioms ?? []).entries()) {
    if (axiom.trim().length < 12) {
      faults.push({ rule: 'axiom_too_thin_to_check', detail: `#${i}: ${axiom}` });
    }
  }

  for (const kind of ontology.kinds) {
    if (!ontology.acceptance[kind]) {
      faults.push({ rule: 'acceptance_missing', detail: kind });
    }
  }
  for (const kind of Object.keys(ontology.acceptance) as TaskKind[]) {
    if (!ontology.kinds.includes(kind)) {
      faults.push({ rule: 'acceptance_for_unaccepted_kind', detail: kind });
    }
    const acc = ontology.acceptance[kind];
    if (acc && acc.evidence.length === 0) {
      faults.push({ rule: 'acceptance_evidence_required', detail: kind });
    }
  }

  return faults;
}

/**
 * the hash a config diff review reads. two documents with the same hash are the
 * same ontology, whichever way the keys were ordered on the way in.
 */
export function versionHash(ontology: SliceOntology): string {
  return createHash('sha256').update(canonical(ontology)).digest('hex');
}

export interface OntologyDiff {
  added: string[];
  removed: string[];
  changed: { id: string; fields: string[] }[];
  meta: string[];
}

/**
 * the change request. a human reads this instead of reading two documents, which
 * is the only reason versioning is worth the rows.
 */
export function diff(before: SliceOntology, after: SliceOntology): OntologyDiff {
  const index = (o: SliceOntology) => new Map(o.terms.map((t) => [slug(t.id), t]));
  const a = index(before);
  const b = index(after);

  const added = [...b.entries()].filter(([key]) => !a.has(key)).map(([, t]) => t.id);
  const removed = [...a.entries()].filter(([key]) => !b.has(key)).map(([, t]) => t.id);
  const changed: { id: string; fields: string[] }[] = [];

  for (const [key, term] of b) {
    const was = a.get(key);
    if (!was) continue;
    const fields = (['label', 'aliases', 'parent', 'excludes', 'related', 'status', 'replacedBy', 'relevance'] as const)
      .filter((f) => canonical(was[f] ?? null) !== canonical(term[f] ?? null));
    if (fields.length > 0) changed.push({ id: term.id, fields });
  }

  const meta = (['depth', 'kinds', 'classes', 'actions', 'axioms', 'acceptance'] as const).filter(
    (f) => canonical(before[f] ?? null) !== canonical(after[f] ?? null),
  );

  return { added, removed, changed, meta };
}
