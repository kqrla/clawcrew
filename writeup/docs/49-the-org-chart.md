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
