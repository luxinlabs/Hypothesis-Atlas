"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import WordCloudComponent from "@/components/WordCloud";

const DOMAIN_TERMS = {
  bio: [
    { text: "neural implant stability", value: 100 },
    { text: "CRISPR-Cas9", value: 96 },
    { text: "mRNA vaccines", value: 94 },
    { text: "gene editing", value: 93 },
    { text: "brain-computer interface", value: 92 },
    { text: "AI drug discovery", value: 91 },
    { text: "single-cell RNA-seq", value: 90 },
    { text: "AlphaFold", value: 90 },
    { text: "organoids", value: 82 },
    { text: "tissue engineering", value: 83 },
    { text: "metagenomics", value: 83 },
    { text: "optogenetics", value: 78 },
    { text: "nanomedicine", value: 85 },
    { text: "immunotherapy", value: 87 },
    { text: "liquid biopsy", value: 85 },
    { text: "spatial transcriptomics", value: 88 },
    { text: "systems biology", value: 82 },
    { text: "digital pathology", value: 79 },
    { text: "organ-on-chip", value: 87 },
    { text: "3D bioprinting", value: 86 },
  ],
  chemistry: [
    { text: "catalytic mechanisms", value: 100 },
    { text: "polymer synthesis", value: 96 },
    { text: "quantum chemistry", value: 94 },
    { text: "molecular dynamics", value: 93 },
    { text: "green chemistry", value: 92 },
    { text: "nanomaterials", value: 91 },
    { text: "electrochemical cells", value: 90 },
    { text: "crystallography", value: 90 },
    { text: "supramolecular chemistry", value: 82 },
    { text: "photochemistry", value: 83 },
    { text: "computational chemistry", value: 83 },
    { text: "organic synthesis", value: 78 },
    { text: "materials science", value: 85 },
    { text: "chemical engineering", value: 87 },
    { text: "analytical chemistry", value: 85 },
    { text: "spectroscopy", value: 88 },
    { text: "thermodynamics", value: 82 },
    { text: "kinetics", value: 79 },
    { text: "surface chemistry", value: 87 },
    { text: "biochemistry", value: 86 },
  ],
  tech: [
    { text: "machine learning", value: 100 },
    { text: "neural networks", value: 96 },
    { text: "quantum computing", value: 94 },
    { text: "blockchain technology", value: 93 },
    { text: "cybersecurity", value: 92 },
    { text: "cloud computing", value: 91 },
    { text: "edge computing", value: 90 },
    { text: "Internet of Things", value: 90 },
    { text: "artificial intelligence", value: 82 },
    { text: "data science", value: 83 },
    { text: "software engineering", value: 83 },
    { text: "computer vision", value: 78 },
    { text: "natural language processing", value: 85 },
    { text: "robotics", value: 87 },
    { text: "autonomous systems", value: 85 },
    { text: "distributed systems", value: 88 },
    { text: "microservices", value: 82 },
    { text: "devops", value: 79 },
    { text: "containerization", value: 87 },
    { text: "serverless computing", value: 86 },
  ],
  finance: [
    { text: "algorithmic trading", value: 100 },
    { text: "cryptocurrency", value: 96 },
    { text: "financial modeling", value: 94 },
    { text: "risk management", value: 93 },
    { text: "portfolio optimization", value: 92 },
    { text: "quantitative finance", value: 91 },
    { text: "market microstructure", value: 90 },
    { text: "behavioral finance", value: 90 },
    { text: "derivatives pricing", value: 82 },
    { text: "credit scoring", value: 83 },
    { text: "fraud detection", value: 83 },
    { text: "financial technology", value: 78 },
    { text: "high-frequency trading", value: 85 },
    { text: "asset management", value: 87 },
    { text: "investment strategies", value: 85 },
    { text: "financial analytics", value: 88 },
    { text: "regulatory compliance", value: 82 },
    { text: "blockchain finance", value: 79 },
    { text: "digital payments", value: 87 },
    { text: "robo-advisors", value: 86 },
  ],
};

