"use client";

import { useEffect, useState } from "react";
import SubscribeModal from "./SubscribeModal";

interface Node {
  id: string;
  label: string;
  depth: number;
  children: Node[];
}

interface ProgressEvent {
  stage: string;
  status: string;
  message: string;
  count?: number;
  timestamp: number;
}

interface FetchedPaper {
  id: string;
  title: string;
  authors: string[];
  venue: string;
  year: string;
  abstract: string;
  url: string;
  source: "openalex" | "pubmed";
}

interface KnowledgeTreeProps {
  rootNodeId: string;
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
  events: ProgressEvent[];
  jobId: string;
  topic?: string;
  theme?: "dark" | "light" | "vibrant";
}

const THEME_STYLES = {
  dark: {
    nodeIdle: "bg-zinc-900 text-zinc-200",
    buildIdle: "bg-zinc-900 border-zinc-600",
    buildLoading: "bg-zinc-800 text-zinc-500",
    connector: "bg-zinc-700",
    error: "bg-red-500/10 border border-red-500/30 text-red-300",
    paperPanel: "bg-zinc-900 border-zinc-700",
    paperCard: "bg-zinc-800 border-zinc-700 hover:border-indigo-500",
    paperTitle: "text-zinc-100",
    paperMeta: "text-zinc-400",
    paperAbstract: "text-zinc-400",
    sectionLabel: "text-zinc-400",
    toolbar: "bg-zinc-900 border-zinc-800",
  },
  light: {
    nodeIdle: "bg-white text-gray-700",
    buildIdle: "bg-white",
    buildLoading: "bg-gray-200 text-gray-500",
    connector: "bg-gray-300",
    error: "bg-red-50 border border-red-200 text-red-700",
    paperPanel: "bg-gray-50 border-gray-200",
    paperCard: "bg-white border-gray-200 hover:border-indigo-300",
    paperTitle: "text-gray-900",
    paperMeta: "text-gray-500",
    paperAbstract: "text-gray-600",
    sectionLabel: "text-gray-500",
    toolbar: "bg-white border-gray-200",
  },
  vibrant: {
    nodeIdle: "bg-white text-zinc-700",
    buildIdle: "bg-white",
    buildLoading: "bg-zinc-200 text-zinc-500",
    connector: "bg-zinc-300",
    error: "bg-rose-50 border border-rose-200 text-rose-700",
    paperPanel: "bg-white/80 border-rose-100",
    paperCard: "bg-white border-zinc-200 hover:border-fuchsia-300",
    paperTitle: "text-zinc-900",
    paperMeta: "text-zinc-500",
    paperAbstract: "text-zinc-600",
    sectionLabel: "text-zinc-500",
    toolbar: "bg-white/80 border-rose-100",
  },
} as const;

function collectLabels(node: Node): string[] {
  return [node.label, ...node.children.flatMap(collectLabels)];
}

function findNodeById(node: Node, id: string): Node | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

function findConnection(paper: FetchedPaper, labels: string[]): string | null {
  const text = (paper.title + " " + (paper.abstract ?? "")).toLowerCase();
  for (const label of labels) {
    const words = label.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    if (words.length > 0 && words.some((w) => text.includes(w))) return label;
  }
  return null;
}

const NODE_COLORS = [
  { bg: "bg-blue-600", border: "border-blue-200", hover: "hover:border-blue-400", text: "text-blue-600", badge: "bg-blue-100 text-blue-700" },
  { bg: "bg-purple-600", border: "border-purple-200", hover: "hover:border-purple-400", text: "text-purple-600", badge: "bg-purple-100 text-purple-700" },
  { bg: "bg-pink-600", border: "border-pink-200", hover: "hover:border-pink-400", text: "text-pink-600", badge: "bg-pink-100 text-pink-700" },
];

