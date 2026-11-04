# finances: money in

Incoming money, revenue streams, and the invoices the org issues. The org may *observe* revenue freely and
may *claim* it only with a reference to a record it does not control.

## revenue streams

Each stream is a row with: what is sold, the processor, the settlement schedule, the fee structure, and
the objective it feeds. A stream without an objective is a hobby; a stream without a processor is a hope.

| stream | shape | settles | verified against |
| --- | --- | --- | --- |
| subscriptions | monthly, per seat | monthly, net of fees | processor payout reports |
| one-off products | per order | rolling | processor + shipping confirmations |
| services | per engagement, invoiced | net 14 | bank statement line |

## the reconciliation rule

Revenue the org reports about itself is worth nothing, because the org is the party with an incentive.
Every revenue number has two sources:

- **primary** — what the org's own database says it should have earned.
- **witness** — what the processor or the bank actually deposited.

These are computed separately and compared daily. A gap is a finding, and the three usual causes are
worth naming because they are indistinguishable from fraud at first glance:

1. a refund or chargeback the org recorded late (or not at all)
2. a fee change nobody noticed
3. revenue the org believes exists because its own metric counted a click rather than a settlement

Rule: **nothing is booked as revenue until the witness shows the money.** The primary number tracks the
intent; the witness tracks the fact; the objective is measured on the witness.

## invoices out

An invoice is an artifact with a number, a period, a line-item breakdown, and a reference to the
engagement or subscription that produced it. It is never regenerated silently: a corrected invoice is a
new number with a reason, because the customer's records and the org's records must be able to disagree in
public.

## what "done" means here

A month closes when every stream's primary and witness numbers agree to within the stated tolerance, every
disagreement has a written explanation, and the explanation is attached to the objective as evidence. A
month that closes because nobody looked is the failure mode this file exists to describe.
