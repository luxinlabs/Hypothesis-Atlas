"use client";

import { useEffect, useState } from "react";

interface Source {
  id: string;
  type: string;
  title: string;
  url: string | null;
  authors: string[];
  venue: string | null;
  snippet: string | null;
  reliabilityTier: string;
  role: string;
}

interface NodeData {
  id: string;
  label: string;
  summary: string;
  methods: string[];
  findings: string[];
  disagreements: string[];
  openProblems: string[];
  sources: Source[];
}

interface NodeDetailProps {
  nodeId: string;
  theme?: "dark" | "light" | "vibrant";
}

const THEME_STYLES = {
  dark: {
    heading: "text-zinc-100",
    text: "text-zinc-300",
    subheading: "text-zinc-200",
    border: "border-zinc-700",
    sourceCard: "bg-zinc-900",
    sourceText: "text-zinc-400",
    datasetCard: "bg-indigo-500/10",
    socialCard: "bg-amber-500/10 border border-amber-500/30",
    socialText: "text-amber-300",
  },
  light: {
    heading: "text-gray-900",
    text: "text-gray-700",
    subheading: "text-gray-900",
    border: "border-gray-200",
    sourceCard: "bg-gray-50",
    sourceText: "text-gray-500",
    datasetCard: "bg-blue-50",
    socialCard: "bg-yellow-50 border border-yellow-200",
    socialText: "text-yellow-600",
  },
  vibrant: {
    heading: "text-zinc-900",
    text: "text-zinc-700",
    subheading: "text-zinc-900",
    border: "border-zinc-200",
    sourceCard: "bg-white",
    sourceText: "text-zinc-500",
    datasetCard: "bg-sky-50",
    socialCard: "bg-rose-50 border border-rose-200",
    socialText: "text-rose-600",
  },
} as const;

export default function NodeDetail({
  nodeId,
  theme = "light",
}: NodeDetailProps) {
  const t = THEME_STYLES[theme];
  const [node, setNode] = useState<NodeData | null>(null);

  useEffect(() => {
    fetch(`/api/nodes/${nodeId}`)
      .then((res) => res.json())
      .then((data) => setNode(data))
      .catch(console.error);
  }, [nodeId]);

  if (!node) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const peerReviewedSources = node.sources.filter(
    (s) => s.reliabilityTier === "peer_reviewed",
  );
  const datasetSources = node.sources.filter(
    (s) => s.reliabilityTier === "dataset",
  );
  const socialSources = node.sources.filter(
    (s) => s.reliabilityTier === "social_signal",
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className={`text-xl font-bold mb-2 ${t.heading}`}>{node.label}</h2>
        <p className={`text-sm leading-relaxed ${t.text}`}>{node.summary}</p>
      </div>

      {node.methods.length > 0 && (
        <div>
          <h3 className={`text-sm font-semibold mb-2 ${t.subheading}`}>
            Methods
          </h3>
          <ul className="space-y-1">
            {node.methods.map((method, i) => (
              <li key={i} className={`text-xs flex gap-2 ${t.text}`}>
                <span className="text-blue-500">•</span>
                <span>{method}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {node.findings.length > 0 && (
        <div>
          <h3 className={`text-sm font-semibold mb-2 ${t.subheading}`}>
            Key Findings
          </h3>
          <ul className="space-y-1">
            {node.findings.map((finding, i) => (
              <li key={i} className="text-xs text-gray-600 flex gap-2">
                <span className="text-green-500">•</span>
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {node.disagreements.length > 0 && (
        <div>
          <h3 className={`text-sm font-semibold mb-2 ${t.subheading}`}>
            Disagreements
          </h3>
          <ul className="space-y-1">
            {node.disagreements.map((disagreement, i) => (
              <li key={i} className="text-xs text-gray-600 flex gap-2">
                <span className="text-orange-500">•</span>
                <span>{disagreement}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {node.openProblems.length > 0 && (
        <div>
          <h3 className={`text-sm font-semibold mb-2 ${t.subheading}`}>
            Open Problems
          </h3>
          <ul className="space-y-1">
            {node.openProblems.map((problem, i) => (
              <li key={i} className="text-xs text-gray-600 flex gap-2">
                <span className="text-red-500">•</span>
                <span>{problem}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={`border-t pt-4 ${t.border}`}>
        <h3 className={`text-sm font-semibold mb-3 ${t.subheading}`}>
          Sources
        </h3>

        {peerReviewedSources.length > 0 && (
          <div className="mb-4">
            <h4 className={`text-xs font-semibold mb-2 ${t.text}`}>
              Peer-Reviewed Papers ({peerReviewedSources.length})
            </h4>
            <div className="space-y-2">
              {peerReviewedSources.slice(0, 5).map((source) => (
                <div
                  key={source.id}
                  className={`text-xs p-2 rounded ${t.sourceCard}`}
                >
                  <a
                    href={source.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {source.title}
                  </a>
                  {source.authors.length > 0 && (
                    <p className={`mt-1 ${t.sourceText}`}>
                      {source.authors.slice(0, 3).join(", ")}
                      {source.authors.length > 3 && " et al."}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {datasetSources.length > 0 && (
          <div className="mb-4">
            <h4 className={`text-xs font-semibold mb-2 ${t.text}`}>
              Datasets ({datasetSources.length})
            </h4>
            <div className="space-y-2">
              {datasetSources.slice(0, 3).map((source) => (
                <div
                  key={source.id}
                  className={`text-xs p-2 rounded ${t.datasetCard}`}
                >
                  <a
                    href={source.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {source.title}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {socialSources.length > 0 && (
          <div>
            <h4 className={`text-xs font-semibold mb-2 ${t.text}`}>
              Speculative / Pre-publication Signals ({socialSources.length})
            </h4>
            <div className="space-y-2">
              {socialSources.map((source) => (
                <div
                  key={source.id}
                  className={`text-xs p-2 rounded ${t.socialCard}`}
                >
                  <a
                    href={source.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-yellow-700 hover:underline font-medium"
                  >
                    {source.title}
                  </a>
                  <p className={`text-xs mt-1 ${t.socialText}`}>
                    ⚠️ Not peer-reviewed
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
