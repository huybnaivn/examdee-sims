"""Rebuild the review tracker page from catalog.json.

usage: python3 scripts/tracker.py <template.html> <out.html>
Each sim's own side of the review (round number and what was done) lives in its manifest under
"review"; the reviewer's verdicts live in the published page's data store, not in this repo.
"""
import json, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
sims = []
for c in json.load(open(root / "catalog.json")):
    row = {"s": c["slug"], "t": c["title"], "j": c["subject"], "g": c["grades"]}
    if c.get("review"):
        row["r"] = int(c["review"].get("round", 1))
        row["c"] = str(c["review"].get("note", ""))
        row["e"] = 1  # published beside the tracker page, so it can be viewed inside it
    k = c.get("curriculum")
    if k:  # where the sim sits in the Vietnamese programme
        row["k"] = f'{k["subject"]} {k["grade"]} · {k["topic"]} · {k["content"]}' + ("" if k.get("verified") else " (chưa đối chiếu SGK)")
    if c.get("status") == "approved":
        row["a"] = 1
    sims.append(row)
template = open(sys.argv[1], encoding="utf-8").read()
start, end = template.index("const SIMS = ") + len("const SIMS = "), template.index(";\nconst BASE")
open(sys.argv[2], "w", encoding="utf-8").write(template[:start] + json.dumps(sims, ensure_ascii=False, separators=(",", ":")) + template[end:])
print(len(sims), "sims,", sum(1 for s in sims if "r" in s), "awaiting review")
