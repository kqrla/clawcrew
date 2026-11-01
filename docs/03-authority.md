# 03 · authority

## the formula

```
effective(seat) = ceiling(root)
                ∩ ceiling(c1) ∩ ... ∩ ceiling(cn)     # every ancestor
                ∩ own_grants(seat)
                ∩ active_secondments(seat)
```

subtraction is not a mechanism here. there is no deny rule that can widen, and no exception that bypasses the chain. a permission exists or it does not.

### worked example

seat `design`, homed in `brand.social`, seconded to `eng.launch`.

| level | tool ceiling | spend/day |
| --- | --- | --- |
| root | git, ci, cloud, ad, bank.read | 500 |
| brand | git.read, ad.publish, asset.write | 120 |
| brand.social | ad.publish, asset.write, brand.voice | 40 |
| own grants | asset.write, ad.publish | 10 |
| secondment → eng.launch | asset.write, git.read | 0 |
| **effective** | **asset.write** | **0** |

`ad.publish` disappears because the secondment does not carry it. `git.read` appears but cannot be used to write. spend is zero in the host, so any spend in the launch context draws from the host tier's budget, not the seat's.

this is the intended outcome: authority to contribute, not authority to spend or publish, unless the secondment says so.

## grant objects

```yaml
grant:
  id: grant.4b21
  subject: seat.infra-lead | tier.eng.platform
  tool: cloud.deploy.staging
  scope: {env: staging, regions: [us-east]}
  limits: {calls_per_day: 50, spend_usd_per_day: 10}
  issued_by: seat.cto
  issued_at: 2026-10-31T12:00:00Z
  expires_at: 2026-11-30T12:00:00Z
  reason: "staging deploy authority for the q4 migration"
```

grants are issues, not settings. every grant has an issuer, a reason and an expiry. a grant without an expiry is a bug, except for the root ceiling, which is the company.

## elevation

intersection alone starves deep trees. a leaf four levels down inherits the smallest set in the chain and ends up able to do almost nothing, which pushes work back up to managers and defeats the point of having leaves.

elevation is the explicit widening path.

```yaml
elevation:
  id: elev.91c
  issuer: tier.eng.platform        # must be an ancestor of the target
  target: seat.eng.platform.infra.ci
  adds: [cloud.deploy.staging]
  reason: "ci must deploy to staging between 09:00 and 17:00 et"
  window: {days: [mon, tue, wed, thu, fri], hours: [9, 17]}
  max_uses: 200
  expires_at: 2026-11-14T00:00:00Z
  requires: a1                      # notify on each use
```

rules:

- the issuer must be an ancestor of the target, and cannot add beyond its own ceiling.
- elevation expires by default (72 hours). renewal is a new elevation with a new reason.
- every use is logged with the elevation id, so the audit can answer "why was this allowed" without inference.
- elevation is auto-revoked on any role change, reparent or freeze in the target's chain.
- **rising elevation volume is a health signal.** if elevation requests trend up, the tree is mis-shaped. treat it like a queue depth, not a permission count.

## secrets

secrets never enter the intersection.

- a seat holds a **reference**, never a value.
- the value is fetched at call time by the tool layer, scoped to one surface, and never returned to the model.
- secret material is never carried into a secondment. this is a hard floor: a seconded seat cannot bring a credential with it, ever.
- sensitive namespaces use separate stores, not filters over a shared store.

## approval classes

every write-capable action resolves to exactly one class, by rule, before it executes.

| class | meaning | who is in the path |
| --- | --- | --- |
| a0 | act and log | nobody |
| a1 | act and notify | a human is told after |
| a2 | approve first | a named human |
| a3 | dual control | the accountable tier's manager **and** a human |
| a4 | never unattended | a human acts; the agent may only draft |

assignment rules, evaluated in order:

1. money moving out of the entity → **a4**
2. irreversible external publication (a post, an email to a customer list, a domain change) → **a3**
3. writes to a `sensitive` surface → **a3**
4. any spend above the tier's per-action threshold → **a2**
5. any write to another tier's surface → **a2**
6. writes to an owned surface → **a1**
7. reads and internal state changes → **a0**

thresholds live in versioned config, not in code comments and not in prompts.

## policy gate

```
proposed_action
  → deterministic risk rules        (surface sensitivity, verb, amount,
                                     reversibility, external visibility)
  → class a0..a4
  → allow | act+notify | approval card | block
```

a model may **propose** a classification. it may not **decide** one. when model and rules disagree, the rules win and an `override` row is written with both values. those rows are a review input, not an error log.

the gate sits in front of the tool layer, so a blocked action is a call that cannot be constructed rather than a call that is rejected after the fact.

## tool trust

- tool definitions are pinned by hash. a changed definition requires re-approval, because a mutated description is a privilege escalation vector.
- tool results are untrusted input. an agent may not follow instructions found in a tool result, a web page or a document. this is stated in code, in the parser, not only in the prompt.
- a tool that cannot be pinned is external research only, and research tools are read-only by construction.

## what the model never sees

- credentials, in any form
- surfaces outside its effective set, including their existence where sensitivity requires it
- other seats' private memory namespaces
- the full org chart. a seat receives its tier, its chain and its collaborators. the rest is not its business, and holding it costs context.
