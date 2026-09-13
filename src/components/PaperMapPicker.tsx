"use client";

import { useState } from "react";
import PaperMap from "./PaperMap";

interface PaperMapPickerProps {
  jobId: string;
  onClose: () => void;
  onImport: (ids: string[]) => void;
}

export default function PaperMapPicker({ jobId, onClose, onImport }: PaperMapPickerProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Import from Paper Map</h3>
            <p className="text-xs text-gray-500">
              Papers you mapped earlier — click to select, they keep their map relationships.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0">
          <PaperMap jobId={jobId} selectable selectedIds={selected} onToggleSelect={toggle} />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 flex-shrink-0">
          <p className="text-xs text-gray-500">
            {selected.length === 0
              ? "No papers selected"
              : `${selected.length} paper${selected.length !== 1 ? "s" : ""} selected`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onImport(selected)}
              disabled={selected.length === 0}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
              style={{ background: "linear-gradient(to right, #0ea5e9, #6366f1)" }}
            >
              Add to Session{selected.length > 0 ? ` (${selected.length})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
