export default function StatsPanel({ meta, divergence }) {
  if (!meta || !divergence) return null;

  const allDists = divergence.per_year.flatMap((g) => g.sequences.map((s) => s.distance));
  const maxDist = allDists.length ? Math.max(...allDists) : 0;
  const latestYear = divergence.per_year.at(-1);

  const stats = [
    {
      label: "Total Sequences",
      value: meta.total_sequences,
      sub: `${meta.start_year} – ${meta.end_year}`,
    },
    {
      label: "Countries",
      value: meta.countries?.length ?? "—",
      sub: meta.countries?.slice(0, 3).join(", ") + (meta.countries?.length > 3 ? "…" : ""),
    },
    {
      label: "Max p-Distance",
      value: maxDist.toFixed(4),
      sub: "from prototype reference",
    },
    {
      label: `${latestYear?.year ?? ""} Mean Distance`,
      value: latestYear?.mean?.toFixed(4) ?? "—",
      sub: `n = ${latestYear?.count ?? 0} sequences`,
    },
    {
      label: "Last Updated",
      value: meta.last_updated,
      sub: meta.data_source,
    },
  ];

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-slate-700 bg-surface-800 px-4 py-3"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{s.label}</p>
          <p className="mt-1 text-xl font-bold text-slate-100 font-mono">{s.value}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}
