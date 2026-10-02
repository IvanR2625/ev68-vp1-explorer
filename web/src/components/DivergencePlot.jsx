import {
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ErrorBar, Area,
} from "recharts";
import * as d3 from "d3";

const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([2014, 2024]);

const OUTBREAK_YEARS = [2014, 2016, 2018, 2022];

function CustomDot({ cx, cy, payload }) {
  if (!payload?.year) return null;
  return (
    <circle
      cx={cx} cy={cy} r={3}
      fill={colorScale(payload.year)}
      fillOpacity={0.7}
      stroke="none"
    />
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  if (d._type === "mean") {
    return (
      <div className="tooltip">
        <div className="font-semibold text-slate-100">{d.year}</div>
        <div className="text-emerald-400">Mean: {d.mean?.toFixed(4)}</div>
        <div className="text-slate-400">±{d.stdev?.toFixed(4)} SD</div>
        <div className="text-slate-500">{d.count} sequences</div>
      </div>
    );
  }
  return (
    <div className="tooltip">
      <div className="font-mono text-emerald-400">{d.accession}</div>
      <div className="text-slate-300">{d.country} · {d.year}</div>
      <div className="text-slate-400">p-dist: {d.distance?.toFixed(4)}</div>
      {d.clade && <div className="text-slate-500">Clade {d.clade}</div>}
    </div>
  );
}

export default function DivergencePlot({ data }) {
  if (!data?.per_year) return null;

  // Scatter data: all individual sequences
  const scatterData = data.per_year.flatMap((g) =>
    g.sequences.map((s) => ({
      ...s,
      _type: "seq",
      // jitter year slightly for scatter readability
      yearJitter: s.year + (Math.random() - 0.5) * 0.25,
    }))
  );

  // Mean line data
  const meanData = data.per_year.map((g) => ({
    year: g.year,
    mean: g.mean,
    stdev: g.stdev,
    count: g.count,
    upper: g.mean + g.stdev,
    lower: Math.max(0, g.mean - g.stdev),
    _type: "mean",
  }));

  const allYears = data.per_year.map((g) => g.year);
  const minYear = Math.min(...allYears);
  const maxYear = Math.max(...allYears);

  return (
    <div className="flex flex-col h-full">
      <ResponsiveContainer width="100%" height="75%">
        <ComposedChart margin={{ top: 12, right: 16, bottom: 40, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="yearJitter"
            type="number"
            domain={[minYear - 0.5, maxYear + 0.5]}
            tickCount={maxYear - minYear + 1}
            tickFormatter={(v) => Math.round(v)}
            tick={{ fill: "#64748b", fontSize: 11 }}
            label={{ value: "Collection Year", position: "insideBottom", offset: -28, fill: "#475569", fontSize: 11 }}
          />
          <YAxis
            dataKey="distance"
            type="number"
            tickFormatter={(v) => v.toFixed(3)}
            tick={{ fill: "#64748b", fontSize: 11 }}
            label={{ value: "p-distance from reference", angle: -90, position: "insideLeft", offset: 14, fill: "#475569", fontSize: 10 }}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Outbreak year references */}
          {OUTBREAK_YEARS.filter((y) => y >= minYear && y <= maxYear).map((y) => (
            <ReferenceLine
              key={y}
              x={y}
              stroke="#ef444420"
              strokeWidth={18}
              label={{ value: `${y} outbreak`, position: "top", fill: "#ef4444", fontSize: 9 }}
            />
          ))}

          {/* ±1 SD band */}
          <Area
            data={meanData}
            dataKey="upper"
            type="monotone"
            stroke="none"
            fill="#10b98118"
            xAxisId={0}
            yAxisId={0}
          />
          <Area
            data={meanData}
            dataKey="lower"
            type="monotone"
            stroke="none"
            fill="#0f172a"
            xAxisId={0}
            yAxisId={0}
          />

          {/* Individual sequences scatter */}
          <Scatter
            data={scatterData}
            dataKey="distance"
            xAxisId={0}
            yAxisId={0}
            shape={<CustomDot />}
            isAnimationActive={false}
          />

          {/* Mean line */}
          <Line
            data={meanData}
            dataKey="mean"
            type="monotone"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: "#10b981", r: 4, stroke: "#0f172a", strokeWidth: 1.5 }}
            xAxisId={0}
            yAxisId={0}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Year color legend */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-2">
        {data.per_year.map((g) => (
          <span key={g.year} className="flex items-center gap-1 text-xs text-slate-400">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: colorScale(g.year) }}
            />
            {g.year} <span className="text-slate-600">({g.count})</span>
          </span>
        ))}
      </div>

      {/* Mean-per-year mini table */}
      <div className="mt-3 overflow-auto rounded border border-slate-700/50 text-xs">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              {["Year", "n", "Mean", "±SD", "Range"].map((h) => (
                <th key={h} className="px-2 py-1 text-left font-semibold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.per_year.map((g) => (
              <tr key={g.year} className="border-t border-slate-800/60 hover:bg-surface-700/30">
                <td className="px-2 py-1 font-mono text-slate-300">{g.year}</td>
                <td className="px-2 py-1 text-slate-500">{g.count}</td>
                <td className="px-2 py-1 font-mono text-emerald-400">{g.mean.toFixed(4)}</td>
                <td className="px-2 py-1 font-mono text-slate-400">{g.stdev.toFixed(4)}</td>
                <td className="px-2 py-1 font-mono text-slate-500">{g.min.toFixed(3)}–{g.max.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
