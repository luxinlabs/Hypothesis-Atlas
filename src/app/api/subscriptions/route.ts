import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

function nextMonday(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const daysUntil = day === 1 ? 7 : (8 - day) % 7;
  d.setDate(d.getDate() + daysUntil);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function confirmationHtml(email: string, topic: string, frequency: number): string {
  const nextDate = nextMonday();
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5,#9333ea);padding:32px 40px;text-align:center;">
              <p style="margin:0 0 4px 0;color:rgba(255,255,255,0.75);font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Hypothesis Atlas</p>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">You're subscribed!</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
                Hi there! Your weekly paper digest is all set. Here's a summary of your subscription:
              </p>

              <!-- Subscription card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;border:1px solid #e0d9ff;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;color:#6d28d9;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Research Topic</p>
                    <p style="margin:0 0 16px;color:#1f2937;font-size:17px;font-weight:700;">${topic}</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50%">
                          <p style="margin:0 0 2px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;">Papers per week</p>
                          <p style="margin:0;color:#1f2937;font-size:15px;font-weight:600;">${frequency} papers</p>
                        </td>
                        <td width="50%">
                          <p style="margin:0 0 2px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;">First digest</p>
                          <p style="margin:0;color:#1f2937;font-size:15px;font-weight:600;">${nextDate}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.6;">
                Every Monday, we'll send you the <strong>${frequency} most relevant and recent papers</strong> on
                <em>${topic}</em> — ranked by both topical relevance and publication recency.
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.6;">
                You can manage or cancel your subscription at any time from the Hypothesis Atlas app.
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://hypothesis-atlas.vercel.app" style="display:inline-block;background:linear-gradient(to right,#4f46e5,#9333ea);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:10px;">
                      Open Hypothesis Atlas
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #f3f4f6;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                You're receiving this because ${email} subscribed to weekly research digests on Hypothesis Atlas.
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

    const normalizedEmail = email.toLowerCase();

    // Upsert: if same email+topic exists, update frequency
    const existing = await prisma.paperSubscription.findFirst({
      where: { email: normalizedEmail, topic },
    });

    let subscription;
    if (existing) {
      subscription = await prisma.paperSubscription.update({
        where: { id: existing.id },
        data: { frequency: freq },
      });
    } else {
      subscription = await prisma.paperSubscription.create({
        data: { email: normalizedEmail, topic, frequency: freq },
      });
    }

    // Send confirmation email via Resend
    let emailSent = false;
    let emailError: string | undefined;

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      emailError = "RESEND_API_KEY not configured";
      console.warn("[subscriptions] Skipping email — RESEND_API_KEY is not set");
    } else {
      try {
        const resend = new Resend(resendKey);
        const result = await resend.emails.send({
          from: "Hypothesis Atlas <onboarding@resend.dev>",
          to: normalizedEmail,
          subject: `Subscribed: ${freq} papers/week on "${topic}"`,
          html: confirmationHtml(normalizedEmail, topic, freq),
        });
        if (result.error) {
          emailError = result.error.message;
          console.error("[subscriptions] Resend error:", result.error);
        } else {
          emailSent = true;
          console.log("[subscriptions] Confirmation email sent:", result.data?.id);
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
