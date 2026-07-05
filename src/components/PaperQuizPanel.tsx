"use client";

import { useState } from "react";

interface Question {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface ResearchIdea {
  title: string;
  problem_to_solve: string;
  proposed_method: string[];
  next_3_steps: string[];
  field_context: string[];
}

interface PaperQuizPanelProps {
  jobId: string;
  idea: ResearchIdea | null;
  /** When true, renders an inline button instead of a fixed floating button */
  inline?: boolean;
}

export default function PaperQuizPanel({ jobId, idea, inline = false }: PaperQuizPanelProps) {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function handleOpen() {
    setOpen(true);
    if (loaded) return;
    if (!idea) {
      setError("No research idea selected yet. Pick one in Step 1 first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const data = await res.json();
      if (data.error || !data.questions) {
        setError("Could not generate questions. Please try again.");
      } else {
        setQuestions(data.questions);
        setLoaded(true);
      }
    } catch {
      setError("Failed to load questions.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setOpen(false);
  }

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
    setLoaded(false);
    setQuestions([]);
  }

  const q = questions[currentIndex];
  const progressPct = questions.length > 0 ? (currentIndex / questions.length) * 100 : 0;

  return (
    <>
      {inline ? (
        /* Inline button — sits in the step tabs row */
        <button
          onClick={open ? handleClose : handleOpen}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
          style={{
            background: open
              ? "#7c3aed"
              : "linear-gradient(to right, #0ea5e9, #7c3aed)",
            color: "#fff",
          }}
          title="Test your understanding of this paper idea"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {open ? "Close Quiz" : "Quiz"}
        </button>
      ) : (
        /* Floating trigger button */
        <button
          onClick={open ? handleClose : handleOpen}
          className="fixed bottom-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-xl font-semibold text-sm transition-all hover:scale-105"
          style={{
            right: "13rem",
            background: open
              ? "#7c3aed"
              : "linear-gradient(to right, #0ea5e9, #7c3aed)",
            color: "#fff",
          }}
          title="Test your understanding of this paper idea"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {open ? "Close Quiz" : "Quiz"}
        </button>
      )}

      {/* Slide-in panel */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]"
            onClick={handleClose}
          />
          <div
            className="fixed top-0 right-0 h-full z-40 flex flex-col border-l shadow-2xl bg-white border-gray-200 transition-all duration-300"
            style={{ width: "360px" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Test Your Understanding</h2>
                {idea && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[260px]">{idea.title}</p>
                )}
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {loading && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
                  <p className="text-xs">Generating questions from your idea…</p>
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                  <p className="text-xs text-red-600">{error}</p>
                  {idea && (
                    <button
                      onClick={() => { setError(null); setLoaded(false); handleOpen(); }}
                      className="mt-3 text-xs text-red-500 underline"
                    >
                      Try again
                    </button>
                  )}
                </div>
              )}

              {!loading && !error && finished && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-6 text-center">
                    <div className="text-3xl mb-2">
                      {score === questions.length ? "🎉" : score >= questions.length * 0.75 ? "✅" : score >= questions.length * 0.5 ? "🤔" : "📖"}
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{score} / {questions.length}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {score === questions.length
                        ? "Perfect! You have a strong grasp of this idea."
                        : score >= questions.length * 0.75
                        ? "Great work! A few details to review."
                        : score >= questions.length * 0.5
                        ? "Good effort — re-read the idea details above."
                        : "Consider reviewing the idea content before writing."}
                    </p>
                  </div>
                  <button
                    onClick={handleRestart}
                    className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors"
                  >
                    Retake Quiz
                  </button>
                </div>
              )}

              {!loading && !error && !finished && q && (
                <div className="space-y-4">
                  {/* Progress */}
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Question {currentIndex + 1} of {questions.length}</span>
                    <span>{score} correct</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-gray-100">
                    <div
                      className="h-1 rounded-full bg-violet-500 transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  {/* Question */}
                  <p className="text-sm text-gray-800 leading-relaxed font-medium">{q.question}</p>

                  {/* Options */}
                  <div className="space-y-2">
                    {q.options.map((option, i) => {
                      let cls =
                        "w-full text-left text-xs px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ";
                      if (!answered) {
                        cls += "border-gray-200 bg-white text-gray-700 hover:border-violet-400 hover:bg-violet-50";
                      } else if (i === q.correctIndex) {
                        cls += "border-green-500 bg-green-50 text-green-700";
                      } else if (i === selectedIndex) {
                        cls += "border-red-400 bg-red-50 text-red-700";
                      } else {
                        cls += "border-gray-200 bg-gray-50 text-gray-400";
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
                    <div className="rounded-lg bg-white border border-gray-200 p-3 text-xs text-gray-600 leading-relaxed">
                      <span className="font-semibold text-gray-800">
                        {selectedIndex === q.correctIndex ? "✓ Correct — " : "✗ Incorrect — "}
                      </span>
                      {q.explanation}
                    </div>
                  )}

                  {/* Next */}
                  {answered && (
                    <button
                      onClick={handleNext}
                      className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors"
                    >
                      {currentIndex + 1 >= questions.length ? "See Results" : "Next Question →"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
