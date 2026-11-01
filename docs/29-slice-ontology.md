# 29 · the per-slice ontology

the concept is [13-ontology](../concept/13-ontology/readme.md). this is the part that can be wrong.

## 1 · the collapse this fixes

before this document, the schema had exactly one evidence scheme, one acceptance test and one set of verbs, and they were all about code.

```
task.surfaces = ['financials.rails']      -- a real surface the factory works on
complete(row, holder, 'artifact://sha256/abc')  -- accepted
```

a price change was closed with an artifact hash. nothing failed, because the field was populated and the gate was green. that is the worst failure shape available: not a crash, a confirmation.

the cause is not laziness, it is that the model had nowhere to put the difference. `surfaces: string[]` says *where*, never *what kind of thing lives there*.

## 2 · three sources, one piece each

**salesforce, on shape.** an ontology is at the strong end of a spectrum: pick list, taxonomy, thesaurus, graph of classes, individuals, relations and axioms. the property worth taking is extensibility: *a taxonomy has to be reorganised to grow; a graph absorbs a new concept as a node*. a month-long org adds vocabulary constantly, so the default depth is `graph`, and shallower depths are allowed where the vocabulary is genuinely stable (`financials.rails` and `accounting.books` are shallower, because their vocabulary is genuinely stable).

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

`classes` and `actions` are the slice's nouns and verbs. `axioms` are constraints in words, deliberately not a rule language. `acceptance` is keyed by kind, so a slice can accept `ops` and `support` on quite different terms and a slice that only prices things says so.

## 4 · the ten slices, and what proves each done

the factory runs this org, not a sales org: design, code, research, security,
financials, media, operations, accounting, support, documentation. each one has a
different notion of done, which is the whole reason the kind exists.

| kind | slice | default evidence | gate |
| --- | --- | --- | --- |
| `code` | `code.repo` | `commit:`, `run:` | the test command exits 0 on the tree the commit points at |
| `design` | `design.studio` | `file:`, `figma:`, `penpot:`, `artifact:` | the file is pinned at the version produced, its hash matches, and an approval from another seat is attached |
| `research` | `research.analysis` | `sheet:`, `sql:`, `source:`, `chart:` | each claim cites a query or sheet whose numbers reproduce, with the sample size stated |
| `security` | `security.controls` | `scan:`, `audit:` | the scan ran against the deployed revision and no open finding above threshold is unaccepted |
| `financial` | `financials.rails` | `stripe:`, `payout:`, `invoice:` | the object exists at the provider with the expected amount and currency, attributed in its metadata |
| `media` | `media.studio` | `asset:`, `render:` | the asset resolves, the hash matches the approved render, spec matches, consent on record |
| `ops` | `operations.runtime` | `run:`, `deploy:`, `ticket:` | the check ran across the whole window it claims, against the deployed revision |
| `accounting` | `accounting.books` | `ledger:`, `sheet:` | the entry posts to a balanced trial balance and every provider transaction in the period reconciles |
| `support` | `support.inbox` | `ticket:` | closed by someone other than the author |
| `doc` | `documentation.site` | `url:`, `artifact:` | the url resolves, the body hash matches, every claim cites a source that resolves |

a slice may **narrow** its scheme (`code` → `run:` only) and may never **widen** it outside the kind's defaults. widening is exactly how a commit hash comes to certify a move of money.

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

ten seed ontologies in `backend/ontology/`, published live:

| seed | slice | kind | provides | requires |
| --- | --- | --- | --- | --- |
| `design` | `design.studio` | design | `design.asset` | — |
| `code` | `code.repo` | code | `code.change` | `design.asset` |
| `research` | `research.analysis` | research | `research.signal` | — |
| `security` | `security.controls` | security | `security.control` | `code.change`, `runtime.deploy` |
| `financials` | `financials.rails` | financial | `payment.rail` | `code.change` |
| `media` | `media.studio` | media | `media.asset` | `design.asset` |
| `operations` | `operations.runtime` | ops | `runtime.deploy`, `oncall.roster` | `code.change` |
| `accounting` | `accounting.books` | accounting | `ledger.record` | `payment.rail` |
| `support` | `support.inbox` | support | `support.inbox` | `doc.page`, `runtime.deploy` |
| `documentation` | `documentation.site` | doc | `doc.page` | `code.change` |

the `provides` / `requires` pair is what makes a slice **plug and play**. a business is a set of slices, and the set is whole when every `requires` is met by some `provides` inside it. `compose()` reports the gaps by contract and by who is waiting, so removing a slice says *what cannot run* instead of surfacing a missing dependency at the first handoff. the ten together are closed; dropping `code` blocks four slices on `code.change`, and dropping `design` blocks two on `design.asset`.

live, the same check is a view rather than an assertion: `unmet_contracts` is the query behind it, and it returns nothing for the current set.

- `slice_without_ontology`: surfaces work is being addressed to with no vocabulary at all.
- `unprovable_work`: open tasks whose kind has no acceptance recorded in their slice's current ontology. these cannot be proven done by anyone.

## 9 · what is not built

**no store yet.** `publish` and `current` are a handful of statements and `scripts/publish-seeds.ts` does the work, but there is no `OntologyStore` with supersede-on-publish and a validated write path. until there is, publishing is a script and a reviewer.

**nothing resolves terms at claim time.** a seat claims a row and gets a free-text `brief`. the ontology is not consulted, so an agent can still write a term nobody defined and be believed. the gate is at `complete`, which is late: it catches a fabricated proof of done, not a fabricated plan.

**candidate terms have no lifecycle.** `status: 'candidate'` exists in the type and nothing creates one. the intended flow, a proposal that becomes a candidate term before it becomes canonical, needs the store first.

**contracts are named, not typed.** `code.change` says a slice fulfils something; it does not say what shape that something is. two slices can name the same contract and mean different things, and only a human reading both documents would notice. a contract needs a schema and a version before a business can be assembled without review.

**no cross-slice identity.** the slices share a meta-model and a contract list, and nothing else. the interesting case, a `financial` price change and a `doc` page describing it being the same event seen twice, needs a relation between slices and a decision about which side owns the individual. that is the next document.
