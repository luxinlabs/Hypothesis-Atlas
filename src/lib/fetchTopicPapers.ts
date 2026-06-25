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

function rankScore(paper: FetchedPaper, query: string): number {
  const currentYear = new Date().getFullYear();
  const stopWords = new Set(["with", "from", "that", "this", "for", "and", "the", "are", "its", "into", "using"]);
  const tokens = query.toLowerCase().split(/\W+/).filter((w) => w.length > 3 && !stopWords.has(w));
  const titleLower = paper.title.toLowerCase();
  const abstractLower = (paper.abstract ?? "").toLowerCase();
  let relevance = 0;
  for (const token of tokens) {
    if (titleLower.includes(token)) relevance += 4;
    if (abstractLower.includes(token)) relevance += 1;
  }
  if (tokens.some((t) => titleLower.startsWith(t))) relevance += 3;
  const relScore = Math.min(relevance, 20) / 20;
  // 2-year window: current year = 1.0, two years ago = 0.0
  const year = parseInt(paper.year) || (currentYear - 2);
  const recScore = Math.max(0, Math.min(1, (year - (currentYear - 2)) / 2));
  return relScore * 0.65 + recScore * 0.35;
}

export async function fetchTopicPapers(topic: string, limit: number): Promise<FetchedPaper[]> {
  const query = topic.trim().slice(0, 300);
  const [openAlexResults, pubmedResults] = await Promise.allSettled([
    searchOpenAlex(query, Math.ceil(limit * 0.7) + 5),
    searchPubMed(query, Math.ceil(limit * 0.5) + 5),
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

  const scored = papers.map((p) => ({ paper: p, score: rankScore(p, query) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.paper);
}
