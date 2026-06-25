import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { fetchTopicPapers, FetchedPaper } from "@/lib/fetchTopicPapers";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hypothesis-atlas.vercel.app";

// Vercel calls this with the CRON_SECRET header for auth
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // allow in dev without secret
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function formatTime(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr);
  const m = parseInt(mStr ?? "0");
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

function nextMonday(time24: string): string {
  const d = new Date();
  const day = d.getDay();
  const daysUntil = day === 1 ? 7 : (8 - day) % 7;
  d.setDate(d.getDate() + daysUntil);
  return (
    d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) +
    " at " + formatTime(time24)
  );
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

function weeklyDigestHtml(
  email: string,
  topic: string,
  frequency: number,
  deliveryTime: string,
  papers: FetchedPaper[],
  unsubToken: string,
): string {
  const timeLabel = formatTime(deliveryTime);
  const nextDate = nextMonday(deliveryTime);
  const unsubUrl = `${APP_URL}/api/subscriptions/unsubscribe?token=${unsubToken}`;
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#9333ea);padding:28px 40px;">
            <p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Hypothesis Atlas · Weekly Digest</p>
            <h1 style="margin:0 0 6px;color:#ffffff;font-size:22px;font-weight:700;">Your Weekly Papers</h1>
            <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;"><strong>${frequency} papers</strong> on <strong>${topic}</strong></p>
          </td>
        </tr>
        <tr>
          <td style="background:#f5f3ff;padding:12px 40px;border-bottom:1px solid #e0d9ff;">
            <p style="margin:0 0 3px;color:#4f46e5;font-size:12px;">
              📅 Delivered every <strong>Monday at ${timeLabel}</strong>. Next digest: <strong>${nextDate}</strong>
            </p>
            <p style="margin:0;color:#7c6fcd;font-size:11px;">Papers from ${currentYear - 1}–${currentYear}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px 8px;">
            <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
              Here are this week's top <strong>${papers.length}</strong> papers on <em>${topic}</em>:
            </p>
            ${papers.map((p, i) => paperCard(p, i)).join("")}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 28px;background:#f9fafb;border-top:1px solid #f3f4f6;">
            <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;text-align:center;">
              Sent to ${email} · weekly digest on <em>${topic}</em>
            </p>
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
              <a href="${APP_URL}" style="color:#4f46e5;text-decoration:none;">Open Hypothesis Atlas</a>
              &nbsp;·&nbsp;
              <a href="${unsubUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  // Current UTC hour as "HH:00" to match stored deliveryTime
  const nowUtc = new Date();
  const currentHour = nowUtc.getUTCHours().toString().padStart(2, "0");
  const currentTime = `${currentHour}:00`;

  console.log(`[weekly-digest] Running for deliveryTime=${currentTime} (UTC)`);

  // Find all subscriptions whose deliveryTime matches this hour
  const subscriptions = await prisma.paperSubscription.findMany({
    where: { deliveryTime: currentTime },
  });

  console.log(`[weekly-digest] Found ${subscriptions.length} subscription(s) to send`);

  const resend = new Resend(resendKey);
  const results: { email: string; topic: string; ok: boolean; error?: string }[] = [];

  for (const sub of subscriptions) {
    try {
      const papers = await fetchTopicPapers(sub.topic, sub.frequency);
      const result = await resend.emails.send({
        from: "Hypothesis Atlas <onboarding@resend.dev>",
        to: sub.email,
        subject: `Weekly digest: ${sub.frequency} papers on "${sub.topic}"`,
        html: weeklyDigestHtml(sub.email, sub.topic, sub.frequency, sub.deliveryTime, papers, sub.unsubToken),
      });

      if (result.error) {
        console.error(`[weekly-digest] Failed ${sub.email}:`, result.error);
        results.push({ email: sub.email, topic: sub.topic, ok: false, error: result.error.message });
      } else {
        console.log(`[weekly-digest] Sent to ${sub.email} (${sub.topic}): ${result.data?.id}`);
        results.push({ email: sub.email, topic: sub.topic, ok: true });
      }
    } catch (err) {
      console.error(`[weekly-digest] Exception for ${sub.email}:`, err);
      results.push({ email: sub.email, topic: sub.topic, ok: false, error: String(err) });
    }
  }

  return NextResponse.json({
    sentAt: nowUtc.toISOString(),
    deliveryTime: currentTime,
    total: subscriptions.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
