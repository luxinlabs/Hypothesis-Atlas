"use client";

import { useState } from "react";
import { NotebookPage } from "@/lib/notebook-types";

interface PageListProps {
  pages: NotebookPage[];
  currentPage: NotebookPage | null;
  onPageSelect: (page: NotebookPage) => void;
  onPageCreate: (title: string) => void;
  onPageDelete: (pageId: string) => void;
  isLoading?: boolean;
  theme?: "dark" | "light" | "vibrant";
}

export default function PageList({
  pages,
  currentPage,
  onPageSelect,
  onPageCreate,
  onPageDelete,
  isLoading = false,
  theme = "light",
}: PageListProps) {
  const [newPageTitle, setNewPageTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreatePage = async () => {
    if (!newPageTitle.trim()) return;

    setIsCreating(true);
    try {
      await onPageCreate(newPageTitle.trim());
      setNewPageTitle("");
      setIsCreating(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePage = async (pageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this page?")) {
      await onPageDelete(pageId);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isDark = theme === "dark";
  const isVibrant = theme === "vibrant";

  return (
    <div
      className={`flex flex-col h-full ${isDark ? "bg-zinc-900" : isVibrant ? "bg-white/90" : "bg-white"}`}
    >
      <div
        className={`p-4 border-b ${isDark ? "border-zinc-800" : "border-gray-200"}`}
      >
        <div className="flex items-center justify-between mb-3">
          <h3
            className={`font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}
          >
            Notebook Pages
          </h3>
          <button
            onClick={() => setIsCreating(true)}
            className={`p-2 text-blue-600 rounded-lg transition-colors ${isDark ? "hover:bg-zinc-800" : "hover:bg-blue-50"}`}
            title="New page"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>

        {isCreating && (
          <div className="space-y-2">
            <input
              type="text"
              value={newPageTitle}
              onChange={(e) => setNewPageTitle(e.target.value)}
              placeholder="Page title..."
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-zinc-800 border-zinc-700 text-zinc-100" : "border-gray-300"}`}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreatePage();
                } else if (e.key === "Escape") {
                  setIsCreating(false);
                  setNewPageTitle("");
                }
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreatePage}
                disabled={!newPageTitle.trim() || isLoading}
                className="flex-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewPageTitle("");
                }}
                className={`flex-1 px-3 py-1 text-sm rounded-lg ${isDark ? "bg-zinc-700 text-zinc-200 hover:bg-zinc-600" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {pages.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <svg
              className="w-12 h-12 text-gray-300 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-sm">No pages yet</p>
            <p className="text-xs mt-1">
              Create your first page to get started
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {pages.map((page) => (
              <div
                key={page.id}
                onClick={() => onPageSelect(page)}
                className={`group p-3 rounded-lg cursor-pointer transition-colors ${
                  currentPage?.id === page.id
                    ? "bg-blue-50 border border-blue-200"
                    : "hover:bg-gray-50 border border-transparent"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-gray-900 truncate">
                      {page.title}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(page.updatedAt)}
                    </p>
                    {page.content.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {page.content.substring(0, 50)}...
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDeletePage(page.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-all"
                    title="Delete page"
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