export default function KnowledgeTree({
  rootNodeId,
  selectedNodeId,
  onNodeSelect,
  events,
  jobId,
  topic,
  theme = "light",
}: KnowledgeTreeProps) {
  const t = THEME_STYLES[theme];
  const [rootNode, setRootNode] = useState<Node | null>(null);
  const [buildingChildren, setBuildingChildren] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Explore Papers state
  const [exploringPapers, setExploringPapers] = useState(false);
  const [papers, setPapers] = useState<FetchedPaper[]>([]);
  const [showPapers, setShowPapers] = useState(false);
  const [showSubscribe, setShowSubscribe] = useState(false);

  const fetchNodeTree = () => {
    fetch(`/api/nodes/${rootNodeId}`)
      .then((res) => res.json())
      .then((data) => setRootNode(data))
      .catch(console.error);
  };

  useEffect(() => {
    fetchNodeTree();
  }, [rootNodeId]);

  useEffect(() => {
    const buildChildrenCompleted = events.find(
      (e) => e.stage === "build_children" && e.status === "completed",
    );
    if (buildChildrenCompleted) {
      fetchNodeTree();
      setBuildingChildren(null);
    }
  }, [events]);

  const handleBuildChildren = async (nodeId: string) => {
    setBuildingChildren(nodeId);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/nodes/${nodeId}/build-children`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.message || data.error || "Failed to build children");
        setBuildingChildren(null);
        return;
      }
      if (data.alreadyBuilt) {
        fetchNodeTree();
        setBuildingChildren(null);
      }
    } catch {
      setErrorMessage("An error occurred while building children");
      setBuildingChildren(null);
    }
  };

  const selectedNode = selectedNodeId && rootNode ? findNodeById(rootNode, selectedNodeId) : null;
  const activeTopic = selectedNode?.label || topic || rootNode?.label || "";

  const handleExplorePapers = async () => {
    const query = activeTopic;
    if (!query) return;
    setExploringPapers(true);
    setShowPapers(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/search-papers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: query }),
      });
      const data = await res.json();
      setPapers(data.papers ?? []);
    } catch {
      setPapers([]);
    } finally {
      setExploringPapers(false);
    }
  };

  const renderNode = (node: Node, level: number) => {
    const hasChildren = node.children && node.children.length > 0;
    const canBuildChildren = node.depth < 2 && !hasChildren;
    const isBuilding = buildingChildren === node.id;
    const color = NODE_COLORS[level] || NODE_COLORS[2];

    const sizeClasses =
      level === 0 ? "px-8 py-4 text-base font-semibold"
      : level === 1 ? "px-6 py-3 text-sm font-medium"
      : "px-4 py-2 text-xs font-medium";

    return (
      <div key={node.id} className="flex flex-col items-center">
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => onNodeSelect(node.id)}
            className={`rounded-lg transition-all ${sizeClasses} ${
              selectedNodeId === node.id
                ? `${color.bg} text-white shadow-lg scale-105`
                : `${t.nodeIdle} border-2 ${color.border} ${color.hover} hover:shadow-md`
            }`}
          >
            {node.label}
          </button>

          {canBuildChildren && (
            <button
              onClick={() => handleBuildChildren(node.id)}
              disabled={isBuilding}
              className={`text-xs px-3 py-1 rounded-full transition-all ${
                isBuilding
                  ? `${t.buildLoading} cursor-not-allowed`
                  : `${color.text} ${t.buildIdle} border border-current hover:bg-opacity-10`
              }`}
            >
              {isBuilding ? (
                <span className="flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Building...
                </span>
              ) : (
                "⚡ Build Children"
              )}
            </button>
          )}
        </div>

        {hasChildren && (
          <>
            <div className={`w-0.5 h-8 ${t.connector} my-3`} />
            <div className={`grid gap-6 w-full ${
              level === 0
                ? node.children.length > 3 ? "grid-cols-3" : "grid-cols-2"
                : "grid-cols-1"
            }`}>
              {node.children.map((child) => renderNode(child, level + 1))}
            </div>
          </>
        )}
      </div>
    );
  };

  if (!rootNode) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600" />
      </div>
    );
  }

  const allLabels = collectLabels(rootNode);

  return (
    <div className="max-w-6xl mx-auto">

      {/* ── Toolbar ── */}
      <div className={`flex items-center justify-between mb-6 px-3 py-2.5 rounded-xl border ${t.toolbar}`}>
        {/* Left: hint + selected node chip */}
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-xs hidden sm:block ${t.sectionLabel}`}>
            Click a node · "Build Children" to expand
          </span>
          {selectedNode && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
              theme === "dark" ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                               : "bg-indigo-50 text-indigo-700 border border-indigo-200"
            }`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span className="truncate max-w-[180px]">{selectedNode.label}</span>
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Subscribe button */}
          <button
            onClick={() => setShowSubscribe(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
              theme === "dark"
                ? "border-zinc-600 text-zinc-300 hover:bg-zinc-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-100"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Subscribe
          </button>

          {/* Explore Papers button */}
          <button
            onClick={showPapers ? () => setShowPapers(false) : handleExplorePapers}
            disabled={exploringPapers}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60 transition-all"
            style={{ background: "linear-gradient(to right, #0ea5e9, #6366f1)" }}
          >
            {exploringPapers ? (
              <>
                <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                Fetching…
              </>
            ) : showPapers ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                Hide Papers
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {selectedNode ? `Explore for "${selectedNode.label.slice(0, 20)}${selectedNode.label.length > 20 ? "…" : ""}"` : "Explore Papers"}
              </>
            )}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className={`mb-4 p-3 rounded text-sm ${t.error}`}>
          <div className="flex items-center justify-between gap-3">
            <p>{errorMessage}</p>
            <button onClick={() => setErrorMessage(null)} className="text-current/70 hover:text-current">✕</button>
          </div>
        </div>
      )}

      {/* ── Knowledge Tree nodes ── */}
      <div className="flex flex-col items-center">
        {renderNode(rootNode, 0)}
      </div>

      {/* ── Explored Papers panel ── */}
      {showPapers && (
        <div className={`mt-10 rounded-2xl border p-6 ${t.paperPanel}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className={`font-semibold text-sm ${t.paperTitle}`}>
                Related Papers
              </h3>
              <p className={`text-xs mt-0.5 ${t.paperMeta}`}>
                {exploringPapers
                  ? `Searching OpenAlex and PubMed for "${activeTopic}"…`
                  : papers.length > 0
                  ? `${papers.length} papers for "${activeTopic}" — connected to nodes in your tree`
                  : "No papers found. Try selecting a different node or rebuilding the tree."}
              </p>
            </div>
            {!exploringPapers && papers.length > 0 && (
              <button
                onClick={handleExplorePapers}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  theme === "dark"
                    ? "border-zinc-600 text-zinc-400 hover:bg-zinc-700"
                    : "border-gray-200 text-gray-500 hover:bg-gray-100"
                }`}
              >
                Refresh
              </button>
            )}
          </div>

          {exploringPapers ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`rounded-xl border p-4 animate-pulse ${t.paperCard}`}>
                  <div className={`h-3 rounded mb-2 w-3/4 ${theme === "dark" ? "bg-zinc-700" : "bg-gray-200"}`} />
                  <div className={`h-2.5 rounded mb-1 w-1/2 ${theme === "dark" ? "bg-zinc-700" : "bg-gray-200"}`} />
                  <div className={`h-2 rounded w-full mt-3 ${theme === "dark" ? "bg-zinc-700" : "bg-gray-100"}`} />
                  <div className={`h-2 rounded w-5/6 mt-1 ${theme === "dark" ? "bg-zinc-700" : "bg-gray-100"}`} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {papers.map((paper) => {
                const connectedNode = findConnection(paper, allLabels);
                const nodeColorIndex = connectedNode
                  ? allLabels.indexOf(connectedNode) % NODE_COLORS.length
                  : -1;
                const badgeColor = nodeColorIndex >= 0 ? NODE_COLORS[nodeColorIndex].badge : null;

                return (
                  <div key={paper.id} className={`rounded-xl border p-4 transition-all cursor-default ${t.paperCard}`}>
                    {/* Connection badge */}
                    {connectedNode && (
                      <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mb-2 ${badgeColor}`}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        {connectedNode}
                      </div>
                    )}

                    <a
                      href={paper.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-sm font-semibold leading-snug hover:text-indigo-600 transition-colors line-clamp-2 block ${t.paperTitle}`}
                    >
                      {paper.title}
                    </a>

                    <div className={`flex flex-wrap items-center gap-x-2 mt-1.5 text-xs ${t.paperMeta}`}>
                      {paper.year && <span className="font-medium">{paper.year}</span>}
                      {paper.venue && <span className="italic truncate max-w-[150px]">{paper.venue}</span>}
                      <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                        paper.source === "openalex" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {paper.source === "openalex" ? "OpenAlex" : "PubMed"}
                      </span>
                    </div>

                    {paper.authors.length > 0 && (
                      <p className={`text-xs mt-1 ${t.paperMeta}`}>
                        {paper.authors.slice(0, 2).join(", ")}{paper.authors.length > 2 ? " et al." : ""}
                      </p>
                    )}

                    {paper.abstract && (
                      <p className={`text-xs mt-2 leading-relaxed line-clamp-3 ${t.paperAbstract}`}>
                        {paper.abstract}
                      </p>
                    )}

                    <a
                      href={paper.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-3 text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
                    >
                      Read paper
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Subscribe modal ── */}
      {showSubscribe && (
        <SubscribeModal
          topic={activeTopic}
          onClose={() => setShowSubscribe(false)}
          theme={theme}
        />
      )}
    </div>
  );
}
