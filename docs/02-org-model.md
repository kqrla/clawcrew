# 02 · org model

## one entity

there is no department type, no team type and no seat type in the engine. there is a **circle**, and there is a **seat** inside it. depth is unbounded.

"department", "division", "bloc", "team", "pod" and "squad" are labels a human puts on a circle for display. the engine reads them only to pick an icon. nothing in authority, budgeting or scheduling depends on the label.

this is deliberate. a model with fixed tiers cannot express a department containing blocs containing teams, and it cannot survive a reorganization, which is the normal state of a young company.

## circle

```yaml
circle:
  id: eng.platform.infra          # dotted path, stable, never reused
  parent: eng.platform            # exactly one, or null for the root
  label: team                     # display only
  manager: seat.infra-lead        # a seat, or null for a circle with no members
  members:                        # seats and child circles, mixed
    - seat.ci
    - seat.secrets
    - circle.eng.platform.infra.oncall
  surfaces:                       # owned, not merely used
    - repo:infra/*
    - cloud:prod-us-east
    - secret:deploy-keys
  ceiling:                        # the most any descendant may hold
    tools: [git, ci.run, cloud.read, cloud.deploy.staging]
    spend_usd_per_day: 40
  budget:
    tokens_per_day: 2000000
    usd_per_day: 40
    wall_clock_per_shift: 4h
    concurrent_tasks: 3
  objectives: [obj.uptime, obj.deploy-time]
  cadence:
    shift_cron: "0 */6 * * *"
    lease_ttl: 90m
    heartbeat: 15m
  state: active                   # active | frozen | burned
```

## seat

```yaml
seat:
  id: seat.infra-lead
  title: platform lead            # a role title, never a person's name
  home_circle: eng.platform.infra # exactly one
  grants:
    tools: [git.write, ci.run, cloud.deploy.staging]
    spend_usd_per_day: 10
  model: {provider: anthropic, model_id: ..., fallback: ...}
  badge: badge.7f3a
```

a seat does not own surfaces. the circle does. a seat acts on behalf of its circle, which is why moving a seat between circles changes what it can do without editing the seat.

## surface

```yaml
surface:
  id: repo:infra/*
  kind: repo_path        # repo_path | db_table | endpoint | domain | ad_account
                         # | bank_account | document | queue | secret_ref
  owner_circle: eng.platform.infra
  sensitivity: internal  # public | internal | sensitive
  approval_class: a1     # see 03
  partition_key: path    # optional, for parallel work division
```

## invariants

these are write-time validations, not documentation.

1. **single parent.** a circle has exactly one parent.
2. **acyclic.** no circle is its own ancestor.
3. **one home.** a seat belongs to exactly one home circle. it may be seconded elsewhere; it may not be homed twice.
4. **one owner.** a surface has exactly one owning circle.
5. **narrowing.** `child.ceiling ⊆ parent.ceiling` on every write.
6. **no self-management.** a seat cannot be the manager of a circle it is contained by, at any depth.
7. **burned means empty.** a burned circle holds no grants, no leases, no secrets, and cannot be a secondment host.

invariant 5 is the one that produces the starvation problem in deep trees. the answer is elevation grants, not a weaker invariant. see [03-authority](03-authority.md).

## depth

depth is a cost paid for isolation, not a status symbol.

each added level buys a narrower blast radius and a smaller context. it costs a delegation hop, a review hop, a budget split and a manager whose context must be large enough to arbitrate. three levels covers most companies. five is usually a sign that someone modeled the human org instead of the work.

guidance:

- **2 levels** (root, leaves): fine for one product surface, under ~7 seats.
- **3 levels**: the default. root, function, team.
- **4+ levels**: justified only when a subtree has genuinely different credential boundaries, not merely different subject matter.

if two circles have the same ceiling, the same surfaces and the same objectives, they are one circle with a bigger span.

## what a manager does

three jobs, and no others:

1. **decompose.** turn a parent objective into child objectives, each with a metric and an executable source.
2. **arbitrate.** resolve contention over shared surfaces and competing objectives.
3. **handle exceptions.** decide the cases a child cannot decide, including escalation to a human.

a manager that only routes work is a lossy relay and a single point of failure. the test is one question: *does this node change a decision, or does it only move one?* if it only moves one, delete the node and let the runtime route.

## span of control

not a fixed number. the limit is how much state a manager must hold to arbitrate: its objectives, its surface map, its open exceptions and its children's current status.

practical range is five to nine children. above that, either add a level or narrow the children's surfaces.

"one manager covers two departments" is not a feature. it means the surface boundaries are wrong or a level is missing, and it will show up later as a manager approving work it cannot evaluate.

## instantiation

a four-level org, which is the deepest this spec recommends:

```
root (ceo)
├── brand                      dept
│   ├── social                 team
│   │   ├── content            seat
│   │   ├── community          seat
│   │   └── design             seat   ← seconded to eng.launch
│   └── system                 team
│       ├── naming             seat
│       └── assets             seat
└── fintech-eng                dept
    ├── finance-ops            team
    │   ├── billing            seat   ← owns billing surface
    │   ├── recon              seat
    │   └── analyst            seat   ← seconded to brand.pricing
    ├── product-eng            team
    │   ├── backend            seat
    │   ├── frontend           seat
    │   └── qa                 seat
    └── platform               team
        ├── infra              seat
        └── security           seat
```

note that `design` sits under `social` but works for `eng.launch`. its authority to act there comes from a secondment, and the deliverable is owned by the launch team's manager. the home manager owns the seat's standing permissions and conduct, not the launch outcome. that is the whole matrix solution; see [04-secondments](04-secondments.md).

## circles that contain only circles

allowed, and sometimes correct: a division holding three teams and no direct workers. the manager of such a circle is a genuine manager under the cost test, because its job is to allocate budget and arbitrate between teams.

a circle containing only circles and no objectives is not allowed. it is a folder.

## reorganization

moving a circle changes the effective permissions of every seat underneath it, in one write. this is the point of computing authority by intersection rather than storing it per seat.

a reparent must:

- show a permission diff for every affected seat before it applies
- revalidate every lease held inside the moved subtree
- route every pending approval card to the new chain
- log one event with the diff, not one event per seat
