"""Align sequences with MAFFT (falls back to pairwise if unavailable)."""

import logging
import shutil
import subprocess

logger = logging.getLogger(__name__)


def run_mafft(input_fasta, output_fasta, mafft_cmd="mafft") -> bool:
    if not shutil.which(mafft_cmd):
        logger.warning("mafft not found in PATH")
        return False
    cmd = [mafft_cmd, "--auto", "--thread", "-1", str(input_fasta)]
    logger.info("Running MAFFT: %s", " ".join(cmd))
    with open(output_fasta, "w") as out:
        result = subprocess.run(cmd, stdout=out, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        logger.error("MAFFT failed: %s", result.stderr[-500:])
        return False
    logger.info("Alignment written to %s", output_fasta)
    return True


def run_muscle(input_fasta, output_fasta) -> bool:
    muscle = shutil.which("muscle") or shutil.which("muscle3")
    if not muscle:
        return False
    cmd = [muscle, "-in", str(input_fasta), "-out", str(output_fasta)]
    logger.info("Running MUSCLE")
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0


def run(cfg) -> None:
    """Align sequences; tries MAFFT then MUSCLE."""
    success = run_mafft(cfg.SEQUENCES_FASTA, cfg.ALIGNED_FASTA, cfg.MAFFT_CMD)
    if not success:
        success = run_muscle(cfg.SEQUENCES_FASTA, cfg.ALIGNED_FASTA)
    if not success:
        raise RuntimeError(
            "No aligner found. Install MAFFT: conda install -c bioconda mafft"
        )
