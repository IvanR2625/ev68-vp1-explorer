#!/usr/bin/env python3
"""
Generate realistic mock data for the web app.
Run this before the real pipeline to seed the site with demo data.
"""

import json
import math
import random
import sys
from pathlib import Path

random.seed(42)

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "web" / "public" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

YEARS = list(range(2014, 2025))
COUNTRIES = [
    "USA", "Germany", "Japan", "Netherlands", "United Kingdom",
    "China", "Canada", "France", "Australia", "South Korea",
    "Italy", "Spain", "Brazil", "India", "Sweden",
]
COUNTRY_WEIGHTS = [30, 12, 10, 8, 8, 7, 5, 4, 3, 3, 2, 2, 2, 2, 2]

# EV-D68 has 4 clades: A, B, C, D
CLADES = {
    "A": {"years": range(2014, 2019), "color": "#3b82f6"},
    "B": {"years": range(2014, 2025), "color": "#10b981"},
    "C": {"years": range(2016, 2025), "color": "#f59e0b"},
    "D": {"years": range(2018, 2025), "color": "#ef4444"},
}

# Mean divergence from reference per year (gradually increasing, with outbreak spikes)
DIVERGENCE_MEANS = {
    2014: 0.018, 2015: 0.022, 2016: 0.031, 2017: 0.038,
    2018: 0.044, 2019: 0.049, 2020: 0.051, 2021: 0.054,
    2022: 0.061, 2023: 0.066, 2024: 0.071,
}


def rand_accession(year: int, i: int) -> str:
    prefix_map = {2014: "KM", 2015: "KP", 2016: "KX", 2017: "MF",
                  2018: "MH", 2019: "MK", 2020: "MT", 2021: "MW",
                  2022: "OP", 2023: "OR", 2024: "PQ"}
    prefix = prefix_map.get(year, "KM")
    return f"{prefix}{881700 + year * 30 + i:06d}"


def assign_clade(year: int) -> str:
    eligible = [c for c, info in CLADES.items() if year in info["years"]]
    # Newer clades become dominant over time
    weights = []
    for c in eligible:
        if c == "A":
            w = max(0.1, 1 - (year - 2014) * 0.12)
        elif c == "B":
            w = 0.5
        elif c == "C":
            w = min(0.8, (year - 2015) * 0.15) if year > 2015 else 0.1
        else:  # D
            w = min(0.7, (year - 2017) * 0.18) if year > 2017 else 0.1
        weights.append(w)
    return random.choices(eligible, weights=weights, k=1)[0]


def make_sequence_pool() -> list[dict]:
    seqs = []
    for year in YEARS:
        n = random.randint(10, 25)
        for i in range(n):
            clade = assign_clade(year)
            base_dist = DIVERGENCE_MEANS[year]
            dist = round(max(0.001, random.gauss(base_dist, base_dist * 0.20)), 6)
            country = random.choices(COUNTRIES, weights=COUNTRY_WEIGHTS)[0]
            seqs.append({
                "accession": rand_accession(year, i),
                "year": year,
                "country": country,
                "clade": clade,
                "distance": dist,
                "strain": f"EV-D68/{country.replace(' ', '_')}/{year}/{i+1:02d}",
            })
    return seqs


# ── Tree generation ──────────────────────────────────────────────────────────

