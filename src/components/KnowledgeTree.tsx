"use client";

import { useEffect, useState } from "react";

interface Node {
  id: string;
  label: string;
  children: Node[];
}

interface ProgressEvent {
  stage: string;
  status: string;
  message: string;
  count?: number;
  timestamp: number;
}

interface KnowledgeTreeProps {
  rootNodeId: string;
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
  events: ProgressEvent[];
}

export default function KnowledgeTree({
  rootNodeId,
  selectedNodeId,
  onNodeSelect,
  events,
}: KnowledgeTreeProps) {
  const [rootNode, setRootNode] = useState<Node | null>(null);

  useEffect(() => {
    fetch(`/api/nodes/${rootNodeId}`)
      .then((res) => res.json())
      .then((data) => setRootNode(data))
      .catch(console.error);
  }, [rootNodeId]);

  useEffect(() => {
    const buildChildrenCompleted = events.find(
      (e) => e.stage === "build_children" && e.status === "completed",
    );

    if (buildChildrenCompleted && rootNodeId) {
      fetch(`/api/nodes/${rootNodeId}`)
        .then((res) => res.json())
        .then((data) => setRootNode(data))
        .catch(console.error);
    }
  }, [events, rootNodeId]);

  if (!rootNode) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col items-center">
        <button
          onClick={() => onNodeSelect(rootNode.id)}
          className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all ${
            selectedNodeId === rootNode.id
              ? "bg-blue-600 text-white shadow-lg scale-105"
              : "bg-white text-gray-800 border-2 border-blue-200 hover:border-blue-400 hover:shadow-md"
          }`}
        >
          {rootNode.label}
        </button>

        {rootNode.children && rootNode.children.length > 0 && (
          <>
            <div className="w-0.5 h-12 bg-gray-300 my-4"></div>

            <div className="grid grid-cols-2 gap-6 w-full">
              {rootNode.children.map((child) => (
                <div key={child.id} className="flex flex-col items-center">
                  <button
                    onClick={() => onNodeSelect(child.id)}
                    className={`w-full px-6 py-3 rounded-lg font-medium transition-all ${
                      selectedNodeId === child.id
                        ? "bg-purple-600 text-white shadow-lg scale-105"
                        : "bg-white text-gray-700 border-2 border-purple-200 hover:border-purple-400 hover:shadow-md"
                    }`}
                  >
                    {child.label}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-12 text-center text-sm text-gray-500">
        <p>Click any node to view detailed analysis</p>
      </div>
    </div>
  );
}
