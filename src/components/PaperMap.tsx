"use client";

import { useEffect, useRef, useState } from "react";

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

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const visibleLinks = hovered || selected
    ? links.filter(
        (l) =>
          l.source === (hovered ?? selected?.id) ||
          l.target === (hovered ?? selected?.id)
      )
    : links;

  const connectedIds = new Set(
    visibleLinks.flatMap((l) => [l.source, l.target])
  );

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
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-full"
          style={{ cursor: "crosshair" }}
          onClick={() => setSelected(null)}
        >
          {/* Links */}
          {visibleLinks.map((link, i) => {
            const s = nodeMap.get(link.source);
            const t = nodeMap.get(link.target);
            if (!s || !t) return null;
            return (
              <line
                key={i}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke={isDark ? "#4b5563" : "#d1d5db"}
                strokeWidth={1.5}
                strokeOpacity={0.6}
              />
            );
          })}

          {/* All-links dim lines when something is hovered */}
          {(hovered || selected) &&
            links
              .filter(
                (l) =>
                  l.source !== (hovered ?? selected?.id) &&
                  l.target !== (hovered ?? selected?.id)
              )
              .map((link, i) => {
                const s = nodeMap.get(link.source);
                const t = nodeMap.get(link.target);
                if (!s || !t) return null;
                return (
                  <line
                    key={`dim-${i}`}
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke={isDark ? "#27272a" : "#f3f4f6"}
                    strokeWidth={1}
                  />
                );
              })}

          {/* Center label */}
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
            const isConnected = connectedIds.has(node.id);
            const isDimmed =
              (hovered || selected) && !isSelected && !isHovered && !isConnected;
            const r = isSelected ? 16 : isHovered ? 14 : 10;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(isSelected ? null : node);
                }}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <circle
                  r={r}
                  fill={color.fill}
                  stroke={isSelected ? "#fff" : color.stroke}
                  strokeWidth={isSelected ? 3 : 1.5}
                  opacity={isDimmed ? 0.2 : 1}
                />
                {(isHovered || isSelected) && (
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
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detail panel */}
      <div
        className={`w-80 border-l overflow-y-auto flex-shrink-0 transition-all ${
          isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"
        }`}
      >
        {selected ? (
          <PaperDetail
            node={selected}
            related={links
              .filter((l) => l.source === selected.id || l.target === selected.id)
              .map((l) => nodeMap.get(l.source === selected.id ? l.target : l.source))
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
              <p className={`text-sm font-medium ${isDark ? "text-zinc-400" : "text-gray-500"}`}>
                Click any paper to see details and related work
              </p>
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

  return (
    <div className="p-5 space-y-4">
      <div>
        <span
          className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-2"
          style={{ background: color.fill + "22", color: color.fill }}
        >
          {color.label}
        </span>
        <h3 className={`text-sm font-bold leading-snug ${isDark ? "text-zinc-100" : "text-gray-900"}`}>
          {node.title}
        </h3>
        {node.venue && (
          <p className={`text-xs mt-1 italic ${sub}`}>{node.venue}</p>
        )}
        {node.authors.length > 0 && (
          <p className={`text-xs mt-0.5 ${sub}`}>
            {node.authors.slice(0, 3).join(", ")}
            {node.authors.length > 3 ? " et al." : ""}
          </p>
        )}
      </div>

      {node.snippet && (
        <div>
          <p className={`text-xs leading-relaxed ${text}`}>{node.snippet}</p>
        </div>
      )}

      {node.knowledgeNodes.length > 0 && (
        <div>
          <p className={`text-xs font-semibold mb-1 ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
            Knowledge Areas
          </p>
          <div className="flex flex-wrap gap-1">
            {node.knowledgeNodes.map((kn) => (
              <span
                key={kn.nodeId}
                className={`text-xs px-2 py-0.5 rounded-full ${
                  isDark ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-100 text-indigo-700"
                }`}
              >
                {kn.nodeLabel}
              </span>
            ))}
          </div>
        </div>
      )}

      {node.url && (
        <a
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-blue-500 hover:underline truncate"
        >
          {node.url}
        </a>
      )}

      {related.length > 0 && (
        <div className={`border-t pt-3 ${border}`}>
          <p className={`text-xs font-semibold mb-2 ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
            Related Papers ({related.length})
          </p>
          <div className="space-y-2">
            {related.map((r) => {
              const rc = TIER_COLOR[r.reliabilityTier] ?? fallbackColor;
              return (
                <button
                  key={r.id}
                  onClick={() => onSelectRelated(r)}
                  className={`w-full text-left text-xs p-2 rounded-lg transition-colors ${card} hover:opacity-80`}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5 flex-shrink-0 align-middle"
                    style={{ background: rc.fill }}
                  />
                  {r.title.slice(0, 70)}
                  {r.title.length > 70 ? "…" : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
