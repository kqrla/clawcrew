# 24 · runtime substrates

the engine decides *what* may happen. these services decide *where* it happens. none of them may hold authority: a substrate that can grant capability becomes part of the org chart whether you drew it there or not.

## the slots

five slots, defined by `docs/12-runtime.md`, `docs/17`, `docs/21` and `docs/22`.

| slot | what it must do | candidate | verdict |
| --- | --- | --- | --- |
| runner | execute a shift headlessly: tests, scans, builds, with lower authority than day shift | celesto | adopt for ci-shaped work |
| machine | one long-lived machine per seat, that survives a pause and resumes mid-task | superserve | adopt where a seat needs a real computer |
| computer use | drive a browser and a desktop as an agent | cua.ai / celesto | capability only, never authority |
| serialisation | grant a lease without two holders winning | terse | promising, do not adopt yet |
| convergence | fork work across agents, then join | acyclic sdk | adopt as an executor under the barrier, not instead of it |

## celesto

drop-in github actions runner, roughly ninety percent cheaper per minute, plus cloud computers that boot in about two seconds and can be driven by cli or ssh. microVM core is apache-2.0 and self-hostable.

fits the night shift exactly, because the night shift is already defined as "the same core, headless, on a schedule, with lower authority". the cheap runner is what makes an hourly tick affordable rather than a rounding error.

## superserve

microVMs for long-running agents, with pause, resume and fork, nvme persistence, egress rules and a credential broker that keeps keys outside the machine. sdk is apache-2.0.

two properties matter here. **resume** is how a seat survives a lease gap without losing its working set, which is what a month-long run actually needs. **fork** is the physical version of the exploration quota: snapshot a machine, try a different approach in the branch, discard it. it is also the honest way to run a second attempt without disturbing the first.

the credential broker is the part to verify before trusting it, because "agent never sees the key" is a claim about the boundary we have been calling authority. if the broker will hand a token to any process in the machine, it is egress control, not authority.

## terse

a durable actor is a single-threaded server with its own sqlite. mit, self-hostable, an explicit alternative to cloudflare durable objects.

this is the most tempting and the most dangerous of the five. **tempting** because single-threaded execution is the cleanest possible answer to lease granting: one actor per tier, requests serialised, no partial unique index and no `for update` needed. **dangerous** because it puts coordination state in sqlite on the actor, which is a second record next to postgres, and `docs/16` is explicit that there is one record.

verdict for now: not adopted. it solves a problem postgres already solves, at the cost of the audit.

## acyclic

open sdk and harness for recursive fork-join agent swarms: fan work out across sandboxes, merge what comes back. rust harness, typescript packages, protobuf interfaces, conformance suites, apache-2.0.

this is the only candidate that names the thing `docs/17` names. fork-join with a merge step *is* the convergence barrier. the difference is where the truth lives: acyclic merges outputs, `docs/17` requires an exhaustive partition map and refuses closure without a parent metric. adopt the harness to execute partitions. keep the barrier, because the barrier is what stops a merge from becoming an average.

## agentrelay

not evaluated. if it is a store-and-forward relay for agent messages it overlaps `docs/22` and the question is whether it gives an ack that means "persisted", not "received". if it does not, `docs/22` already covers it.

## what none of them decide

whether a seat may act, what an objective is, whether a task is done, which door a message crossed. put any of those in a vendor's control plane and the audit becomes a screenshot.
