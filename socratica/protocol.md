# socratica

a standing arrangement for two or more seats with genuinely different interests to argue a decision
from their own position, and produce a memo that the deciding tier reads before acting.

**status: not vetoable, and not binding.** a debate can inform a decision, sharpen it, or kill it by
argument. it cannot block one, and it cannot make one. the difference matters, because a debate that
could block would be a veto dressed as dialogue, and a debate that could decide would let the most
articulate seat run the org.

## why this exists

scope management is not drift. drift is a word for losing the plot. the actual daily question is
where the next unit of effort goes:

- **breadth**: another slice, another surface, another feature. the org looks bigger.
- **depth**: the same surface, measurably better. the org looks the same and costs less.
- **thin**: breadth without depth. the failure mode, and the one that looks like progress.

those three trade against each other, and which one is right depends on who you ask. a design seat
wants breadth because a catalog with three shirts is a catalog nobody returns to. a financials seat
wants depth because every surface costs support and every surface dilutes the unit economics. an
operations seat wants nothing new until the current thing stops paging. none of them is wrong, and a
single-agent decision quietly picks whichever voice the prompt weighted last.

`socratica` exists so the disagreement is *recorded* rather than averaged: what each seat held, what
would change its mind, and what survived.

## the rules

1. **every position states a falsifier**: the observation that would make its holder drop it. a
   position with no falsifier is a preference and is labelled as one, not debated.
2. **no rebuttal without a steelman**: a seat answering another seat must first state the strongest
   version of what it is answering. this is the only rule that costs real work, and it is the one
   that stops two monologues from being called a conversation.
3. **no voting, no averaging.** a 2-1 split is not a conclusion. it is a split, and it goes in the
   memo as one.
4. **dissent is preserved verbatim** in the memo. the deciding tier reads the losing argument in the
   words of the seat that made it, not paraphrased by the winner.
5. **the memo has no authority field it can fill in.** it is advisory; the deciding tier's gate is the
   only thing that acts.
6. **a claim keeps its provenance** through the debate. a fact asserted in round one and rebutted in
   round three is still a fact with a reference, or it is not a fact.

## what the memo contains

| field | why |
| --- | --- |
| question | one sentence, the decision actually being made |
| positions | each seat, its stance, its claims, its falsifier |
| steelmen | who answered whom, and the strongest version of the case they answered |
| survived | the claims nobody rebutted with evidence |
| split | the claims still contested, with both sides intact |
| falsifiers | the test that would settle each surviving position, as a command where possible |
| recommendation | optional, one seat's view, labelled as one seat's view |
| authority | always `advisory` |

## what would make this theatre

a debate whose memo nobody reads before the gate. so the wiring is: the deciding tier's decision
record cites a memo id, and `socratica` is refused as an input to a gate. the gate reads evidence; the
memo tells the seat which evidence to go and get. a memo that turns into a gate would be exactly the
veto this document refuses.

## the failure this is designed to catch

a debate where every participant agrees. three seats agreeing in three different vocabularies is
usually one seat's framing accepted by two others, and it is the least valuable memo the system can
produce. `socratica` marks a unanimous debate as `unananimous_by_framing` unless at least one seat's
claims carry distinct evidence references, because independent agreement is the only kind worth
having.
