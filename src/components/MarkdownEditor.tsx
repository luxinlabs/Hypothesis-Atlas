"use client";

import { useState, useEffect, useRef } from "react";
import { NotebookPage } from "@/lib/notebook-types";

interface MarkdownEditorProps {
  page: NotebookPage | null;
  onSave: (content: string) => void;
  isLoading?: boolean;
}

export default function MarkdownEditor({
  page,
  onSave,
  isLoading = false,
}: MarkdownEditorProps) {
  const [content, setContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (page) {
      setContent(page.content);
      setIsDirty(false);
    } else {
      setContent("");
      setIsDirty(false);
    }
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isDirty && page) {
        onSave(content);
        setIsDirty(false);
      }
    }, 1000); // Auto-save after 1 second of inactivity

    return () => clearTimeout(timer);
  }, [content, isDirty, page, onSave]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsDirty(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab support
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newContent =
        content.substring(0, start) + "  " + content.substring(end);
      setContent(newContent);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart =
            textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  if (!page) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <div className="bg-gray-50 rounded-xl p-8 border-2 border-dashed border-gray-300">
            <svg
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <p className="font-medium">
              Select or create a page to start writing
            </p>
            <p className="text-sm mt-2">Use markdown for formatting</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <h3 className="font-semibold text-gray-900">{page.title}</h3>
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-xs text-orange-600 font-medium">Unsaved</span>
          )}
          {isLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-200 border-t-blue-600"></div>
          )}
        </div>
      </div>

      <div className="flex-1 p-4 bg-gray-50">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Start writing in markdown..."
          className="w-full h-full p-4 font-mono text-sm bg-white border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          style={{ minHeight: "400px" }}
        />
      </div>

      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500">
          <span className="font-medium">Markdown tips:</span> Use ## for
          headers, * for italics, ** for bold, `code` for inline code
        </div>
      </div>
    </div>
  );
}
