// "500: {"message":"..."}" is how apiRequest reports a failed call. Toasts used
// to show that string as is - braces, status and, for a server error, whatever
// the server put in `message`. This returns just the human part, and never a
// SQL statement.

const SQL_LEAK = /\b(insert into|update "|select .* from|delete from)\b|\$\d+/i;

export function friendlyApiError(error: unknown, fallback = "Please try again."): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!raw) return fallback;

  let text = raw.replace(/^\d{3}:\s*/, "").trim();
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed?.message === "string") text = parsed.message;
    } catch {
      // not JSON: keep the text
    }
  }
  if (!text || SQL_LEAK.test(text)) return fallback;
  return text.length > 240 ? `${text.slice(0, 237)}…` : text;
}
