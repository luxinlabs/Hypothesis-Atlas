import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { email, topic, frequency } = await req.json();

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ error: "Topic required" }, { status: 400 });
    }
    const freq = Number(frequency);
    if (!freq || ![5, 10, 20].includes(freq)) {
      return NextResponse.json({ error: "Frequency must be 5, 10, or 20" }, { status: 400 });
    }

    // Upsert: if same email+topic exists, update frequency
    const existing = await prisma.paperSubscription.findFirst({
      where: { email: email.toLowerCase(), topic },
    });

    let subscription;
    if (existing) {
      subscription = await prisma.paperSubscription.update({
        where: { id: existing.id },
        data: { frequency: freq },
      });
    } else {
      subscription = await prisma.paperSubscription.create({
        data: { email: email.toLowerCase(), topic, frequency: freq },
      });
    }

    return NextResponse.json({ subscription, updated: !!existing });
  } catch (err) {
    console.error("subscription error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ subscriptions: [] });

  const subscriptions = await prisma.paperSubscription.findMany({
    where: { email: email.toLowerCase() },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ subscriptions });
}
