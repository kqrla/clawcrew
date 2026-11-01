# meenible

a dress-up game where the doll is parametric OpenSCAD, so one configuration is simultaneously
the preview, the STL a user downloads, and the file a print house ships.

rooms are part catalogs. pose is a rig. the exit is either an STL or an order.

---

## 0 · why this workflow is cheaper than a generation pipeline

the obvious build is: user describes a figure, a 3D generation API (Tripo, Meshy, Trellis and
friends) returns a mesh. it is also the expensive one, and the cost scales with the two things
this product does most.

| | generation API per doll | parametric catalog |
| --- | --- | --- |
| cost driver | **every generation, every retry, every variation** | **catalog size** — authored once, amortised over all users |
| marginal cost of a slider drag | one API call | a render of cached modules, milliseconds of CPU |
| the 10,000th user picking the same hoodie | paid again | cache hit on a content hash |
| output | unrigged, usually non-manifold, unprintable | every part authored, tested, licensed, print-oriented |
| repair | a second model, or a human | the harness, mechanically |
| a reprint a year later | cannot be reproduced | same recipe + same kit version = same mesh |
| legal posture | whatever the model absorbed | every part has a declared licence record |

the asymmetry that decides it: **dress-up games are fun in proportion to how much people iterate.**
a generation pipeline charges per iteration, so the most engaging version of your product is the
most expensive one to run. a catalog charges once for a part and then nothing, so engagement is
free and the only thing that grows is authoring — which is where the moat is anyway.

the model still does something, and it is the cheap thing: turning intent into a *selection*.
"a cyberpunk courier with a drone" becomes a recipe of existing parts and numbers. that is a few
hundred tokens, not a mesh, and two users asking for the same thing get the same cached answer.

## 1 · the decision everything else follows from

**the model never writes geometry. it writes a recipe.**

this is the same move facadia makes with SVG: the substrate is a portable, committed,
human-authored rule table, the model emits a bounded op, and a deterministic checker decides
whether the result is legal. swap the substrate and the trick holds.

```
catalog (human-authored .scad, tested, versioned, hashed)
        +
recipe  (json, ~2 kb, schema-validated, the only thing AI may emit)
        +
openscad build (pinned, one exact version)
        =
artifact (stl, content-addressed)
```

"eliminate hallucinated ai code" is not a promise you keep with a better prompt. it is a
promise you keep by removing code from the model's output surface. once the model emits
`{"part":"hoodie","params":{"hood_len":0.62}}` instead of `module hoodie() {...}`, the worst
case stops being *broken geometry* and becomes *invalid selection*, which is detectable in
microseconds and repairable, because the error names the vocabulary the answer had to come
from.

| what the failure used to be | what it is now |
| --- | --- |
| calls a function that does not exist | names a part that does not exist, from a closed list |
| silently produces a non-manifold mesh | schema rejects before a renderer is ever invoked |
| output differs run to run | recipe + kit + build version hash to one stl |
| "looks fine" but is not printable | mesh gate and printability gate, both mechanical |
| unfixable without a human reading the code | structured error, model emits a one-step recipe diff |

## 2 · determinism is the feature, not a hygiene detail

if the same recipe renders to a different mesh tomorrow, nothing downstream works: not the
cache, not sharing a link, not reprinting something someone bought last month, not proving
what you shipped.

so the build is pinned and hostile to the things that make CAD non-repeatable:

- **one exact openscad build**, in the render worker, in the wasm preview, checked at boot
  against a recorded version string. recent builds ship the Manifold CSG backend and are much
  faster, but they still emit non-manifold output in edge cases (open upstream issues), so the
  mesh gate below is not optional decoration.
- **banned from catalog code**: `rands()` (the only real source of run-to-run difference),
  `import()` of anything remote, `surface()`, and `text()` with a system font. engraving uses a
  committed stroke-path font, because "system font" is both a determinism bug and a licensing
  bug waiting to be served papers.
- **`$fn/$fa/$fs` fixed by the harness**, never by the recipe: a user must not be able to change
  tessellation and torch the cache.
- **parameters quantised to 0.01 mm** at the schema boundary. floats that differ in the 9th
  decimal produce different triangle counts and different hashes for optically identical dolls.
