# 29 · the per-slice ontology

the concept is [13-ontology](../concept/13-ontology/readme.md). this is the part that can be wrong.

## 1 · the collapse this fixes

before this document, the schema had exactly one evidence scheme, one acceptance test and one set of verbs, and they were all about code.

```
task.surfaces = ['crm.pipeline']     -- a real surface the factory works on
complete(row, holder, 'artifact://sha256/abc')  -- accepted
```

a deal was closed with an artifact hash. nothing failed, because the field was populated and the gate was green. that is the worst failure shape available: not a crash, a confirmation.

the cause is not laziness, it is that the model had nowhere to put the difference. `surfaces: string[]` says *where*, never *what kind of thing lives there*.

## 2 · three sources, one piece each

**salesforce, on shape.** an ontology is at the strong end of a spectrum: pick list, taxonomy, thesaurus, graph of classes, individuals, relations and axioms. the property worth taking is extensibility: *a taxonomy has to be reorganised to grow; a graph absorbs a new concept as a node*. a month-long org adds vocabulary constantly, so the default depth is `graph`, and shallower depths are allowed where the vocabulary is genuinely stable (`crm-pipeline` is a `thesaurus`).

**memorium, on living.** its AO3-derived tag system gives canonical terms, aliases, a parent for branches and subbranches, exclusions, weighted associations, and relevance that varies by perspective. two rules transfer:

- **an alias is provenance; the canonical term is a resolution, not a replacement.** `"intermittent failure"` resolves to `flake` and the words the seat wrote are stored. normalising that away destroys evidence about how the org actually talks.
- **relevance is per perspective.** `stage` is 0.9 to `seat.sales` and 0.2 to `seat.ops`. one canonical id, two slices, no ambiguity at the point of use.

**kiro, on the brief.** requirements with acceptance criteria, a design, discrete tasks, plus a repair variant that states current / expected / unchanged behaviour. the *shape* transfers to every kind of work. the assumption underneath it, that the artifact is a file and the proof is a test run, does not, so it is dropped.

## 3 · the model

```
SliceOntology {
  slice, version, depth, kinds[],
  classes[], actions[], axioms[],
  terms[{ id, label, aliases[], parent, excludes[], related[], category,
          status: canonical|candidate|deprecated, replacedBy?, relevance{seat: 0..1} }],
  acceptance { [kind]: { evidence: [scheme:], gate: "what a reviewer checks" } },
  author, publishedAt
}
```

`classes` and `actions` are the slice's nouns and verbs. `axioms` are constraints in words, deliberately not a rule language. `acceptance` is keyed by kind, so one slice can accept `code` and `data` on quite different terms, and a slice that only runs deals says so.

## 4 · kinds, and what proves each done

| kind | default evidence | gate |
| --- | --- | --- |
| `code` | `commit:`, `run:` | the test command exits 0 on the tree the commit points at |
| `doc` | `url:`, `artifact:` | the url resolves and the body hash matches the source |
| `data` | `sql:`, `artifact:` | the number moved, computed outside the seat |
| `deal` | `crm:` | the record is at the target stage, the transition attributed to this run |
| `design` | `artifact:`, `asset:` | the hash is pinned and an approval is attached |
| `research` | `source:`, `url:` | every claim maps to a source that says what the claim says |
| `support` | `ticket:` | closed by someone other than the author |
| `ops` | `run:`, `sql:` | the check ran across the whole window it claims |

a slice may **narrow** its scheme (`code` → `run:` only) and may never **widen** it outside the kind's defaults. widening is exactly how a commit hash comes to certify a deal.

enforced at the only place that matters: `complete` refuses `evidence_kind_mismatch:<kind>_expects_<schemes>` when the reference does not fit the row's kind. unkinded rows keep the old payload rule, so nothing that predates this document changed behaviour.

## 5 · resolution

```
resolve(ontology, raw, {seat}) ->
  | { ok, term, via: 'id' | 'label' | 'alias', confidence, raw, relevance? }
  | { ok: false, reason, raw, candidates[] }
```

order: canonical id (1.0), label (1.0), alias (0.95), then refusal with up to five token-overlap candidates. deliberately **not** fuzzy matched to a winner. names, not scores.

| refusal | meaning |
| --- | --- |
| `empty_term` | nothing to resolve |
| `unknown_term` | file a proposal; candidates are a starting point, not an answer |
| `term_deprecated:use:<id>` | the term was retired into another; the caller is told which |

## 6 · growth is a proposal, not an insert

an agent that meets a missing word files an `ontology_proposal`: the raw term, the normalised form, the slice, the version it was reading, the seat, its intent, and the nearest candidates. one open proposal per `(slice, normalised)`, so a month of agents proposing the same word is one row with a history rather than a month of rows.

merging a proposal means publishing a new ontology version. that is the only path by which the vocabulary grows, and every step of it has an author.

## 7 · versioning

- a version is a row. `unique (slice, version)`, and the store blocks updates to `doc`: republication is a new row.
- `doc_hash` is the sha256 of the canonical encoding, so two rows with the same hash are the same ontology whatever the key order.
- `diff(before, after)` reports added / removed / changed terms plus changed meta, and that output **is** the change request a human reviews. reviewing a hash is not reviewing a change.
- deprecation never deletes: a retired term carries `replacedBy`, because history that cites a deleted term is history nobody can read.

## 8 · what ships

four seed ontologies in `backend/ontology/`, published live, chosen to prove the point that they are not all code:

| seed | slice | kinds | what it demonstrates |
| --- | --- | --- | --- |
| `code-repo` | `repo.orchart` | code, data | the only slice that accepts code; a `flake` that excludes `regression` |
| `crm-pipeline` | `crm.pipeline` | deal | `renewal` excludes `expansion`; `stage` weighted 0.9 for sales, 0.2 for ops |
| `docs-site` | `docs.public` | doc, research | the four diataxis pages as terms, with tutorial excluding reference |
| `support-queue` | `support.queue` | support, ops | an axiom that a ticket is closed by someone other than its author |

plus two views for the questions a human actually asks:

- `slice_without_ontology`: surfaces work is being addressed to with no vocabulary at all.
- `unprovable_work`: open tasks whose kind has no acceptance recorded in their slice's current ontology. these cannot be proven done by anyone.

## 9 · what is not built

**no store yet.** `publish` and `current` are a handful of statements and `scripts/publish-seeds.ts` does the work, but there is no `OntologyStore` with supersede-on-publish and a validated write path. until there is, publishing is a script and a reviewer.

**nothing resolves terms at claim time.** a seat claims a row and gets a free-text `brief`. the ontology is not consulted, so an agent can still write a term nobody defined and be believed. the gate is at `complete`, which is late: it catches a fabricated proof of done, not a fabricated plan.

**candidate terms have no lifecycle.** `status: 'candidate'` exists in the type and nothing creates one. the intended flow, a proposal that becomes a candidate term before it becomes canonical, needs the store first.

**no cross-slice relation.** two ontologies currently share nothing but the meta-model. the interesting case, a `deal` in `crm.pipeline` and a `deployment` in `repo.orchart` being the same event seen twice, needs a relation between slices and a decision about which side owns the individual. that is the next document, and it is the one that makes the org able to notice it shipped something twice.
