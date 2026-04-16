"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "vibrant";

const themes = {
  dark: {
    bg: "bg-[#0a0a0f]",
    text: "text-white",
    cardBg: "bg-zinc-900/50",
    cardBorder: "border-zinc-800",
    cardHover: "hover:border-indigo-500/40 hover:bg-zinc-900",
    accent: "text-indigo-400",
    muted: "text-zinc-400",
    mutedBg: "bg-zinc-900",
    codeBg: "bg-zinc-900",
    codeText: "text-emerald-400",
    codeComment: "text-zinc-600",
    navBg: "bg-white/10",
    navHover: "hover:bg-white/10",
    glow1: "bg-indigo-600/20",
    glow2: "bg-cyan-500/15",
    gradient: "from-indigo-400 via-cyan-400 to-emerald-400",
    buttonPrimary: "bg-white text-black hover:bg-zinc-100",
    buttonSecondary:
      "border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white",
    ctaBg:
      "bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 border border-indigo-500/20",
    footerBorder: "border-zinc-800",
    footerText: "text-zinc-600",
  },
  light: {
    bg: "bg-white",
    text: "text-zinc-900",
    cardBg: "bg-zinc-50/50",
    cardBorder: "border-zinc-200",
    cardHover: "hover:border-blue-400/40 hover:bg-zinc-50",
    accent: "text-blue-600",
    muted: "text-zinc-600",
    mutedBg: "bg-zinc-100",
    codeBg: "bg-zinc-900",
    codeText: "text-emerald-400",
    codeComment: "text-zinc-600",
    navBg: "bg-zinc-100",
    navHover: "hover:bg-zinc-200",
    glow1: "bg-blue-400/10",
    glow2: "bg-indigo-400/8",
    gradient: "from-blue-800 via-indigo-800 to-purple-800",
    buttonPrimary: "bg-zinc-900 text-white hover:bg-zinc-800",
    buttonSecondary:
      "border border-zinc-300 text-zinc-700 hover:border-zinc-400 hover:text-zinc-900",
    ctaBg: "bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200",
    footerBorder: "border-zinc-200",
    footerText: "text-zinc-500",
  },
  vibrant: {
    bg: "bg-gradient-to-br from-rose-50 via-amber-50 to-sky-50",
    text: "text-zinc-900",
    cardBg: "bg-white/80 backdrop-blur-sm",
    cardBorder: "border-zinc-200",
    cardHover: "hover:border-fuchsia-300/60 hover:bg-white",
    accent: "text-fuchsia-600",
    muted: "text-zinc-600",
    mutedBg: "bg-white",
    codeBg: "bg-zinc-900",
    codeText: "text-emerald-400",
    codeComment: "text-zinc-500",
    navBg: "bg-white/80 backdrop-blur-sm",
    navHover: "hover:bg-zinc-100",
    glow1: "bg-fuchsia-300/20",
    glow2: "bg-sky-300/20",
    gradient: "from-fuchsia-600 via-orange-500 to-cyan-600",
    buttonPrimary: "bg-zinc-900 text-white hover:bg-zinc-800",
    buttonSecondary:
      "border border-zinc-300 text-zinc-700 hover:border-zinc-400 hover:text-zinc-900",
    ctaBg: "bg-gradient-to-br from-rose-50 to-sky-50 border border-rose-200",
    footerBorder: "border-zinc-200",
    footerText: "text-zinc-500",
  },
} as const;

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({
  theme: "light",
  setTheme: () => {},
});

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={`flex items-center gap-1 p-1 rounded-lg backdrop-blur-sm ${
        theme === "dark"
          ? "bg-zinc-800/50"
          : theme === "light"
            ? "bg-white border border-zinc-200"
            : "bg-white/10 border border-white/20"
      }`}
    >
      {(["dark", "light", "vibrant"] as Theme[]).map((t) => (
        <button
          key={t}
          onClick={() => setTheme(t)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            theme === t
              ? t === "dark"
                ? "bg-zinc-700 text-white"
                : t === "light"
                  ? "bg-zinc-200 text-zinc-900"
                  : "bg-fuchsia-100 text-fuchsia-700"
              : "text-zinc-400 hover:text-white hover:bg-zinc-700/50"
          }`}
        >
          {t === "dark" ? "Dark" : t === "light" ? "Light" : "Vibrant"}
        </button>
      ))}
    </div>
  );
}

function useTheme() {
  return useContext(ThemeContext);
}

const features = [
  {
    icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
    title: "Knowledge Trees",
    desc: "Auto-generated hierarchical breakdowns of any research topic",
  },
  {
    icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
    title: "Multi-Source",
    desc: "Papers from OpenAlex & PubMed, datasets from GEO, social signals",
  },
  {
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    title: "Real-time Pipeline",
    desc: "Watch evidence gathering live with server-sent events",
  },
  {
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
    title: "LLM Synthesis",
    desc: "Groq-powered analysis with epistemic guardrails",
  },
  {
    icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    title: "Research Notebook",
    desc: "Markdown editor with AI copilot for topic convergence",
  },
  {
    icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
    title: "Open Source",
    desc: "MIT licensed. Self-host free, or run on our servers at $1/round",
  },
];

const steps = [
  { cmd: "make laptop-install", label: "Install everything" },
  { cmd: "make dev", label: "Start dev server" },
  { cmd: "make worker", label: "Start background worker" },
];

export default function Home() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme;
    if (saved && ["dark", "light", "vibrant"].includes(saved)) {
      setTheme(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  const t = themes[theme];

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <main
        className={`min-h-screen ${t.bg} ${t.text} overflow-hidden transition-all duration-500`}
      >
        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6">
          <span className="text-lg font-bold tracking-tight">
            Hypothesis Atlas
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/docs"
              className={`px-4 py-2 text-sm ${t.muted} hover:${t.text} transition-colors`}
            >
              Docs
            </Link>
            <Link
              href="/pricing"
              className={`px-4 py-2 text-sm ${t.muted} hover:${t.text} transition-colors`}
            >
              Pricing
            </Link>
            <Link
              href="/explore"
              className={`px-4 py-2 text-sm font-semibold ${t.buttonPrimary} rounded-lg transition-colors`}
            >
              Try Explorer
            </Link>
            <ThemeSwitcher />
          </div>
        </nav>

        {/* Hero */}
        <section className="relative px-6 md:px-12 pt-16 pb-24 max-w-6xl mx-auto">
          {/* Glow orbs */}
          <div
            className={`absolute -top-20 left-1/4 w-96 h-96 ${t.glow1} rounded-full blur-[120px] pointer-events-none`}
          />
          <div
            className={`absolute -top-10 right-1/4 w-72 h-72 ${t.glow2} rounded-full blur-[100px] pointer-events-none`}
          />

          <div className="relative z-10 text-center max-w-3xl mx-auto">
            <div className="animate-slide-up">
              <span
                className={`inline-block px-3 py-1 mb-6 text-xs font-semibold tracking-wider uppercase ${theme === "dark" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" : theme === "light" ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-pink-100 text-pink-700 border border-pink-300"} rounded-full`}
              >
                Open-source research platform
              </span>
            </div>

            <h1 className="animate-slide-up delay-100 text-5xl md:text-7xl font-extrabold leading-[1.05] tracking-tight">
              Map the evidence.
              <br />
              <span
                className={`bg-gradient-to-r ${t.gradient} bg-clip-text text-transparent animate-gradient`}
              >
                See the science.
              </span>
            </h1>

            <p
              className={`animate-slide-up delay-200 mt-6 text-lg ${t.muted} max-w-xl mx-auto leading-relaxed`}
            >
              Discover, synthesize, and visualize research from papers,
              datasets, and signals &mdash; brainstorm ideas in one click.
            </p>

            <div className="animate-slide-up delay-300 mt-10 flex items-center justify-center gap-4 flex-wrap">
              <Link
                href="/explore"
                className={`group px-6 py-3 ${t.buttonPrimary} font-semibold rounded-xl transition-all shadow-lg ${theme === "dark" ? "shadow-white/10" : "shadow-zinc-900/10"} flex items-center gap-2`}
              >
                Open Explorer
                <svg
                  className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Link>
              <Link
                href="/docs"
                className={`px-6 py-3 ${t.buttonSecondary} font-semibold rounded-xl transition-all`}
              >
                Read the Docs
              </Link>
            </div>
          </div>
        </section>

        {/* Terminal Install */}
        <section className="px-6 md:px-12 pb-24 max-w-3xl mx-auto">
          <div
            className={`animate-slide-up delay-400 ${t.codeBg} ${t.cardBorder} rounded-2xl overflow-hidden animate-pulse-glow`}
          >
            <div
              className={`flex items-center gap-2 px-4 py-3 ${theme === "dark" ? "bg-zinc-800/50" : theme === "light" ? "bg-zinc-100" : "bg-black/30"}`}
            >
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className={`ml-2 text-xs ${t.muted} font-mono`}>
                terminal
              </span>
            </div>
            <div className="p-5 font-mono text-sm space-y-3">
              {steps.map((s, i) => (
                <div key={i}>
                  <span className={t.muted}>$</span>{" "}
                  <span className={t.codeText}>{s.cmd}</span>
                  <span className={`ml-4 ${t.codeComment} text-xs`}>
                    # {s.label}
                  </span>
                </div>
              ))}
              <div className={`pt-2 ${t.muted} text-xs`}>
                Open{" "}
                <span
                  className={
                    theme === "dark"
                      ? "text-cyan-400"
                      : theme === "light"
                        ? "text-blue-600"
                        : "text-pink-300"
                  }
                >
                  http://localhost:3000
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-6 md:px-12 pb-24 max-w-6xl mx-auto">
          <h2 className="text-center text-3xl md:text-4xl font-bold mb-4">
            Everything you need
          </h2>
          <p className={`text-center ${t.muted} mb-12 max-w-lg mx-auto`}>
            From topic selection to structured knowledge &mdash; fully
            automated.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div
                key={i}
                className={`group ${t.cardBg} ${t.cardBorder} rounded-2xl p-6 ${t.cardHover} transition-all duration-300`}
              >
                <div
                  className={`w-10 h-10 mb-4 rounded-lg ${theme === "dark" ? "bg-indigo-500/10" : theme === "light" ? "bg-blue-100" : "bg-pink-500/20"} flex items-center justify-center ${theme === "dark" ? "group-hover:bg-indigo-500/20" : theme === "light" ? "group-hover:bg-blue-200" : "group-hover:bg-pink-500/30"} transition-colors`}
                >
                  <svg
                    className={`w-5 h-5 ${t.accent}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d={f.icon}
                    />
                  </svg>
                </div>
                <h3 className={`font-semibold ${t.text} mb-1`}>{f.title}</h3>
                <p className={`text-sm ${t.muted} leading-relaxed`}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 md:px-12 pb-24 max-w-4xl mx-auto">
          <h2 className="text-center text-3xl md:text-4xl font-bold mb-12">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            {[
              {
                step: "1",
                title: "Pick a topic",
                desc: "Click any term in the word cloud or type your own.",
              },
              {
                step: "2",
                title: "Watch it build",
                desc: "Real-time pipeline fetches papers, datasets, and signals.",
              },
              {
                step: "3",
                title: "Explore & write",
                desc: "Navigate the knowledge tree and use the AI notebook.",
              },
            ].map((s, i) => (
              <div key={i}>
                <div
                  className={`mx-auto w-12 h-12 rounded-full bg-gradient-to-br ${theme === "dark" ? "from-indigo-500 to-cyan-500" : theme === "light" ? "from-blue-500 to-indigo-500" : "from-pink-400 to-purple-400"} flex items-center justify-center text-lg font-bold mb-4 animate-float`}
                  style={{ animationDelay: `${i * 200}ms` }}
                >
                  {s.step}
                </div>
                <h3 className={`font-semibold text-lg mb-2`}>{s.title}</h3>
                <p className={`text-sm ${t.muted}`}>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className={`border-t ${t.footerBorder} px-6 md:px-12 py-8`}>
          <div className="max-w-6xl mx-auto flex items-center justify-between text-xs">
            <span className={t.footerText}>
              Hypothesis Atlas &middot; MIT License
            </span>
            <div className="flex gap-4">
              <Link
                href="/docs"
                className={`${t.footerText} hover:${t.text} transition-colors`}
              >
                Docs
              </Link>
              <Link
                href="/explore"
                className={`${t.footerText} hover:${t.text} transition-colors`}
              >
                Explorer
              </Link>
              <Link
                href="/pricing"
                className={`${t.footerText} hover:${t.text} transition-colors`}
              >
                Pricing
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </ThemeContext.Provider>
  );
}
