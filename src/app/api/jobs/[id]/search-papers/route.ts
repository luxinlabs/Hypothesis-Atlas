import { NextRequest, NextResponse } from "next/server";
import { fetchTopicPapers, FetchedPaper } from "@/lib/fetchTopicPapers";

export type { FetchedPaper };

export async function POST(req: NextRequest) {
  try {
    const { description } = await req.json();
    if (!description || typeof description !== "string") {
      return NextResponse.json({ error: "description required" }, { status: 400 });
    }
    const papers = await fetchTopicPapers(description, 20);
    return NextResponse.json({ papers });
  } catch (err) {
    console.error("search-papers error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
