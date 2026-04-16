"use client";

interface SuggestedTopic {
  label: string;
  evidence?: string;
  color?: string;
}

interface SuggestedTopicsProps {
  topics: SuggestedTopic[];
  onTopicClick: (label: string) => void;
  theme?: "dark" | "light" | "vibrant";
}

const COLORS = [
  "bg-blue-100 text-blue-800 border-blue-300",
  "bg-purple-100 text-purple-800 border-purple-300",
  "bg-pink-100 text-pink-800 border-pink-300",
  "bg-indigo-100 text-indigo-800 border-indigo-300",
  "bg-cyan-100 text-cyan-800 border-cyan-300",
  "bg-teal-100 text-teal-800 border-teal-300",
  "bg-green-100 text-green-800 border-green-300",
  "bg-orange-100 text-orange-800 border-orange-300",
];

export default function SuggestedTopics({
  topics,
  onTopicClick,
  theme = "light",
}: SuggestedTopicsProps) {
  if (topics.length === 0) return null;

  const shell =
    theme === "dark"
      ? "bg-zinc-900 border-zinc-800"
      : theme === "vibrant"
        ? "bg-white/80 border-rose-200"
        : "bg-gradient-to-br from-blue-50 to-purple-50 border-gray-200";

  return (
    <div className={`p-4 border-t ${shell}`}>
      <div className="mb-3">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
          <svg
            className="w-4 h-4 text-purple-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          Suggested Topics
        </h4>
        <p className="text-xs text-gray-600 mt-1">From your conversation</p>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {topics.slice(0, 8).map((topic, index) => (
          <button
            key={index}
            onClick={() => onTopicClick(topic.label)}
            className={`w-full text-left p-3 rounded-lg border-2 transition-all hover:shadow-md hover:scale-105 ${
              COLORS[index % COLORS.length]
            }`}
          >
            <div className="font-medium text-sm leading-tight">
              {topic.label}
            </div>
            {topic.evidence && (
              <div className="text-xs mt-1 opacity-75 line-clamp-2">
                {topic.evidence}
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="mt-3 text-xs text-gray-500 text-center">
        Click to add to candidate topics
      </div>
    </div>
  );
}