type Domain = keyof typeof DOMAIN_TERMS;
type Theme = "dark" | "light" | "vibrant";

const DOMAIN_META: Record<
  Domain,
  { label: string; subtitle: string; emoji: string }
> = {
  bio: {
    label: "Biology",
    subtitle: "Genomics, biotech, and health research",
    emoji: "🧬",
  },
  chemistry: {
    label: "Chemistry",
    subtitle: "Materials, synthesis, and molecular science",
    emoji: "⚗️",
  },
  tech: {
    label: "Technology",
    subtitle: "AI, systems, and software innovation",
    emoji: "💻",
  },
  finance: {
    label: "Finance",
    subtitle: "Markets, risk, and quantitative strategies",
    emoji: "📈",
  },
};

const THEME_STYLES = {
  dark: {
    mainBg: "bg-[#0a0a0f]",
    text: "text-white",
    subText: "text-zinc-400",
    navButton:
      "bg-zinc-900 border border-zinc-700 text-zinc-200 hover:bg-zinc-800",
    docsButton: "bg-white text-black hover:bg-zinc-200",
    banner: "border-amber-500/30 bg-amber-500/10 text-amber-100",
    panel: "bg-zinc-900/80 border border-zinc-700",
    card: "bg-zinc-900 border border-zinc-700 hover:border-indigo-400/60",
    cardActive: "bg-indigo-500/15 border-indigo-400 text-white",
    cardMuted: "text-zinc-400",
    cloud: "bg-zinc-900/70 border border-zinc-700",
    futureButton:
      "bg-zinc-800/70 border border-zinc-600 text-zinc-300 cursor-not-allowed",
    headingPlate:
      "inline-flex px-4 py-2 rounded-xl border border-zinc-600 bg-zinc-900/80 shadow-sm backdrop-blur-sm",
    heading:
      "bg-gradient-to-r from-indigo-200 via-cyan-200 to-emerald-200 bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]",
  },
  light: {
    mainBg: "bg-gradient-to-b from-white to-zinc-50",
    text: "text-zinc-900",
    subText: "text-zinc-600",
    navButton: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50",
    docsButton: "bg-zinc-900 text-white hover:bg-zinc-800",
    banner: "border-amber-200 bg-amber-50 text-amber-900",
    panel: "bg-white/90 border border-gray-200/70",
    card: "bg-white border border-gray-200 hover:border-blue-300",
    cardActive: "bg-blue-50 border-blue-500 text-zinc-900",
    cardMuted: "text-zinc-600",
    cloud: "bg-white/90 border border-gray-200/50",
    futureButton:
      "bg-white border border-slate-300 text-slate-700 cursor-not-allowed",
    headingPlate:
      "inline-flex px-4 py-2 rounded-xl border border-slate-300/90 bg-white/95 shadow-md",
    heading:
      "bg-gradient-to-r from-slate-900 via-indigo-900 to-fuchsia-900 bg-clip-text text-transparent drop-shadow-[0_1px_0_rgba(255,255,255,0.55)]",
  },
  vibrant: {
    mainBg: "bg-gradient-to-br from-rose-50 via-amber-50 to-sky-50",
    text: "text-zinc-900",
    subText: "text-zinc-600",
    navButton: "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50",
    docsButton: "bg-zinc-900 text-white hover:bg-zinc-800",
    banner: "border-rose-200 bg-white/70 text-rose-900",
    panel: "bg-white/80 border border-rose-200",
    card: "bg-white border border-zinc-200 hover:border-fuchsia-300",
    cardActive: "bg-fuchsia-50 border-fuchsia-500 text-zinc-900",
    cardMuted: "text-zinc-600",
    cloud: "bg-white/85 border border-zinc-200",
    futureButton:
      "bg-white/90 border border-rose-300 text-zinc-700 cursor-not-allowed",
    headingPlate:
      "inline-flex px-4 py-2 rounded-xl border border-rose-300/90 bg-white/92 shadow-md",
    heading:
      "bg-gradient-to-r from-fuchsia-900 via-orange-900 to-cyan-900 bg-clip-text text-transparent drop-shadow-[0_1px_0_rgba(255,255,255,0.45)]",
  },
} as const;

