import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const YEAR_MIN = 2014;
const YEAR_MAX = 2024;
const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([YEAR_MIN, YEAR_MAX]);
const yearColors = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => ({
  year: YEAR_MIN + i,
  color: colorScale(YEAR_MIN + i),
}));

function drawTree(svgEl, containerEl, data) {
  const W = containerEl.clientWidth || 720;
  const H = containerEl.clientHeight || 540;
  const ML = 8, MR = 170, MT = 16, MB = 16;
  const innerW = W - ML - MR;
  const innerH = H - MT - MB;

  const svg = d3.select(svgEl)
    .attr("width", W)
    .attr("height", H)
    .attr("viewBox", `0 0 ${W} ${H}`);

  svg.selectAll("*").remove();

  // Zoom group
  const zoomG = svg.append("g");
  svg.call(
    d3.zoom()
      .scaleExtent([0.05, 8])
      .on("zoom", (e) => zoomG.attr("transform", e.transform))
  );

  const g = zoomG.append("g").attr("transform", `translate(${ML},${MT})`);

  const root = d3.hierarchy(data);
  const leaves = root.leaves();

  // Cluster layout
  d3.cluster().size([innerH, innerW * 0.75])(root);

  // Rescale x (depth axis) using cumulative branch lengths
  root.each((node) => {
    node._y = node.parent
      ? (node.parent._y || 0) + Math.abs(node.data.branchLength || 0)
      : 0;
  });
  const maxY = d3.max(root.descendants(), (d) => d._y) || 1;
  root.each((node) => { node.y = (node._y / maxY) * innerW * 0.78; });

  // Links — elbow (cladogram style)
  g.append("g")
    .attr("class", "links")
    .selectAll("path")
    .data(root.links())
    .join("path")
    .attr("fill", "none")
    .attr("stroke", "#334155")
    .attr("stroke-width", 0.8)
    .attr("d", (d) =>
      `M${d.source.y},${d.source.x}H${d.target.y}V${d.target.x}`
    );

  // Tooltip div
  const tooltip = d3.select("body")
    .selectAll(".phylo-tip")
    .data([null])
    .join("div")
    .attr("class", "tooltip phylo-tip")
    .style("display", "none")
    .style("position", "fixed");

  // Leaf nodes
  const leafG = g.append("g").attr("class", "leaves");
  leaves.forEach((leaf) => {
    const lg = leafG.append("g").attr("class", "leaf");

    lg.append("circle")
      .attr("cx", leaf.y)
      .attr("cy", leaf.x)
      .attr("r", 3.5)
      .attr("fill", leaf.data.year ? colorScale(leaf.data.year) : "#64748b")
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 0.8)
      .on("mouseover", (event) => {
        const d = leaf.data;
        tooltip
          .style("display", "block")
          .style("left", event.clientX + 14 + "px")
          .style("top", event.clientY - 10 + "px")
          .html(
            `<div class="font-mono text-emerald-400">${d.accession || d.name}</div>` +
            `<div class="text-slate-300">${d.strain || ""}</div>` +
            `<div class="mt-1 text-slate-400">${d.country || "—"} · ${d.year || "?"}</div>` +
            (d.clade ? `<div class="text-slate-500">Clade ${d.clade}</div>` : "") +
            (d.distance != null ? `<div class="text-slate-500">p-dist: ${d.distance?.toFixed(4)}</div>` : "")
          );
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", event.clientX + 14 + "px")
          .style("top", event.clientY - 10 + "px");
      })
      .on("mouseout", () => tooltip.style("display", "none"));

    // Label (only show if enough space)
    if (leaves.length < 120) {
      lg.append("text")
        .attr("x", leaf.y + 6)
        .attr("y", leaf.x)
        .attr("dy", "0.35em")
        .attr("font-size", "7px")
        .attr("fill", "#64748b")
        .text(`${leaf.data.accession || ""} (${leaf.data.year || ""})`);
    }
  });

  // Internal nodes
  g.append("g")
    .selectAll("circle")
    .data(root.descendants().filter((d) => d.children))
    .join("circle")
    .attr("cx", (d) => d.y)
    .attr("cy", (d) => d.x)
    .attr("r", 1.5)
    .attr("fill", "#475569");

  // Year legend (right side)
  const legendG = svg.append("g").attr("transform", `translate(${W - MR + 12},${MT + 20})`);
  legendG.append("text")
    .attr("y", -8)
    .attr("font-size", "9px")
    .attr("font-weight", "600")
    .attr("fill", "#64748b")
    .attr("letter-spacing", "0.08em")
    .text("YEAR");

  yearColors.forEach(({ year, color }, i) => {
    legendG.append("circle").attr("cx", 6).attr("cy", i * 16 + 4).attr("r", 5).attr("fill", color);
    legendG.append("text")
      .attr("x", 16).attr("y", i * 16 + 8)
      .attr("font-size", "9px").attr("fill", "#94a3b8")
      .text(year);
  });

  // Scale bar
  const sbG = g.append("g").attr("transform", `translate(4,${innerH - 20})`);
  const scaleLen = (0.01 / maxY) * innerW * 0.78;
  sbG.append("line").attr("x1", 0).attr("x2", scaleLen).attr("y1", 0).attr("y2", 0)
    .attr("stroke", "#475569").attr("stroke-width", 1.5);
  sbG.append("text").attr("x", scaleLen / 2).attr("y", -4).attr("text-anchor", "middle")
    .attr("font-size", "8px").attr("fill", "#64748b").text("0.01 substitutions/site");
}

export default function PhyloTree({ treeData }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!treeData || !svgRef.current || !containerRef.current) return;
    drawTree(svgRef.current, containerRef.current, treeData);
    setRendered(true);
  }, [treeData]);

  // Redraw on resize
  useEffect(() => {
    if (!treeData) return;
    const ro = new ResizeObserver(() => {
      if (svgRef.current && containerRef.current) {
        drawTree(svgRef.current, containerRef.current, treeData);
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [treeData]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden rounded-lg bg-surface-900">
      <svg ref={svgRef} className="tree-svg w-full h-full" />
      {!rendered && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
          Rendering tree…
        </div>
      )}
      <p className="absolute bottom-2 right-2 text-xs text-slate-600 select-none">
        scroll to zoom · drag to pan
      </p>
    </div>
  );
}
