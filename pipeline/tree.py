"""Build phylogenetic tree with FastTree and export to D3 JSON."""

import json
import logging
import shutil
import subprocess
from io import StringIO

from Bio import Phylo

logger = logging.getLogger(__name__)


def run_fasttree(aligned_fasta, tree_newick, fasttree_cmd="FastTree") -> bool:
    cmd = shutil.which(fasttree_cmd) or shutil.which(fasttree_cmd.lower())
    if not cmd:
        logger.warning("FastTree not found in PATH")
        return False
    args = [cmd, "-nt", "-gtr", "-gamma", str(aligned_fasta)]
    logger.info("Running FastTree")
    with open(tree_newick, "w") as out:
        result = subprocess.run(args, stdout=out, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        logger.error("FastTree failed: %s", result.stderr[-500:])
        return False
    logger.info("Tree written to %s", tree_newick)
    return True


def _clade_to_dict(clade, metadata: dict) -> dict:
    name = str(clade.name) if clade.name else ""
    branch_len = float(clade.branch_length) if clade.branch_length else 0.0

    node: dict = {"name": name, "branchLength": round(branch_len, 6)}

    if clade.clades:
        node["children"] = [_clade_to_dict(c, metadata) for c in clade.clades]
    else:
        accession = name.split("|")[0] if "|" in name else name
        meta = metadata.get(accession, {})
        node.update(
            {
                "isLeaf": True,
                "accession": accession,
                "year": meta.get("collection_year"),
                "country": meta.get("country", "Unknown"),
                "strain": meta.get("strain", accession),
            }
        )
    return node


def newick_to_json(newick_path, metadata_by_accession: dict, output_json) -> None:
    with open(newick_path) as fh:
        newick_str = fh.read().strip()

    tree = Phylo.read(StringIO(newick_str), "newick")
    d3_tree = _clade_to_dict(tree.root, metadata_by_accession)

    with open(output_json, "w") as fh:
        json.dump(d3_tree, fh, separators=(",", ":"))
    logger.info("Tree JSON written to %s", output_json)


def run(cfg, metadata_by_accession: dict) -> None:
    success = run_fasttree(cfg.ALIGNED_FASTA, cfg.TREE_NEWICK, cfg.FASTTREE_CMD)
    if not success:
        raise RuntimeError(
            "FastTree not found. Install: conda install -c bioconda fasttree"
        )
    newick_to_json(cfg.TREE_NEWICK, metadata_by_accession, cfg.TREE_JSON)
