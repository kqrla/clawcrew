# 07 · provenance and audit

the test of provenance is not "can the system explain what it did". every system can generate an explanation. the test is: **can someone who was not there, and who does not trust the system, reconstruct what happened from evidence that the system could not have written after the fact.**

this reframes the whole problem. an agent's summary of its own work is a claim, and claims are the thing being audited. the record has to be built out of things the agent could not author: what the store observed, what the credential was, what the artifact hashes to.

## one record

the common architecture has two trails, a message log and an audit log, and they are joined by an id that is sometimes missing. the result is an audit that cannot answer the question people actually ask, which is "who told whom to do this".

so the design joins them at the schema level: **a message and its effect are the same row**, or adjacent rows with a guaranteed key. the audit is not a separate narrative written by an observer, it is a view over the record that the work already produces. this is why [06-a2a](../06-a2a/readme.md) insists the envelope is small: a small envelope is one that can be an audit row.

## what has to be attributable

four things, and each has a distinct failure if it is missing:

**attribution.** which seat, in which tier, at what time. not which model, not which process. a model instance is an implementation detail that gets replaced mid-flight; a seat is the thing that owed something.

**authority.** what the seat held at that moment, computed from the chain, not what it was designed to hold. permissions change during a month and the record has to show the version in force.

**evidence.** the artifact, by content hash. this is the only part that cannot be narrated, because a hash either matches the bytes or it does not.

**consequence.** what changed in the world: which surface, which row, which deployment. a record of intentions is not an audit.

## legible to a non-ai third party

an audit that only an agent can read is not an audit, it is a memory. the requirement is that a person with no access to the models can answer three questions from the record alone:

1. what was this organization trying to achieve, and what number did it have to move?
2. what did it do, in order, and who authorized each step?
3. did the number move, measured independently of anyone's report?

everything in the record is arranged to answer those three, and anything that does not help is not in the record. this is the discipline that keeps the log from becoming a transcript: a transcript answers "what was said", which is the least useful question and the most voluminous.

## the auditor is not a participant

if the auditor runs with the workers' credentials, the auditor is a participant and the audit is a rubber stamp. so the auditor is a separate identity with read-only access, on a slow clock, checking the record against the primary sources the record claims to have consulted.

**slow clock** is the load-bearing part. an auditor on the same schedule as the workers sees the same partial state and repeats the same mistakes. running weekly means the auditor reads conclusions rather than activity, which is a different and much harder test: two months of self-consistent reports with no movement in the metric is a pattern visible only from above.

three checks in particular:

- **claims against sources.** the metric in the record versus the number recomputed from its declared source. this catches the most common failure, which is an org that is measuring its own summary.
- **coverage against the partition map.** partitions reported as done versus partitions that exist.
- **authority against the chain.** every action taken under a permission the seat actually held, at that time.

## tamper evidence without a blockchain

the record lives in a database, and a database admin can edit history. the answer is not a distributed ledger, it is **anchoring**: on a fixed schedule, a hash over the record's content is published somewhere the org does not control, with the hash of the previous anchor included.

this buys one property cheaply: any edit to the past breaks the chain of anchors, and the break is detectable by anyone holding an earlier anchor. it does not prevent the edit, it makes it impossible to make quietly. that is the correct threat model here, because the adversary being defended against is the organization itself, drifting into a state where its own history is convenient.

the anchor is also the most skippable step in the whole design, which is why it is worth naming as such. nothing fails visibly when anchoring is off. the system simply becomes unable to prove anything that happened more than one backup ago.

## what provenance is not

not observability. traces tell you why something is slow. this tells you whether it happened and whether it was allowed.

not a summary. a summary is the artifact under audit.

not infallible. it records what the store saw. an agent that lies in a message has lied in the record, permanently and legibly, which is a better outcome than the lie being paraphrased into a report.

## what breaks without this

without a joined record, the org can prove what it concluded and not what it was told. without transport identity, attribution is hearsay. without a metric recomputed from source, completion is a claim. without anchoring, the past is editable and therefore untrue. and without an auditor on a different clock with different credentials, all of it is self-reported data with better formatting.

## what we do not claim

that this makes the org trustworthy. it makes it **checkable**, which is a lower bar and the only one available. a record can be complete and still describe a month of expensive work aimed at the wrong objective. the objective's soundness is [08-prioritization](../08-prioritization/readme.md)'s problem, and no audit trail has ever caught a bad goal.
