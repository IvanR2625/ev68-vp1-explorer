"""Fetch EV-D68 VP1 sequences from NCBI Nucleotide."""

import logging
import re
import time
from collections import defaultdict
from datetime import datetime
from typing import Optional
import random

from Bio import Entrez, SeqIO

logger = logging.getLogger(__name__)


def setup_entrez(email: str) -> None:
    Entrez.email = email
    Entrez.tool = "EV68-VP1-DivergenceAnalysis"


def search_ids(taxid: int, gene: str, min_len: int, max_len: int,
               start_year: int, end_year: int, max_count: int) -> list[str]:
    query = (
        f"txid{taxid}[Organism:noexp] "
        f"AND {gene}[Gene Name] "
        f"AND {min_len}:{max_len}[SLEN] "
        f"AND {start_year}/01/01:{end_year}/12/31[PDAT]"
    )
    logger.info("NCBI query: %s", query)

    handle = Entrez.esearch(db="nuccore", term=query, retmax=max_count)
    record = Entrez.read(handle)
    handle.close()

    total = int(record["Count"])
    logger.info("Found %d sequences", total)
    return record["IdList"]


def _parse_year(date_str: str) -> Optional[int]:
    if not date_str or date_str.lower() in ("missing", "not collected", "unknown"):
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y", "%d-%b-%Y", "%b-%Y"):
        try:
            return datetime.strptime(date_str.strip(), fmt).year
        except ValueError:
            pass
    m = re.search(r"\b(20\d{2}|199\d)\b", date_str)
    return int(m.group(1)) if m else None


def _parse_country(country_str: str) -> str:
    if not country_str:
        return "Unknown"
    return country_str.split(":")[0].strip()


def fetch_records(id_list: list[str]) -> list[dict]:
    records = []
    batch_size = 50
    for i in range(0, len(id_list), batch_size):
        batch = id_list[i : i + batch_size]
        logger.info(
            "Batch %d/%d (%d seqs)",
            i // batch_size + 1,
            (len(id_list) - 1) // batch_size + 1,
            len(batch),
        )
        try:
            handle = Entrez.efetch(
                db="nuccore", id=",".join(batch), rettype="gb", retmode="text"
            )
            for gb in SeqIO.parse(handle, "genbank"):
                parsed = _parse_gb(gb)
                if parsed:
                    records.append(parsed)
            handle.close()
        except Exception as exc:
            logger.warning("Batch failed: %s", exc)
        time.sleep(0.34)
    return records


def _parse_gb(record) -> Optional[dict]:
    src = next((f for f in record.features if f.type == "source"), None)
    year = country = strain = None

    if src:
        raw_date = src.qualifiers.get("collection_date", [None])[0]
        year = _parse_year(raw_date) if raw_date else None
        raw_country = src.qualifiers.get("country", [None])[0]
        country = _parse_country(raw_country) if raw_country else "Unknown"
        strain = src.qualifiers.get("strain", [None])[0]

    # Prefer extracted VP1 CDS; fall back to full record
    seq = None
    for feat in record.features:
        quals = feat.qualifiers
        if feat.type == "CDS" and "VP1" in "".join(quals.get("gene", []) + quals.get("product", [])):
            seq = str(feat.extract(record.seq))
            break
    if seq is None:
        seq = str(record.seq)

    n_frac = seq.upper().count("N") / max(len(seq), 1)
    if n_frac > 0.05:
        return None

    return {
        "accession": record.id.split(".")[0],
        "description": record.description,
        "strain": strain or record.id,
        "collection_year": year,
        "country": country,
        "sequence": seq.upper(),
        "length": len(seq),
    }


def sample_by_year(
    records: list[dict], start_year: int, end_year: int, max_per_year: int
) -> list[dict]:
    by_year: dict[int, list] = defaultdict(list)
    for r in records:
        yr = r.get("collection_year")
        if yr and start_year <= yr <= end_year:
            by_year[yr].append(r)

    sampled = []
    for yr in range(start_year, end_year + 1):
        pool = by_year.get(yr, [])
        n = min(len(pool), max_per_year)
        sampled.extend(random.sample(pool, n))
        logger.info("  %d: %d/%d seqs", yr, n, len(pool))
    return sampled


def write_fasta(records: list[dict], path) -> None:
    with open(path, "w") as fh:
        for r in records:
            yr = r.get("collection_year", "unknown")
            country = (r.get("country") or "unknown").replace(" ", "_")
            header = f"{r['accession']}|{yr}|{country}"
            fh.write(f">{header}\n{r['sequence']}\n")


def run(cfg) -> list[dict]:
    setup_entrez(cfg.NCBI_EMAIL)
    ids = search_ids(
        cfg.TAXID, cfg.GENE, cfg.MIN_SEQ_LEN, cfg.MAX_SEQ_LEN,
        cfg.START_YEAR, cfg.END_YEAR, cfg.MAX_SEQUENCES * 2,
    )
    if not ids:
        logger.error("No sequences found")
        return []

    records = fetch_records(ids)
    logger.info("Parsed %d valid records", len(records))

    sampled = sample_by_year(records, cfg.START_YEAR, cfg.END_YEAR, cfg.MAX_PER_YEAR)
    logger.info("Sampled %d sequences across years", len(sampled))

    write_fasta(sampled, cfg.SEQUENCES_FASTA)
    return sampled
