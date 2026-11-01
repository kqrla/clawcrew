#!/usr/bin/env python3
"""
proves gate 7 actually gates. builds three meshes on the fly and asserts what the
checker says about each, so the harness is verified without needing openscad:

  a closed cube            -> passes, volume is exactly right
  a cube missing a face    -> not closed, boundary edges counted
  a cube with a fin        -> non-manifold, edge use counted
  an inside-out cube       -> closed but wrong winding
  a zero-area triangle     -> degenerate

    python3 test_stlcheck.py
"""
import os
import struct
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
CHECK = os.path.join(HERE, "stlcheck.py")
sys.path.insert(0, HERE)
import stlcheck  # noqa: E402


def cube(s=10.0):
    """12 triangles, outward winding, centred on the origin."""
    h = s / 2.0
    v = [(-h, -h, -h), (h, -h, -h), (h, h, -h), (-h, h, -h),
         (-h, -h, h), (h, -h, h), (h, h, h), (-h, h, h)]
    faces = [(0, 3, 2), (0, 2, 1),   # bottom
             (4, 5, 6), (4, 6, 7),   # top
             (0, 1, 5), (0, 5, 4),   # -y
             (1, 2, 6), (1, 6, 5),   # +x
             (2, 3, 7), (2, 7, 6),   # +y
             (3, 0, 4), (3, 4, 7)]   # -x
    return [(v[a], v[b], v[c]) for a, b, c in faces]


def write_binary_stl(path, tris):
    with open(path, "wb") as fh:
        fh.write(b"figureforge test".ljust(80, b" "))
        fh.write(struct.pack("<I", len(tris)))
        for tri in tris:
            fh.write(struct.pack("<3f", 0.0, 0.0, 0.0))
            for p in tri:
                fh.write(struct.pack("<3f", *p))
            fh.write(struct.pack("<H", 0))


def write_ascii_stl(path, tris):
    with open(path, "w") as fh:
        fh.write("solid test\n")
        for tri in tris:
            fh.write(" facet normal 0 0 0\n  outer loop\n")
            for p in tri:
                fh.write(f"   vertex {p[0]} {p[1]} {p[2]}\n")
            fh.write("  endloop\n endfacet\n")
        fh.write("endsolid test\n")


results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(f"  {'ok  ' if cond else 'FAIL'} {name}{'' if cond else '  -> ' + detail}")


def main():
    print("gate 7: mesh integrity")

    closed = stlcheck.check(cube())
    check("closed cube passes", closed["ok"] if "ok" in closed else not closed["failures"])
    check("closed cube is closed and manifold", closed["closed"] and closed["manifold"])
    check("closed cube volume is 1000 mm^3", abs(closed["volume_mm3"] - 1000.0) < 1e-6,
          str(closed["volume_mm3"]))
    check("closed cube bbox is 10x10x10", closed["bbox_mm"] == [10.0, 10.0, 10.0],
          str(closed["bbox_mm"]))
    check("closed cube is outward-facing", closed["orientable"])

    holed = stlcheck.check(cube()[:-2])  # drop one face = 2 triangles
    check("missing face is not closed", not holed["closed"])
    check("missing face reports 4 boundary edges", holed["boundary_edges"] == 4,
          str(holed["boundary_edges"]))
    check("missing face names the gate and is repairable",
          holed["failures"][0]["code"] == "not_closed" and holed["failures"][0]["fixable_by"],
          str(holed["failures"]))

    # a duplicated shell face: still closed, no boundary edges, but three edges now
    # have three triangles on them. this is the case that fools a "closed" check alone.
    doubled = cube() + [cube()[0]]
    duped = stlcheck.check(doubled)
    check("a doubled face is closed", duped["closed"],
          f"boundary={duped['boundary_edges']}")
    check("a doubled face is non-manifold", not duped["manifold"])
    check("all three of its edges are overused", duped["overused_edges"] == 3,
          str(duped["overused_edges"]))

    # a fin welded to an existing cube edge: shares that edge, so 3 uses on it,
    # and its two free edges are now boundary. both faults, named separately.
    fin = cube() + [((-5.0, -5.0, -5.0), (-5.0, 5.0, -5.0), (12.0, 0.0, 18.0))]
    finned = stlcheck.check(fin)
    check("a fin is non-manifold", not finned["manifold"])
    check("a fin adds boundary edges", not finned["closed"],
          f"boundary={finned['boundary_edges']}")
    codes = {f["code"] for f in finned["failures"]}
    check("the fin names both faults", {"not_closed", "non_manifold_edges"} <= codes, str(codes))

    flipped = [(a, c, b) for a, b, c in cube()]
    inverted = stlcheck.check(flipped)
    check("inside-out cube is still closed", inverted["closed"])
    check("inside-out cube is caught by winding", not inverted["orientable"])
    check("inside-out cube reports negative volume", inverted["volume_mm3"] < 0,
          str(inverted["volume_mm3"]))

    degenerate = cube() + [((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (2.0, 0.0, 0.0))]
    degen = stlcheck.check(degenerate)
    check("a collinear triangle is degenerate", not degen["non_degenerate"])
    check("the degenerate triangle is counted",
          any(f["code"] == "degenerate_triangles" for f in degen["failures"]),
          str([f["code"] for f in degen["failures"]]))

    oversized = stlcheck.check(cube(300.0), max_bbox=220.0)
    check("300 mm cube exceeds a 220 mm bed",
          any(f["code"] == "exceeds_build_volume" for f in oversized["failures"]),
          str(oversized["failures"]))

    with tempfile.TemporaryDirectory() as tmp:
        bp = os.path.join(tmp, "cube_bin.stl")
        ap = os.path.join(tmp, "cube_ascii.stl")
        hp = os.path.join(tmp, "hole.stl")
        write_binary_stl(bp, cube())
        write_ascii_stl(ap, cube())
        write_binary_stl(hp, cube()[:-2])

        for path, label in ((bp, "binary"), (ap, "ascii")):
            out = subprocess.run([sys.executable, CHECK, path, "--json"],
                                 capture_output=True, text=True)
            check(f"{label} stl parses and passes", out.returncode == 0, out.stderr[:200])
            check(f"{label} stl reports 12 triangles", '"triangles": 12' in out.stdout,
                  out.stdout[:200])

        out = subprocess.run([sys.executable, CHECK, hp], capture_output=True, text=True)
        check("hole exits non-zero", out.returncode == 1, str(out.returncode))
        check("hole prints a readable reason", "not_closed" in out.stdout, out.stdout[:300])

        truncated = os.path.join(tmp, "truncated.stl")
        write_binary_stl(truncated, cube())
        with open(truncated, "r+b") as fh:
            fh.truncate(os.path.getsize(truncated) - 20)
        out = subprocess.run([sys.executable, CHECK, truncated, "--json"],
                             capture_output=True, text=True)
        check("a truncated file is refused, not miscounted", out.returncode != 0, out.stdout[:200])

    failed = [n for n, ok, _ in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
