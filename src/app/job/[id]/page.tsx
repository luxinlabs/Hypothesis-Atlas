"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ProgressTimeline from "@/components/ProgressTimeline";
import KnowledgeTree from "@/components/KnowledgeTree";
import NodeDetail from "@/components/NodeDetail";
import NotebookTab from "@/components/NotebookTab";

interface Job {
  id: string;
  topicQuery: string;
  status: string;
  rootNodeId: string | null;
}

interface ProgressEvent {
  stage: string;
  status: string;
  message: string;
  count?: number;
  timestamp: number;
}

type Theme = "dark" | "light" | "vibrant";

const THEME_STYLES = {
  dark: {
    page: "bg-[#0a0a0f] text-white",
    pageSoft: "bg-zinc-900/90 border-zinc-800",
    pageMuted: "bg-zinc-900/80 border-zinc-800",
    tabBar: "bg-zinc-900 border-zinc-800",
    tabActive: "border-indigo-400 text-indigo-300",
    tabIdle: "text-zinc-400 hover:text-zinc-200 hover:border-zinc-600",
    title:
      "bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-transparent",
  },
  light: {
    page: "bg-gradient-to-b from-white to-zinc-50 text-zinc-900",
    pageSoft: "bg-white/90 border-gray-200",
    pageMuted: "bg-white/80 border-gray-200",
    tabBar: "bg-white border-gray-200",
    tabActive: "border-blue-500 text-blue-600",
    tabIdle: "text-gray-500 hover:text-gray-700 hover:border-gray-300",
    title:
      "bg-gradient-to-r from-blue-800 to-indigo-800 bg-clip-text text-transparent",
  },
  vibrant: {
    page: "bg-gradient-to-br from-rose-50 via-amber-50 to-sky-50 text-zinc-900",
    pageSoft: "bg-white/80 border-rose-200",
    pageMuted: "bg-white/85 border-zinc-200",
    tabBar: "bg-white/80 border-rose-200",
    tabActive: "border-fuchsia-500 text-fuchsia-700",
    tabIdle: "text-zinc-500 hover:text-zinc-700 hover:border-zinc-300",
    title:
      "bg-gradient-to-r from-fuchsia-700 to-orange-700 bg-clip-text text-transparent",
  },
} as const;

export default function JobPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"knowledge" | "notebook">(
    "knowledge",
  );
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved && ["dark", "light", "vibrant"].includes(saved)) {
      setTheme(saved);
    }
  }, []);

  const t = THEME_STYLES[theme];

  useEffect(() => {
    const fetchJob = () => {
      fetch(`/api/jobs/${jobId}`)
        .then((res) => res.json())
        .then((data) => {
          setJob(data);
          // Only set selectedNodeId if it hasn't been set yet
          if (data.rootNodeId && selectedNodeId === null) {
            setSelectedNodeId(data.rootNodeId);
          }
        })
        .catch(console.error);
    };

    fetchJob();

    const eventSource = new EventSource(`/api/jobs/${jobId}/events`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setEvents((prev) => [...prev, data]);

      if (data.stage === "build_root" && data.status === "completed") {
        fetchJob();
      }

      if (data.stage === "complete" && data.status === "completed") {
        fetchJob();
      }
    };

    return () => {
      eventSource.close();
    };
  }, [jobId, selectedNodeId]);

  if (!job) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${t.page}`}
      >
        <div className="text-center">
          <div className="relative mb-6">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-gray-200 mx-auto"></div>
            <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-blue-600 mx-auto absolute top-0 left-1/2 -ml-10"></div>
          </div>
          <p className="text-lg font-semibold text-gray-700">
            Loading job details...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${t.page} transition-all duration-500`}>
      <header
        className={`${t.pageSoft} backdrop-blur-sm border-b px-6 py-5 shadow-sm`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${t.title}`}>
                {job.topicQuery}
              </h1>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">
                ID: {job.id.slice(0, 12)}...
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-4 py-2 rounded-lg text-sm font-semibold shadow-sm ${
                job.status === "completed"
                  ? "bg-green-100 text-green-800 border border-green-200"
                  : job.status === "processing"
                    ? "bg-blue-100 text-blue-800 border border-blue-200 animate-pulse"
                    : job.status === "failed"
                      ? "bg-red-100 text-red-800 border border-red-200"
                      : "bg-gray-100 text-gray-800 border border-gray-200"
              }`}
            >
              {job.status === "processing" && (
                <span className="inline-block w-2 h-2 bg-blue-600 rounded-full mr-2 animate-ping"></span>
              )}
              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </span>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className={`${t.tabBar} border-b`}>
        <div className="px-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab("knowledge")}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "knowledge"
                  ? t.tabActive
                  : `border-transparent ${t.tabIdle}`
              }`}
            >
              <div className="flex items-center gap-2">
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
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                Knowledge Tree
              </div>
            </button>
            <button
              onClick={() => setActiveTab("notebook")}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "notebook"
                  ? t.tabActive
                  : `border-transparent ${t.tabIdle}`
              }`}
            >
              <div className="flex items-center gap-2">
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
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Notebook & Topic Copilot
              </div>
            </button>
          </nav>
        </div>
      </div>

      <div className="flex h-[calc(100vh-89px-49px)]">
        {activeTab === "knowledge" ? (
          <>
            <div className="w-80 bg-white/80 backdrop-blur-sm border-r border-gray-200 overflow-y-auto shadow-sm">
              <ProgressTimeline events={events} theme={theme} />
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              {job.rootNodeId ? (
                <KnowledgeTree
                  rootNodeId={job.rootNodeId}
                  selectedNodeId={selectedNodeId}
                  onNodeSelect={setSelectedNodeId}
                  events={events}
                  jobId={jobId}
                  theme={theme}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl p-12 shadow-lg">
                    <div className="relative mb-6">
                      <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 mx-auto"></div>
                      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-600 mx-auto absolute top-0 left-1/2 -ml-8"></div>
                    </div>
                    <p className="text-lg font-semibold text-gray-800 mb-2">
                      Building Knowledge Tree
                    </p>
                    <p className="text-sm text-gray-600">
                      Analyzing sources and creating nodes...
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div
              className={`w-96 ${t.pageMuted} backdrop-blur-sm border-l overflow-y-auto shadow-sm`}
            >
              {selectedNodeId ? (
                <NodeDetail nodeId={selectedNodeId} theme={theme} />
              ) : (
                <div className="p-8 text-center">
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
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-gray-600 font-medium">
                      Select a node to view details
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Click any node in the knowledge tree
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <NotebookTab jobId={jobId} theme={theme} />
        )}
      </div>
    </div>
  );
}
