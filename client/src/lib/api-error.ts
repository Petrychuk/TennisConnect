/*
  apiRequest (lib/queryClient.ts) throws Error("<status>: <body>"). These
  read it back so screens can show the server's own message and react to
  its status / code (e.g. TC Live's 409 UNSCORED_MATCHES).
*/
export interface ApiErrorInfo {
  status: number | null;
  message: string;
  code?: string;
  body?: Record<string, unknown>;
}

export function apiErrorInfo(error: unknown): ApiErrorInfo {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const match = raw.match(/^(\d{3}):\s*([\s\S]*)$/);
  if (!match) return { status: null, message: raw || "Something went wrong" };
  const status = Number(match[1]);
  try {
    const body = JSON.parse(match[2]);
    return { status, message: typeof body?.message === "string" ? body.message : match[2], code: body?.code, body };
  } catch {
    return { status, message: match[2] || `Request failed (${status})` };
  }
}
