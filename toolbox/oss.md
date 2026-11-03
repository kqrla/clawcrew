# oss

the shelf. every entry has a licence, a determinism verdict, and the reason it is or is not trusted
by an autonomous build.

| tool | licence | deterministic | use it for | verdict |
| --- | --- | --- | --- | --- |
| OpenSCAD | GPL-2.0 | yes, given pinned build and fixed `$fn` | parametric geometry | trusted, with the harness |
| BOSL2 | BSD-2-Clause | yes | attachments, rounding, mount points in scad | trusted |
| Manifold | Apache-2.0 | yes | fast robust CSG, one of the backends OpenSCAD can use | trusted |
| trimesh | MIT | yes | mesh checks: watertight, volume, euler, overhangs | trusted |
| admesh | GPL-2.0 | yes | STL repair and adjacency | trusted for repair only |
| Chart.js | MIT | yes | charts in artifacts | trusted |
| vitest | MIT | yes | tests | trusted |

## the licence rules

**a tool's licence becomes the product's licence.** GPL in the render path is fine when the render
happens server-side and the output is a mesh; it is not fine if the tool ships to the browser. every
entry notes which side of that line it lands on.

**fonts are a trap.** a system font in a `text()` call makes the output depend on the host and the
licence unknowable. engraving uses a stroke library with a recorded licence, or it does not ship.

**a tool with an unclear licence is not a tool.** it is a risk with a dependency file.

## sourcing a skill from the shelf

an agent may take a tool and turn it into a narrow skill: one command, one output shape, one refusal
when the input is wrong. what it may not do is import a library wholesale and hope. the skill file
records: the tool, its version, its licence, the command it runs, and the check that proves it ran.
