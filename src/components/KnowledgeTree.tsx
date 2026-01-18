"use client";

import { useEffect, useState } from "react";

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

interface KnowledgeTreeProps {
  rootNodeId: string;
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
  events: ProgressEvent[];
  jobId: string;
}

export default function KnowledgeTree({
  rootNodeId,
  selectedNodeId,
  onNodeSelect,
  events,
  jobId,
}: KnowledgeTreeProps) {
  const [rootNode, setRootNode] = useState<Node | null>(null);
  const [buildingChildren, setBuildingChildren] = useState<string | null>(null);

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
    try {
      await fetch(`/api/nodes/${nodeId}/build-children`, {
        method: "POST",
      });
    } catch (error) {
      console.error("Failed to build children:", error);
      setBuildingChildren(null);
    }
  };

  const renderNode = (node: Node, level: number) => {
    const hasChildren = node.children && node.children.length > 0;
    const canBuildChildren = node.depth < 2 && !hasChildren;
    const isBuilding = buildingChildren === node.id;

    const colors = [
      {
        bg: "bg-blue-600",
        border: "border-blue-200",
        hover: "hover:border-blue-400",
        text: "text-blue-600",
      },
      {
        bg: "bg-purple-600",
        border: "border-purple-200",
        hover: "hover:border-purple-400",
        text: "text-purple-600",
      },
      {
        bg: "bg-pink-600",
        border: "border-pink-200",
        hover: "hover:border-pink-400",
        text: "text-pink-600",
      },
    ];
    const color = colors[level] || colors[2];

    // Adjust sizing based on level
    const sizeClasses =
      level === 0
        ? "px-8 py-4 text-base font-semibold"
        : level === 1
          ? "px-6 py-3 text-sm font-medium"
          : "px-4 py-2 text-xs font-medium";

    return (
      <div key={node.id} className="flex flex-col items-center">
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => onNodeSelect(node.id)}
            className={`rounded-lg transition-all ${sizeClasses} ${
              selectedNodeId === node.id
                ? `${color.bg} text-white shadow-lg scale-105`
                : `bg-white text-gray-700 border-2 ${color.border} ${color.hover} hover:shadow-md`
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
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : `${color.text} bg-white border border-current hover:bg-opacity-10`
              }`}
            >
              {isBuilding ? (
                <span className="flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
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
            <div className="w-0.5 h-8 bg-gray-300 my-3"></div>
            <div
              className={`grid gap-6 w-full ${
                level === 0
                  ? node.children.length > 3
                    ? "grid-cols-3"
                    : "grid-cols-2"
                  : level === 1
                    ? "grid-cols-1"
                    : "grid-cols-1"
              }`}
            >
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex flex-col items-center">
        {renderNode(rootNode, 0)}
      </div>

      <div className="mt-12 text-center text-sm text-gray-500">
        <p>Click any node to view detailed analysis</p>
        <p className="text-xs mt-1">
          Click "Build Children" to explore subtopics (max 3 layers)
        </p>
      </div>
    </div>
  );
}
