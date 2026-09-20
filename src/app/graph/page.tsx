"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Theme = "dark" | "light" | "vibrant";

interface GraphSource {
  id: string;
  title: string;
  url: string | null;
  type: string;
  venue: string | null;
  role?: string;
}

interface GraphEntity {
  id: string;
  type: string;
  label: string;
  content: string | null;
  jobId: string | null;
  origin: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  sources: GraphSource[];
}

interface GraphEdge {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  jobId: string | null;
  origin: string;
}

interface QueryResult {
  answer: string | null;
  keyTakeaways: string[];
  gaps: string[];
  message?: string;
  matchedIds: string[];
}

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  topic:      { label: "Topic",      color: "#6366f1", bg: "bg-indigo-500" },
  hypothesis: { label: "Hypothesis", color: "#8b5cf6", bg: "bg-violet-500" },
  method:     { label: "Method",     color: "#06b6d4", bg: "bg-cyan-500" },
  evidence:   { label: "Evidence",   color: "#10b981", bg: "bg-emerald-500" },
  gap:        { label: "Gap",        color: "#f59e0b", bg: "bg-amber-500" },
  note:       { label: "Note",       color: "#f43f5e", bg: "bg-rose-500" },
};

const EDGE_LABELS: Record<string, string> = {
  motivates: "motivates",
  provides: "provides",
  uses_method: "uses method",
  contradicts: "contradicts",
  reveals: "reveals",
  related_to: "related to",
  notes_on: "notes on",
};

const EDGE_COLORS: Record<string, string> = {
  motivates: "#8b5cf6",
  provides: "#10b981",
  uses_method: "#06b6d4",
  contradicts: "#ef4444",
  reveals: "#f59e0b",
  related_to: "#94a3b8",
  notes_on: "#f43f5e",
};

const THEME_STYLES = {
  dark: {
    mainBg: "bg-[#0a0a0f]",
    text: "text-white",
    subText: "text-zinc-400",
    navButton: "bg-zinc-900 border border-zinc-700 text-zinc-200 hover:bg-zinc-800",
    panel: "bg-zinc-900/80 border border-zinc-700",
    card: "bg-zinc-900 border border-zinc-700",
    input: "bg-zinc-800 border border-zinc-600 text-zinc-100 placeholder-zinc-500",
    headingPlate: "inline-flex px-4 py-2 rounded-xl border border-zinc-600 bg-zinc-900/80 shadow-sm backdrop-blur-sm",
    heading: "bg-gradient-to-r from-indigo-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]",
    divider: "border-zinc-700",
    chipOff: "bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200",
  },
  light: {
    mainBg: "bg-gradient-to-b from-white to-zinc-50",
    text: "text-zinc-900",
    subText: "text-zinc-600",
    navButton: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50",
    panel: "bg-white/90 border border-gray-200/70",
    card: "bg-white border border-gray-200",
    input: "bg-gray-50 border border-gray-300 text-zinc-900 placeholder-gray-400",
    headingPlate: "inline-flex px-4 py-2 rounded-xl border border-slate-300/90 bg-white/95 shadow-md",
    heading: "bg-gradient-to-r from-indigo-700 via-violet-700 to-fuchsia-700 bg-clip-text text-transparent",
    divider: "border-gray-200",
    chipOff: "bg-white border border-gray-200 text-gray-400 hover:text-gray-700",
  },
  vibrant: {
    mainBg: "bg-gradient-to-br from-rose-50 via-amber-50 to-sky-50",
    text: "text-zinc-900",
    subText: "text-zinc-600",
    navButton: "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50",
    panel: "bg-white/80 border border-rose-200",
    card: "bg-white border border-zinc-200",
    input: "bg-white border border-gray-300 text-zinc-900 placeholder-gray-400",
    headingPlate: "inline-flex px-4 py-2 rounded-xl border border-rose-300/90 bg-white/92 shadow-md",
    heading: "bg-gradient-to-r from-rose-700 via-pink-600 to-fuchsia-600 bg-clip-text text-transparent",
    divider: "border-rose-200",
    chipOff: "bg-white border border-zinc-200 text-gray-400 hover:text-gray-700",
  },
} as const;

