import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hypothesis-atlas.vercel.app";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${APP_URL}/unsubscribed?status=invalid`);
  }

  try {
    const subscription = await prisma.paperSubscription.findUnique({
      where: { unsubToken: token },
    });

    if (!subscription) {
      return NextResponse.redirect(`${APP_URL}/unsubscribed?status=notfound`);
    }

    await prisma.paperSubscription.delete({ where: { id: subscription.id } });

    const params = new URLSearchParams({ topic: subscription.topic, email: subscription.email });
    return NextResponse.redirect(`${APP_URL}/unsubscribed?${params}`);
  } catch (err) {
    console.error("[unsubscribe] error:", err);
    return NextResponse.redirect(`${APP_URL}/unsubscribed?status=error`);
  }
}
