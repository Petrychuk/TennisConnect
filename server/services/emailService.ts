// Transactional email via Resend (https://resend.com) - plain REST call
// via fetch, same pattern as telegramService.ts, so no new SDK/dependency
// to install or pin in package.json.
//
// Setup (one-time, in the Resend dashboard):
//   1. Sign up at resend.com, create an API key.
//   2. Add + verify your sending domain (Domains -> Add Domain), and add
//      the DNS records it gives you. Until the domain is verified, Resend
//      only lets you send to the email address you signed up with - real
//      users won't receive anything, even though the API call "succeeds".
//   3. Set these two env vars (in .env / .env.dev, never committed):
//        RESEND_API_KEY=re_xxxxxxxx
//        RESEND_FROM_EMAIL="TennisConnect <no-reply@yourverifieddomain.com>"

const RESEND_API_URL = "https://api.resend.com/emails";

interface SendEmailResult {
  ok: boolean;
  error?: string;
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    // Loud on purpose - a silently-missing key here previously showed up
    // as "the API says success but no email ever arrives", which is the
    // exact bug we're fixing. Anyone tailing prod logs should see this
    // immediately instead of having to guess why users report nothing
    // arriving.
    console.error(
      "❌ RESEND_API_KEY or RESEND_FROM_EMAIL is not set - email was NOT sent.",
      { to: params.to, subject: params.subject }
    );
    return { ok: false, error: "Email service is not configured" };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(
        `❌ Resend API error (${response.status}) sending to ${params.to}:`,
        body
      );
      return { ok: false, error: `Resend API returned ${response.status}` };
    }

    return { ok: true };
  } catch (error: any) {
    console.error(`❌ Failed to reach Resend API for ${params.to}:`, error?.message || error);
    return { ok: false, error: "Failed to reach email service" };
  }
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: "Reset your TennisConnect password",
    text:
      `We received a request to reset your TennisConnect password.\n\n` +
      `Reset it here (link expires in 1 hour):\n${resetUrl}\n\n` +
      `If you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111;">Reset your password</h2>
        <p style="color: #444; line-height: 1.5;">
          We received a request to reset your TennisConnect password.
          This link expires in 1 hour.
        </p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}"
             style="background:#16a34a; color:#fff; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:bold;">
            Reset Password
          </a>
        </p>
        <p style="color: #888; font-size: 13px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
