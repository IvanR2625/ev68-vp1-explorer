#!/usr/bin/env python3
"""
EV-D68 VP1 Sequence Analysis Pipeline
Fetches sequences from NCBI, aligns, builds tree, computes divergence.
"""

import json
import logging
import sys
from datetime import date

import config
import fetch
import align
import tree
import divergence

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s – %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("pipeline")


def write_metadata(records: list[dict], cfg) -> None:
    countries = sorted({r["country"] for r in records if r.get("country")})
    years = sorted({r["collection_year"] for r in records if r.get("collection_year")})
    meta = {
        "virus": cfg.ORGANISM,
        "gene": cfg.GENE,
        "description": (
            "VP1 (Viral Protein 1) is the primary surface-exposed capsid protein of "
            "Enterovirus D68. It is the main determinant of receptor binding and antibody "
            "neutralization, and is used for genotype classification into clades A–D."
        ),
        "start_year": cfg.START_YEAR,
        "end_year": cfg.END_YEAR,
        "total_sequences": len(records),
        "countries": countries,
        "year_range": [min(years), max(years)] if years else [cfg.START_YEAR, cfg.END_YEAR],
        "data_source": "NCBI Nucleotide",
        "last_updated": date.today().isoformat(),
    }
    with open(cfg.METADATA_JSON, "w") as fh:
        json.dump(meta, fh, indent=2)
    logger.info("Metadata written: %d sequences, %d countries", len(records), len(countries))


def main() -> None:
    logger.info("=== EV-D68 VP1 Pipeline ===")

    # 1. Fetch
    records = fetch.run(config)
    if not records:
        logger.error("No sequences fetched — aborting")
        sys.exit(1)

    by_accession = {r["accession"]: r for r in records}

    # 2. Align
    align.run(config)

    # 3. Build tree
    tree.run(config, by_accession)

    # 4. Divergence
    divergence.run(config, by_accession)

    # 5. Metadata
    write_metadata(records, config)

    logger.info("=== Pipeline complete ===")
    logger.info("Data written to %s", config.DATA_DIR)


if __name__ == "__main__":
    main()
