# vendoring

how something becomes part of a build, and the four things recorded when it does.

## the four records

1. **version, pinned exactly.** not a range. a range means two renders a month apart can differ and
   nobody knows which one the customer got.
2. **hash of the artifact.** the tarball, the container, the binary. a version string is a promise;
   a hash is a fact.
3. **licence, as read.** not as assumed. the licence file is copied next to the record, because the
   one that matters is the one that was true on the day it entered the build.
4. **the check that proves it works.** one command, expected output, run in CI. a vendored tool
   without a check is a vendored tool that will be broken by an unrelated upgrade on a Sunday.

## the determinism ledger

anything that renders has a ledger entry: tool version, inputs, output hash. a render that does not
match the ledger is a finding, not a warning, because the product's promise is that the same recipe
gives the same object in a year.

## what doesn't get vendored

- anything that phones home during a build
- anything whose licence changes on the vendor's schedule (see: every licence that is not a licence)
- anything a human has to install by hand on a machine nobody looked at

## exit

a tool is removed by pinning it out, not by deleting the record. the removal and its reason stay
readable, so the org can answer "why did this stop working in March" without archaeology.
