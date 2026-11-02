import type { LeaderboardRow, RegistrationWithUser } from "@shared/schema";

/*
  Player list and results CSVs for a session (Session Workspace: More →
  Export Player List, Players → Quick Actions → Export List, Results →
  Export). Pure building + a
  browser download. Values are quoted and a leading = + - @ is
  neutralised, so a player's name can't run as a formula when the file is
  opened in a spreadsheet.
*/

function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function playersCsv(registrations: RegistrationWithUser[], timeZone?: string): string {
  const header = ["Name", "Profile", "Status", "Checked in", "Registered at"].map(csvCell).join(",");
  const format = (d: Date | string | null | undefined) =>
    d ? new Date(d).toLocaleString("en-AU", timeZone ? { timeZone } : undefined) : "";
  const rows = registrations.map((r) =>
    [r.userName, r.userSlug, r.status, format(r.checkedInAt), format(r.createdAt)].map(csvCell).join(","),
  );
  return [header, ...rows].join("\n");
}

/** Final standings (Session Workspace → Results → Export), in leaderboard order. */
export function resultsCsv(standings: LeaderboardRow[]): string {
  const header = ["Position", "Player", "Played", "Won", "Drawn", "Lost", "Games won", "Games lost"].map(csvCell).join(",");
  const rows = standings.map((r, i) =>
    [i + 1, r.userName, r.matchesPlayed, r.wins, r.draws, r.losses, r.gamesWon, r.gamesLost].map(csvCell).join(","),
  );
  return [header, ...rows].join("\n");
}

export function csvFileName(sessionTitle: string, kind: "players" | "results" = "players"): string {
  const slug = sessionTitle.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "session";
  return `${slug}-${kind}.csv`;
}

export function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
