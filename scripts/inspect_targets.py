# -*- coding: utf-8 -*-
import json
import collections

with open("src/data/exercises.min.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Total: {len(data)}")
patterns = collections.defaultdict(list)
for ex in data:
    target = ex.get("target", "")
    equip = ex.get("equipment", "")
    body = ex.get("body_part", "")
    en = ex.get("name_en", "")
    patterns[target].append((ex["id"], en, equip))

print(f"Targets: {len(patterns)}")
for t, items in sorted(patterns.items(), key=lambda x: -len(x[1])):
    print(f"Target: {t} ({len(items)} exercises)")
