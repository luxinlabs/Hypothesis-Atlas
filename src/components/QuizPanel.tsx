"use client";

import { useEffect, useState } from "react";

interface Question {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface QuizPanelProps {
  nodeId: string;
  theme?: "dark" | "light" | "vibrant";
}

const THEME_STYLES = {
  dark: {
    container: "bg-zinc-900 border border-zinc-700",
    heading: "text-zinc-100",
    text: "text-zinc-300",
    subtext: "text-zinc-400",
    optionBase: "border border-zinc-600 bg-zinc-800 text-zinc-200 hover:border-blue-500 hover:bg-zinc-700",
    optionCorrect: "border border-green-500 bg-green-500/10 text-green-300",
    optionWrong: "border border-red-500 bg-red-500/10 text-red-300",
    optionDisabled: "border border-zinc-700 bg-zinc-800/50 text-zinc-500",
    explanationBox: "bg-zinc-800 border border-zinc-700 text-zinc-300",
    progress: "bg-zinc-700",
    progressFill: "bg-blue-500",
    scoreBox: "bg-zinc-800 border border-zinc-700",
  },
  light: {
    container: "bg-blue-50 border border-blue-200",
    heading: "text-gray-900",
    text: "text-gray-700",
    subtext: "text-gray-500",
    optionBase: "border border-gray-200 bg-white text-gray-700 hover:border-blue-400 hover:bg-blue-50",
    optionCorrect: "border border-green-500 bg-green-50 text-green-700",
    optionWrong: "border border-red-400 bg-red-50 text-red-700",
    optionDisabled: "border border-gray-200 bg-gray-50 text-gray-400",
    explanationBox: "bg-white border border-green-200 text-gray-700",
    progress: "bg-gray-200",
    progressFill: "bg-blue-500",
    scoreBox: "bg-white border border-gray-200",
  },
  vibrant: {
    container: "bg-violet-50 border border-violet-200",
    heading: "text-zinc-900",
    text: "text-zinc-700",
    subtext: "text-zinc-500",
    optionBase: "border border-zinc-200 bg-white text-zinc-700 hover:border-violet-400 hover:bg-violet-50",
    optionCorrect: "border border-green-500 bg-green-50 text-green-700",
    optionWrong: "border border-red-400 bg-red-50 text-red-700",
    optionDisabled: "border border-zinc-200 bg-gray-50 text-zinc-400",
    explanationBox: "bg-white border border-green-200 text-zinc-700",
    progress: "bg-violet-100",
    progressFill: "bg-violet-500",
    scoreBox: "bg-white border border-violet-200",
  },
} as const;

export default function QuizPanel({ nodeId, theme = "light" }: QuizPanelProps) {
  const t = THEME_STYLES[theme];
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/nodes/${nodeId}/questions`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error || !data.questions) {
          setError("Could not generate questions. Please try again.");
        } else {
          setQuestions(data.questions);
        }
      })
      .catch(() => setError("Failed to load questions."))
      .finally(() => setLoading(false));
  }, [nodeId]);

  function handleSelect(optionIndex: number) {
    if (answered) return;
    setSelectedIndex(optionIndex);
    setAnswered(true);
    if (optionIndex === questions[currentIndex].correctIndex) {
      setScore((s) => s + 1);
    }
  }

  function handleNext() {
    if (currentIndex + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedIndex(null);
      setAnswered(false);
    }
  }

  function handleRestart() {
    setCurrentIndex(0);
    setSelectedIndex(null);
    setAnswered(false);
    setScore(0);
    setFinished(false);
  }

  if (loading) {
    return (
      <div className={`rounded-lg p-4 ${t.container}`}>
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <span className={`text-xs ${t.subtext}`}>Generating comprehension questions…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg p-4 ${t.container}`}>
        <p className={`text-xs ${t.subtext}`}>{error}</p>
      </div>
    );
  }

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    const emoji = pct === 100 ? "🎉" : pct >= 75 ? "✅" : pct >= 50 ? "🤔" : "📖";
    const message =
      pct === 100
        ? "Perfect score! You have a strong grasp of this topic."
        : pct >= 75
        ? "Great work! A few things to review below."
        : pct >= 50
        ? "Good effort. Re-reading the node content will help."
        : "Consider re-reading the node content before moving on.";

    return (
      <div className={`rounded-lg p-4 space-y-3 ${t.container}`}>
        <h4 className={`text-sm font-semibold ${t.heading}`}>Quiz Complete</h4>
        <div className={`rounded-lg p-4 text-center ${t.scoreBox}`}>
          <div className="text-3xl mb-1">{emoji}</div>
          <p className={`text-2xl font-bold ${t.heading}`}>
            {score} / {questions.length}
          </p>
          <p className={`text-xs mt-1 ${t.subtext}`}>{message}</p>
        </div>
        <button
          onClick={handleRestart}
          className="w-full text-xs py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
        >
          Retake Quiz
        </button>
      </div>
    );
  }

  const q = questions[currentIndex];
  const progressPct = ((currentIndex) / questions.length) * 100;

  return (
    <div className={`rounded-lg p-4 space-y-4 ${t.container}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className={`text-sm font-semibold ${t.heading}`}>
          Test Your Understanding
        </h4>
        <span className={`text-xs ${t.subtext}`}>
          {currentIndex + 1} / {questions.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className={`h-1 w-full rounded-full ${t.progress}`}>
        <div
          className={`h-1 rounded-full transition-all duration-300 ${t.progressFill}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Question */}
      <p className={`text-sm leading-relaxed ${t.text}`}>{q.question}</p>

      {/* Options */}
      <div className="space-y-2">
        {q.options.map((option, i) => {
          let cls = `w-full text-left text-xs px-3 py-2 rounded-md transition-colors cursor-pointer ${t.optionBase}`;
          if (answered) {
            if (i === q.correctIndex) {
              cls = `w-full text-left text-xs px-3 py-2 rounded-md ${t.optionCorrect}`;
            } else if (i === selectedIndex) {
              cls = `w-full text-left text-xs px-3 py-2 rounded-md ${t.optionWrong}`;
            } else {
              cls = `w-full text-left text-xs px-3 py-2 rounded-md ${t.optionDisabled}`;
            }
          }
          return (
            <button key={i} className={cls} onClick={() => handleSelect(i)}>
              {option}
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {answered && (
        <div className={`rounded-md p-3 text-xs leading-relaxed ${t.explanationBox}`}>
          <span className="font-semibold">
            {selectedIndex === q.correctIndex ? "✓ Correct — " : "✗ Incorrect — "}
          </span>
          {q.explanation}
        </div>
      )}

      {/* Next button */}
      {answered && (
        <button
          onClick={handleNext}
          className="w-full text-xs py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
        >
          {currentIndex + 1 >= questions.length ? "See Results" : "Next Question →"}
        </button>
      )}
    </div>
  );
}
