"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Job {
  id: string;
  topicQuery: string;
  status: string;
  rootNodeId: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { sources: number; nodes: number };
}

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-100 text-green-800 border border-green-200",
  processing: "bg-blue-100 text-blue-800 border border-blue-200",
  failed: "bg-red-100 text-red-800 border border-red-200",
  pending: "bg-gray-100 text-gray-600 border border-gray-200",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/jobs?limit=50")
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this research job? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/explore"
              className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Word Cloud
            </Link>
            <span className="text-gray-300">|</span>
            <h1 className="font-bold text-gray-900">My Research Jobs</h1>
          </div>
          <Link
            href="/explore"
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all"
          >
            + New Topic
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-500 mb-4">No research jobs yet.</p>
            <Link
              href="/explore"
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"
            >
              Start exploring →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 mb-4">{jobs.length} research job{jobs.length !== 1 ? "s" : ""}</p>
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-gray-900 text-base truncate">
                        {job.topicQuery}
                      </h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_STYLES[job.status] ?? STATUS_STYLES.pending}`}>
                        {job.status === "processing" && (
                          <span className="inline-block w-1.5 h-1.5 bg-blue-600 rounded-full mr-1 animate-ping align-middle" />
                        )}
                        {job.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span>{timeAgo(job.createdAt)}</span>
                      <span>·</span>
                      <span>{job._count.sources} sources</span>
                      <span>·</span>
                      <span>{job._count.nodes} nodes</span>
                      <span>·</span>
                      <span className="font-mono text-gray-300">{job.id.slice(0, 10)}…</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={`/job/${job.id}`}
                      className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                    >
                      View Research
                    </Link>
                    <Link
                      href={`/job/${job.id}/paper`}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                      style={{ background: "linear-gradient(to right, #4f46e5, #9333ea)", color: "#fff" }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Write Paper
                    </Link>
                    <button
                      onClick={() => handleDelete(job.id)}
                      disabled={deleting === job.id}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
                      title="Delete job"
                    >
                      {deleting === job.id ? (
                        <div className="animate-spin h-3.5 w-3.5 border-2 border-red-400 border-t-transparent rounded-full" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
