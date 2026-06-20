"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ResearchIdea {
  title: string;
  problem_to_solve: string;
  proposed_method: string[];
  next_3_steps: string[];
  field_context: string[];
}

interface ReferenceDoc {
  name: string;
  content: string;
}

interface ARSPlanChatProps {
  jobId: string;
  selectedIdea?: ResearchIdea;
  referenceDoc?: ReferenceDoc;
}

interface CachedSession {
  messages: Message[];
  started: boolean;
  savedAt: number;
}

function makeCacheKey(jobId: string, ideaTitle?: string): string {
  const slug = (ideaTitle ?? "default").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
  return `ars-plan:${jobId}:${slug}`;
}

function loadSession(key: string): CachedSession | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedSession;
  } catch {
    return null;
  }
}

function saveSession(key: string, messages: Message[], started: boolean) {
  try {
    const data: CachedSession = { messages, started, savedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

function clearSession(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export default function ARSPlanChat({ jobId, selectedIdea, referenceDoc }: ARSPlanChatProps) {
  const cacheKey = makeCacheKey(jobId, selectedIdea?.title);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [started, setStarted] = useState(false);
  const [noKey, setNoKey] = useState(false);
  const [restored, setRestored] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Restore cached session on mount
  useEffect(() => {
    const cached = loadSession(cacheKey);
    if (cached && cached.started && cached.messages.length > 0) {
      setMessages(cached.messages);
      setStarted(true);
      setRestored(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  // Persist session after streaming finishes (not during — message is incomplete mid-stream)
  useEffect(() => {
    if (!streaming && started && messages.length > 0) {
      saveSession(cacheKey, messages, started);
    }
  }, [streaming, started, messages, cacheKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (userText: string, isInit = false) => {
    const newMessages: Message[] = isInit
      ? []
      : [...messages, { role: "user" as const, content: userText }];

    if (!isInit) {
      setMessages(newMessages);
      setInput("");
    }

    setStreaming(true);

    const placeholder: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...(isInit ? [] : prev), placeholder]);

    try {
      const res = await fetch(`/api/jobs/${jobId}/ars-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          init: isInit,
          selectedIdea,
          referenceDoc,
        }),
      });

      if (res.status === 503) {
        const err = await res.json();
        setNoKey(true);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: err.error };
          return updated;
        });
        return;
      }

      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const final = accumulated;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: final };
          return updated;
        });
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Error connecting to the planning assistant. Please try again.",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  };

  const handleStart = async () => {
    setRestored(false);
    setStarted(true);
    await sendMessage("", true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || streaming) return;
    sendMessage(input.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleReset = () => {
    clearSession(cacheKey);
    setMessages([]);
    setStarted(false);
    setRestored(false);
    setNoKey(false);
  };

  // ── Not started yet ──
  if (!started) {
    const cached = typeof window !== "undefined" ? loadSession(cacheKey) : null;
    const hasCached = cached && cached.messages.length > 0;

    return (
      <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-lg"
          style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
        >
          <svg className="w-8 h-8" style={{ color: "#fff" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">ARS Plan Mode</h3>

        {selectedIdea ? (
          <div className="mb-5 max-w-sm w-full text-left rounded-xl border-2 border-indigo-200 bg-indigo-50 p-4">
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">Paper topic</p>
            <p className="text-sm font-semibold text-indigo-900 leading-snug">{selectedIdea.title}</p>
            <p className="text-xs text-indigo-600 mt-1 line-clamp-2">{selectedIdea.problem_to_solve}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500 max-w-sm leading-relaxed mb-6">
            A Socratic planning assistant that guides you chapter-by-chapter through your paper
            structure — the same workflow as running{" "}
            <code className="bg-gray-100 text-indigo-700 px-1.5 py-0.5 rounded text-xs font-mono">
              /ars-plan
            </code>{" "}
            in Claude Code.
          </p>
        )}

        {hasCached ? (
          <div className="flex flex-col items-center gap-3 w-full max-w-xs">
            <div className="w-full px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 text-left flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Session saved · {cached.messages.length} messages ·{" "}
              {new Date(cached.savedAt).toLocaleDateString()}
            </div>
            <button
              onClick={() => { setStarted(true); setRestored(true); setMessages(cached.messages); }}
              className="w-full px-8 py-3 rounded-xl font-semibold shadow-md transition-all flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(to right, #4f46e5, #9333ea)", color: "#fff" }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Resume Session
            </button>
            <button
              onClick={handleStart}
              className="w-full px-8 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 transition-all"
            >
              Start fresh instead
            </button>
          </div>
        ) : (
          <button
            onClick={handleStart}
            className="px-8 py-3 rounded-xl font-semibold shadow-md transition-all flex items-center gap-2"
            style={{ background: "linear-gradient(to right, #4f46e5, #9333ea)", color: "#fff" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start Planning
          </button>
        )}

        <div className="mt-8 text-xs text-gray-400 bg-gray-50 rounded-lg px-4 py-3 max-w-sm">
          Requires <code className="font-mono">ANTHROPIC_API_KEY</code> in{" "}
          <code className="font-mono">.env.local</code>. Uses{" "}
          <code className="font-mono">claude-sonnet-4-6</code>.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-700 flex-shrink-0">/ars-plan</span>
          {selectedIdea ? (
            <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full truncate max-w-xs">
              {selectedIdea.title}
            </span>
          ) : (
            <span className="text-xs text-gray-400">Socratic Paper Planner</span>
          )}
          {restored && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0">
              restored
            </span>
          )}
          {referenceDoc && (
            <span className="text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {referenceDoc.name}
            </span>
          )}
        </div>
        <button
          onClick={handleReset}
          className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
          title="Clear session and restart"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Restart
        </button>
      </div>

      {/* No API key banner */}
      {noKey && (
        <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <strong>Missing API Key.</strong> Add{" "}
          <code className="font-mono bg-amber-100 px-1 rounded">ANTHROPIC_API_KEY=sk-ant-...</code>{" "}
          to your <code className="font-mono">.env.local</code> and restart the dev server.
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                <span className="text-white text-xs font-bold">A</span>
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-tr-sm"
                  : "bg-gray-100 text-gray-800 rounded-tl-sm"
              }`}
            >
              {msg.content}
              {streaming && i === messages.length - 1 && msg.role === "assistant" && (
                <span className="inline-block w-1.5 h-4 bg-indigo-400 ml-0.5 animate-pulse rounded-sm align-middle" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex-shrink-0 border-t border-gray-200 p-4 bg-white">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming || noKey}
            placeholder={streaming ? "Thinking…" : "Your response (Enter to send, Shift+Enter for newline)"}
            rows={2}
            className="flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming || noKey}
            className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
