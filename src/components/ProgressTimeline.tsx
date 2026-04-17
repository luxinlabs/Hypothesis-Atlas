"use client";

interface ProgressEvent {
  stage: string;
  status: string;
  message: string;
  count?: number;
  timestamp: number;
}

interface ProgressTimelineProps {
  events: ProgressEvent[];
  theme?: "dark" | "light" | "vibrant";
}

const THEME_STYLES = {
  dark: {
    title: "text-zinc-100",
    subtitle: "text-zinc-400",
    pending: "text-zinc-500",
    message: "text-zinc-300",
    timestamp: "text-zinc-500",
    count: "text-indigo-200 bg-indigo-500/20",
    stageDone: "text-green-300",
    stageActive: "text-indigo-300",
    stagePending: "text-zinc-500",
    stagePendingIcon: "bg-zinc-800 text-zinc-500",
    connectorDone: "bg-green-400/70",
    connectorPending: "bg-zinc-700",
    activeDot: "bg-indigo-500 text-white shadow-md animate-pulse",
    completeCard: "bg-green-500/10 border-green-500/30",
    completeTitle: "text-green-300",
    completeText: "text-green-400",
    empty: "text-zinc-400 bg-zinc-900/70",
  },
  light: {
    title: "text-gray-900",
    subtitle: "text-gray-600",
    pending: "text-gray-500",
    message: "text-gray-600",
    timestamp: "text-gray-400",
    count: "text-blue-600 bg-blue-100",
    stageDone: "text-green-700",
    stageActive: "text-blue-700",
    stagePending: "text-gray-500",
    stagePendingIcon: "bg-gray-200 text-gray-400",
    connectorDone: "bg-green-300",
    connectorPending: "bg-gray-200",
    activeDot: "bg-blue-500 text-white shadow-md animate-pulse",
    completeCard: "bg-green-50 border-green-200",
    completeTitle: "text-green-800",
    completeText: "text-green-600",
    empty: "text-gray-500 bg-gray-50",
  },
  vibrant: {
    title: "text-zinc-900",
    subtitle: "text-zinc-600",
    pending: "text-zinc-500",
    message: "text-zinc-600",
    timestamp: "text-zinc-400",
    count: "text-fuchsia-700 bg-fuchsia-100",
    stageDone: "text-green-700",
    stageActive: "text-fuchsia-700",
    stagePending: "text-zinc-500",
    stagePendingIcon: "bg-zinc-200 text-zinc-500",
    connectorDone: "bg-green-300",
    connectorPending: "bg-zinc-200",
    activeDot: "bg-fuchsia-500 text-white shadow-md animate-pulse",
    completeCard: "bg-green-50/80 border-green-200",
    completeTitle: "text-green-800",
    completeText: "text-green-600",
    empty: "text-zinc-500 bg-white/70",
  },
} as const;

const PIPELINE_STAGES = [
  { key: "init", label: "Initialization", icon: "🚀" },
  { key: "expand_query", label: "Query Expansion", icon: "🔍" },
  { key: "fetch_papers", label: "Fetching Papers", icon: "📄" },
  { key: "fetch_datasets", label: "Fetching Datasets", icon: "📊" },
  { key: "fetch_social", label: "Social Signals", icon: "💬" },
  { key: "rank_sources", label: "Ranking Sources", icon: "⭐" },
  { key: "build_root", label: "Building Root Node", icon: "🌳" },
  { key: "build_children", label: "Building Child Nodes", icon: "🌿" },
];

const stageLabels: Record<string, string> = {
  init: "Initialization",
  expand_query: "Query Expansion",
  fetch_papers: "Fetching Papers",
  fetch_datasets: "Fetching Datasets",
  fetch_social: "Social Signals",
  rank_sources: "Ranking Sources",
  build_root: "Building Root Node",
  build_children: "Building Child Nodes",
  complete: "Complete",
  error: "Error",
};

export default function ProgressTimeline({
  events,
  theme = "light",
}: ProgressTimelineProps) {
  const t = THEME_STYLES[theme];

  const getStageStatus = (stageKey: string) => {
    const stageEvents = events.filter((e) => e.stage === stageKey);
    if (stageEvents.length === 0) return "pending";
    const lastEvent = stageEvents[stageEvents.length - 1];
    return lastEvent.status;
  };

  const getStageEvent = (stageKey: string) => {
    const stageEvents = events.filter((e) => e.stage === stageKey);
    return stageEvents[stageEvents.length - 1];
  };

  const isComplete = events.some((e) => e.stage === "complete");

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className={`text-lg font-bold mb-2 ${t.title}`}>
          Pipeline Progress
        </h2>
        <p className={`text-xs ${t.subtitle}`}>Evidence mapping stages</p>
      </div>

      <div className="space-y-3">
        {PIPELINE_STAGES.map((stage, index) => {
          const status = getStageStatus(stage.key);
          const stageEvent = getStageEvent(stage.key);
          const isPending = status === "pending";
          const isStarted = status === "started" || status === "progress";
          const isCompleted = status === "completed";
          const isError = status === "error";

          return (
            <div key={stage.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${
                    isCompleted
                      ? `${t.stageDone} bg-green-500 text-white shadow-md`
                      : isError
                        ? `${t.stageDone} bg-red-500 text-white shadow-md`
                        : isStarted
                          ? t.activeDot
                          : t.stagePendingIcon
                  }`}
                >
                  {isCompleted ? (
                    <span>✓</span>
                  ) : isError ? (
                    <span>✗</span>
                  ) : isStarted ? (
                    <span className="animate-spin">⟳</span>
                  ) : (
                    <span>{stage.icon}</span>
                  )}
                </div>
                {index < PIPELINE_STAGES.length - 1 && (
                  <div
                    className={`w-0.5 flex-1 mt-1 transition-colors ${
                      isCompleted ? t.connectorDone : t.connectorPending
                    }`}
                    style={{ minHeight: "20px" }}
                  />
                )}
              </div>

              <div className="flex-1 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-sm font-semibold ${
                      isCompleted
                        ? t.stageDone
                        : isStarted
                          ? t.stageActive
                          : t.stagePending
                    }`}
                  >
                    {stage.label}
                  </span>
                  {stageEvent?.count !== undefined && (
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-full ${t.count}`}
                    >
                      {stageEvent.count}
                    </span>
                  )}
                </div>
                {stageEvent && (
                  <>
                    <p className={`text-xs mb-1 ${t.message}`}>
                      {stageEvent.message}
                    </p>
                    <p className={`text-xs ${t.timestamp}`}>
                      {new Date(stageEvent.timestamp).toLocaleTimeString()}
                    </p>
                  </>
                )}
                {!stageEvent && isPending && (
                  <p className={`text-xs ${t.pending}`}>Waiting...</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isComplete && (
        <div className={`mt-6 p-4 border rounded-lg ${t.completeCard}`}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎉</span>
            <div>
              <p className={`text-sm font-bold ${t.completeTitle}`}>
                Evidence Mapping Complete!
              </p>
              <p className={`text-xs ${t.completeText}`}>
                Knowledge tree is ready to explore
              </p>
            </div>
          </div>
        </div>
      )}

      {events.length === 0 && (
        <div className={`text-center text-sm py-8 rounded-lg ${t.empty}`}>
          <div className="animate-pulse">
            <p className="font-semibold mb-1">Initializing pipeline...</p>
            <p className="text-xs">Waiting for worker to start processing</p>
          </div>
        </div>
      )}
    </div>
  );
}
