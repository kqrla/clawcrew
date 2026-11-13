# trinketeer

The company. Printed collectibles and small trinkets, sold direct.

Three lines, and one of them has sub-lines:

```
trinketeer/
  meeniable/      live     custom collector figures
    funko-pops/   live     v1, the line everything so far was built for
    bondee-dolls/ planned  soft-proportioned dolls
    block-type/   planned  minecraft-blocky dolls
    mino-girl/    planned  the fourth style in the family
  miniroomie/     planned  printed diorama miniatures: rooms in a box
  meenicals/      planned  props and trinkets, sold on their own
```

`product_line` in the database mirrors this tree exactly, with `parent` for nesting and `status` for where
each line is. The folder is the readable copy; the table is the one the org works from, and the ids match so
neither can drift quietly.

## why the split

`meenible` was never a company. It was the first product line, and it needed a qualifier every time it was
named as a business ("custom collector figures, B2C"). A company that names itself after its first product
cannot start a second one without sounding like it is pivoting. `trinketeer` is the business; the lines are
what the business sells.
