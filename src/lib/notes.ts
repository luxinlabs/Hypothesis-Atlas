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

function migrationFlagKey(jobId: string) {
  return `notes-migrated:${jobId}`;
}

function isNoteType(v: unknown): v is NoteEntry["type"] {
  return v === "manual" || v === "comparison" || v === "session" || v === "insight";
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Notes API ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * One-time migration: pushes any localStorage notes for this job into the
 * research graph as note entities, then flags the job as migrated.
 */
async function migrateLocalNotes(jobId: string): Promise<NoteEntry[]> {
  if (typeof window === "undefined") return [];
  let local: NoteEntry[] = [];
  try {
    if (localStorage.getItem(migrationFlagKey(jobId))) return [];
    const raw = localStorage.getItem(notesKey(jobId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    local = parsed.filter(
      (e): e is NoteEntry =>
        e && typeof e.id === "string" && typeof e.content === "string" && isNoteType(e.type)
    );
  } catch {
    return [];
  }
  if (local.length === 0) return [];

  try {
    await api(`/api/jobs/${jobId}/notes/migrate`, {
      method: "POST",
      body: JSON.stringify({ notes: local }),
    });
    localStorage.setItem(migrationFlagKey(jobId), "1");
    localStorage.removeItem(notesKey(jobId));
  } catch {
    // Keep local notes untouched; retry on next load.
    return [];
  }
  return [];
}

export async function loadNotes(jobId: string): Promise<NoteEntry[]> {
  const migrated = await migrateLocalNotes(jobId);
  if (migrated.length > 0) return migrated;

  try {
    const data = await api<{ notes: NoteEntry[] }>(`/api/jobs/${jobId}/notes`);
    return data.notes;
  } catch {
    return [];
  }
}

function notifyUpdate() {
  window.dispatchEvent(new Event("atlas:notes-update"));
}

export async function appendNote(
  jobId: string,
  entry: Omit<NoteEntry, "id" | "timestamp">
): Promise<NoteEntry> {
  const created = await api<{ note: NoteEntry }>(`/api/jobs/${jobId}/notes`, {
    method: "POST",
    body: JSON.stringify(entry),
  });
  notifyUpdate();
  return created.note;
}

export async function updateNote(
  jobId: string,
  id: string,
  patch: Partial<Pick<NoteEntry, "content" | "title" | "type">>
): Promise<NoteEntry> {
  const updated = await api<{ note: NoteEntry }>(`/api/jobs/${jobId}/notes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  notifyUpdate();
  return updated.note;
}

export async function deleteNote(jobId: string, id: string): Promise<void> {
  await api(`/api/jobs/${jobId}/notes/${id}`, { method: "DELETE" });
  notifyUpdate();
}

/** Replaces the whole note list for a job (used by legacy save-notes call sites). */
export async function saveNotes(jobId: string, entries: NoteEntry[]): Promise<void> {
  await api(`/api/jobs/${jobId}/notes/replace`, {
    method: "POST",
    body: JSON.stringify({ notes: entries }),
  });
  notifyUpdate();
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
