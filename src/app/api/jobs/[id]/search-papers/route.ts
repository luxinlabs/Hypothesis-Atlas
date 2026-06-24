import { NextRequest, NextResponse } from "next/server";
import { searchOpenAlex, reconstructAbstract } from "@/lib/apis/openalex";
import { searchPubMed } from "@/lib/apis/pubmed";

export interface FetchedPaper {
  id: string;
  title: string;
  authors: string[];
  venue: string;
  year: string;
  abstract: string;
  url: string;
  source: "openalex" | "pubmed";
}

const CURRENT_YEAR = new Date().getFullYear();

function rankScore(paper: FetchedPaper, query: string): number {
  // Extract meaningful query tokens (>3 chars, no stop words)
  const stopWords = new Set(["with", "from", "that", "this", "for", "and", "the", "are", "its", "into", "using"]);
  const tokens = query
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  const titleLower = paper.title.toLowerCase();
  const abstractLower = (paper.abstract ?? "").toLowerCase();

  let relevance = 0;
  for (const token of tokens) {
    // Exact token in title = 4 pts, in abstract = 1 pt
    if (titleLower.includes(token)) relevance += 4;
    if (abstractLower.includes(token)) relevance += 1;
  }
  // Bonus if title starts with a query token (strong match)
  if (tokens.some((t) => titleLower.startsWith(t))) relevance += 3;

  // Normalise relevance to 0–1 range (cap at 20 raw pts)
  const relScore = Math.min(relevance, 20) / 20;

  // Recency: scale 0–1 across a 10-year window
  const year = parseInt(paper.year) || (CURRENT_YEAR - 5);
  const recScore = Math.max(0, Math.min(1, (year - (CURRENT_YEAR - 10)) / 10));

  // 65% relevance, 35% recency
  return relScore * 0.65 + recScore * 0.35;
}

export async function POST(req: NextRequest) {
  try {
    const { description } = await req.json();
    if (!description || typeof description !== "string") {
      return NextResponse.json({ error: "description required" }, { status: 400 });
    }

    const query = description.trim().slice(0, 300);

    const [openAlexResults, pubmedResults] = await Promise.allSettled([
      searchOpenAlex(query, 15),
      searchPubMed(query, 10),
    ]);

    const papers: FetchedPaper[] = [];
    const seenTitles = new Set<string>();

    if (openAlexResults.status === "fulfilled") {
      for (const w of openAlexResults.value) {
        if (!w.title) continue;
        const key = w.title.toLowerCase().slice(0, 60);
        if (seenTitles.has(key)) continue;
        seenTitles.add(key);
        papers.push({
          id: w.id,
          title: w.title,
          authors: w.authorships?.slice(0, 4).map((a) => a.author.display_name) ?? [],
          venue: w.primary_location?.source?.display_name ?? "",
          year: w.publication_date?.slice(0, 4) ?? "",
          abstract: reconstructAbstract(w.abstract_inverted_index),
          url: w.doi ? `https://doi.org/${w.doi.replace("https://doi.org/", "")}` : w.id,
          source: "openalex",
        });
      }
    }

    if (pubmedResults.status === "fulfilled") {
      for (const a of pubmedResults.value) {
        if (!a.title) continue;
        const key = a.title.toLowerCase().slice(0, 60);
        if (seenTitles.has(key)) continue;
        seenTitles.add(key);
        papers.push({
          id: a.pmid,
          title: a.title,
          authors: a.authors?.slice(0, 4) ?? [],
          venue: a.journal ?? "",
          year: a.pubDate ?? "",
          abstract: a.abstract ?? "",
          url: `https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/`,
          source: "pubmed",
        });
      }
    }

    // Score each paper: relevance (title > abstract) + recency, then sort descending
    const scored = papers.map((p) => ({ paper: p, score: rankScore(p, query) }));
    scored.sort((a, b) => b.score - a.score);

    return NextResponse.json({ papers: scored.slice(0, 20).map((s) => s.paper) });
  } catch (err) {
    console.error("search-papers error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
