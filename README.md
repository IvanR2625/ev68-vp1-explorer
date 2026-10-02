# EV-D68 VP1 Divergence Explorer

Interactive 10-year phylogenetic and temporal-divergence analysis of
**Enterovirus D68 VP1** (the major capsid / surface protein) using sequences
from NCBI Nucleotide.

## Live demo

Deployed on Vercel — https://temporary-instant-thunder-bcapa5b.vercel.app/ 

## What it shows

| Panel | Content |
|---|---|
| Phylogenetic tree | D3-rendered cladogram of all VP1 sequences, coloured by collection year |
| Divergence plot | p-distance from the Fermon prototype reference over 2014–2024, with ±1 SD band and outbreak year markers |
| Sequence table | Sortable / filterable table linking each accession back to NCBI |

## Quick start (demo data — no NCBI needed)

```bash
python pipeline/generate_sample.py   # creates web/public/data/*.json
cd web
npm install
npm run dev                           # http://localhost:5173
```

## Real NCBI data

Prerequisites (install via conda or system package manager):
```
conda install -c bioconda mafft fasttree
pip install -r pipeline/requirements.txt
```

Set your NCBI email (required for Entrez):
```bash
export NCBI_EMAIL=your@email.com
```

Run the pipeline:
```bash
python pipeline/run_pipeline.py
```

This fetches ≤250 EV-D68 VP1 sequences (2014–2024), aligns them with MAFFT,
builds a GTR+Γ tree with FastTree, and computes per-year divergence statistics.
Output goes to `web/public/data/`.

## Deployment (Vercel — free)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo
3. Vercel auto-detects the `vercel.json` config (`rootDirectory: web`)
4. Add `NCBI_EMAIL` as a **GitHub Actions secret** (for monthly auto-refresh):
   `Settings → Secrets → Actions → New repository secret`
5. Done — Vercel gives you a `*.vercel.app` URL instantly

The GitHub Actions workflow (`.github/workflows/update_data.yml`) re-runs the
pipeline on the 1st of each month and pushes fresh JSON, which triggers a new
Vercel deploy automatically.

## Project structure

```
├── pipeline/
│   ├── config.py           configuration
│   ├── fetch.py            NCBI Entrez fetch
│   ├── align.py            MAFFT wrapper
│   ├── tree.py             FastTree + Newick→JSON
│   ├── divergence.py       p-distance per year
│   ├── run_pipeline.py     orchestrator
│   └── generate_sample.py  synthetic demo data
├── web/
│   ├── src/
│   │   ├── App.jsx
│   │   └── components/
│   │       ├── PhyloTree.jsx      D3 cladogram (zoom/pan)
│   │       ├── DivergencePlot.jsx Recharts scatter + line
│   │       ├── Header.jsx
│   │       └── StatsPanel.jsx
│   └── public/data/        ← pipeline output (committed to repo)
├── vercel.json
└── .github/workflows/update_data.yml
```

## Background

EV-D68 is an understudied picornavirus that caused surprising outbreaks of
severe respiratory illness and **acute flaccid myelitis (AFM)** — a polio-like
paralysis — in 2014, 2016, 2018, and 2022. VP1 is the primary surface protein
and the basis for the four-clade (A–D) classification system. Monitoring VP1
divergence helps track clade emergence and assess vaccine/antibody escape risk.