// ---------- Force-directed layout (adapted from PaperMap) ----------

const W = 1600;
const H = 1000;

interface SimNode {
  entity: GraphEntity;
  degree: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function forceLayout(entities: GraphEntity[], edges: GraphEdge[]): SimNode[] {
  if (entities.length === 0) return [];
  const CX = W / 2;
  const CY = H / 2;
  const degById = new Map<string, number>();
  for (const e of edges) {
    degById.set(e.fromId, (degById.get(e.fromId) ?? 0) + 1);
    degById.set(e.toId, (degById.get(e.toId) ?? 0) + 1);
  }

  const placed: SimNode[] = entities.map((entity) => {
    // Seed: topic/hypothesis near center, others in a ring
    const isCore = entity.type === "topic" || entity.type === "hypothesis";
    const angle = Math.random() * Math.PI * 2;
    const r = isCore ? Math.random() * 150 : 250 + Math.random() * 380;
    return {
      entity,
      degree: degById.get(entity.id) ?? 0,
      x: CX + r * Math.cos(angle),
      y: CY + r * Math.sin(angle),
      vx: 0,
      vy: 0,
    };
  });

  const idxMap = new Map(placed.map((n, i) => [n.entity.id, i]));
  const linkPairs = edges
    .map((l) => ({ i: idxMap.get(l.fromId) ?? -1, j: idxMap.get(l.toId) ?? -1 }))
    .filter((l) => l.i >= 0 && l.j >= 0 && l.i !== l.j);

  const iterations = entities.length > 200 ? 80 : 160;
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const dx = placed[j].x - placed[i].x;
        const dy = placed[j].y - placed[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 12000 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        placed[i].vx -= fx;
        placed[i].vy -= fy;
        placed[j].vx += fx;
        placed[j].vy += fy;
      }
    }

    for (const { i, j } of linkPairs) {
      const dx = placed[j].x - placed[i].x;
      const dy = placed[j].y - placed[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const idealDist = 140;
      const force = (dist - idealDist) * 0.008;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      placed[i].vx += fx;
      placed[i].vy += fy;
      placed[j].vx -= fx;
      placed[j].vy -= fy;
    }

    for (const n of placed) {
      n.vx += (CX - n.x) * 0.0015;
      n.vy += (CY - n.y) * 0.0015;
    }

    const damping = 0.85;
    for (const n of placed) {
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx;
      n.y += n.vy;
    }
  }

  const PAD = 60;
  for (const n of placed) {
    n.x = Math.max(PAD, Math.min(W - PAD, n.x));
    n.y = Math.max(PAD, Math.min(H - PAD, n.y));
  }
  return placed;
}

// ---------- Page ----------

