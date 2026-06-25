"use client";

import { useEffect, useState } from "react";
import {
  NoteEntry,
  appendNote,
  loadNotes,
  saveNotes,
  exportMarkdown,
  TYPE_META,
} from "@/lib/notes";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

interface NotesTabProps {
  jobId: string;
  topic: string;
  theme?: "dark" | "light" | "vibrant";
}

export default function NotesTab({ jobId, topic, theme = "light" }: NotesTabProps) {
  const [entries, setEntries] = useState<NoteEntry[]>([]);
  const [selected, setSelected] = useState<NoteEntry | null>(null);
  const [draft, setDraft] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  const isDark = theme === "dark";
  const isVibrant = theme === "vibrant";

  const bg = isDark ? "bg-zinc-900 text-zinc-100" : isVibrant ? "bg-white/90 text-zinc-900" : "bg-white text-zinc-900";
  const sidebar = isDark ? "bg-zinc-950 border-zinc-800" : isVibrant ? "bg-white/80 border-rose-100" : "bg-gray-50 border-gray-200";
  const card = isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-200";
  const cardHover = isDark ? "hover:bg-zinc-700" : "hover:bg-gray-50";
  const cardActive = isDark ? "bg-indigo-600/20 border-indigo-500" : "bg-indigo-50 border-indigo-300";
  const sub = isDark ? "text-zinc-400" : "text-gray-500";
  const divider = isDark ? "border-zinc-800" : "border-gray-200";
  const inputCls = isDark
    ? "bg-zinc-800 border-zinc-600 text-zinc-100 placeholder-zinc-500 focus:ring-indigo-400"
    : "bg-white border-gray-300 text-zinc-900 placeholder-gray-400 focus:ring-indigo-400";
  const memoryBg = isDark ? "bg-indigo-500/10 border-indigo-500/30" : "bg-indigo-50 border-indigo-200";

  const refresh = () => {
    const all = loadNotes(jobId);
    setEntries(all);
    // keep selected in sync
    if (selected) {
      const updated = all.find((e) => e.id === selected.id);
      setSelected(updated ?? null);
    }
  };

  useEffect(() => {
    // Ensure session entry exists
    const existing = loadNotes(jobId);
    if (existing.length === 0) {
      appendNote(jobId, {
        type: "session",
        title: "Session Started",
        content: `**Research Topic:** ${topic}\n\nThis notes session captures your research memory — add thoughts, save paper comparisons, and export everything as Markdown.`,
      });
    }
    refresh();
  }, [jobId]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("atlas:notes-update", handler);
    return () => window.removeEventListener("atlas:notes-update", handler);
  }, [jobId, selected]);

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    appendNote(jobId, {
      type: "manual",
      title: draftTitle.trim() || undefined,
      content: text,
    });
    setDraft("");
    setDraftTitle("");
  };

  const deleteEntry = (id: string) => {
    saveNotes(jobId, entries.filter((e) => e.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const startEdit = (entry: NoteEntry) => {
    setEditContent(entry.content);
    setEditing(true);
  };

  const saveEdit = () => {
    if (!selected) return;
    const updated = entries.map((e) =>
      e.id === selected.id ? { ...e, content: editContent } : e
    );
    saveNotes(jobId, updated);
    setEditing(false);
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

  const manualCount = entries.filter((e) => e.type === "manual").length;
  const comparisonCount = entries.filter((e) => e.type === "comparison").length;
  const insightCount = entries.filter((e) => e.type === "insight").length;

  return (
    <div className={`flex h-full w-full overflow-hidden ${bg}`}>

      {/* Left: timeline */}
      <div className={`w-80 flex-shrink-0 border-r flex flex-col ${sidebar}`}>
        {/* Session memory card */}
        <div className={`m-4 rounded-xl border p-4 ${memoryBg}`}>
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-2">Session Memory</p>
          <p className={`text-xs font-semibold leading-snug ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
            {topic}
          </p>
          <div className={`flex gap-3 mt-2 text-xs ${sub}`}>
            <span>{entries.length} entries</span>
            {comparisonCount > 0 && <span>{comparisonCount} comparisons</span>}
            {insightCount > 0 && <span>{insightCount} insights</span>}
          </div>
        </div>

        {/* Filter row */}
        <div className={`px-4 pb-3 flex items-center justify-between`}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${sub}`}>
            All Notes ({entries.length})
          </p>
          <button
            onClick={handleExport}
            className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
              isDark ? "border-zinc-600 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                     : "border-gray-200 text-gray-500 hover:bg-gray-100"
            }`}
          >
            Export .md
          </button>
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
          {entries.length === 0 && (
            <p className={`text-xs text-center py-8 ${sub}`}>No notes yet — add one →</p>
          )}
          {[...entries].reverse().map((entry) => {
            const meta = TYPE_META[entry.type] ?? TYPE_META.manual;
            const isActive = selected?.id === entry.id;
            return (
              <button
                key={entry.id}
                onClick={() => { setSelected(entry); setEditing(false); }}
                className={`w-full text-left rounded-xl border p-3 transition-all ${
                  isActive ? cardActive : `${card} ${cardHover}`
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
                    {meta.label}
                  </span>
                  {entry.title && (
                    <span className={`text-xs font-medium truncate ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                      {entry.title}
                    </span>
                  )}
                </div>
                <p className={`text-xs leading-snug line-clamp-2 ${isDark ? "text-zinc-400" : "text-gray-500"}`}>
                  {entry.content.replace(/\*\*/g, "").slice(0, 100)}
                </p>
                <p className={`text-xs mt-1.5 ${sub}`}>{formatTime(entry.timestamp)}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: editor / detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          /* Entry detail view */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Detail header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b flex-shrink-0 ${divider}`}>
              <div className="flex items-center gap-2 min-w-0">
                {(() => {
                  const meta = TYPE_META[selected.type] ?? TYPE_META.manual;
                  return (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${meta.bg} ${meta.text}`}>
                      {meta.label}
                    </span>
                  );
                })()}
                <span className={`text-sm font-semibold truncate ${isDark ? "text-zinc-200" : "text-gray-800"}`}>
                  {selected.title ?? "Note"}
                </span>
                <span className={`text-xs flex-shrink-0 ${sub}`}>{formatTime(selected.timestamp)}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!editing ? (
                  <>
                    <button
                      onClick={() => startEdit(selected)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                        isDark ? "border-zinc-600 text-zinc-300 hover:bg-zinc-700"
                               : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteEntry(selected.id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={saveEdit}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-opacity"
                      style={{ background: "linear-gradient(to right, #4f46e5, #9333ea)", color: "#fff" }}>
                      Save
                    </button>
                    <button onClick={() => setEditing(false)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                        isDark ? "border-zinc-600 text-zinc-300 hover:bg-zinc-700"
                               : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}>
                      Cancel
                    </button>
                  </>
                )}
                <button onClick={() => setSelected(null)}
                  className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-zinc-700 text-zinc-400" : "hover:bg-gray-100 text-gray-400"}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Detail content */}
            <div className="flex-1 overflow-y-auto p-6">
              {editing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className={`w-full h-full min-h-[300px] rounded-xl border px-4 py-3 text-sm leading-relaxed resize-none outline-none focus:ring-2 transition ${inputCls}`}
                />
              ) : (
                <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                  {selected.content}
                </p>
              )}
            </div>
          </div>
        ) : (
          /* New note composer */
          <div className="flex-1 flex flex-col p-6 gap-4 overflow-y-auto">
            <div>
              <h2 className={`text-lg font-bold mb-1 ${isDark ? "text-zinc-100" : "text-gray-900"}`}>
                Add a Note
              </h2>
              <p className={`text-xs ${sub}`}>
                Capture thoughts, findings, or decisions for this research session.
              </p>
            </div>

            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Title (optional)"
              className={`rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 transition ${inputCls}`}
            />

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote(); }}
              placeholder="Write your note here… (⌘↵ to save)"
              rows={10}
              className={`flex-1 rounded-xl border px-4 py-3 text-sm leading-relaxed resize-none outline-none focus:ring-2 transition ${inputCls}`}
            />

            <button
              onClick={addNote}
              disabled={!draft.trim()}
              className="py-2.5 px-6 rounded-xl font-semibold text-sm self-start transition-opacity disabled:opacity-40"
              style={{ background: "linear-gradient(to right, #4f46e5, #9333ea)", color: "#fff" }}
            >
              Add Note
            </button>

            {/* Quick insight prompt */}
            <div className={`rounded-xl border p-4 ${isDark ? "bg-zinc-800/40 border-zinc-700" : "bg-gray-50 border-gray-200"}`}>
              <p className={`text-xs font-semibold mb-2 ${isDark ? "text-zinc-300" : "text-gray-600"}`}>
                Quick captures
              </p>
              <div className="flex flex-wrap gap-2">
                {["Key finding", "Open question", "Method note", "Citation needed", "Follow up"].map((label) => (
                  <button
                    key={label}
                    onClick={() => setDraftTitle(label)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      isDark ? "border-zinc-600 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                             : "border-gray-200 text-gray-500 hover:bg-white hover:text-gray-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
