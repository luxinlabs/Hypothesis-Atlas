import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { fetchTopicPapers, FetchedPaper } from "@/lib/fetchTopicPapers";

function formatTime(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr);
  const m = parseInt(mStr ?? "0");
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${suffix}`;
}

function nextMonday(time24: string): string {
  const d = new Date();
  const day = d.getDay();
  const daysUntil = day === 1 ? 7 : (8 - day) % 7;
  d.setDate(d.getDate() + daysUntil);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    + " at " + formatTime(time24);
}

function paperCard(paper: FetchedPaper, index: number): string {
  const abstract = paper.abstract
    ? paper.abstract.slice(0, 240) + (paper.abstract.length > 240 ? "…" : "")
    : "No abstract available.";
  const authors = paper.authors.length > 0
    ? paper.authors.slice(0, 3).join(", ") + (paper.authors.length > 3 ? " et al." : "")
    : "Unknown authors";
  const sourceColor = paper.source === "openalex" ? "#4f46e5" : "#0891b2";
  const sourceLabel = paper.source === "openalex" ? "OpenAlex" : "PubMed";

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
  <tr>
    <td style="padding:16px 20px;background:#ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
        <tr>
          <td>
            <span style="display:inline-block;background:#f3f4f6;color:#6b7280;font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;margin-bottom:6px;">#${index + 1}</span>
            <span style="display:inline-block;background:${sourceColor}18;color:${sourceColor};font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;margin-bottom:6px;margin-left:4px;">${sourceLabel}</span>
          </td>
          <td align="right" style="color:#9ca3af;font-size:12px;white-space:nowrap;">${paper.year}</td>
        </tr>
      </table>
      <a href="${paper.url}" style="color:#1f2937;font-size:15px;font-weight:700;text-decoration:none;line-height:1.4;display:block;margin-bottom:6px;">${paper.title}</a>
      <p style="margin:0 0 8px;color:#6b7280;font-size:12px;">${authors}${paper.venue ? ` · <em>${paper.venue}</em>` : ""}</p>
      <p style="margin:0 0 12px;color:#4b5563;font-size:13px;line-height:1.5;">${abstract}</p>
      <a href="${paper.url}" style="display:inline-block;background:#f5f3ff;color:#4f46e5;font-size:12px;font-weight:600;padding:6px 14px;border-radius:8px;text-decoration:none;">Read paper →</a>
    </td>
  </tr>
</table>`;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hypothesis-atlas.vercel.app";

function digestHtml(email: string, topic: string, frequency: number, deliveryTime: string, papers: FetchedPaper[], isFirst: boolean, unsubToken: string): string {
  const nextDate = nextMonday(deliveryTime);
  const timeLabel = formatTime(deliveryTime);
  const title = isFirst ? "Your First Paper Digest" : `Weekly Digest: ${topic}`;
  const unsubUrl = `${APP_URL}/api/subscriptions/unsubscribe?token=${unsubToken}`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5,#9333ea);padding:28px 40px;">
              <p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Hypothesis Atlas · Research Digest</p>
              <h1 style="margin:0 0 6px;color:#ffffff;font-size:22px;font-weight:700;">${title}</h1>
              <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;">
                <strong>${frequency} papers</strong> on <strong>${topic}</strong>
              </p>
            </td>
          </tr>

          <!-- Schedule banner -->
          <tr>
            <td style="background:#f5f3ff;padding:12px 40px;border-bottom:1px solid #e0d9ff;">
              <p style="margin:0;color:#4f46e5;font-size:12px;">
                📅 You'll receive ${frequency} papers every <strong>Monday at ${timeLabel}</strong>. Next digest: <strong>${nextDate}</strong>
              </p>
            </td>
          </tr>

          <!-- Papers -->
          <tr>
            <td style="padding:24px 40px 8px;">
              <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
                Here are the top <strong>${papers.length}</strong> most relevant and recent papers on <em>${topic}</em>, ranked by relevance and publication date:
              </p>
              ${papers.map((p, i) => paperCard(p, i)).join("")}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;background:#f9fafb;border-top:1px solid #f3f4f6;">
              <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;text-align:center;">
                You subscribed to weekly research digests on Hypothesis Atlas with ${email}.
              </p>
              <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;text-align:center;">
                <a href="${APP_URL}" style="color:#4f46e5;text-decoration:none;">Open Hypothesis Atlas</a>
                &nbsp;·&nbsp;
                <a href="${unsubUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
              </p>
              <p style="margin:0;color:#d1d5db;font-size:11px;text-align:center;">
                Clicking unsubscribe will immediately remove you from this digest.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const { email, topic, frequency, deliveryTime } = await req.json();

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
    const time = (typeof deliveryTime === "string" && /^\d{2}:\d{2}$/.test(deliveryTime))
      ? deliveryTime
      : "09:00";

    const normalizedEmail = email.toLowerCase();

    const existing = await prisma.paperSubscription.findFirst({
      where: { email: normalizedEmail, topic },
    });

    let subscription;
    if (existing) {
      subscription = await prisma.paperSubscription.update({
        where: { id: existing.id },
        data: { frequency: freq, deliveryTime: time },
      });
    } else {
      subscription = await prisma.paperSubscription.create({
        data: { email: normalizedEmail, topic, frequency: freq, deliveryTime: time },
      });
    }

    // Fetch papers + send immediately
    let emailSent = false;
    let emailError: string | undefined;

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      emailError = "RESEND_API_KEY not configured";
      console.warn("[subscriptions] Skipping email — RESEND_API_KEY is not set");
    } else {
      try {
        console.log(`[subscriptions] Fetching ${freq} papers for "${topic}"…`);
        const papers = await fetchTopicPapers(topic, freq);
        console.log(`[subscriptions] Fetched ${papers.length} papers`);

        const resend = new Resend(resendKey);
        const result = await resend.emails.send({
          from: "Hypothesis Atlas <onboarding@resend.dev>",
          to: normalizedEmail,
          subject: `Your first ${freq} papers on "${topic}" — Hypothesis Atlas`,
          html: digestHtml(normalizedEmail, topic, freq, time, papers, true, subscription.unsubToken),
        });

        if (result.error) {
          emailError = result.error.message;
          console.error("[subscriptions] Resend error:", result.error);
        } else {
          emailSent = true;
          console.log("[subscriptions] Digest email sent:", result.data?.id);
        }
      } catch (emailErr) {
        emailError = String(emailErr);
        console.error("[subscriptions] Email send exception:", emailErr);
      }
    }

    return NextResponse.json({ subscription, updated: !!existing, emailSent, emailError });
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
