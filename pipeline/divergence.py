"""Calculate p-distance divergence statistics from aligned FASTA."""

import json
import logging
import statistics
from collections import defaultdict

from Bio import SeqIO

logger = logging.getLogger(__name__)


def p_distance(seq1: str, seq2: str) -> float:
    """Proportion of differing sites, ignoring gaps."""
    diffs = valid = 0
    for a, b in zip(seq1, seq2):
        if a == "-" or b == "-":
            continue
        valid += 1
        if a != b:
            diffs += 1
    return diffs / valid if valid else 0.0


def choose_reference(records: list) -> tuple[str, str]:
    """Use earliest sequence as divergence reference."""
    dated = [(r, r.id.split("|")[1]) for r in records if "|" in r.id]
    dated.sort(key=lambda x: x[1])
    ref = dated[0][0] if dated else records[0]
    logger.info("Reference: %s", ref.id)
    return ref.id, str(ref.seq)


def compute_divergence(aligned_fasta, metadata_by_accession: dict) -> dict:
    records = list(SeqIO.parse(aligned_fasta, "fasta"))
    if not records:
        raise ValueError("Empty alignment")

    ref_id, ref_seq = choose_reference(records)

    by_year: dict[int, list] = defaultdict(list)
    all_sequences = []

    for rec in records:
        parts = rec.id.split("|")
        accession = parts[0]
        try:
            year = int(parts[1]) if len(parts) > 1 else None
        except ValueError:
            year = None
        country = parts[2].replace("_", " ") if len(parts) > 2 else "Unknown"

        if year is None:
            meta = metadata_by_accession.get(accession, {})
            year = meta.get("collection_year")
            country = meta.get("country", country)

        if year is None:
            continue

        dist = round(p_distance(ref_seq, str(rec.seq)), 6)
        entry = {
            "accession": accession,
            "year": year,
            "country": country,
            "distance": dist,
            "strain": metadata_by_accession.get(accession, {}).get("strain", accession),
        }
        by_year[year].append(entry)
        all_sequences.append(entry)

    per_year = []
    for yr in sorted(by_year):
        dists = [e["distance"] for e in by_year[yr]]
        per_year.append(
            {
                "year": yr,
                "mean": round(statistics.mean(dists), 6),
                "stdev": round(statistics.stdev(dists) if len(dists) > 1 else 0, 6),
                "count": len(dists),
                "min": round(min(dists), 6),
                "max": round(max(dists), 6),
                "sequences": sorted(by_year[yr], key=lambda x: x["distance"]),
            }
        )

    return {
        "reference": ref_id,
        "per_year": per_year,
        "total_sequences": len(all_sequences),
    }


def run(cfg, metadata_by_accession: dict) -> None:
    result = compute_divergence(cfg.ALIGNED_FASTA, metadata_by_accession)

    with open(cfg.DIVERGENCE_JSON, "w") as fh:
        json.dump(result, fh, indent=2)
    logger.info(
        "Divergence JSON written: %d year-groups", len(result["per_year"])
    )
