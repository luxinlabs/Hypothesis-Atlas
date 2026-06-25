"use client";

import { useEffect, useRef, useState } from "react";
import { appendNote } from "@/lib/notes";

interface KnowledgeNodeRef {
  nodeId: string;
  nodeLabel: string;
  depth: number;
  role: string;
}

interface PaperNode {
  id: string;
  title: string;
  url: string | null;
  reliabilityTier: string;
  type: string;
  venue: string | null;
  authors: string[];
  snippet: string | null;
  publishedAt: string | null;
  knowledgeNodes: KnowledgeNodeRef[];
}

interface PaperLink {
  source: string;
  target: string;
  sharedNode: string;
}

interface SimNode extends PaperNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface ComparisonResult {
  approachComparison: {
    summary: string;
    paperA: string;
    paperB: string;
    keyDifference: string;
  };
  gapAnalysis: {
    paperAGap: string;
    paperBGap: string;
    combinedOpportunity: string;
  };
}

interface PaperMapProps {
  jobId: string;
  theme?: "dark" | "light" | "vibrant";
}

const TIER_COLOR: Record<string, { fill: string; stroke: string; label: string }> = {
  peer_reviewed: { fill: "#3b82f6", stroke: "#1d4ed8", label: "Peer-reviewed" },
  dataset: { fill: "#10b981", stroke: "#047857", label: "Dataset" },
  social_signal: { fill: "#f59e0b", stroke: "#b45309", label: "Social / Preprint" },
};

const fallbackColor = { fill: "#8b5cf6", stroke: "#6d28d9", label: "Other" };

const W = 900;
const H = 600;
const CX = W / 2;
const CY = H / 2;

function layoutNodes(nodes: PaperNode[]): SimNode[] {
  if (nodes.length === 0) return [];

  const groups: Record<string, PaperNode[]> = {
    peer_reviewed: [],
    dataset: [],
    social_signal: [],
    other: [],
  };

  for (const n of nodes) {
    const key = n.reliabilityTier in groups ? n.reliabilityTier : "other";
    groups[key].push(n);
  }

  // Sort each group by weight (knowledgeNodes.length) descending
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => b.knowledgeNodes.length - a.knowledgeNodes.length);
  }

  const radii: Record<string, number> = {
    peer_reviewed: 160,
    dataset: 240,
    social_signal: 310,
    other: 310,
  };

  const placed: SimNode[] = [];

  for (const [tier, group] of Object.entries(groups)) {
    if (group.length === 0) continue;
    const r = radii[tier] ?? 280;
    group.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
      placed.push({
        ...node,
        x: CX + r * Math.cos(angle),
        y: CY + r * Math.sin(angle),
        vx: 0,
        vy: 0,
      });
    });
  }

  // Simple repulsion pass to avoid overlaps
  for (let pass = 0; pass < 60; pass++) {
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const dx = placed[j].x - placed[i].x;
        const dy = placed[j].y - placed[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = 70;
        if (dist < minDist) {
          const force = ((minDist - dist) / dist) * 0.5;
          placed[i].x -= dx * force;
          placed[i].y -= dy * force;
          placed[j].x += dx * force;
          placed[j].y += dy * force;
        }
      }
    }
  }

  // Clamp within SVG bounds with padding
  const PAD = 50;
  for (const n of placed) {
    n.x = Math.max(PAD, Math.min(W - PAD, n.x));
    n.y = Math.max(PAD, Math.min(H - PAD, n.y));
  }

  return placed;
}