- **units are millimetres, y-up is screen, z-up is print**, converted at exactly one place.

`artifact_id = sha256(kit_version ‖ recipe ‖ openscad_version ‖ render_flags)`.

that id is the cache key, the share link, the order line, and the audit record. one id, four
jobs.

## 3 · the harness, in the order it runs

cheap gates first, so a bad recipe costs microseconds and a bad mesh costs one render.

| gate | question | cost |
| --- | --- | --- |
| 1 schema | is this a valid recipe for this kit version? | µs |
| 2 vocabulary | do the parts exist, and in the right room? | µs |
| 3 fit | does each part declare a mount the body exposes? | µs |
| 4 range | are params inside the declared min/max/step? | µs |
| 5 compose | do exclusive parts collide (two hats, incompatible sleeves)? | ms |
| 6 render | does openscad exit 0 and emit a mesh? | 0.5–20 s |
| 7 mesh integrity | manifold, non-degenerate, closed, sane volume and bbox? | ms |
| 8 printability | min wall, overhang angle, whether supports are needed, base contact | s |
| 9 pose | joint limits, self-intersection, centre of mass over the plinth | s |
| 10 budget | triangle count and file size for web preview | µs |

gates 1–5 run in the browser on every slider drag. 6–10 run server-side on commit, and 8–9 run
again per material and printer profile, because "printable" is a property of a pair, not a
file.

every failure returns the same shape, because this is what the model repairs against:

```json
{ "gate": "fit", "code": "mount_missing",
  "detail": { "part": "hoodie", "needs": "torso.upper", "body": "pop.v3 exposes [neck, torso.mid, hands]" },
  "fixable_by": ["swap_part", "swap_body"],
  "candidates": ["tee", "crop_hoodie", "jacket"] }
```

`harness/stlcheck.py` in this folder is the smallest slice of gate 7, written to be runnable
right now with no CAD toolchain: it parses STL and answers *closed? manifold? degenerate?
volume? bbox?* it is the shape every later gate should take.

## 4 · the rooms

a room is a folder of parts plus a parameter schema. rooms are independent, which is what makes
"separate outfit rooms" cheap: adding one is a catalogue change, not a geometry rewrite.

| room | contents | notes |
| --- | --- | --- |
| **body** | the base figure: proportions, head size ratio, hand style | the silhouette is a *proportion system*, deliberately not a replica of any one toy line's trade dress |
| **face** | eyes, brows, mouth | **decals, not geometry.** paint is what makes this read as a collectible; extruding every eyelash is how you ship an ugly doll and a 400k-triangle file |
| **hair** | caps, fringes, long styles | the one place overhangs bite hardest; every hair part ships with a print orientation |
| **outfit × n** | tops, bottoms, outerwear, shoes, hats, held props | one room per category; each part declares mounts, exclusives, and a colour slot |
| **pose** | shoulder / elbow / hip / knee / neck angles | curated library of print-validated poses, plus free posing for preview and stl export |
| **plinth** | base, name plate, engraving | the flat thing the printer needs; engraving via stroke font |

two hard rules that save months:

**one colour slot per part, one part per colour.** a part is printed in one filament. multicolour
inside a single part is a different product with a different price, and mixing the two in one
data model is how a pricing engine becomes a lie.

**every part carries its own print orientation.** a mesh that is manifold can still need supports
under its own chin. the orientation travels with the part, because only the part author knows it.

## 5 · the three things that will actually kill this

everything above is engineering, and engineering is the part you can do. these are the parts
that decide whether it exists.

### 5.0 the market, before the mechanics

collector figurine buyers are not toy buyers. the same person who will not pay $20 for a plastic
figure pays $60–$150 for a made-to-order one, and the things they are paying for are exactly the
things a parametric catalog can do better than a toy factory: their own character, their own pose,
a size they choose, an edition of one. that is why the project's declared price is **$89** against
a **$45** cost ceiling, rather than the $22 a mass-market figure would have to hit.

the consequence for every gate below: this business fails on **cost and legality**, not on
whether people want it. there is no version of this that works by being cheap for the buyer.

### 5.1 colour economics

a collectible reads as a collectible because of paint. printing is not painting, and the gap is
where the unit economics live:

