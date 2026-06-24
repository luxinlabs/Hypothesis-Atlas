"use client";

import { useEffect, useRef, useState } from "react";
import {
  NoteEntry,
  appendNote,
  loadNotes,
  saveNotes,
  exportMarkdown,
  TYPE_META,
} from "@/lib/notes";

export { appendNote };
export type { NoteEntry };

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

interface NotesPanelProps {
  jobId: string;
  topic: string;
  theme?: "dark" | "light" | "vibrant";
  hidden?: boolean;
}

export default function NotesPanel({ jobId, topic, theme = "light", hidden = false }: NotesPanelProps) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<NoteEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const isDark = theme === "dark";

  const bg = isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-gray-200 text-zinc-900";
  const sub = isDark ? "text-zinc-400" : "text-gray-500";
  const inputCls = isDark
    ? "bg-zinc-800 border-zinc-600 text-zinc-100 placeholder-zinc-500 focus:ring-indigo-400"
    : "bg-gray-50 border-gray-300 text-zinc-900 placeholder-gray-400 focus:ring-indigo-400";
  const cardCls = isDark ? "bg-zinc-800/60 border-zinc-700" : "bg-gray-50 border-gray-200";
  const divider = isDark ? "border-zinc-700" : "border-gray-100";

  const refresh = () => setEntries(loadNotes(jobId));

  useEffect(() => {
    const existing = loadNotes(jobId);
    if (existing.length === 0) {
      appendNote(jobId, {
        type: "session",
        title: "Session Started",
        content: `**Research Topic:** ${topic}\n\nThis notes session captures your research memory — add thoughts, save paper comparisons, and export everything as Markdown.`,
      });
    }
    refresh();
  }, [jobId, topic]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("atlas:notes-update", handler);
    return () => window.removeEventListener("atlas:notes-update", handler);
  }, [jobId]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length, open]);

  const addManualNote = () => {
    const text = draft.trim();
    if (!text) return;
    appendNote(jobId, { type: "manual", content: text });
    setDraft("");
  };

  const deleteEntry = (id: string) => {
    saveNotes(jobId, entries.filter((e) => e.id !== id));
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    const md = exportMarkdown(entries, topic);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notes-${jobId.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-xl font-semibold text-sm transition-all hover:scale-105"
        style={{
          background: open ? "#6366f1" : "linear-gradient(to right, #4f46e5, #9333ea)",
          color: "#fff",
        }}
        title="Session Notes"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Notes
        {entries.length > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/30 text-xs font-bold">
            {entries.length}
          </span>
        )}
      </button>

      <div
        className={`fixed top-0 right-0 h-full z-40 flex flex-col border-l shadow-2xl transition-all duration-300 ${bg} ${
          open ? "w-96 opacity-100" : "w-0 opacity-0 overflow-hidden"
        }`}
      >
        {open && (
          <>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${divider} flex-shrink-0`}>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-500">Session Notes</p>
                <p className={`text-xs mt-0.5 truncate ${sub}`}>{topic}</p>
              </div>
              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                <button onClick={handleExport}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                    isDark ? "border-zinc-600 text-zinc-300 hover:bg-zinc-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>Export .md</button>
                <button onClick={() => setOpen(false)}
                  className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-zinc-700 text-zinc-400" : "hover:bg-gray-100 text-gray-500"}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {entries.length === 0 && (
                <p className={`text-xs text-center mt-8 ${sub}`}>No notes yet.</p>
              )}
              {entries.map((entry) => {
                const meta = TYPE_META[entry.type] ?? TYPE_META.manual;
                const isExpanded = expanded.has(entry.id);
                const isLong = entry.content.length > 200;
                const display = isLong && !isExpanded ? entry.content.slice(0, 200) + "…" : entry.content;
                return (
                  <div key={entry.id} className={`rounded-xl border p-3 ${cardCls}`}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
                          {meta.label}
                        </span>
                        {entry.title && (
                          <span className={`text-xs font-medium ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                            {entry.title}
                          </span>
                        )}
                      </div>
                      <button onClick={() => deleteEntry(entry.id)}
                        className={`flex-shrink-0 p-0.5 rounded transition-colors ${isDark ? "text-zinc-600 hover:text-zinc-400" : "text-gray-300 hover:text-gray-500"}`}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className={`text-xs leading-relaxed whitespace-pre-wrap ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                      {display}
                    </p>
                    {isLong && (
                      <button onClick={() => toggleExpand(entry.id)} className="text-xs text-indigo-500 mt-1 hover:underline">
                        {isExpanded ? "Show less" : "Show more"}
                      </button>
                    )}
                    <p className={`text-xs mt-2 ${sub}`}>{formatTime(entry.timestamp)}</p>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className={`border-t ${divider} px-4 py-4 flex-shrink-0`}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addManualNote(); }}
                placeholder="Add a note… (⌘↵ to save)"
                rows={3}
                className={`w-full rounded-xl border px-3 py-2 text-xs resize-none outline-none focus:ring-2 transition ${inputCls}`}
              />
              <button onClick={addManualNote} disabled={!draft.trim()}
                className="mt-2 w-full py-2 rounded-xl text-xs font-semibold transition-opacity disabled:opacity-40"
                style={{ background: "linear-gradient(to right, #4f46e5, #9333ea)", color: "#fff" }}>
                Add Note
              </button>
            </div>
          </>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]" onClick={() => setOpen(false)} />
      )}
    </>
  );
}