def build_tree(seqs: list[dict]) -> dict:
    """Build a pseudo-phylogenetic tree grouped by clade then year."""
    from collections import defaultdict

    by_clade: dict[str, list] = defaultdict(list)
    for s in seqs:
        by_clade[s["clade"]].append(s)

    clade_subtrees = []
    for clade_name, members in sorted(by_clade.items()):
        by_year: dict[int, list] = defaultdict(list)
        for m in members:
            by_year[m["year"]].append(m)

        year_subtrees = []
        for yr, yr_members in sorted(by_year.items()):
            leaves = []
            for m in yr_members:
                leaves.append({
                    "name": f"{m['accession']}|{m['year']}|{m['country'].replace(' ', '_')}",
                    "branchLength": round(m["distance"] * 0.4 + random.uniform(0, 0.005), 6),
                    "isLeaf": True,
                    "accession": m["accession"],
                    "year": m["year"],
                    "country": m["country"],
                    "strain": m["strain"],
                    "clade": m["clade"],
                    "distance": m["distance"],
                })
            year_subtrees.append({
                "name": f"clade_{clade_name}_{yr}",
                "branchLength": round(0.005 + random.uniform(0, 0.003), 6),
                "children": leaves,
            })

        clade_subtrees.append({
            "name": f"clade_{clade_name}",
            "branchLength": round(0.01 + CLADES[clade_name].get("baseLen", random.uniform(0.005, 0.02)), 6),
            "children": year_subtrees,
        })

    return {"name": "root", "branchLength": 0, "children": clade_subtrees}


# ── Divergence JSON ──────────────────────────────────────────────────────────

def build_divergence(seqs: list[dict]) -> dict:
    from collections import defaultdict

    by_year: dict[int, list] = defaultdict(list)
    for s in seqs:
        by_year[s["year"]].append(s)

    per_year = []
    for yr in YEARS:
        group = by_year.get(yr, [])
        if not group:
            continue
        dists = [s["distance"] for s in group]
        import statistics as stats
        per_year.append({
            "year": yr,
            "mean": round(sum(dists) / len(dists), 6),
            "stdev": round(stats.stdev(dists) if len(dists) > 1 else 0, 6),
            "count": len(dists),
            "min": round(min(dists), 6),
            "max": round(max(dists), 6),
            "sequences": [
                {
                    "accession": s["accession"],
                    "year": s["year"],
                    "country": s["country"],
                    "distance": s["distance"],
                    "strain": s["strain"],
                    "clade": s["clade"],
                }
                for s in sorted(group, key=lambda x: x["distance"])
            ],
        })

    return {
        "reference": "Fermon_prototype_1962",
        "per_year": per_year,
        "total_sequences": len(seqs),
    }


# ── Metadata JSON ─────────────────────────────────────────────────────────────

def build_metadata(seqs: list[dict]) -> dict:
    from datetime import date
    countries = sorted({s["country"] for s in seqs})
    return {
        "virus": "Enterovirus D68",
        "gene": "VP1",
        "description": (
            "VP1 (Viral Protein 1) is the primary surface-exposed capsid protein of "
            "Enterovirus D68. It determines receptor binding and antibody neutralization, "
            "and is used for genotype classification into clades A–D. EV-D68 caused "
            "large outbreaks of severe respiratory illness and acute flaccid myelitis "
            "in 2014, 2016, 2018, and 2022 in North America and Europe."
        ),
        "start_year": min(s["year"] for s in seqs),
        "end_year": max(s["year"] for s in seqs),
        "total_sequences": len(seqs),
        "countries": countries,
        "year_range": [min(s["year"] for s in seqs), max(s["year"] for s in seqs)],
        "data_source": "NCBI Nucleotide (sample data — run pipeline for real sequences)",
        "last_updated": date.today().isoformat(),
        "is_sample": True,
    }


def main() -> None:
    print("Generating sample data...")
    seqs = make_sequence_pool()
    print(f"  {len(seqs)} sequences across {len(YEARS)} years")

    tree_data = build_tree(seqs)
    with open(DATA_DIR / "tree.json", "w") as fh:
        json.dump(tree_data, fh, separators=(",", ":"))
    print(f"  tree.json written")

    div_data = build_divergence(seqs)
    with open(DATA_DIR / "divergence.json", "w") as fh:
        json.dump(div_data, fh, indent=2)
    print(f"  divergence.json written")

    meta = build_metadata(seqs)
    with open(DATA_DIR / "metadata.json", "w") as fh:
        json.dump(meta, fh, indent=2)
    print(f"  metadata.json written")

    print(f"\nSample data ready in {DATA_DIR}")
    print("Run pipeline/run_pipeline.py to replace with real NCBI data.")


if __name__ == "__main__":
    main()
