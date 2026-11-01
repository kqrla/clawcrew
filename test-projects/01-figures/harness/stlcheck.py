#!/usr/bin/env python3
"""
gate 7 of the harness: is this mesh a thing a printer can slice?

no CAD toolchain, no dependencies. give it an STL and it answers the questions that
decide whether a file is worth sending to a print house at all:

  closed        every edge shared by exactly two triangles
  manifold      no edge shared by more than two (a fin, a T-junction, a doubled shell)
  orientable    consistent outward winding, checked by the sign of the signed volume
  non_degenerate no zero-area triangles, which slicers turn into holes
  volume        signed volume in mm^3, for material cost and for sanity
  bbox          extents in mm, for scale and for bed fit

exit 0 if every gate passes, 1 otherwise. --json for the structured error the model
repairs against (see README section 3).

usage:
    python3 stlcheck.py model.stl [--json] [--max-bbox 220]
"""
from __future__ import annotations

import json
import math
import struct
import sys
from collections import defaultdict

# vertices are welded at 0.1 micron. STL stores each vertex per triangle, so exact
# float comparison would never match an edge; this is the tolerance that decides
# "same point" and therefore whether a mesh is closed.
WELD = 4  # decimal places


def _key(v):
    return (round(v[0], WELD), round(v[1], WELD), round(v[2], WELD))


def parse_stl(path):
    """binary if it looks binary, ascii otherwise. both are common in the wild."""
    with open(path, "rb") as fh:
        data = fh.read()
    if len(data) >= 84:
        count = struct.unpack("<I", data[80:84])[0]
        expected = 84 + count * 50
        if expected == len(data):
            tris = []
            for i in range(count):
                off = 84 + i * 50
                vals = struct.unpack("<12f", data[off : off + 48])
                tris.append(((vals[3], vals[4], vals[5]),
                             (vals[6], vals[7], vals[8]),
                             (vals[9], vals[10], vals[11])))
            return tris, "binary", count
    text = data.decode("utf-8", errors="replace")
    if "facet" not in text:
        raise ValueError("not an STL: no binary header match and no facets")
    tris, verts = [], []
    for line in text.splitlines():
        parts = line.split()
        if len(parts) == 4 and parts[0] == "vertex":
            verts.append((float(parts[1]), float(parts[2]), float(parts[3])))
            if len(verts) == 3:
                tris.append(tuple(verts))
                verts = []
    return tris, "ascii", len(tris)


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _cross(u, v):
    return (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])


def _dot(u, v):
    return u[0] * v[0] + u[1] * v[1] + u[2] * v[2]


