# corrections

what happens when a number was wrong. the interesting case is not "we fixed it", it is "we believed
it for three weeks".

## the four steps

1. **record the correction as a new reading.** never edit the old one. the wrong number is evidence
   about the instrument, and deleting it destroys the only record of how the org was misled.
2. **name the class.** stale cache, wrong join, denominator change, source that measured a proxy.
   a correction without a class is a patch, and patches recur.
3. **add the counter that would have caught it.** for the stale tracking ref, the counter was a
   witness in a different system. a correction that does not produce a counter will happen twice.
4. **check what was decided on it.** any phase advance, kill, or price change made on the wrong
   number is reopened. this is the expensive step and the one that actually matters.

## the worked example, from this repo

the primary gauge reported 1 commit on main. it was reading a stale local tracking ref; the remote
was at 25. the correction is a new reading (25), the class is `stale_cache`, the counter is the
crosscheck against the provider's own record, and the decision check found nothing had been ruled on
it yet. a week later it would have been a review verdict.

## the refusal

a correction may not be used to relitigate a settled decision it did not touch. the point is
accuracy, not a second vote.
