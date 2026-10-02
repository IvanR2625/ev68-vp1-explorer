import { useEffect, useState } from "react";
import Header from "./components/Header";
import StatsPanel from "./components/StatsPanel";
import PhyloTree from "./components/PhyloTree";
import DivergencePlot from "./components/DivergencePlot";

async function fetchJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}

export default function App() {
  const [meta, setMeta] = useState(null);
  const [tree, setTree] = useState(null);
  const [divergence, setDivergence] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchJSON("./data/metadata.json"),
      fetchJSON("./data/tree.json"),
      fetchJSON("./data/divergence.json"),
    ])
      .then(([m, t, d]) => {
        setMeta(m);
        setTree(t);
        setDivergence(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent mx-auto" />
          <p className="text-slate-400">Loading sequence data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="rounded-xl border border-red-800 bg-red-950/30 p-8 text-center max-w-md">
          <p className="text-red-400 font-semibold mb-2">Data not found</p>
          <p className="text-slate-400 text-sm">
            Run <code className="text-emerald-400">python pipeline/generate_sample.py</code> to
            seed demo data, or <code className="text-emerald-400">python pipeline/run_pipeline.py</code> for
            real NCBI sequences.
          </p>
          <p className="text-slate-600 text-xs mt-3">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header meta={meta} />

      <main className="flex-1 container mx-auto max-w-screen-2xl px-4 pb-8">
        <StatsPanel meta={meta} divergence={divergence} />

        {/* Main visualizations */}
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
          {/* Phylogenetic tree — wider column */}
          <section className="xl:col-span-3 rounded-xl border border-slate-700 bg-surface-800 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Phylogenetic Tree · VP1 (2014 – 2024)
            </h2>
            <div className="h-[560px]">
              <PhyloTree treeData={tree} />
            </div>
          </section>

          {/* Divergence plot */}
          <section className="xl:col-span-2 rounded-xl border border-slate-700 bg-surface-800 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
              VP1 Divergence Over Time
            </h2>
            <div className="h-[560px]">
              <DivergencePlot data={divergence} />
            </div>
          </section>
        </div>

        {/* Sequence table */}
        <section className="mt-6 rounded-xl border border-slate-700 bg-surface-800 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            All Sequences
          </h2>
          <SequenceTable divergence={divergence} />
        </section>
      </main>

      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-600">
        Data: NCBI Nucleotide · Sequences: {meta?.total_sequences} · Updated: {meta?.last_updated}
        {meta?.is_sample && (
          <span className="ml-2 rounded bg-amber-900/50 px-2 py-0.5 text-amber-400">
            sample data
          </span>
        )}
      </footer>
    </div>
  );
}

function SequenceTable({ divergence }) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState("year");
  const [sortDir, setSortDir] = useState(1);

  if (!divergence) return null;

  const all = divergence.per_year.flatMap((g) => g.sequences);

  const filtered = all.filter((s) => {
    const q = filter.toLowerCase();
    return (
      !q ||
      s.accession.toLowerCase().includes(q) ||
      s.country.toLowerCase().includes(q) ||
      (s.strain || "").toLowerCase().includes(q) ||
      String(s.year).includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    return sortDir * (av < bv ? -1 : av > bv ? 1 : 0);
  });

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => -d);
    else { setSortKey(key); setSortDir(1); }
  }

  const TH = ({ k, label }) => (
    <th
      onClick={() => toggleSort(k)}
      className="cursor-pointer select-none px-3 py-2 text-left text-xs font-semibold
                 uppercase tracking-wider text-slate-400 hover:text-slate-200"
    >
      {label}
      {sortKey === k && (sortDir === 1 ? " ↑" : " ↓")}
    </th>
  );

  return (
    <div>
      <input
        type="search"
        placeholder="Filter by accession, country, strain, year…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-3 w-full max-w-sm rounded-lg border border-slate-700 bg-surface-900
                   px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500
                   focus:border-emerald-500 focus:outline-none"
      />
      <div className="max-h-72 overflow-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-700">
            <tr>
              <TH k="accession" label="Accession" />
              <TH k="year" label="Year" />
              <TH k="country" label="Country" />
              <TH k="distance" label="p-Distance" />
              {sorted[0]?.clade && <TH k="clade" label="Clade" />}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 500).map((s) => (
              <tr key={s.accession} className="border-t border-slate-700/50 hover:bg-surface-700/40">
                <td className="px-3 py-1.5 font-mono text-emerald-400">
                  <a
                    href={`https://www.ncbi.nlm.nih.gov/nuccore/${s.accession}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {s.accession}
                  </a>
                </td>
                <td className="px-3 py-1.5 text-slate-300">{s.year}</td>
                <td className="px-3 py-1.5 text-slate-400">{s.country}</td>
                <td className="px-3 py-1.5 font-mono text-slate-300">{s.distance?.toFixed(4)}</td>
                {s.clade && (
                  <td className="px-3 py-1.5">
                    <span className="rounded px-1.5 py-0.5 text-xs font-semibold bg-slate-700 text-slate-300">
                      {s.clade}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length > 500 && (
          <p className="px-3 py-2 text-xs text-slate-500">
            Showing 500 of {sorted.length} — narrow your filter
          </p>
        )}
      </div>
    </div>
  );
}
