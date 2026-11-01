# the contract

what the model may emit, what the catalog must declare for that to be checkable, and how a
failed render becomes a one-step repair instead of a rewrite.

## 1 · the catalog is the vocabulary

a part file is ordinary OpenSCAD with a machine-readable header. the header is parsed into the
catalog index; the index is the only list of names a model is allowed to use.

```scad
// --- figureforge part ---
// id:        hoodie
// room:      outerwear
// provides:  [torso.upper]
// requires:  [torso.mid, neck]
// excludes:  [coat, cape]
// colours:   1
// orientation: flat-back-down
// licence:   own
// params:
//   hood_len: {min: 0.0, max: 1.0, step: 0.02, default: 0.5}
//   sleeve:   {min: 0.4, max: 1.0, step: 0.02, default: 0.8}
// --- end ---

module hoodie(hood_len = 0.5, sleeve = 0.8) {
  // BOSL2 attachments, one mount per declared interface
  attach("torso.mid") rounded_prism(...);
  if (hood_len > 0) attach("neck") hood(len = hood_len);
  for (s = [-1, 1]) attach(["shoulder_l", "shoulder_r"][s > 0 ? 1 : 0]) sleeve_geom(len = sleeve);
}
```

the header does five jobs at once: it is the parameter schema the recipe is validated against, the
mount graph gate 3 checks, the exclusion list gate 5 checks, the print orientation gate 8 needs, and
the licence record for gate 0 (legal) that nobody thinks about until it matters.

**the `.scad` is the source of truth. the schema is generated.** a hand-maintained second copy of
the parameter list is a bug with a delay fuse.

## 2 · the generated driver

rendering never executes the recipe directly. the recipe is compiled to one driver file, which is
what gets archived next to the STL:

```scad
// generated from recipe sha256:8a47... against kit pop.v3 — do not edit
include <kit/pop.v3/base.scad>
include <kit/pop.v3/outfits/hoodie.scad>
...
$fn = 96; $fa = 2; $fs = 0.2;            // set by the harness, never by the recipe
base_pop(head_ratio = 0.46, stance = 0.50);
translate(mount("neck"))  crop_cap();
translate(mount("torso.upper")) hoodie(hood_len = 0.62, sleeve = 0.80);
...

// colours are exported as a separate manifest, not as geometry:
//   { "shell": "#2b4d6b", "accent": "#e0a24a" }
```

three consequences, all of them the point:

- the driver is **deterministic text**, so it can be diffed, archived, and re-rendered years later
- colour is a **manifest**, not geometry, so recolouring never invalidates a cached mesh
- `$fn` lives in the harness. a user cannot change tessellation, so the cache cannot be poisoned by
  a slider.

## 3 · what the model may and may not do

| may | may not |
| --- | --- |
| choose parts from the index | emit OpenSCAD, or any code at all |
| set declared params within declared ranges | invent a part id, a mount, or a param |
| choose a palette slot and a hex for it | put a literal hex on a part |
| pick a curated pose, or set joint angles within kit limits | change `$fn`, layer height, or tessellation |
| emit a one-step diff against a rejected recipe | return a whole new recipe when asked to repair |

the boundary is deliberate: everything in the left column is a **selection problem with a closed
answer set**, which is the class of task a language model is actually reliable at. everything in
the right column is code generation, which is the class of task that produced the failure mode
this architecture exists to prevent.

## 4 · the repair loop

```
brief ──model──▶ recipe ──gates 1..5──▶ recipe ──render──▶ mesh ──gates 7..9──▶ artifact
                    ▲                     │                  │
                    └──── structured error ┘◀─────────────────┘
                          (gate, code, detail, fixable_by, candidates)
```

rules that keep this from becoming a slot machine:

1. **the model gets the error, not the mesh.** no screenshots, no "does this look right". geometry
   is judged by gates, not by a model's opinion of a render.
2. **two attempts per gate failure, then escalate.** a repair that fails the same gate twice is not
   going to succeed on the third try, it is going to churn.
3. **repairs are diffs.** one part swap or one param change per attempt, recorded. a full rewrite
   destroys the traceability that makes the audit trail worth having.
4. **rejections are data.** every failed recipe, its error, and its repair are the training set for
   the next version of the selection prompt. this is the only loop that improves over time.

## 5 · golden hashes

every part has a recorded render hash, checked in CI:

```
parts.golden.json    { "hoodie": { "kit": "pop.v3", "hash": "f1a02184", "triangles": 8421 } }
```

if a part's geometry changes, its hash changes, and CI fails until the author updates the golden
file in the same commit. this catches the failure that code review reliably misses: a "harmless"
rounding change that silently makes every previously purchased figure render differently from the
one already on someone's shelf.

it also gives version bumping a mechanical trigger. a hash change is a `pop.v4`. there is no
judgement call.

## 6 · determinism checklist

run before any artifact is allowed to reach a printer:

- [ ] one exact openscad build, recorded in the artifact manifest, asserted at worker boot
- [ ] no `rands()`, no `import()` of remote files, no `surface()`, no system `text()`
- [ ] `$fn/$fa/$fs` set by the harness only
- [ ] params quantised to 0.01 mm at the schema boundary
- [ ] millimetres everywhere; y-up in the viewer, z-up in the export, converted once
- [ ] two renders of the same recipe byte-identical, checked on every deploy with three sample
      recipes (binary STL, so "byte-identical" is a real assertion and not a vibe)

the last one is the only test that matters, and it is cheap. if it passes, the cache, the share
link, the reorder, and the audit trail all work. if it fails, none of them do.
