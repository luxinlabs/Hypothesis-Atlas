"use client";

import { useState } from "react";
import { CandidateTopic } from "@/lib/notebook-types";

interface CandidateTopicsProps {
  candidates: CandidateTopic[];
  selectedCandidates: string[];
  onSelectionChange: (selected: string[]) => void;
  onAddCandidate: (label: string) => void;
  onArchiveCandidate: (candidateId: string) => void;
  isLoading?: boolean;
}

export default function CandidateTopics({
  candidates,
  selectedCandidates,
  onSelectionChange,
  onAddCandidate,
  onArchiveCandidate,
  isLoading = false,
}: CandidateTopicsProps) {
  const [newCandidate, setNewCandidate] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAddCandidate = async () => {
    if (!newCandidate.trim()) return;

    setIsAdding(true);
    try {
      await onAddCandidate(newCandidate.trim());
      setNewCandidate("");
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleSelection = (candidateId: string) => {
    const newSelection = selectedCandidates.includes(candidateId)
      ? selectedCandidates.filter((id) => id !== candidateId)
      : [...selectedCandidates, candidateId];
    onSelectionChange(newSelection);
  };

  const handleArchive = async (candidateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await onArchiveCandidate(candidateId);
  };

  const activeCandidates = candidates.filter((c) => c.status === "active");
  const selectedCount = selectedCandidates.length;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Candidate Topics</h3>
          {selectedCount > 0 && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
              {selectedCount} selected
            </span>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newCandidate}
              onChange={(e) => setNewCandidate(e.target.value)}
              placeholder="Add topic..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddCandidate();
                } else if (e.key === "Escape") {
                  setNewCandidate("");
                }
              }}
            />
            <button
              onClick={handleAddCandidate}
              disabled={!newCandidate.trim() || isLoading || isAdding}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeCandidates.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <svg
              className="w-12 h-12 text-gray-300 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <p className="text-sm font-medium">No candidate topics yet</p>
            <p className="text-xs mt-1">
              Add topics manually or chat with the copilot
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeCandidates.map((candidate) => {
              const isSelected = selectedCandidates.includes(candidate.id);
              const evidence = candidate.evidenceJson
                ? JSON.parse(candidate.evidenceJson)
                : null;

              return (
                <div
                  key={candidate.id}
                  className={`group p-3 border rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => handleToggleSelection(candidate.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div
                        className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? "border-blue-500 bg-blue-500"
                            : "border-gray-300"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-gray-900">
                          {candidate.label}
                        </h4>

                        {evidence && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {evidence}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-2">
                          {candidate.score && (
                            <span className="text-xs text-gray-500">
                              Score: {candidate.score.toFixed(2)}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(candidate.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleArchive(candidate.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded transition-all"
                      title="Archive topic"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedCount > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-600 mb-2">
            {selectedCount} topic{selectedCount !== 1 ? "s" : ""} selected for
            convergence
          </div>
        </div>
      )}
    </div>
  );
}
