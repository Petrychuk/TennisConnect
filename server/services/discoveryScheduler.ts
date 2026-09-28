import { storage } from "../storage";
import { runDiscovery, isDiscoveryRunning, sweepExpiredActivities } from "./discoveryOrchestration";

// [PLAY][AI] TC Discovery Agent, section 14 - "the Agent should
// periodically revisit the original source." Opt-in: a real run calls a
// paid model, so nothing here does anything unless
// DISCOVERY_SCHEDULER_ENABLED=true is set for that environment.
//
// What it does, on a timer:
//   1. Every tick: mark finished events EXPIRED (cheap, no network, no AI).
//   2. Every tick: re-scan sources that are DUE - i.e. an admin has
//      already run them for real once (nextScanAt is set) and their
//      recheck interval has elapsed. A brand-new source is never scanned
//      automatically; its first real run is a deliberate admin action.
// Everything it finds goes through the same review rules as a manual run
// (new items land in Pending; a changed approved event goes back for
// re-approval), so an unattended scan can't put unreviewed data in Play.

const TICK_MS = 6 * 60 * 60 * 1000; // every 6 hours

export function startDiscoveryScheduler(): void {
  if (process.env.DISCOVERY_SCHEDULER_ENABLED !== "true") return;

  const tick = async () => {
    try {
      const expired = await sweepExpiredActivities();
      if (expired > 0) console.log(JSON.stringify({ event: "discovery_scheduler_expired", count: expired }));

      if (isDiscoveryRunning()) return; // a manual run is in progress - the next tick will catch up

      const due = await storage.getDiscoverySources({ enabledOnly: true, dueOnly: true });
      if (due.length === 0) return;

      const run = await storage.createDiscoveryRun({ isDryRun: false });
      const summary = await runDiscovery({ isDryRun: false, dueOnly: true });
      await storage.completeDiscoveryRun(run.id, summary);
      console.log(
        JSON.stringify({
          event: "discovery_scheduler_run",
          sources: summary.sourcesScanned,
          created: summary.eventsCreated,
          updated: summary.eventsUpdated,
          errors: summary.errors.length,
        })
      );
    } catch (err: any) {
      console.log(JSON.stringify({ event: "discovery_scheduler_error", error: err?.message }));
    }
  };

  const timer = setInterval(tick, TICK_MS);
  timer.unref?.(); // never keep the process alive just for this
  console.log(JSON.stringify({ event: "discovery_scheduler_started", everyHours: TICK_MS / 3_600_000 }));
}