export default function ResearchGraphPage() {
  const [theme, setTheme] = useState<Theme>("light");
  const [entities, setEntities] = useState<GraphEntity[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [stats, setStats] = useState<{ entities: number; edges: number; byType: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set(Object.keys(TYPE_META)));
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());

  const [queryText, setQueryText] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [querying, setQuerying] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState("hypothesis");
  const [addLabel, setAddLabel] = useState("");
  const [addContent, setAddContent] = useState("");
  const [addConnectTo, setAddConnectTo] = useState(true);
  const [addEdgeType, setAddEdgeType] = useState("related_to");

  const [editLabel, setEditLabel] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [edgeTargetSearch, setEdgeTargetSearch] = useState("");
  const [newEdgeType, setNewEdgeType] = useState("related_to");

  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ panning: boolean; lastX: number; lastY: number }>({ panning: false, lastX: 0, lastY: 0 });

  const t = THEME_STYLES[theme];

  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved && ["dark", "light", "vibrant"].includes(saved)) setTheme(saved);
  }, []);

  const loadGraph = useCallback(async () => {
    try {
      const res = await fetch("/api/graph");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setEntities(data.entities);
      setEdges(data.edges);
      setStats(data.stats);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to load research graph.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const selected = useMemo(
    () => entities.find((e) => e.id === selectedId) ?? null,
    [entities, selectedId]
  );

  useEffect(() => {
    setEditing(false);
    if (selected) {
      setEditLabel(selected.label);
      setEditContent(selected.content ?? "");
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered view
  const searchLower = search.trim().toLowerCase();
  const matchesSearch = useCallback(
    (e: GraphEntity) =>
      !searchLower ||
      e.label.toLowerCase().includes(searchLower) ||
      (e.content ?? "").toLowerCase().includes(searchLower),
    [searchLower]
  );

  const visibleEntities = useMemo(
    () => entities.filter((e) => visibleTypes.has(e.type) && matchesSearch(e)),
    [entities, visibleTypes, matchesSearch]
  );
  const visibleIds = useMemo(
    () => new Set(visibleEntities.map((e) => e.id)),
    [visibleEntities]
  );
  const visibleEdges = useMemo(
    () => edges.filter((e) => visibleIds.has(e.fromId) && visibleIds.has(e.toId)),
    [edges, visibleIds]
  );

  const simNodes = useMemo(
    () => forceLayout(visibleEntities, visibleEdges),
    [visibleEntities, visibleEdges]
  );
  const nodePos = useMemo(
    () => new Map(simNodes.map((n) => [n.entity.id, n])),
    [simNodes]
  );

  const toggleType = (type: string) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // React marks wheel listeners passive, so preventDefault needs a native listener.
  // Re-run when the canvas mounts/unmounts (loading state and empty filters both swap it out).
  const svgMounted = !loading && visibleEntities.length > 0;
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(3, Math.max(0.3, z * (e.deltaY > 0 ? 0.9 : 1.1))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [svgMounted]);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragState.current = { panning: true, lastX: e.clientX, lastY: e.clientY };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.current.panning) return;
    const dx = e.clientX - dragState.current.lastX;
    const dy = e.clientY - dragState.current.lastY;
    dragState.current.lastX = e.clientX;
    dragState.current.lastY = e.clientY;
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  };
  const handleMouseUp = () => {
    dragState.current.panning = false;
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // ---------- Mutations ----------

  const handleAddEntity = async () => {
    const label = addLabel.trim();
    if (!label) return;
    setSaving(true);
    try {
      const res = await fetch("/api/graph/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: addType,
          label,
          content: addContent.trim() || undefined,
          connectTo: addConnectTo ? selectedId : undefined,
          edgeType: addConnectTo ? addEdgeType : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      setShowAddForm(false);
      setAddLabel("");
      setAddContent("");
      await loadGraph();
    } catch {
      setError("Failed to add entity.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/graph/entities/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: editLabel, content: editContent }),
      });
      if (!res.ok) throw new Error();
      setEditing(false);
      await loadGraph();
    } catch {
      setError("Failed to save entity.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntity = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/graph/entities/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setSelectedId(null);
      await loadGraph();
    } catch {
      setError("Failed to delete entity.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEdge = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/graph/edges/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await loadGraph();
    } catch {
      setError("Failed to delete edge.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddEdge = async (targetId: string) => {
    if (!selected || !targetId || targetId === selected.id) return;
    setSaving(true);
    try {
      const res = await fetch("/api/graph/edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromId: selected.id, toId: targetId, type: newEdgeType }),
      });
      if (!res.ok && res.status !== 409) throw new Error();
      setEdgeTargetSearch("");
      await loadGraph();
    } catch {
      setError("Failed to add edge.");
    } finally {
      setSaving(false);
    }
  };

  const handleQuery = async () => {
    const q = queryText.trim();
    if (!q) return;
    setQuerying(true);
    setQueryResult(null);
    try {
      const res = await fetch("/api/graph/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Query failed");
      setQueryResult(data);
      setMatchedIds(new Set(data.matchedIds ?? []));
    } catch (err) {
      console.error(err);
      setQueryResult({ answer: null, keyTakeaways: [], gaps: [], message: "Query failed — please try again.", matchedIds: [] });
    } finally {
      setQuerying(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/graph/sync", { method: "POST" });
      if (!res.ok) throw new Error();
      await loadGraph();
    } catch {
      setError("Sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  // ---------- Derived panel data ----------

  const connectedEdges = useMemo(() => {
    if (!selected) return [];
    return edges
      .filter((e) => e.fromId === selected.id || e.toId === selected.id)
      .map((e) => ({
        edge: e,
        dir: e.fromId === selected.id ? ("out" as const) : ("in" as const),
        other: entities.find((x) => x.id === (e.fromId === selected.id ? e.toId : e.fromId)),
      }))
      .filter((x) => x.other);
  }, [edges, entities, selected]);

  const edgeTargetMatches = useMemo(() => {
    const q = edgeTargetSearch.trim().toLowerCase();
    if (!q) return [];
    return entities
      .filter(
        (e) =>
          e.id !== selectedId &&
          (e.label.toLowerCase().includes(q) || (e.content ?? "").toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [edgeTargetSearch, entities, selectedId]);

  const runCount = useMemo(
    () => new Set(entities.map((e) => e.jobId).filter(Boolean)).size,
    [entities]
  );

  const nodeRadius = (n: SimNode) => {
    if (n.entity.type === "topic") return 16;
    if (n.entity.type === "hypothesis") return 10;
    if (n.entity.type === "note") return 9;
    return 5 + Math.min(5, n.degree * 0.6);
  };

  const showLabel = (n: SimNode) =>
    n.entity.id === selectedId ||
    n.entity.id === hoveredId ||
    matchedIds.has(n.entity.id) ||
    n.entity.type === "topic" ||
    (n.entity.type === "hypothesis" && n.degree > 0);

  return (
    <main className={`min-h-screen ${t.mainBg} ${t.text} transition-all duration-500`}>
      <div className="container mx-auto px-4 py-10 max-w-[1500px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <div className={t.headingPlate}>
              <h1 className={`text-4xl font-bold ${t.heading}`}>Research Graph</h1>
            </div>
            <p className={`${t.subText} mt-2`}>
              Your persistent knowledge across every run — topics, hypotheses, evidence, gaps, and notes.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link href="/" className={`px-4 py-2 rounded-lg font-semibold transition-colors ${t.navButton}`}>Home</Link>
            <Link href="/jobs" className={`px-4 py-2 rounded-lg font-semibold transition-colors ${t.navButton}`}>My Research</Link>
            <Link href="/explore" className={`px-4 py-2 rounded-lg font-semibold transition-colors ${t.navButton}`}>Explore</Link>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-2 rounded-xl border border-red-300 bg-red-50 text-red-700 text-sm">{error}</div>
        )}

        {/* Cross-run query */}
        <div className={`rounded-2xl p-4 mb-4 shadow-lg ${t.panel}`}>
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-2">Ask across all runs</p>
          <div className="flex gap-2">
            <input
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleQuery(); }}
              placeholder="What have I learned across all my runs about…"
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400 ${t.input}`}
            />
            <button
              onClick={handleQuery}
              disabled={querying || !queryText.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
              style={{ background: "linear-gradient(to right, #4f46e5, #9333ea)", color: "#fff" }}
            >
              {querying ? "Thinking…" : "Ask"}
            </button>
          </div>
          {queryResult && (
            <div className={`mt-4 rounded-xl border p-4 text-sm leading-relaxed ${theme === "dark" ? "bg-zinc-800/60 border-zinc-700" : "bg-gray-50 border-gray-200"}`}>
              {queryResult.answer ? (
                <>
                  <p className="whitespace-pre-wrap">{queryResult.answer}</p>
                  {queryResult.keyTakeaways.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-indigo-500 mb-1">Key takeaways</p>
                      <ul className="list-disc list-inside space-y-1">
                        {queryResult.keyTakeaways.map((k, i) => <li key={i}>{k}</li>)}
                      </ul>
                    </div>
                  )}
                  {queryResult.gaps.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-amber-500 mb-1">Gaps</p>
                      <ul className="list-disc list-inside space-y-1">
                        {queryResult.gaps.map((g, i) => <li key={i}>{g}</li>)}
                      </ul>
                    </div>
                  )}
                  <p className={`text-xs mt-3 ${t.subText}`}>
                    {matchedIds.size} matched entities highlighted in the graph below.
                  </p>
                </>
              ) : (
                <p className={t.subText}>{queryResult.message ?? "No answer available."}</p>
              )}
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className={`rounded-2xl p-4 mb-4 shadow-lg ${t.panel} flex flex-wrap items-center gap-3`}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TYPE_META).map(([type, meta]) => {
              const on = visibleTypes.has(type);
              const count = stats?.byType?.[type] ?? 0;
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    on ? "text-white border-transparent" : t.chipOff
                  }`}
                  style={on ? { background: meta.color } : undefined}
                >
                  <span className={`inline-block w-2 h-2 rounded-full ${on ? "bg-white/80" : ""}`} style={!on ? { background: meta.color } : undefined} />
                  {meta.label} ({count})
                </button>
              );
            })}
          </div>
          <div className="flex-1 min-w-[200px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter entities…"
              className={`w-full rounded-xl border px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-400 ${t.input}`}
            />
          </div>
          <div className={`text-xs ${t.subText}`}>
            {stats ? `${stats.entities} entities · ${stats.edges} edges · ${runCount} runs` : ""}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors disabled:opacity-40 ${t.navButton}`}
          >
            {syncing ? "Syncing…" : "Resync from runs"}
          </button>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold transition-opacity"
            style={{ background: "linear-gradient(to right, #4f46e5, #9333ea)", color: "#fff" }}
          >
            + Add Entity
          </button>
        </div>

        {/* Add entity form */}
        {showAddForm && (
          <div className={`rounded-2xl p-4 mb-4 shadow-lg ${t.panel}`}>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-3">New entity</p>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className={`text-xs block mb-1 ${t.subText}`}>Type</label>
                <select
                  value={addType}
                  onChange={(e) => setAddType(e.target.value)}
                  className={`rounded-xl border px-3 py-2 text-sm outline-none ${t.input}`}
                >
                  {Object.entries(TYPE_META).map(([type, meta]) => (
                    <option key={type} value={type}>{meta.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[220px]">
                <label className={`text-xs block mb-1 ${t.subText}`}>Label</label>
                <input
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  placeholder="e.g. Transformer scaling laws"
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 ${t.input}`}
                />
              </div>
              <div className="flex-1 min-w-[220px]">
                <label className={`text-xs block mb-1 ${t.subText}`}>Content (optional)</label>
                <input
                  value={addContent}
                  onChange={(e) => setAddContent(e.target.value)}
                  placeholder="Details, reasoning, context…"
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 ${t.input}`}
                />
              </div>
              {selectedId && (
                <div className="flex items-center gap-2 pb-1">
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={addConnectTo} onChange={(e) => setAddConnectTo(e.target.checked)} />
                    <span className={t.subText}>Link to selected</span>
                  </label>
                  {addConnectTo && (
                    <select
                      value={addEdgeType}
                      onChange={(e) => setAddEdgeType(e.target.value)}
                      className={`rounded-xl border px-2 py-1.5 text-xs outline-none ${t.input}`}
                    >
                      {Object.entries(EDGE_LABELS).map(([type, label]) => (
                        <option key={type} value={type}>{label}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              <button
                onClick={handleAddEntity}
                disabled={saving || !addLabel.trim()}
                className="px-5 py-2 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
                style={{ background: "linear-gradient(to right, #4f46e5, #9333ea)", color: "#fff" }}
              >
                {saving ? "Saving…" : "Create"}
              </button>
            </div>
          </div>
        )}

        {/* Graph + inspector */}
        <div className="flex gap-4 items-stretch">
          <div className={`flex-1 rounded-2xl shadow-xl overflow-hidden ${t.panel}`} style={{ minHeight: 560 }}>
            {loading ? (
              <div className="flex items-center justify-center h-[560px]">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              </div>
            ) : visibleEntities.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[560px] gap-2">
                <p className={`text-sm ${t.subText}`}>No entities match the current filters.</p>
                <p className={`text-xs ${t.subText}`}>Run a research session or clear the filters.</p>
              </div>
            ) : (
              <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                className="w-full h-[560px] cursor-grab active:cursor-grabbing select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => { handleMouseUp(); setHoveredId(null); }}
              >
                <defs>
                  {Object.entries(EDGE_COLORS).map(([type, color]) => (
                    <marker
                      key={type}
                      id={`arrow-${type}`}
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="5"
                      markerHeight="5"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} opacity="0.7" />
                    </marker>
                  ))}
                </defs>
                <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                  {/* Edges */}
                  {visibleEdges.map((edge) => {
                    const from = nodePos.get(edge.fromId);
                    const to = nodePos.get(edge.toId);
                    if (!from || !to) return null;
                    const color = EDGE_COLORS[edge.type] ?? "#94a3b8";
                    const touched = edge.fromId === selectedId || edge.toId === selectedId || edge.fromId === hoveredId || edge.toId === hoveredId;
                    return (
                      <line
                        key={edge.id}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke={color}
                        strokeWidth={touched ? 2.2 : 1}
                        opacity={touched ? 0.9 : 0.35}
                        markerEnd={`url(#arrow-${edge.type})`}
                      />
                    );
                  })}
                  {/* Nodes */}
                  {simNodes.map((n) => {
                    const meta = TYPE_META[n.entity.type] ?? TYPE_META.evidence;
                    const r = nodeRadius(n);
                    const isSel = n.entity.id === selectedId;
                    const isMatch = matchedIds.has(n.entity.id);
                    return (
                      <g
                        key={n.entity.id}
                        transform={`translate(${n.x} ${n.y})`}
                        onMouseEnter={() => setHoveredId(n.entity.id)}
                        onClick={(e) => { e.stopPropagation(); setSelectedId(n.entity.id); }}
                        className="cursor-pointer"
                      >
                        {(isSel || isMatch) && (
                          <circle r={r + 6} fill="none" stroke={isSel ? "#fff" : "#f43f5e"} strokeWidth={2} opacity={0.8} />
                        )}
                        <circle
                          r={r}
                          fill={meta.color}
                          stroke={n.entity.origin === "user" ? "#fff" : "none"}
                          strokeWidth={1.5}
                          opacity={0.92}
                        />
                        {showLabel(n) && (
                          <text
                            x={r + 4}
                            y={4}
                            fontSize={11}
                            fill="currentColor"
                            className={theme === "dark" ? "" : ""}
                            style={{ paintOrder: "stroke", stroke: theme === "dark" ? "#0a0a0f" : "#fff", strokeWidth: 3, fontWeight: 600 }}
                          >
                            {n.entity.label.length > 34 ? n.entity.label.slice(0, 33) + "…" : n.entity.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            )}
            {/* View controls */}
            <div className="flex items-center justify-between px-3 py-2 border-t text-xs" style={{ borderColor: theme === "dark" ? "#3f3f46" : "#e5e7eb" }}>
              <span className={t.subText}>Scroll to zoom · drag to pan · click a node to inspect</span>
              <button onClick={resetView} className={`px-2 py-1 rounded-lg border ${t.navButton}`}>Reset view</button>
            </div>
          </div>

          {/* Inspector panel */}
          <div className={`w-96 flex-shrink-0 rounded-2xl shadow-xl border flex flex-col max-h-[620px] ${t.panel} ${theme === "dark" ? "border-zinc-700" : "border-gray-200"}`}>
            {selected ? (
              <>
                <div className={`px-4 py-3 border-b flex items-center justify-between ${t.divider}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                      style={{ background: TYPE_META[selected.type]?.color ?? "#6366f1" }}
                    >
                      {TYPE_META[selected.type]?.label ?? selected.type}
                    </span>
                    <span className={`text-xs flex-shrink-0 ${t.subText}`}>
                      {selected.origin === "user" ? "user-edited" : "run-derived"}
                    </span>
                  </div>
                  <button onClick={() => setSelectedId(null)} className={`p-1 rounded-lg ${t.subText} hover:opacity-70`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                  {!editing ? (
                    <div>
                      <p className="text-sm font-semibold leading-snug break-words">{selected.label}</p>
                      {selected.content && (
                        <p className={`text-xs mt-2 whitespace-pre-wrap leading-relaxed ${t.subText}`}>{selected.content}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        placeholder="Label"
                        className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 ${t.input}`}
                      />
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        placeholder="Content / details"
                        rows={5}
                        className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-400 resize-none ${t.input}`}
                      />
                    </div>
                  )}

                  {selected.sources.length > 0 && (
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wide mb-1.5 ${t.subText}`}>Provenance ({selected.sources.length})</p>
                      <div className="space-y-1">
                        {selected.sources.slice(0, 8).map((s) => (
                          <a
                            key={s.id}
                            href={s.url ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`block text-xs truncate hover:underline ${t.subText}`}
                          >
                            {s.title}{s.venue ? ` — ${s.venue}` : ""}
                          </a>
                        ))}
                        {selected.sources.length > 8 && (
                          <p className={`text-xs ${t.subText}`}>+{selected.sources.length - 8} more</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className={`text-xs font-bold uppercase tracking-wide mb-1.5 ${t.subText}`}>Connections ({connectedEdges.length})</p>
                    <div className="space-y-1.5">
                      {connectedEdges.map(({ edge, dir, other }) => (
                        <div key={edge.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${theme === "dark" ? "bg-zinc-800/60 border-zinc-700" : "bg-gray-50 border-gray-200"}`}>
                          <button
                            onClick={() => other && setSelectedId(other.id)}
                            className="flex-1 min-w-0 text-left hover:underline"
                          >
                            <span className={t.subText}>{dir === "out" ? "→" : "←"}</span>{" "}
                            <span style={{ color: TYPE_META[other?.type ?? ""]?.color }}>{TYPE_META[other?.type ?? ""]?.label ?? other?.type}</span>{" "}
                            <span className="truncate">{other?.label.slice(0, 40)}</span>
                            <span className={t.subText}> ({EDGE_LABELS[edge.type] ?? edge.type})</span>
                          </button>
                          <button
                            onClick={() => handleDeleteEdge(edge.id)}
                            title="Delete edge"
                            className={`p-0.5 rounded hover:text-red-500 ${t.subText}`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {connectedEdges.length === 0 && (
                        <p className={`text-xs ${t.subText}`}>No connections yet.</p>
                      )}
                    </div>

                    {/* Add edge */}
                    <div className="mt-2">
                      <input
                        value={edgeTargetSearch}
                        onChange={(e) => setEdgeTargetSearch(e.target.value)}
                        placeholder="Connect to entity… (search)"
                        className={`w-full rounded-lg border px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-400 ${t.input}`}
                      />
                      {edgeTargetMatches.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-2 items-center">
                          <select
                            value={newEdgeType}
                            onChange={(e) => setNewEdgeType(e.target.value)}
                            className={`rounded-lg border px-2 py-1 text-xs outline-none ${t.input}`}
                          >
                            {Object.entries(EDGE_LABELS).map(([type, label]) => (
                              <option key={type} value={type}>{label}</option>
                            ))}
                          </select>
                          {edgeTargetMatches.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => handleAddEdge(m.id)}
                              className="text-xs px-2 py-1 rounded-full text-white font-medium hover:opacity-80"
                              style={{ background: TYPE_META[m.type]?.color ?? "#6366f1" }}
                            >
                              {m.label.slice(0, 22)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className={`px-4 py-3 border-t flex items-center gap-2 ${t.divider}`}>
                  {!editing ? (
                    <>
                      <button
                        onClick={() => setEditing(true)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${t.navButton}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteEntity(selected.id)}
                        disabled={saving}
                        className="px-3 py-1.5 rounded-lg border border-red-300 text-red-500 text-xs font-medium hover:bg-red-50 disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving || !editLabel.trim()}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-40"
                        style={{ background: "linear-gradient(to right, #4f46e5, #9333ea)", color: "#fff" }}
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => setEditing(false)} className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${t.navButton}`}>
                        Cancel
                      </button>
                    </>
                  )}
                  {selected.jobId && (
                    <Link
                      href={`/job/${selected.jobId}`}
                      className={`ml-auto text-xs px-2 py-1.5 rounded-lg border ${t.navButton}`}
                    >
                      View run →
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center">
                <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <p className={`text-sm font-medium`}>Select a node</p>
                <p className={`text-xs ${t.subText}`}>
                  Click any entity to inspect its provenance, edit it, or connect it to other knowledge.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className={`mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs ${t.subText}`}>
          {Object.entries(EDGE_LABELS).map(([type, label]) => (
            <span key={type} className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5" style={{ background: EDGE_COLORS[type] }} />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-white" style={{ background: "#6366f1", boxShadow: "0 0 0 1px #6366f1" }} />
            white ring = user-created/edited
          </span>
        </div>
      </div>
    </main>
  );
}
