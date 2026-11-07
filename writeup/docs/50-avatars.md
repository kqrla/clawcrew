# 50 · agent avatars

Each seat has a generated face, stable across logs, the board, and old screenshots, because it is derived
from the seat id by fnv-1a then xorshift rather than stored.

## the first version was wrong, and the correction is the interesting part

I built thirty outlined geometric shapes with a hat on top. I had read the reference page's text and never
looked at it. When I looked, it was obvious: the reference is **plush toys**, soft forms under a single
light, with fur that fuzzes the silhouette and glossy bead eyes. An outline drawing is the opposite of that,
so the first version was a different product wearing the same vocabulary.

What changed, and why each part earns its place:

| part | how | why |
| --- | --- | --- |
| body | three-layer gradient, light from upper left | a toy is a form under a light, not a shape with a border |
| fuzz | `feTurbulence` + `feDisplacementMap` on the silhouette only | fur reads as an irregular edge; a smooth edge reads as a sticker |
| volume | a radial `sheen` pass and a radial `shade` pass, no strokes | highlight upper left, occlusion at the rim, which is the whole illusion |
| eyes | dark lens, hard specular dot, soft secondary | bead eyes are glossy; a flat dot reads as a drawing |
| face | outside the displacement filter | the face must stay crisp or it looks like a bruised toy |
| motion | one blink animation, `prefers-reduced-motion` respected | a face that never blinks is a logo |

## what is exposed

shape (30), hue, face (eyes / eyes+mouth), hat (beret, beanie, party, crown, horns, halo), glasses (round,
square, shades), antenna (stub, loop, double), blush, eye gap and size. Pin any one and the rest stay put.

That last sentence cost a bug: the first implementation short-circuited the random stream when a part was
pinned, so choosing a crown reshuffled the eyes. Every draw now happens unconditionally and only the winning
value is swapped.

## served where it is needed

`GET /api/avatar?id=seat.code` returns SVG, 1KB, `max-age=3600`, with `shape`, `hue`, `hat` overridable by
query. SVG rather than canvas because a log line, an email, and `<img>` with no JS all need it.

## not built

Their version animates states (working, sleeping) and simulates 3D on a canvas with a light rig. This has one
blink and static shading. The gaps that matter: no `working`/`sleeping` states, no pointer-following gaze, and
no UI beyond three query parameters.


## addendum: use the package

Not mine to remake. `npm i bot-avatars` (0.2.2, MIT-style public package, React ≥18 peer) and the board
renders their canvas avatars: `web/avatars.tsx` mounts `<BotAvatar size={30} state=... interactive={false}>`
into every node's `[data-bot]` holder, bundled with esbuild to `web/avatars.js` (280KB) and served by the
board server. Seat nodes get `state="working"`, everything else `default`, so a seat looks busy on the board
because it is.

`type` is derived from the seat id by fnv-1a over their eighteen types, so a seat keeps its body across
renders without a column and without a random re-roll on refresh.

The procedural generator in `src/domain/avatar.ts` stays, demoted: it is the renderer for places a canvas
cannot go, which is a log line, an email, or a `<img>` in a document. Two renderers, one rule: the seat's
identity picks the body, so `seat.support` is recognisable in both.