export default function PaperMap({ jobId, theme = "light" }: PaperMapProps) {
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [links, setLinks] = useState<PaperLink[]>([]);
  const [selected, setSelected] = useState<SimNode | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  // Compare mode state
  const [compareMode, setCompareMode] = useState(false);
  const [compareSet, setCompareSet] = useState<string[]>([]);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [comparing, setComparing] = useState(false);

  const isDark = theme === "dark";

  useEffect(() => {
    setLoading(true);
    fetch(`/api/jobs/${jobId}/paper-map`)
      .then((r) => r.json())
      .then((data) => {
        setNodes(layoutNodes(data.nodes ?? []));
        setLinks(data.links ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [jobId]);

  // Auto-fetch comparison when 2 papers are in compareSet
  useEffect(() => {
    if (compareSet.length === 2) {
      setComparing(true);
      setComparison(null);
      fetch(`/api/jobs/${jobId}/paper-compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperAId: compareSet[0], paperBId: compareSet[1] }),
      })
        .then((r) => r.json())
        .then((data: ComparisonResult) => setComparison(data))
        .catch(console.error)
        .finally(() => setComparing(false));
    }
  }, [compareSet, jobId]);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const maxWeight = Math.max(1, ...nodes.map((n) => n.knowledgeNodes.length));

  // Hub-and-spoke link model
  // Build connected-paper IDs for selected paper
  const selectedConnectedIds = selected
    ? new Set(
        links
          .filter((l) => l.source === selected.id || l.target === selected.id)
          .flatMap((l) => [l.source, l.target])
      )
    : new Set<string>();

  const handleNodeClick = (node: SimNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (compareMode) {
      setCompareSet((prev) => {
        if (prev.includes(node.id)) {
          return prev.filter((id) => id !== node.id);
        }
        if (prev.length >= 2) return prev;
        return [...prev, node.id];
      });
      return;
    }
    setSelected((prev) => (prev?.id === node.id ? null : node));
  };

  const handleExitCompare = () => {
    setCompareMode(false);
    setCompareSet([]);
    setComparison(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className={`text-sm ${isDark ? "text-zinc-400" : "text-gray-500"}`}>
            Building paper map...
          </p>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className={`text-sm ${isDark ? "text-zinc-400" : "text-gray-500"}`}>
          No papers available yet. Wait for the knowledge tree to build.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* SVG graph */}
      <div className="flex-1 relative overflow-hidden">
        {/* Legend */}
        <div
          className={`absolute top-4 left-4 z-10 rounded-xl px-4 py-3 text-xs space-y-1 shadow-sm border ${
            isDark ? "bg-zinc-900 border-zinc-700" : "bg-white border-gray-200"
          }`}
        >
          {Object.entries(TIER_COLOR).map(([tier, { fill, label }]) => (
            <div key={tier} className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ background: fill }}
              />
              <span className={isDark ? "text-zinc-300" : "text-gray-600"}>{label}</span>
            </div>
          ))}
          <div className={`pt-1 mt-1 border-t text-[10px] leading-snug ${isDark ? "text-zinc-500 border-zinc-700" : "text-gray-400 border-gray-200"}`}>
            Lines = knowledge node connections to Research hub<br />
            thickness = connection weight
          </div>
        </div>

        {/* Compare mode toggle */}
        <div className="absolute top-4 right-4 z-10">
          <button
            type="button"
            onClick={() => {
              if (compareMode) {
                handleExitCompare();
              } else {
                setCompareMode(true);
                setSelected(null);
              }
            }}
            className="px-4 py-2 rounded-xl text-sm font-semibold shadow transition-opacity hover:opacity-90"
            style={{
              background: compareMode
                ? "#f59e0b"
                : "linear-gradient(to right, #4f46e5, #9333ea)",
              color: "#fff",
            }}
          >
            {compareMode ? "Exit Compare" : "Compare Papers"}
          </button>
          {compareMode && (
            <p className={`text-xs text-center mt-1 ${isDark ? "text-zinc-400" : "text-gray-500"}`}>
              {compareSet.length === 0
                ? "Click 2 papers to compare"
                : compareSet.length === 1
                ? "Pick one more paper"
                : "Comparing…"}
            </p>
          )}
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-full"
          style={{ cursor: compareMode ? "crosshair" : "crosshair" }}
          onClick={() => {
            if (!compareMode) setSelected(null);
          }}
        >
          {/* Hub-and-spoke: center to every node lines */}
          {nodes.map((node) => {
            const weight = node.knowledgeNodes.length;
            const ratio = weight / maxWeight;
            const lineWidth = 1 + ratio * 4;
            const baseOpacity = 0.25 + ratio * 0.55;
            const color = TIER_COLOR[node.reliabilityTier] ?? fallbackColor;

            // Dim hub lines when a paper is selected (except selected paper's hub line)
            const isSelectedNode = selected?.id === node.id;
            const opacity = selected
              ? isSelectedNode
                ? baseOpacity
                : 0.15
              : baseOpacity;

            return (
              <line
                key={`hub-${node.id}`}
                x1={CX}
                y1={CY}
                x2={node.x}
                y2={node.y}
                stroke={color.stroke}
                strokeWidth={lineWidth}
                strokeOpacity={opacity}
              />
            );
          })}

          {/* Dashed spoke lines to connected papers when a paper is selected */}
          {selected &&
            links
              .filter(
                (l) =>
                  l.source === selected.id || l.target === selected.id
              )
              .map((link, i) => {
                const targetId =
                  link.source === selected.id ? link.target : link.source;
                const targetNode = nodeMap.get(targetId);
                if (!targetNode) return null;
                const color = TIER_COLOR[targetNode.reliabilityTier] ?? fallbackColor;
                return (
                  <line
                    key={`dash-${i}`}
                    x1={selected.x}
                    y1={selected.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={color.stroke}
                    strokeWidth={1.5}
                    strokeOpacity={0.7}
                    strokeDasharray="5,4"
                  />
                );
              })}

          {/* Center hub circle */}
          <circle cx={CX} cy={CY} r={28} fill={isDark ? "#1e1b4b" : "#ede9fe"} />
          <text
            x={CX}
            y={CY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            fill={isDark ? "#a5b4fc" : "#6d28d9"}
            fontWeight="600"
          >
            Research
          </text>

          {/* Nodes */}
          {nodes.map((node) => {
            const color = TIER_COLOR[node.reliabilityTier] ?? fallbackColor;
            const isSelected = selected?.id === node.id;
            const isHovered = hovered === node.id;
            const isDimmed =
              selected && !isSelected && !selectedConnectedIds.has(node.id);
            const r = isSelected ? 16 : isHovered ? 14 : 10;

            const compareIndex = compareSet.indexOf(node.id);
            const isInCompare = compareIndex !== -1;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                style={{ cursor: "pointer" }}
                onClick={(e) => handleNodeClick(node, e)}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Compare selection ring */}
                {isInCompare && (
                  <circle
                    r={r + 5}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={3}
                    strokeDasharray="6,3"
                  />
                )}
                <circle
                  r={r}
                  fill={color.fill}
                  stroke={isSelected ? "#fff" : isInCompare ? "#f59e0b" : color.stroke}
                  strokeWidth={isSelected ? 3 : isInCompare ? 2.5 : 1.5}
                  opacity={isDimmed ? 0.2 : 1}
                />
                {/* Compare badge number */}
                {isInCompare && (
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={8}
                    fontWeight="700"
                    fill="#fff"
                    style={{ pointerEvents: "none" }}
                  >
                    {compareIndex + 1}
                  </text>
                )}
                {(isHovered || isSelected) && !isInCompare && (
                  <text
                    y={-r - 5}
                    textAnchor="middle"
                    fontSize={9}
                    fill={isDark ? "#e4e4e7" : "#374151"}
                    style={{ pointerEvents: "none" }}
                  >
                    {node.title.slice(0, 38)}
                    {node.title.length > 38 ? "…" : ""}
                  </text>
                )}
                {isHovered && (
                  <text
                    y={r + 14}
                    textAnchor="middle"
                    fontSize={8}
                    fill={isDark ? "#a5b4fc" : "#6d28d9"}
                    style={{ pointerEvents: "none" }}
                  >
                    {node.knowledgeNodes.length} shared node{node.knowledgeNodes.length !== 1 ? "s" : ""}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detail / Compare panel */}
      <div
        className={`w-80 border-l overflow-y-auto flex-shrink-0 transition-all ${
          isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"
        }`}
      >
        {compareMode && (comparing || comparison) ? (
          <ComparePanel
            comparison={comparison}
            comparing={comparing}
            paperA={nodeMap.get(compareSet[0] ?? "") ?? null}
            paperB={nodeMap.get(compareSet[1] ?? "") ?? null}
            onClear={() => {
              setComparison(null);
              setCompareSet([]);
            }}
            isDark={isDark}
            jobId={jobId}
          />
        ) : selected && !compareMode ? (
          <PaperDetail
            node={selected}
            related={links
              .filter((l) => l.source === selected.id || l.target === selected.id)
              .map((l) =>
                nodeMap.get(l.source === selected.id ? l.target : l.source)
              )
              .filter(Boolean) as SimNode[]}
            onSelectRelated={(n) => setSelected(n)}
            isDark={isDark}
          />
        ) : (
          <div className="p-6 text-center">
            <div
              className={`rounded-xl p-8 border-2 border-dashed ${
                isDark ? "border-zinc-700" : "border-gray-200"
              }`}
            >
              <svg
                className={`w-12 h-12 mx-auto mb-3 ${isDark ? "text-zinc-600" : "text-gray-300"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {compareMode ? (
                <p className={`text-sm font-medium ${isDark ? "text-zinc-400" : "text-gray-500"}`}>
                  Click two papers on the map to compare them
                </p>
              ) : (
                <p className={`text-sm font-medium ${isDark ? "text-zinc-400" : "text-gray-500"}`}>
                  Click any paper to see details and related work
                </p>
              )}
              <p className={`text-xs mt-2 ${isDark ? "text-zinc-600" : "text-gray-400"}`}>
                {nodes.length} papers · {links.length} connections
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ComparePanel({
  comparison,
  comparing,
  paperA,
  paperB,
  onClear,
  isDark,
  jobId,
}: {
  comparison: ComparisonResult | null;
  comparing: boolean;
  paperA: SimNode | null;
  paperB: SimNode | null;
  onClear: () => void;
  isDark: boolean;
  jobId: string;
}) {
  const [saved, setSaved] = useState(false);
  const sub = isDark ? "text-zinc-400" : "text-gray-500";
  const heading = isDark ? "text-zinc-100" : "text-gray-900";
  const body = isDark ? "text-zinc-300" : "text-gray-700";

  const handleSaveToNotes = () => {
    if (!comparison) return;
    const titleA = paperA?.title ?? "Paper A";
    const titleB = paperB?.title ?? "Paper B";
    const content = [
      `**Paper A:** ${titleA}`,
      `**Paper B:** ${titleB}`,
      ``,
      `### Approach & Methods`,
      `_${comparison.approachComparison.summary}_`,
      ``,
      `**${titleA.slice(0, 40)}…**`,
      comparison.approachComparison.paperA,
      ``,
      `**${titleB.slice(0, 40)}…**`,
      comparison.approachComparison.paperB,
      ``,
      `**Key Difference:** ${comparison.approachComparison.keyDifference}`,
      ``,
      `### Research Gaps`,
      `**${titleA.slice(0, 40)} gap:** ${comparison.gapAnalysis.paperAGap}`,
      ``,
      `**${titleB.slice(0, 40)} gap:** ${comparison.gapAnalysis.paperBGap}`,
      ``,
      `**Combined Opportunity:** ${comparison.gapAnalysis.combinedOpportunity}`,
    ].join("\n");

    appendNote(jobId, {
      type: "comparison",
      title: `${titleA.slice(0, 30)}… vs ${titleB.slice(0, 30)}…`,
      content,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (comparing) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-indigo-500"></div>
        <p className={`text-sm font-medium ${sub}`}>Analyzing papers…</p>
      </div>
    );
  }

  if (!comparison) return null;

  const { approachComparison, gapAnalysis } = comparison;

  return (
    <div className="p-5 space-y-5 overflow-y-auto">
      {/* Paper titles */}
      <div className="space-y-2">
        {paperA && (
          <div className="flex gap-2 items-start">
            <span className="text-xs font-bold text-indigo-600 shrink-0 mt-0.5">A</span>
            <p className="text-xs font-semibold text-indigo-700 leading-snug">
              {paperA.title.slice(0, 80)}{paperA.title.length > 80 ? "…" : ""}
            </p>
          </div>
        )}
        {paperB && (
          <div className="flex gap-2 items-start">
            <span className="text-xs font-bold text-purple-600 shrink-0 mt-0.5">B</span>
            <p className="text-xs font-semibold text-purple-700 leading-snug">
              {paperB.title.slice(0, 80)}{paperB.title.length > 80 ? "…" : ""}
            </p>
          </div>
        )}
      </div>

      {/* Approach & Methods */}
      <div>
        <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${heading}`}>
          Approach &amp; Methods
        </p>
        <p className={`text-xs mb-3 italic ${sub}`}>{approachComparison.summary}</p>
        <div className="space-y-2">
          <div>
            <p className="text-xs font-semibold text-indigo-600 mb-1">
              {paperA ? paperA.title.slice(0, 30) + (paperA.title.length > 30 ? "…" : "") : "Paper A"}
            </p>
            <p className={`text-xs leading-relaxed ${body}`}>{approachComparison.paperA}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-purple-600 mb-1">
              {paperB ? paperB.title.slice(0, 30) + (paperB.title.length > 30 ? "…" : "") : "Paper B"}
            </p>
            <p className={`text-xs leading-relaxed ${body}`}>{approachComparison.paperB}</p>
          </div>
        </div>
        <div className="mt-3 rounded-lg p-3 bg-amber-50 border border-amber-200">
          <p className="text-xs font-semibold text-amber-800 mb-1">Key Difference</p>
          <p className="text-xs leading-relaxed text-amber-900">{approachComparison.keyDifference}</p>
        </div>
      </div>

      {/* Research Gaps */}
      <div>
        <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${heading}`}>
          Research Gaps
        </p>
        <div className="space-y-2">
          <div>
            <p className="text-xs font-semibold text-indigo-600 mb-1">
              {paperA ? paperA.title.slice(0, 30) + (paperA.title.length > 30 ? "…" : "") : "Paper A"} gap
            </p>
            <p className={`text-xs leading-relaxed ${body}`}>{gapAnalysis.paperAGap}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-purple-600 mb-1">
              {paperB ? paperB.title.slice(0, 30) + (paperB.title.length > 30 ? "…" : "") : "Paper B"} gap
            </p>
            <p className={`text-xs leading-relaxed ${body}`}>{gapAnalysis.paperBGap}</p>
          </div>
        </div>
        <div className="mt-3 rounded-lg p-3 bg-green-50 border border-green-200">
          <p className="text-xs font-semibold text-green-800 mb-1">Combined Opportunity</p>
          <p className="text-xs leading-relaxed text-green-900">{gapAnalysis.combinedOpportunity}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSaveToNotes}
        className="w-full py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-90"
        style={{ background: "linear-gradient(to right, #4f46e5, #9333ea)", color: "#fff" }}
      >
        {saved ? "✓ Saved to Notes" : "Save to Notes"}
      </button>

      <button
        type="button"
        onClick={onClear}
        className={`w-full py-2 rounded-xl text-xs font-semibold border transition-colors ${
          isDark
            ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            : "border-gray-200 text-gray-600 hover:bg-gray-50"
        }`}
      >
        Clear Comparison
      </button>
    </div>
  );
}

function PaperDetail({
  node,
  related,
  onSelectRelated,
  isDark,
}: {
  node: SimNode;
  related: SimNode[];
  onSelectRelated: (n: SimNode) => void;
  isDark: boolean;
}) {
  const color = TIER_COLOR[node.reliabilityTier] ?? fallbackColor;
  const text = isDark ? "text-zinc-300" : "text-gray-700";
  const sub = isDark ? "text-zinc-400" : "text-gray-500";
  const border = isDark ? "border-zinc-700" : "border-gray-200";
  const card = isDark ? "bg-zinc-800" : "bg-gray-50";
  const heading = isDark ? "text-zinc-100" : "text-gray-900";
  const sectionLabel = `text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? "text-zinc-400" : "text-gray-500"}`;

  const year = node.publishedAt
    ? new Date(node.publishedAt).getFullYear()
    : null;

  return (
    <div className="p-5 space-y-5">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: color.fill + "22", color: color.fill }}
          >
            {color.label}
          </span>
          {node.type && node.type !== node.reliabilityTier && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? "bg-zinc-700 text-zinc-300" : "bg-gray-100 text-gray-600"}`}>
              {node.type}
            </span>
          )}
          {year && (
            <span className={`text-xs ${sub}`}>{year}</span>
          )}
        </div>
        <h3 className={`text-sm font-bold leading-snug ${heading}`}>
          {node.title}
        </h3>
        {node.venue && (
          <p className={`text-xs mt-1.5 italic ${sub}`}>{node.venue}</p>
        )}
        {node.authors.length > 0 && (
          <p className={`text-xs mt-1 ${sub}`}>
            {node.authors.slice(0, 4).join(", ")}
            {node.authors.length > 4 ? ` +${node.authors.length - 4} more` : ""}
          </p>
        )}
      </div>

      {/* Abstract */}
      {node.snippet && (
        <div className={`rounded-lg p-3 ${isDark ? "bg-zinc-800/60" : "bg-gray-50"}`}>
          <p className={sectionLabel}>Abstract</p>
          <p className={`text-xs leading-relaxed ${text}`}>
            {node.snippet}
            {!node.snippet.endsWith(".") && !node.snippet.endsWith("…") && (
              <span className={sub}> …</span>
            )}
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className={`flex gap-3 text-xs ${sub}`}>
        <div className="flex flex-col items-center">
          <span className={`text-base font-bold ${heading}`}>{node.knowledgeNodes.length}</span>
          <span>knowledge nodes</span>
        </div>
        <div className={`w-px ${isDark ? "bg-zinc-700" : "bg-gray-200"}`} />
        <div className="flex flex-col items-center">
          <span className={`text-base font-bold ${heading}`}>{related.length}</span>
          <span>related papers</span>
        </div>
      </div>

      {/* Knowledge areas */}
      {node.knowledgeNodes.length > 0 && (
        <div>
          <p className={sectionLabel}>Knowledge Areas</p>
          <div className="flex flex-wrap gap-1.5">
            {node.knowledgeNodes.map((kn) => (
              <span
                key={kn.nodeId}
                className={`text-xs px-2 py-0.5 rounded-full ${
                  isDark ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                }`}
              >
                {kn.nodeLabel}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Read paper link */}
      {node.url && (
        <a
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-lg text-xs font-semibold border transition-colors"
          style={{ borderColor: color.fill + "66", color: color.fill }}
        >
          Read Paper
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}

      {/* Related papers */}
      {related.length > 0 && (
        <div className={`border-t pt-4 ${border}`}>
          <p className={sectionLabel}>Related Papers ({related.length})</p>
          <div className="space-y-2">
            {related.map((r) => {
              const rc = TIER_COLOR[r.reliabilityTier] ?? fallbackColor;
              const ry = r.publishedAt ? new Date(r.publishedAt).getFullYear() : null;
              return (
                <button
                  key={r.id}
                  onClick={() => onSelectRelated(r)}
                  className={`w-full text-left p-2.5 rounded-lg transition-colors ${card} hover:opacity-80`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: rc.fill }}
                    />
                    <div className="min-w-0">
                      <p className={`text-xs font-medium leading-snug ${heading}`}>
                        {r.title.slice(0, 90)}{r.title.length > 90 ? "…" : ""}
                      </p>
                      {(r.venue || ry) && (
                        <p className={`text-xs mt-0.5 ${sub}`}>
                          {[r.venue, ry].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
