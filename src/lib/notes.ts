export interface NoteEntry {
  id: string;
  type: "manual" | "comparison" | "session" | "insight";
  timestamp: string;
  title?: string;
  content: string;
}

export function notesKey(jobId: string) {
  return `notes:${jobId}`;
}

export function loadNotes(jobId: string): NoteEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(notesKey(jobId));
    return raw ? (JSON.parse(raw) as NoteEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveNotes(jobId: string, entries: NoteEntry[]) {
  localStorage.setItem(notesKey(jobId), JSON.stringify(entries));
  window.dispatchEvent(new Event("atlas:notes-update"));
}

export function appendNote(
  jobId: string,
  entry: Omit<NoteEntry, "id" | "timestamp">
): NoteEntry {
  const entries = loadNotes(jobId);
  const full: NoteEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  saveNotes(jobId, [...entries, full]);
  return full;
}

export function deleteNote(jobId: string, id: string) {
  const entries = loadNotes(jobId).filter((e) => e.id !== id);
  saveNotes(jobId, entries);
}

export function exportMarkdown(entries: NoteEntry[], topic: string): string {
  const lines: string[] = [
    `# Research Notes — ${topic}`,
    `_Exported ${new Date().toLocaleDateString()}_`,
    "",
  ];
  for (const e of entries) {
    lines.push(`## ${e.title ?? e.type}`);
    lines.push(`_${new Date(e.timestamp).toLocaleString()}_`);
    lines.push("");
    lines.push(e.content);
    lines.push("");
  }
  return lines.join("\n");
}

export const TYPE_META: Record<
  NoteEntry["type"],
  { label: string; bg: string; text: string }
> = {
  session: { label: "Session", bg: "bg-indigo-100", text: "text-indigo-700" },
  manual:  { label: "Note",    bg: "bg-gray-100",   text: "text-gray-600"   },
  comparison: { label: "Comparison", bg: "bg-amber-100", text: "text-amber-700" },
  insight: { label: "Insight", bg: "bg-emerald-100", text: "text-emerald-700" },
};
