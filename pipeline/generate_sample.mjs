// Node.js port of generate_sample.py — seeds web/public/data/ with demo data
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "web", "public", "data");
mkdirSync(DATA_DIR, { recursive: true });

// Seeded pseudo-random (LCG) for reproducibility
let seed = 42;
function rand() {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff;
  return ((seed >>> 0) / 0xffffffff);
}
function randn() {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function choice(arr, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
}
function sample(arr, n) {
  const a = [...arr]; const out = [];
  for (let i = 0; i < n && a.length; i++) {
    const idx = Math.floor(rand() * a.length);
    out.push(a.splice(idx, 1)[0]);
  }
  return out;
}

const YEARS = Array.from({ length: 11 }, (_, i) => 2014 + i);
const COUNTRIES = ["USA","Germany","Japan","Netherlands","United Kingdom","China","Canada","France","Australia","South Korea","Italy","Spain","Brazil","India","Sweden"];
const CW = [30,12,10,8,8,7,5,4,3,3,2,2,2,2,2];
const CLADES = { A: [2014,2015,2016,2017,2018], B: YEARS, C: [2016,2017,2018,2019,2020,2021,2022,2023,2024], D: [2018,2019,2020,2021,2022,2023,2024] };
const DIV_MEANS = {2014:0.018,2015:0.022,2016:0.031,2017:0.038,2018:0.044,2019:0.049,2020:0.051,2021:0.054,2022:0.061,2023:0.066,2024:0.071};
const PREFIXES = {2014:"KM",2015:"KP",2016:"KX",2017:"MF",2018:"MH",2019:"MK",2020:"MT",2021:"MW",2022:"OP",2023:"OR",2024:"PQ"};

function assignClade(year) {
  const eligible = Object.entries(CLADES).filter(([, yrs]) => yrs.includes(year)).map(([c]) => c);
  const weights = eligible.map(c => {
    if (c === "A") return Math.max(0.05, 1 - (year - 2014) * 0.12);
    if (c === "B") return 0.5;
    if (c === "C") return year > 2015 ? Math.min(0.9, (year - 2015) * 0.15) : 0.05;
    return year > 2017 ? Math.min(0.8, (year - 2017) * 0.18) : 0.05;
  });
  return choice(eligible, weights);
}

// Generate sequences
const seqs = [];
for (const year of YEARS) {
  const n = 10 + Math.floor(rand() * 16); // 10-25
  for (let i = 0; i < n; i++) {
    const clade = assignClade(year);
    const mu = DIV_MEANS[year];
    const dist = Math.max(0.001, mu + randn() * mu * 0.20);
    const country = choice(COUNTRIES, CW);
    const prefix = PREFIXES[year];
    const num = 881700 + year * 30 + i;
    seqs.push({
      accession: `${prefix}${num}`,
      year, country, clade,
      distance: Math.round(dist * 1e6) / 1e6,
      strain: `EV-D68/${country.replace(/ /g,"_")}/${year}/${String(i+1).padStart(2,"0")}`,
    });
  }
}

// ── Tree JSON ────────────────────────────────────────────────────────────────
function buildTree(seqs) {
  const byClade = {};
  for (const s of seqs) { (byClade[s.clade] ||= []).push(s); }
  const cladeNodes = Object.entries(byClade).sort().map(([clade, members]) => {
    const byYear = {};
    for (const m of members) { (byYear[m.year] ||= []).push(m); }
    const yearNodes = Object.entries(byYear).sort().map(([yr, yrMembers]) => {
      const leaves = yrMembers.map(m => ({
        name: `${m.accession}|${m.year}|${m.country.replace(/ /g,"_")}`,
        branchLength: Math.round((m.distance * 0.4 + rand() * 0.005) * 1e6) / 1e6,
        isLeaf: true, accession: m.accession, year: m.year,
        country: m.country, strain: m.strain, clade: m.clade, distance: m.distance,
      }));
      return { name: `clade_${clade}_${yr}`, branchLength: Math.round((0.005 + rand()*0.003)*1e6)/1e6, children: leaves };
    });
    return { name: `clade_${clade}`, branchLength: Math.round((0.01 + rand()*0.015)*1e6)/1e6, children: yearNodes };
  });
  return { name: "root", branchLength: 0, children: cladeNodes };
}

// ── Divergence JSON ──────────────────────────────────────────────────────────
function buildDivergence(seqs) {
  const byYear = {};
  for (const s of seqs) { (byYear[s.year] ||= []).push(s); }
  const per_year = YEARS.filter(y => byYear[y]).map(year => {
    const group = byYear[year];
    const dists = group.map(s => s.distance);
    const mean = dists.reduce((a,b)=>a+b,0)/dists.length;
    const variance = dists.map(d=>(d-mean)**2).reduce((a,b)=>a+b,0)/Math.max(1,dists.length-1);
    const stdev = Math.sqrt(variance);
    const sorted = [...group].sort((a,b)=>a.distance-b.distance);
    return {
      year, count: group.length,
      mean: Math.round(mean*1e6)/1e6,
      stdev: Math.round(stdev*1e6)/1e6,
      min: Math.round(Math.min(...dists)*1e6)/1e6,
      max: Math.round(Math.max(...dists)*1e6)/1e6,
      sequences: sorted.map(({accession,year,country,distance,strain,clade})=>({accession,year,country,distance,strain,clade})),
    };
  });
  return { reference: "Fermon_prototype_1962", per_year, total_sequences: seqs.length };
}

// ── Metadata JSON ─────────────────────────────────────────────────────────────
function buildMetadata(seqs) {
  const countries = [...new Set(seqs.map(s=>s.country))].sort();
  return {
    virus: "Enterovirus D68", gene: "VP1",
    description: "VP1 (Viral Protein 1) is the primary surface-exposed capsid protein of Enterovirus D68. It determines receptor binding and antibody neutralization, and is used for genotype classification into clades A–D. EV-D68 caused large outbreaks of severe respiratory illness and acute flaccid myelitis (AFM) in 2014, 2016, 2018, and 2022 in North America and Europe.",
    start_year: 2014, end_year: 2024,
    total_sequences: seqs.length,
    countries,
    year_range: [2014, 2024],
    data_source: "NCBI Nucleotide (sample data — run pipeline for real sequences)",
    last_updated: new Date().toISOString().split("T")[0],
    is_sample: true,
  };
}

const tree = buildTree(seqs);
const div = buildDivergence(seqs);
const meta = buildMetadata(seqs);

writeFileSync(join(DATA_DIR, "tree.json"), JSON.stringify(tree));
writeFileSync(join(DATA_DIR, "divergence.json"), JSON.stringify(div, null, 2));
writeFileSync(join(DATA_DIR, "metadata.json"), JSON.stringify(meta, null, 2));

console.log(`Generated ${seqs.length} sequences across ${YEARS.length} years`);
console.log(`  tree.json, divergence.json, metadata.json → ${DATA_DIR}`);
