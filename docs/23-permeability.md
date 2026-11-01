# 23 · permeability

a sandbox has two properties: what cannot cross (isolation), and what may cross (permeability). 17 argued for both. this is the full spec for the second one.

permeability is the only part of the authority model that a human will ever read as a sentence, so it has to be a declarative artifact, not code.

## 1 · a crossing is a declaration

one file, committed, diffable, reviewed like any other change to authority:

```yaml
# orchart.crossings.yaml
crossings:
  - id: brand-to-eng-launch
    from: brand.social
    to: eng.product
    kinds: [proposal, artifact_ref]
    max_per_hour: 30
    max_bytes: 5_000_000
    expires_at: 2026-12-01T00:00:00Z
    authorized_by: root
    reason: launch campaign assets, agreed 2026-10-28

  - id: finance-to-brand-invoices
    from: fin.ops
    to: brand.social
    kinds: [signal]
    max_per_hour: 4
    expires_at: 2027-02-01T00:00:00Z
    authorized_by: root
    reason: spend pacing signals during campaigns
```

a crossing that exists only in code is a bug. a crossing that exists only in a database row is a bug you cannot review.

## 2 · compile, then enforce

at startup the config is compiled into the credential graph:

```
crossing.id -> { from, to, kinds[], bucket(max_per_hour, burst), expires_at, authorized_by, config_hash }
```

the runtime never re-reads the yaml. the compiled set is what the relay checks, and `config_hash` is written into every relay event, so an audit can prove which version of the door was open when a message crossed it.

this is the same shape as the tier ceilings: authority is compiled to something enforceable, and the prose that produced it is retained for the humans.

## 3 · default deny, and how a match is chosen

no crossing, no message. there is no fallback, no ambient internal network, no "they are in the same company".

when more than one crossing matches `(from, to, kind)`:

1. the most specific `from`/`to` pair wins (exact over wildcard, if wildcards are ever allowed),
2. then the narrower `kinds` set,
3. never the union of two crossings.

union is how permission systems rot. if two doors both match, the narrower one governs, and a message that fits neither is rejected rather than combined into permission.

## 4 · asymmetry is the default

`brand.social -> eng.product` grants nothing in reverse. the reverse requires its own entry, its own rate, and its own justification.

this is not pedantry. a team that can push assets into another team's surface is not thereby entitled to read that team's work in progress. in practice the reverse door is usually narrower and expires sooner, and writing it down is what makes that obvious.

## 5 · rates are continuous, not windows

a token bucket, not a fixed window.

```
burst = max(1, ceil(max_per_hour / 6))
refill = max_per_hour / 3600 per second, continuous
```

fixed windows let a sender spend the whole allowance in the last second of one window and the first second of the next, which is twice the limit at exactly the moment you were protecting against. buckets also give a useful number: remaining tokens, which is what a sender needs to pace itself.

rejections are free to record and expensive to ignore: `rate_limited` is counted per crossing.

## 6 · expiry is mandatory

every crossing has an `expires_at`. no permanent doors.

a door without an end date is a door nobody re-reads. the compile step rejects a crossing without an expiry, and renewal is a diff with a new reason, which is exactly the review you wanted.

## 7 · revocation

revocation is immediate and takes effect on the next check. what happens to envelopes already leased is a per-crossing choice:

| revoke_mode | behaviour | use for |
| --- | --- | --- |
| `drain` | leased envelopes finish, queued ones are dead-lettered | routine closure |
| `cut` | leased and queued are dead-lettered immediately | a suspected leak |

the event log records which mode applied, because "we revoked at 14:02 and two more messages arrived" is a question that will be asked.

## 8 · no inheritance

a crossing at `brand` does **not** grant `brand.social -> eng.product`. crossings are declared at the tier pair that uses them.

inheritance feels efficient and produces the worst class of hole: a door opened for one team that silently serves four, discovered a month later in an audit. the compile step can warn about a child needing a door its parent has, but it must not grant it.

## 9 · the two exclusions

- **secrets never cross.** a crossing carries references. `artifact://` may point at a blob; nothing may point at a secret store path.
- **money never crosses.** a crossing cannot authorize spend. spend is a grant (03) and a policy class (a2..a4); a relayed message may *request* a payment and may never *cause* one.

## 10 · what the numbers are for

per crossing, weekly:

| metric | reading |
| --- | --- |
| `rejected_no_crossing` | unmet demand. a team keeps trying to reach another and there is no door. this is the signal to open one, or to fix the org chart instead |
| `rejected_rate_limited` | the door is too narrow. sustained means widen or split |
| `bytes_out` | a door moving 40MB/hour is a data exfiltration path with a friendly name |
| `receipt_missing` | a one-way door nobody answers. close it |
| `unused_30d` | retire it |

a crossing at 0% usage for 30 days is retired at the monthly re-charter. doors accumulate exactly like objectives do, and for the same reason: nobody wants to be the one who removes something.

## 11 · review is the product

the requirement that permissions be reviewable as config diffs is not a documentation preference. it is the only mechanism by which a human can audit a month of autonomy in ten minutes.

so the monthly artifact is a **crossing diff**: doors added, removed, widened, narrowed, expired, and the three unusual readings (unmet demand, saturation, silence). a diff a person can read is worth more than a log they cannot.

## 12 · what permeability is not

- not a firewall. it does not protect the network; it constrains the org.
- not a routing table. it says whether a message may exist, not where it goes.
- not a substitute for secondment (04). a crossing moves objects; a secondment moves a person and their authority.
- not a trust score. there is no "trusted tier". there is a named door with an expiry and a reason.