| path | colours | cost/quality | verdict |
| --- | --- | --- | --- |
| FDM, one part per colour | ~6–8 per figure | cheap, visible layer lines | the default cheap tier. **the product is a snap-fit kit**, not a painted figure |
| FDM + multicolour head (AMS-type) | 4–8, with purge waste | mid, slower, waste per swap | good for the face/head only, where colour matters most |
| full colour (PolyJet / binder jet) | photographic | boutique pricing, fragile, rough surface | **the collector tier.** at $89 a figure this is affordable; at $20 it never was |

so there are two products, not one: a **snap-fit kit printed in a farm** for the $30–40 end, and a
**full-colour figure** for the collector tier where the $89 price makes the quote survivable. both
are the same recipe; only the material and the price change, which is the point of separating
geometry from manufacturing.

and the check is not a spreadsheet: `unit_margin` in the project's assemble gate compares the
price to a quote from the actual print house, and refuses launch when the difference is a habit
rather than a business.

### 5.2 IP, which is the real minefield

"customize their favourite characters" is the sentence that gets the cease and desist, and it
arrives in three separate flavours:

- **character likeness** is copyright and, for some, trademark. a recognizable character is
  infringement whether you sculpted it or a user did.
- **the style itself** is the subtler one. big head, small body, black dot eyes is generic; *the
  specific proportion set and platform base of a famous product line* is closer to trade dress.
  build a proportion system you can defend, and do not market it as "X style".
- **a person's face** is a third thing entirely: consent, minors, and biometric-privacy statutes
  in some jurisdictions. local-only processing, no server-side face templates, and an explicit
  consent gate are cheaper than the alternative.

the workable path: original characters you own, the user's own likeness with consent, a curated
fan-art posture that is clearly non-commercial until a licence exists, and licences as the
growth story rather than the launch assumption.

### 5.3 repose vs print

this is the constraint most dress-up-with-3d projects discover at the end, expensively.

a posed figure is a mesh with overhangs, floating limbs, and support scars in the armpits. an
articulated figure needs joint clearance (roughly 0.2–0.3 mm depending on printer) and
print-in-place only works on well-tuned machines, in the right orientation, with the right
material.

so pose cannot be a free slider that feeds the printer. it has to be:

- **curated poses** — a library where each pose has been printed, photographed, and blessed per
  material. the slider snaps to these for orders.
- **free pose** — allowed for preview and for STL export to someone's own printer, with an
  explicit "this needs supports" flag from gate 8 rather than a silent failure.
- **articulated** — a separate kit with clearance tolerances and tested joints. a different
  product, not a checkbox.

## 6 · stack

- **catalog**: `.scad` modules, BOSL2 for attachments and rounding, one file per part, a header
  comment declaring mounts/params/colour slots that a parser turns into the schema. the `.scad`
  is the source of truth; the schema is generated, never hand-maintained.
- **preview**: openscad-wasm in a worker, low tessellation, debounced, cached by artifact id.
  ~9 MB wasm, loads once, runs offline after that.
- **export**: real openscad CLI in a render pool, full tessellation, same pinned version.
- **harness**: this repo. every gate returns structured errors; golden hashes per part catch any
  accidental geometry change in review.
- **fulfilment**: Slant 3D has a quote/order/tracking REST API; Craftcloud-type aggregators
  expose multi-vendor quoting. pick one for FDM kits and one full-colour bureau for the premium
  tier. price = quote, not a guess.
- **money**: Stripe. **stl path**: signed url to the artifact, and an export report attached so a
  user's own printer has the same information the farm would have.

## 7 · the first slice, and what it proves

do not build the AI first. do not build the printer first. build the thing that makes both safe.

1. **base body + one outfit room + three curated poses + STL export + the export report.**
   prove the harness end to end: recipe in, validated mesh out, non-manifold recipes refused with
   a readable reason.
2. **recipe AI over the catalog**, with the repair loop: the model gets a failing gate as JSON and
   emits a one-step diff. measure repair rate, not vibes.
3. **one fulfilment integration**, one material, one pose library. price from a live quote.
4. **rooms at scale**: the only thing that should grow after this is the catalog, because a
   new outfit must never require touching the engine.

the test of the whole design: adding a hundred outfits should add no code, and a user's saved
doll from a year ago should still print to the same mesh.
