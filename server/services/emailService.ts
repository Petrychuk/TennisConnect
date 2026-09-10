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

// Same wordmark as the navbar (client/src/components/navbar.tsx:
// `Tennis<span className="text-[hsl(var(--tennis-ball))]">Connect</span>`
// + a small dot in that same colour) - reproduced here as inline-styled
// text, not an <img>, since most email clients block remote images by
// default until the person clicks "show images", which would mean the
// very first thing they see is a broken-image icon instead of the
// logo. Text always renders. #C7F53D is hsl(75, 90%, 60%) - the
// --tennis-ball CSS var - converted to hex since HSL() function syntax
// isn't reliably supported across email clients (Outlook desktop's
// Word rendering engine in particular).
const EMAIL_LOGO_HTML = `
  <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 22px; font-weight: 800; margin: 0 0 24px;">
    <span style="color:#111;">Tennis</span><span style="color:#C7F53D;">Connect</span><span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#C7F53D; margin-left:3px;"></span>
  </div>
`;

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
    const controller = new AbortController();
    // Resend is normally sub-second; this is a circuit breaker, not a
    // realistic expected duration - a provider-side hiccup or network
    // stall here was previously blocking the whole HTTP request open
    // with no ceiling at all (matches the ~20s p99 spikes seen in
    // Railway's Response Time graph - undici's default fetch has no
    // meaningful timeout of its own to fall back on).
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch(RESEND_API_URL, {
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
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

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
    const timedOut = error?.name === "AbortError";
    console.error(
      `❌ Failed to reach Resend API for ${params.to}:`,
      timedOut ? "timed out after 8s" : error?.message || error
    );
    return { ok: false, error: timedOut ? "Email service timed out" : "Failed to reach email service" };
  }
}

export async function sendVerificationEmail(
  to: string,
  verifyUrl: string
): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: "🎾 One click and you're on the court - confirm your email",
    text:
      `Welcome to TennisConnect! You're one click away from finding your next hitting partner (or your next student).\n\n` +
      `Confirm your email here (link expires in 24 hours):\n${verifyUrl}\n\n` +
      `If you didn't create a TennisConnect account, you can safely ignore this email - no account will be activated without confirmation.`,
    html: `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        ${EMAIL_LOGO_HTML}
        <p style="font-size: 32px; margin: 0 0 8px;">🎾</p>
        <h2 style="color: #111; margin: 0 0 12px;">You're one click from the court</h2>
        <p style="color: #444; line-height: 1.6;">
          Welcome to TennisConnect! Confirm your email and you're in -
          ready to find hitting partners, coaches, and sessions around
          Sydney. This link expires in 24 hours, so don't let it sit in
          the deuce court too long.
        </p>
        <p style="margin: 28px 0;">
          <a href="${verifyUrl}"
             style="background:#90C610; color:#fff; padding:14px 24px; border-radius:999px; text-decoration:none; font-weight:bold; display:inline-block;">
            Confirm Email Address
          </a>
        </p>
        <p style="color: #888; font-size: 13px; line-height: 1.5;">
          If you didn't create a TennisConnect account, you can safely
          ignore this email - no account will be activated without
          confirmation.
        </p>
      </div>
    `,
  });
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
        ${EMAIL_LOGO_HTML}
        <h2 style="color: #111;">Reset your password</h2>
        <p style="color: #444; line-height: 1.5;">
          We received a request to reset your TennisConnect password.
          This link expires in 1 hour.
        </p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}"
             style="background:#90C610; color:#fff; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:bold;">
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
