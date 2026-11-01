# 04 · secondments

## the problem this solves

a real org is a matrix. the drawing that started this project has seven execution seats and four blocs, and four of the seven seats sit in two blocs at once. a tree model says each of those seats has one boss and the overlap is decoration. a matrix model says each has two bosses and nobody can approve anything. both are wrong.

the resolution is to stop asking one relationship to carry two different things.

- **authority** (whose credentials, whose budget, who approves) is single-parent and lives in the tree.
- **accountability** (who owns this outcome) attaches to the tier that commissioned the work.

a secondment is the record that joins them.

## record

```yaml
secondment:
  id: sec.2f81
  seat: seat.design
  home_tier: brand.social
  host_tier: eng.launch
  deliverable: "launch page assets, 12 screens, by 2026-11-12"
  scope:
    tools: [asset.write, git.read]
    spend_usd: 0
  requested_by: seat.launch-lead      # the host asks
  authorized_by: seat.brand-director  # the home decides
  issued_at: 2026-10-31T12:00:00Z
  expires_at: 2026-11-14T00:00:00Z
  state: active                       # requested | active | expired | revoked | rejected
  deliverable_owner: seat.launch-lead # accountability
```

## who decides what

v0.1 said the home manager decides the scope. that is half right and it breaks the flow.

- **the host requests.** it knows what the deliverable needs.
- **the home authorizes, denies or narrows.** it owns the seat's standing permissions and cannot be surprised by what its own seat carries.
- **the host's manager owns the deliverable.** success and failure are theirs.
- **the home's manager owns conduct and standing grants.** whether this seat keeps `ad.publish` tomorrow is not the host's call.

the distinction matters at review time. if the launch page ships late, that is the host's finding. if the designer posted from the company account during the secondment, that is the home's finding.

## the request stays visible

a denied or narrowed request is not deleted. it stays as unmet demand, visible to both chains.

this is the single most useful management signal the system produces. without it, "we are under-resourced" and "we were refused" look identical from above, and the org will keep re-requesting the same thing through different seats.

## inert until authorized

a secondment in `requested` state grants nothing. it is not a draft permission, not a soft launch, not an implicit yes. the screen shows everything that would be carried, pre-ticked, and the authorizer unticks what stays home.

the authorization event logs:

- the scope diff (what is added, what is removed)
- the scope version
- who authorized, when, and against which deliverable
- an expiry

## effective permissions inside a host

```
effective_in_host(seat) = ceiling(host)
                        ∩ scope(secondment)
                        ∩ own_grants(seat)
```

note there is no home ceiling term, because the home ceiling already bounds `own_grants`. the host's ceiling is the new constraint.

consequences:

- the seat cannot exceed the host's authority by being seconded. it can only be narrowed.
- the seat does not gain the host's other tools.
- spend inside the host draws on the host's budget. a secondment that authorizes spend is a separate, explicit line, never an inference.

## hard floor

secrets, credentials and anything tagged `sensitive` are never carried. not narrowed, not scoped, not for an hour. the seconded seat operates through the host's own credential references, or it does not operate on that surface.

this is the rule that makes secondments safe to hand out liberally. the worst case of a bad secondment is unwanted work product, not a leaked key.

## isolation

each host runs in its own session with its own memory namespaces. the model physically does not receive what the scope excludes, which is stronger than instructing it not to look.

## write-back

what the seat learns in the host is stored under the host's namespace.

merging back to the home tier is an explicit acceptance, not a default:

- the home manager sees a summary of what would merge, with source message ids
- accepted material is written with provenance
- rejected material stays in the host namespace until it expires

this prevents a secondment from becoming a covert channel for context, and it prevents one team's conventions from silently contaminating another's.

## revocation

on revoke or expiry, the authorizer chooses one of two dispositions for the host namespace:

- **keep**: the host keeps the artifacts it produced, the seat loses access
- **purge**: the host's derived memory is destroyed, artifacts referenced by the deliverable are retained

the choice and its reason are logged. default is keep, because destroying work product is the more expensive mistake.

## limits

- a seat may hold at most **two** active secondments. three is a sign the seat is a shared service that should be a tier.
- a secondment may not exceed 90 days without re-authorization.
- a secondment to an ancestor tier requires the ancestor's manager to authorize, not the immediate home manager.
- a secondment is not a promotion, a raise, or a change of home. if a seat spends most of its hours in the host for two consecutive cycles, the correct action is a transfer, and the monthly review should say so.

## hours accounting

every secondment logs hours spent, derived from leases rather than self-reported. the monthly review surfaces:

- seats with more than 50% of hours outside their home tier (misplaced seats)
- hosts that depend on seconded capacity for more than one cycle (hidden headcount)
- repeated denied requests for the same scope (structural starvation)
