"use client";

import { useState, useEffect } from "react";
import {
  NotebookPage,
  NotebookMessage,
  CandidateTopic,
  ResearchIdea,
} from "@/lib/notebook-types";
import PageList from "./PageList";
import MarkdownEditor from "./MarkdownEditor";
import ChatPanel from "./ChatPanel";
import CandidateTopics from "./CandidateTopics";
import SuggestedTopics from "./SuggestedTopics";

interface NotebookTabProps {
  jobId: string;
  theme?: "dark" | "light" | "vibrant";
}

interface SuggestedTopic {
  label: string;
  evidence?: string;
}

export default function NotebookTab({
  jobId,
  theme = "light",
}: NotebookTabProps) {
  const [pages, setPages] = useState<NotebookPage[]>([]);
  const [currentPage, setCurrentPage] = useState<NotebookPage | null>(null);
  const [messages, setMessages] = useState<NotebookMessage[]>([]);
  const [candidates, setCandidates] = useState<CandidateTopic[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [top3Ideas, setTop3Ideas] = useState<ResearchIdea[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [activePanel, setActivePanel] = useState<"pages" | "candidates">(
    "pages",
  );
  const [suggestedTopics, setSuggestedTopics] = useState<SuggestedTopic[]>([]);

  const isDark = theme === "dark";
  const isVibrant = theme === "vibrant";

  const shell = isDark
    ? "bg-zinc-900 border-zinc-800"
    : isVibrant
      ? "bg-white/85 border-rose-200"
      : "bg-white border-gray-200";

  const tabActive = isDark
    ? "text-indigo-300 border-b-2 border-indigo-400 bg-indigo-500/10"
    : isVibrant
      ? "text-fuchsia-700 border-b-2 border-fuchsia-500 bg-fuchsia-50"
      : "text-blue-600 border-b-2 border-blue-600 bg-blue-50";

  const tabIdle = isDark
    ? "text-zinc-400 hover:text-zinc-200"
    : "text-gray-600 hover:text-gray-900";

  const selectedTopicLabels = candidates
    .filter((c) => selectedCandidates.includes(c.id))
    .map((c) => c.label);

  const activeTopicLabels = candidates
    .filter((c) => c.status === "active")
    .map((c) => c.label);

  const notesPages = pages.filter((page) => page.content.trim().length > 0);

  const hasExportableContent =
    notesPages.length > 0 ||
    activeTopicLabels.length > 0 ||
    selectedTopicLabels.length > 0 ||
    (top3Ideas?.length ?? 0) > 0;

  useEffect(() => {
    loadPages();
    loadMessages();
    loadCandidates();
    loadTop3Ideas();
  }, [jobId]);

  const loadPages = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/notebook/pages`);
      if (response.ok) {
        const pagesData = await response.json();
        setPages(pagesData);
        if (pagesData.length > 0 && !currentPage) {
          setCurrentPage(pagesData[0]);
        }
      }
    } catch (error) {
      console.error("Failed to load pages:", error);
    }
  };

  const loadMessages = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/notebook/messages`);
      if (response.ok) {
        const messagesData = await response.json();
        setMessages(messagesData);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  const loadCandidates = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/candidates`);
      if (response.ok) {
        const candidatesData = await response.json();
        setCandidates(candidatesData);
      }
    } catch (error) {
      console.error("Failed to load candidates:", error);
    }
  };

  const loadTop3Ideas = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/converge`);
      if (response.ok) {
        const data = await response.json();
        setTop3Ideas(data.ideas);
      }
    } catch (error) {
      console.error("Failed to load top 3 ideas:", error);
    }
  };

  const handleCreatePage = async (title: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/notebook/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || `Page ${pages.length + 1}`,
          content: "",
        }),
      });

      if (response.ok) {
        const newPage = await response.json();
        setPages([...pages, newPage]);
        setCurrentPage(newPage);
      }
    } catch (error) {
      console.error("Failed to create page:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!hasExportableContent) return;

    const generatedAt = new Date().toISOString();
    const ideaSection =
      top3Ideas && top3Ideas.length > 0
        ? top3Ideas
            .map(
              (idea, index) => `### ${index + 1}. ${idea.title}

**Problem Statement**
${idea.problem_to_solve}

**Proposed Method**
${idea.proposed_method.map((method) => `- ${method}`).join("\n")}

**Next Steps**
${idea.next_3_steps.map((step) => `- ${step}`).join("\n")}
`,
            )
            .join("\n")
        : "_No converged ideas yet._";

    const notesSection =
      notesPages.length > 0
        ? notesPages
            .map((page) => `### ${page.title}\n\n${page.content.trim()}\n`)
            .join("\n")
        : "_No notebook notes yet._";

    const markdown = `# Hypothesis Atlas Brainstorm Export

Generated: ${generatedAt}
Job ID: ${jobId}

## Topic Pack (for Claude / ChatGPT)

### Selected Topics
${selectedTopicLabels.length > 0 ? selectedTopicLabels.map((topic) => `- ${topic}`).join("\n") : "_No selected topics yet._"}

### Candidate Topics
${activeTopicLabels.length > 0 ? activeTopicLabels.map((topic) => `- ${topic}`).join("\n") : "_No candidate topics yet._"}

## Research Ideas

${ideaSection}

## Notes

${notesSection}
`;

    const baseName =
      selectedTopicLabels[0] || activeTopicLabels[0] || "atlas-brainstorm";
    const safeName = baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const fileName = `${safeName || "atlas-brainstorm"}.md`;

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSavePage = async (content: string) => {
    if (!currentPage) return;

    try {
      const response = await fetch(`/api/notebook/pages/${currentPage.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        const updatedPage = await response.json();
        setPages(pages.map((p) => (p.id === updatedPage.id ? updatedPage : p)));
        setCurrentPage(updatedPage);
      }
    } catch (error) {
      console.error("Failed to save page:", error);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    try {
      const response = await fetch(`/api/notebook/pages/${pageId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setPages(pages.filter((p) => p.id !== pageId));
        if (currentPage?.id === pageId) {
          setCurrentPage(pages.find((p) => p.id !== pageId) || null);
        }
      }
    } catch (error) {
      console.error("Failed to delete page:", error);
    }
  };

  const handleSendMessage = async (message: string) => {
    setIsChatting(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/notebook/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: currentPage?.id,
          message,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages([...messages, data.userMessage, data.assistantMessage]);

        // Update suggested topics from chat response
        if (data.suggestedTopics && data.suggestedTopics.length > 0) {
          setSuggestedTopics(data.suggestedTopics);
          loadCandidates();
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsChatting(false);
    }
  };

  const handleSuggestedTopicClick = async (label: string) => {
    await handleAddCandidate(label);
  };

  const handleAddCandidate = async (label: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });

      if (response.ok) {
        const newCandidate = await response.json();
        setCandidates([...candidates, newCandidate]);
      }
    } catch (error) {
      console.error("Failed to add candidate:", error);
    }
  };

  const handleArchiveCandidate = async (candidateId: string) => {
    try {
      // For now, we'll just remove from local state
      // In a real implementation, you'd update the status via API
      setCandidates(candidates.filter((c) => c.id !== candidateId));
      setSelectedCandidates(
        selectedCandidates.filter((id) => id !== candidateId),
      );
    } catch (error) {
      console.error("Failed to archive candidate:", error);
    }
  };

  const handleConverge = async () => {
    if (selectedCandidates.length === 0) return;

    setIsLoading(true);
    try {
      const selectedLabels = candidates
        .filter((c) => selectedCandidates.includes(c.id))
        .map((c) => c.label);

      const response = await fetch(`/api/jobs/${jobId}/converge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedTopics: selectedLabels }),
      });

      if (response.ok) {
        const data = await response.json();
        setTop3Ideas(data.ideas);
      }
    } catch (error) {
      console.error("Failed to converge:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Left Sidebar */}
      <div className={`w-80 border-r ${shell}`}>
        <div
          className={`flex border-b ${isDark ? "border-zinc-800" : "border-gray-200"}`}
        >
          <button
            onClick={() => setActivePanel("pages")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activePanel === "pages" ? tabActive : tabIdle
            }`}
          >
            Pages ({pages.length})
          </button>
          <button
            onClick={() => setActivePanel("candidates")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activePanel === "candidates" ? tabActive : tabIdle
            }`}
          >
            Topics ({candidates.filter((c) => c.status === "active").length})
          </button>
        </div>

        <div className="h-[calc(100%-49px)] flex flex-col">
          <div className="flex-1 overflow-hidden">
            {activePanel === "pages" ? (
              <PageList
                pages={pages}
                currentPage={currentPage}
                onPageSelect={setCurrentPage}
                onPageCreate={handleCreatePage}
                onPageDelete={handleDeletePage}
                isLoading={isLoading}
                theme={theme}
              />
            ) : (
              <CandidateTopics
                candidates={candidates}
                selectedCandidates={selectedCandidates}
                onSelectionChange={setSelectedCandidates}
                onAddCandidate={handleAddCandidate}
                onArchiveCandidate={handleArchiveCandidate}
                isLoading={isLoading}
                theme={theme}
              />
            )}
          </div>

          {/* Suggested Topics Section */}
          {suggestedTopics.length > 0 && (
            <SuggestedTopics
              topics={suggestedTopics}
              onTopicClick={handleSuggestedTopicClick}
              theme={theme}
            />
          )}
        </div>
      </div>

      {/* Center Editor */}
      <div
        className={`flex-1 border-r ${isDark ? "border-zinc-800" : "border-gray-200"}`}
      >
        <MarkdownEditor
          page={currentPage}
          onSave={handleSavePage}
          isLoading={isLoading}
          theme={theme}
        />
      </div>

      {/* Right Panel - Chat or Top 3 Ideas */}
      <div className={`w-[500px] relative ${isDark ? "bg-zinc-950" : ""}`}>
        {top3Ideas ? (
          <div
            className={`h-full overflow-y-auto p-4 ${isDark ? "bg-zinc-900" : isVibrant ? "bg-white/90" : "bg-white"}`}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900">
                Top 3 Research Ideas
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportMarkdown}
                  disabled={!hasExportableContent}
                  className="text-sm px-3 py-1.5 rounded-md bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Export .md
                </button>
                <button
                  onClick={() => setTop3Ideas(null)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  ← Back to chat
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {top3Ideas.map((idea, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <h4 className="font-semibold text-gray-900 mb-2">
                    {index + 1}. {idea.title}
                  </h4>

                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Field:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {idea.field_context.map((field, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="font-medium text-gray-700">
                        Problem:
                      </span>
                      <p className="text-gray-600 mt-1">
                        {idea.problem_to_solve}
                      </p>
                    </div>

                    <div>
                      <span className="font-medium text-gray-700">Method:</span>
                      <ul className="list-disc list-inside text-gray-600 mt-1">
                        {idea.proposed_method.map((method, i) => (
                          <li key={i}>{method}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="font-medium text-gray-700">
                        Next Steps:
                      </span>
                      <ol className="list-decimal list-inside text-gray-600 mt-1">
                        {idea.next_3_steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>

                    {(idea.citations.papers.length > 0 ||
                      idea.citations.datasets.length > 0) && (
                      <div>
                        <span className="font-medium text-gray-700">
                          Sources:
                        </span>
                        <div className="mt-1 space-y-1">
                          {idea.citations.papers.length > 0 && (
                            <div className="text-xs text-gray-600">
                              Papers: {idea.citations.papers.join(", ")}
                            </div>
                          )}
                          {idea.citations.datasets.length > 0 && (
                            <div className="text-xs text-gray-600">
                              Datasets: {idea.citations.datasets.join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <ChatPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isChatting}
            theme={theme}
          />
        )}

        {!top3Ideas && (
          <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
            <button
              onClick={handleExportMarkdown}
              disabled={!hasExportableContent}
              className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all text-sm"
            >
              Export Brainstorm (.md)
            </button>

            {selectedCandidates.length > 0 && (
              <button
                onClick={handleConverge}
                disabled={isLoading || selectedCandidates.length === 0}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Converging...
                  </div>
                ) : (
                  `Converge to Top 3 (${selectedCandidates.length} selected)`
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
