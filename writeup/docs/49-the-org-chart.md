# 49 · the org chart as a whiteboard

The chart is not a diagram of the org. It **is** the org's placement, stored, and editing it is an operation
with a bounded effect. That distinction is the whole design, and it is the same rule that made the facade
engine work: switching one factor is one op with a bounded diff, never a regeneration.

```
org_node   id, kind(tier|department|bloc|wing|seat), label, parent, x, y, board
```

Coordinates are data because a person drags things. `src/domain/board.ts` is the operation behind a drag:

| gesture | effect |
| --- | --- |
| drag a seat | that node moves |
| drag a department | the department and its seats move together |
| drop between grid lines | snapped to the grid, because a whiteboard with sub-pixel positions is a whiteboard nobody can align |
| drop on an occupied square | refused, `would_overlap` |
| drop off the board | refused, `off_board` |
| drag something that does not exist | refused, `unknown_node` |

The refusals are the feature. A canvas that silently accepts a stack of two boxes teaches the person that
the picture is decorative; a canvas that says "that would stack two departments" teaches them the picture is
the model.

## what intuitive controls means, concretely

- **drag** moves; the branch follows, and only the branch.
- **snap** is on, and the grid is visible, so a hand-placed layout stays legible a month later.
- **refusal is visible**: an invalid drop bounces back with a reason, in the vocabulary above, not a silent
  no-op.
- **one gesture is one op**, so it can be undone by replaying the inverse, and it can be audited by
  diffing before and after.
- **moving does not re-layout**: nothing else on the board shifts, because a person who moves one box and
  finds five boxes moved has lost their place.

## not built

The canvas itself, and persistence of the move op. `moveNode` returns the exact set of positions that
changed, which is what a save endpoint needs: write those rows, nothing else. The table exists; the drag is
a row update away.

## built

- `org_node` seeded with the org from `tackle/`: directive, three departments with seats, two wings
  (audit weekly, on-call by lease), one bloc.
- `scripts/board-server.ts` — node:http, four routes: `/api/board`, `/api/move`, `/api/undo`, and the page.
- `web/board.html` — drag with the branch following, 20px snap, a refused drop shakes and logs its reason,
  plus the clawbasecamp pane reading the same `bc_message` rows the a2a view does.
- `org_board_op` records `moved` **and** `before`.

verified against the real database:

```
POST /api/move  {"id":"dept.code","x":460,"y":180}
 -> {"ok":true,"moved":[{"dept.code",460,180},{"seat.code",460,280}]}
GET  /api/board  dept.code 460,180   seat.code 460,280
POST /api/undo
 -> {"ok":true,"moved":[{"dept.code",400,160},{"seat.code",400,260}]}
GET  /api/board  dept.code 400,160   seat.code 400,260
```

## undo, corrected

the first undo read the op's `moved` and re-applied it, which is a no-op that reports success. an inverse
is not a delta: subtracting works until two ops overlap, and then it moves the wrong box. the op now stores
`before`, and undo writes those positions and records itself as an op like any other gesture.

## still not built

nothing has been dragged by a mouse. the page was verified by curl and by reading the HTML, not in a
browser, so the pointer handling and the 20px snap are reasoned rather than observed. `POST /api/move`
takes any `actor`, which is fine on a laptop and is an authorization hole on a shared host: the actor
should come from the session, not the body.
