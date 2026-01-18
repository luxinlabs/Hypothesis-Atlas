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
}

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

export default function ProgressTimeline({ events }: ProgressTimelineProps) {
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
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          Pipeline Progress
        </h2>
        <p className="text-xs text-gray-600">Evidence mapping stages</p>
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
                      ? "bg-green-500 text-white shadow-md"
                      : isError
                        ? "bg-red-500 text-white shadow-md"
                        : isStarted
                          ? "bg-blue-500 text-white shadow-md animate-pulse"
                          : "bg-gray-200 text-gray-400"
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
                      isCompleted ? "bg-green-300" : "bg-gray-200"
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
                        ? "text-green-700"
                        : isStarted
                          ? "text-blue-700"
                          : "text-gray-500"
                    }`}
                  >
                    {stage.label}
                  </span>
                  {stageEvent?.count !== undefined && (
                    <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                      {stageEvent.count}
                    </span>
                  )}
                </div>
                {stageEvent && (
                  <>
                    <p className="text-xs text-gray-600 mb-1">
                      {stageEvent.message}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(stageEvent.timestamp).toLocaleTimeString()}
                    </p>
                  </>
                )}
                {!stageEvent && isPending && (
                  <p className="text-xs text-gray-400">Waiting...</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isComplete && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="text-sm font-bold text-green-800">
                Evidence Mapping Complete!
              </p>
              <p className="text-xs text-green-600">
                Knowledge tree is ready to explore
              </p>
            </div>
          </div>
        </div>
      )}

      {events.length === 0 && (
        <div className="text-center text-gray-500 text-sm py-8 bg-gray-50 rounded-lg">
          <div className="animate-pulse">
            <p className="font-semibold mb-1">Initializing pipeline...</p>
            <p className="text-xs">Waiting for worker to start processing</p>
          </div>
        </div>
      )}
    </div>
  );
}
