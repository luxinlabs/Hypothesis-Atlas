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
}

export default function NodeDetail({ nodeId }: NodeDetailProps) {
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
        <h2 className="text-xl font-bold text-gray-900 mb-2">{node.label}</h2>
        <p className="text-sm text-gray-700 leading-relaxed">{node.summary}</p>
      </div>

      {node.methods.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Methods</h3>
          <ul className="space-y-1">
            {node.methods.map((method, i) => (
              <li key={i} className="text-xs text-gray-600 flex gap-2">
                <span className="text-blue-500">•</span>
                <span>{method}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {node.findings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
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
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
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
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
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

      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Sources</h3>

        {peerReviewedSources.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">
              Peer-Reviewed Papers ({peerReviewedSources.length})
            </h4>
            <div className="space-y-2">
              {peerReviewedSources.slice(0, 5).map((source) => (
                <div key={source.id} className="text-xs bg-gray-50 p-2 rounded">
                  <a
                    href={source.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {source.title}
                  </a>
                  {source.authors.length > 0 && (
                    <p className="text-gray-500 mt-1">
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
            <h4 className="text-xs font-semibold text-gray-700 mb-2">
              Datasets ({datasetSources.length})
            </h4>
            <div className="space-y-2">
              {datasetSources.slice(0, 3).map((source) => (
                <div key={source.id} className="text-xs bg-blue-50 p-2 rounded">
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
            <h4 className="text-xs font-semibold text-gray-700 mb-2">
              Speculative / Pre-publication Signals ({socialSources.length})
            </h4>
            <div className="space-y-2">
              {socialSources.map((source) => (
                <div
                  key={source.id}
                  className="text-xs bg-yellow-50 p-2 rounded border border-yellow-200"
                >
                  <a
                    href={source.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-yellow-700 hover:underline font-medium"
                  >
                    {source.title}
                  </a>
                  <p className="text-yellow-600 text-xs mt-1">
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
