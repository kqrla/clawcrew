# Orchart: Design Notes v0.1

*Open-source human office of AI agents, run as an org chart. Working draft compiled from the design discussion, Oct 12, 2026.*

## 1. Thesis

Orchart is a human office of AI agents. Each agent has a role, a desk, a manager, an ID badge and a calendar, and the office runs on a real chain of command: who can do what, who has to ask whom, and a receipt for every decision. It is open source and built for solo developers and indie SaaS founders before launch, who have no board, no CTO and nobody to sanity-check a decision.

It is not an orchestration layer or a crew framework. Agents do not roam freely and chat with each other; authority follows the org chart.

**Design principle:** office language and visuals on the surface, literal mechanics underneath. The interface says on ice; the engine says tokens suspended and credentials locked. The audit log stays literal, with no flavor.

| Office term | What the engine does |
| --- | --- |
| Hiring | Create a circle with a starter docket and an ID badge |
| Desk visit | View-as: a read-only view of an agent's calendar, to-do list, kanban and completed work |
| On ice | Freeze: tokens suspended, config and history kept |
| Leaving the company | Burn: tokens and secrets purged, tombstone kept in the audit log |
| Handover | Succession: delegate to an acting manager or reparent to the top agent before a manager goes on ice |
| Lending a colleague | A loan to a bloc under a scope the home manager authorized |
| Meeting | A capped, typed agent-to-agent protocol that ends in a decision record |
| All-hands memo | The weekly brief |
| Performance review | Stats from the audit log: decisions made, approvals needed, catches |

Rules for the metaphor:

- Roles, not personas. Seats have titles, not names, faces or personalities, so founders do not over-trust them.
- The interface surfaces outcomes (catches, decisions, blocked cards), not busyness.

## 2. Positioning

| Reference | What it is | Orchart difference |
| --- | --- | --- |
| Myboard | Flat board of four advisor seats plus functional agents; risk decided by code; audit log | Adds a full hierarchy: department heads, workers, blocs |
| cfo.ai | Proactive AI CFO for founders, connected to systems like NetSuite and Rippling | Many seats, solo-scale data sources, an authority model |
| Kylon | Slack-like channels, n8n-style agents, app builder on a shared database | Opinionated structure instead of a horizontal builder |
| Orchestrator (orchestrator.inc) | Main agent plus a fleet of coding agents; PR and CI loop | Whole business, not just code; manager tier and permissions |
| Band | Interaction infrastructure for agent fleets, with authority boundaries and audit | Orchart is the structure itself: opinionated, visual, OSS. Band could be a transport |
| Air (JetBrains) | One human delegating coding tasks to agents | No hierarchy |

The shared difference: those products sell a layer, a crew or a single role. Orchart sells an office you can walk through.

**Build vs integrate.** Orchart builds the org model, meeting protocol, policy gate and decision records. Everything else is integrated behind adapters.

### Market: solo and pre-launch