export default function ExplorePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Domain>("bio");
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved && ["dark", "light", "vibrant"].includes(saved)) {
      setTheme(saved);
    }
  }, []);

  const t = THEME_STYLES[theme];

  const handleWordClick = async (word: string) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicQuery: word }),
      });

      const data = await response.json();
      if (data.jobId) {
        router.push(`/job/${data.jobId}`);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error creating job:", error);
      setIsLoading(false);
    }
  };

  return (
    <main
      className={`min-h-screen ${t.mainBg} ${t.text} transition-all duration-500`}
    >
      <div className="container mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className={t.headingPlate}>
              <h1 className={`text-4xl font-bold ${t.heading}`}>
                Hypothesis Atlas Explorer
              </h1>
            </div>
            <p className={`${t.subText} mt-2`}>
              Click a topic to launch an evidence-mapping run.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${t.navButton}`}
            >
              Home
            </Link>
            <Link
              href="/docs"
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${t.docsButton}`}
            >
              Docs
            </Link>
          </div>
        </div>

        <div className="mb-6 flex justify-center">
          <button
            type="button"
            disabled
            className={`px-4 py-2 rounded-lg text-sm font-semibold shadow-sm ${t.futureButton}`}
            title="Hosted $1 mode will be available in a future update"
          >
            $1 hosted mode — available in the future
          </button>
        </div>

        <div
          className={`rounded-3xl p-8 backdrop-blur-sm shadow-xl ${t.panel}`}
        >
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] mb-2 text-center text-indigo-500">
              Step 1
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-center">
              Choose your domain
            </h2>
            <p className={`mt-2 text-center ${t.subText}`}>
              Pick an area you care about. We’ll generate a topic cloud tailored
              to it.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
              {(["bio", "chemistry", "tech", "finance"] as Domain[]).map(
                (domain) => {
                  const isActive = selectedDomain === domain;
                  const meta = DOMAIN_META[domain];

                  return (
                    <button
                      key={domain}
                      onClick={() => setSelectedDomain(domain)}
                      className={`w-full text-left rounded-2xl p-5 border transition-all hover:-translate-y-0.5 ${
                        isActive ? t.cardActive : t.card
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl leading-none">
                          {meta.emoji}
                        </span>
                        <div>
                          <p className="text-lg font-semibold">{meta.label}</p>
                          <p
                            className={`mt-1 text-sm ${isActive ? "text-current/80" : t.cardMuted}`}
                          >
                            {meta.subtitle}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                },
              )}
            </div>
          </div>

          <p
            className={`text-sm font-semibold uppercase tracking-wider mb-4 text-center ${t.subText}`}
          >
            Step 2 · Select a topic to begin
          </p>

          <div className={`rounded-2xl p-4 ${t.cloud}`}>
            <WordCloudComponent
              words={DOMAIN_TERMS[selectedDomain]}
              onWordClick={handleWordClick}
            />
          </div>
        </div>

        {isLoading && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-2xl p-10 text-center shadow-2xl max-w-md mx-4">
              <div className="relative mb-6">
                <div className="animate-spin rounded-full h-20 w-20 border-4 border-gray-200 mx-auto"></div>
                <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-blue-600 mx-auto absolute top-0 left-1/2 -ml-10"></div>
              </div>
              <p className="text-xl font-bold text-gray-800 mb-2">
                Launching Evidence Mapping
              </p>
              <p className="text-sm text-gray-600">
                Analyzing papers, datasets, and research signals...
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