def check(tris, max_bbox=None):
    result = {
        "triangles": len(tris),
        "closed": False,
        "manifold": False,
        "orientable": False,
        "non_degenerate": False,
        "boundary_edges": 0,
        "overused_edges": 0,
        "degenerate_triangles": 0,
        "volume_mm3": 0.0,
        "bbox_mm": [0.0, 0.0, 0.0],
        "failures": [],
    }
    if not tris:
        result["failures"].append({"gate": "mesh", "code": "empty_mesh", "detail": {}})
        return result

    edges = defaultdict(int)
    degenerate = 0
    signed_volume = 0.0
    lo = [math.inf] * 3
    hi = [-math.inf] * 3

    for tri in tris:
        a, b, c = (_key(p) for p in tri)
        for p in (a, b, c):
            for i in range(3):
                lo[i] = min(lo[i], p[i])
                hi[i] = max(hi[i], p[i])
        if len({a, b, c}) < 3:
            degenerate += 1
        else:
            n = _cross(_sub(b, a), _sub(c, a))
            if _dot(n, n) < 1e-12:  # collinear
                degenerate += 1
        for u, v in ((a, b), (b, c), (c, a)):
            edges[(u, v) if u <= v else (v, u)] += 1
        signed_volume += _dot(tri[0], _cross(tri[1], tri[2])) / 6.0

    boundary = sum(1 for n in edges.values() if n == 1)
    overused = sum(1 for n in edges.values() if n > 2)

    result["boundary_edges"] = boundary
    result["overused_edges"] = overused
    result["degenerate_triangles"] = degenerate
    result["volume_mm3"] = round(signed_volume, 4)
    result["bbox_mm"] = [round(hi[i] - lo[i], 3) for i in range(3)]

    result["closed"] = boundary == 0
    result["manifold"] = overused == 0
    result["non_degenerate"] = degenerate == 0
    # a closed mesh with consistent outward winding has positive signed volume.
    # negative means the mesh is inside out, which slices to nothing in some slicers.
    result["orientable"] = result["closed"] and signed_volume > 0

    if not result["closed"]:
        result["failures"].append({
            "gate": "mesh_integrity",
            "code": "not_closed",
            "detail": {"boundary_edges": boundary,
                       "hint": "a hole, an unstitched seam, or a part that did not overlap its neighbour"},
            "fixable_by": ["increase_overlap", "swap_part", "close_hole"],
            "candidates": [],
        })
    if not result["manifold"]:
        result["failures"].append({
            "gate": "mesh_integrity",
            "code": "non_manifold_edges",
            "detail": {"overused_edges": overused,
                       "hint": "three or more triangles on one edge: a fin, a T-junction, or two shells sharing a face"},
            "fixable_by": ["offset_part", "swap_part", "increase_overlap"],
            "candidates": [],
        })
    if not result["non_degenerate"]:
        result["failures"].append({
            "gate": "mesh_integrity",
            "code": "degenerate_triangles",
            "detail": {"count": degenerate, "hint": "zero area triangles slice into holes"},
            "fixable_by": ["change_param", "swap_part"],
            "candidates": [],
        })
    if result["closed"] and signed_volume <= 0:
        result["failures"].append({
            "gate": "mesh_integrity",
            "code": "inside_out",
            "detail": {"signed_volume_mm3": result["volume_mm3"],
                       "hint": "consistent winding, wrong direction: reverse the transform"},
            "fixable_by": ["reverse_winding"],
            "candidates": [],
        })
    if max_bbox and max(result["bbox_mm"]) > max_bbox:
        result["failures"].append({
            "gate": "printability",
            "code": "exceeds_build_volume",
            "detail": {"bbox_mm": result["bbox_mm"], "limit_mm": max_bbox},
            "fixable_by": ["scale_down", "split_part"],
            "candidates": [],
        })

    return result


def main(argv):
    if not argv or argv[0].startswith("-"):
        print(__doc__)
        return 2
    path = argv[0]
    as_json = "--json" in argv
    max_bbox = None
    if "--max-bbox" in argv:
        max_bbox = float(argv[argv.index("--max-bbox") + 1])

    tris, fmt, declared = parse_stl(path)
    result = check(tris, max_bbox=max_bbox)
    result["file"] = path
    result["format"] = fmt
    if declared != len(tris):
        result["failures"].append({
            "gate": "mesh_integrity",
            "code": "truncated_file",
            "detail": {"declared_triangles": declared, "parsed": len(tris)},
            "fixable_by": ["re_render"],
            "candidates": [],
        })

    ok = not result["failures"]
    result["ok"] = ok
    if as_json:
        print(json.dumps(result, indent=2, sort_keys=True))
    else:
        print(f"{path}: {result['triangles']} triangles, {fmt}, "
              f"{'PASS' if ok else 'FAIL'}")
        print(f"  bbox {result['bbox_mm']} mm   volume {result['volume_mm3']} mm^3")
        print(f"  closed {result['closed']}   manifold {result['manifold']}   "
              f"outward {result['orientable']}   degenerate {result['degenerate_triangles']}")
        for f in result["failures"]:
            print(f"  FAIL {f['gate']}/{f['code']}: {f['detail'].get('hint', '')}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