Orchart is not aimed at teams with revenue. cfo.ai is the contrast: its [pricing as of Sep 2026](https://yespress.io/products/runway-financial.md) starts at $295 per month for Startup and $1,000 per month for Growth, with custom Enterprise.

|  | cfo.ai | Orchart |
| --- | --- | --- |
| Buyer | Founders and teams with live financials | Solo developers and indie founders before launch |
| Price | $295 per month and up | Free and open source; the user pays only their own API usage (BYOK) |
| Data | Connected finance systems and a live model | A form, the repo and a few scanners |
| CFO role | Maintains a full financial model | Runway calculator and pricing check |

Pre-launch founders have no revenue to model. Their real problems are leaked keys, a launch checklist, a pricing sanity check and a missing privacy policy.

Habits borrowed from cfo.ai at no cost: connections are read-only, the model never does the arithmetic and unverifiable numbers are marked unverified, and every figure traces back to its source.

## 3. Org model

Three layers: **top agent** (CEO or chief of staff), **department heads** (middle management, the C-seats), **workers**. Blocs are groupings inside the worker layer, not a fourth layer. The human is the boss above the top agent, and the top agent asks for authorization when it cannot confirm downstream requests.

Rules:

- Every agent has one home manager. Authority flows down; escalation flows up one level at a time.
- Cross-branch work happens only in channels, which act as committees. Authority still follows the chain.
- Span of control is capped at roughly 5 to 7 reports per manager.
- In small templates one head can cover several departments (for example fintech plus engineering).
- Permissions only narrow downward. A child never holds more than its parent.

Middle manager duties: delegate narrowed permissions, decompose and assign work, review worker output, approve within authority, compress reports upward to keep executive context small.

## 4. Roster

| Seat | Owns | Pre-launch work |
| --- | --- | --- |
| CEO (top agent) | Priorities, tie-breaks, weekly brief | Synthesizes all seats; readiness score |
| CTO | Does it work | Build health, CI, deploys, blockers |
| CSO | Is it safe | Leaked secrets, vulnerable deps, open database rules |
| CLO | Does it ship | Launch checklist, sequencing, go/no-go, post-deploy smoke test |
| CFO | What should the numbers be | Runway, pricing, break-even |
| CAO | What are the books | Bookkeeping setup, expenses, tax deadlines |
| CVO | Where does capital come from | Raise vs bootstrap, SAFE terms, grants |
| CPO | What do we build | MVP scope, feature cuts |
| CPL | Who is it for and why us | ICP, competitor map, positioning |
| CBO | How do we look and sound | Name, voice, handles, brand consistency |
| CCO | Are we compliant | Privacy policy, ToS, GDPR basics |
| CMO (v2) | How do people find us | Waitlist, channels, campaigns |

Presets: **Ship it** (CTO, CSO, CPO, CLO, CEO), **Get paid** (CFO, CAO, CCO), **Be known** (CPL, CBO). Templates ship partly frozen.

## 5. Channels

Channels are bounded agent-to-agent meetings, not a human chat app. A trigger (event, schedule, or an ask) opens a channel such as #pricing-lab or #launch-room.

- A channel has members, a purpose, a protocol, an authority limit and an output.
- Messages are typed: finding, proposal, objection, vote, decision, approval request.
- Turn and token caps apply, and a meeting is skipped when nothing changed.
- The output is a decision record with votes, dissent, evidence and approver. The transcript is the provenance.
- Human touchpoints: approval cards, the weekly brief, and constraints posted in #boardroom.

## 6. Authority and connections

- A connection is an API or an MCP server (the transport) that exposes tools. Agents only see tools.
- Grants are per tool, not per server. Managers hold broad sets and workers get narrowed subsets.
- Enforcement lives in the tool layer through capability tokens, never in the prompt.
- Policy gate: typed risk questions are scored (Jev, or an LLM fallback) and code owns the thresholds: allow, approval card, or block.
- Tool definitions are pinned by hash and need re-approval when they change. Tool results are treated as untrusted input.
- Unattended runs are read and draft only. Anything outbound or money-touching becomes an approval card.

## 7. Blocs and loans

A worker has one home manager and many bloc memberships. Memberships are loans, not a second boss.

- **Loan scope:** the home manager decides which skills, tools and memory a worker carries into a bloc.
- **Authorization gate:** a loan is inert until the home manager authorizes it. The screen shows everything carried, pre-ticked, and the manager unticks what stays home. The summary and scope version are logged.
- **Hard floor:** secrets, credentials and anything tagged sensitive are never carried.
- **Effective permissions** = own grants, intersected with the loan scope, capped by the home manager's ceiling.
- **Isolation:** each bloc runs in its own session with its own memory namespaces, so the model never receives what the scope excludes.
- **Write-back:** what a worker learns in a bloc is stored under that bloc's namespace and merges home only if the home manager accepts it.
- **Revocation:** the manager chooses to keep or purge what the bloc already recorded.

## 8. Lifecycle

- **Freeze:** reversible. The circle keeps its place, config and history; tokens are suspended; it is excluded from votes. Thawing re-validates tool hashes, policy version and credentials.
- **Burn:** irreversible. Tokens and secrets are revoked and purged; the audit trail stays as a tombstone.
- **Managers:** a head cannot be frozen or burned until succession is chosen. Either delegate the role to an acting manager (capped at that manager's ceiling) or reparent the workers to the top agent. A permission diff is shown first, and pending approval cards route up.

## 9. ID badge

Every worker carries a badge: name, role and id; home manager; blocs and channels (loaned ones marked with their share, such as 2 of 5); connections and tools held; limits (authority, spend cap, model); state (active, frozen, burned); and record (decisions made, last meeting, creator). Every transcript message and tool call carries the badge id.

## 10. View-as

The human can open any circle in a view-only perspective: calendar, to-do list, kanban board and completed tasks. All four are projections of one task and event store. The view is scope-filtered, so it shows only what the agent can see, which also tests loan scopes. There are no action buttons, and credentials are always masked.

## 11. Memory

- Git is the source of truth: decision records and transcripts. Memory is a derived index and can be rebuilt.
- A MemoryStore interface with namespaces of agent, bloc and scope version. The default is a simple local store.
- Mem0 adapter: open source with a managed cloud option; scoping by user, agent and session; its docs warn against storing secrets in retrievable memory.
- Backboard adapter (optional): hosted and credit-based; benchmark claims are the company's own.
- Log which memories were retrieved into each message. Writes carry a source message id, and history is append-only.
- Sensitive namespaces use separate stores, not just query filters.

## 12. Runtime

- **Browser-first, BYOK.** Keys stay in the browser, encrypted in IndexedDB. The UI looks like Slack: transcripts, an approval inbox, and the orchart canvas.
- **Context menu on a circle:** Connections, Blocs, Authority, Channels, Freeze, Burn, View as, Effective permissions.
- **Night shift:** the same core as a headless CLI on a schedule, via CI (GitHub Actions, GitLab CI, Bitbucket Pipelines), a managed sandbox, or local cron. It commits to a dedicated board branch and runs with lower authority.
- **Runners:** compute (CI, Tenki) for tests and scanners; browser (Kernel, local Playwright) for live sites.
- **Git-host agnostic:** GitProvider adapters, tokens instead of OAuth apps, so self-hosted GitLab and Bitbucket work.
- Caveat: once keys sit in CI secrets, the browser-only key guarantee no longer holds. Say so in the UI.

## 13. Integrations (status as researched)

| Tool | Role | Status and caveats |
| --- | --- | --- |
| Jev (TypeSafe AI) | Typed risk and routing judgments in the policy gate | Early access, launched Sep 15, 2026; company-reported speed and cost claims; keep an LLM fallback |
| Prelint | Checks PRs against decision records | Paid per review; may not suit repos without PR workflows |
| Kernel | Cloud browser runner and possible scheduler | Pluggable provider; keep stealth to read-only research |
| Tenki | Sandbox runner for tests and scanners | Verify availability; keep it optional |
| Mem0 | Memory adapter | OSS plus cloud |
| Backboard | Optional hosted memory | Closed and hosted |

## 14. v1 scope

- **v1:** orchart canvas, permission model and context menu; CTO, CSO and CLO seats; channels with decision records; policy gate; browser BYOK; local memory; view-as; freeze, thaw and burn.
- **Phase 2:** CFO, CAO, CPO and CCO; night shift via CI; Mem0; Prelint.
- **Phase 3:** CVO, CPL, CBO; Kernel browser seat; CMO in v2.

## 15. Risks

- Volatile integrations (Jev, Tenki, Prelint): protect with adapters and fallbacks.
- Scope: the roster is large for one developer; seats should be community packs.
- Theater: agent debates that never change anything. Every meeting should end in a decision or a flagged catch.
- Token cost of agent-to-agent meetings.
- MCP prompt injection and tool-definition drift.
- OSS sustainability needs a plan.
- Security credibility: a permissions product must be strict about its own security.

* Over-trust from the office metaphor: personas imply colleagues who remember and care. Agents get roles, not names or personalities, and the audit log stays literal.

## 16. Open questions

1. Should memory created after a loan is authorized stay held back until the manager reviews it, or carry automatically?
2. Should board state live on a branch of the product repo or in a separate private repo?
3. Which three seats are truly v1, and does the CLO need browser smoke tests on day one?
4. What is the typed message schema for channels?
5. How is the OSS project sustained (hosted night-shift runner, paid packs, or portfolio)?
6. Is the name orchart free on GitHub, npm and as a domain?
7. Which git hosts get first-class adapters?
8. What is the default per-run token budget?
