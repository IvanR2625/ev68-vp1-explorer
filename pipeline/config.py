"""Pipeline configuration for EV-D68 VP1 sequence analysis."""

import os
from pathlib import Path

NCBI_EMAIL = os.getenv("NCBI_EMAIL", "researcher@example.com")

ORGANISM = "Enterovirus D68"
TAXID = 42789
GENE = "VP1"

START_YEAR = 2014
END_YEAR = 2024
MIN_SEQ_LEN = 700
MAX_SEQ_LEN = 1050
MAX_SEQUENCES = 300
MAX_PER_YEAR = 25

ROOT_DIR = Path(__file__).parent.parent
DATA_DIR = ROOT_DIR / "web" / "public" / "data"
TEMP_DIR = ROOT_DIR / "pipeline" / "temp"

DATA_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)

SEQUENCES_FASTA = TEMP_DIR / "sequences_raw.fasta"
ALIGNED_FASTA = TEMP_DIR / "sequences_aligned.fasta"
TREE_NEWICK = TEMP_DIR / "tree.nwk"
TREE_JSON = DATA_DIR / "tree.json"
DIVERGENCE_JSON = DATA_DIR / "divergence.json"
METADATA_JSON = DATA_DIR / "metadata.json"

MAFFT_CMD = "mafft"
FASTTREE_CMD = "FastTree"
