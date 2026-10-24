// Supabase Storage adapter for the E2E run cleanup (server/services/e2eRunCleanup.ts).
// Lists the "media" bucket recursively under ONE prefix and removes given
// paths. Which prefixes and paths are allowed is decided - and re-checked -
// by e2eRunCleanup.ts (only this run's users' own folders).
//
// Kept apart from the cleanup service so the service, its tests and the
// test-hook router never import the Supabase client.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RunStorage } from "./e2eRunCleanup";

const BUCKET = "media";
const PAGE = 100;

export function supabaseRunStorage(client: SupabaseClient): RunStorage {
  const bucket = () => client.storage.from(BUCKET);

  async function listFiles(prefix: string): Promise<string[]> {
    const folder = prefix.replace(/\/+$/, "");
    const files: string[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await bucket().list(folder, { limit: PAGE, offset });
      if (error) throw new Error(`storage list failed for ${folder}: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const entry of data) {
        const path = `${folder}/${entry.name}`;
        // Supabase returns folders as entries without an id.
        if (entry.id === null || entry.id === undefined) files.push(...(await listFiles(`${path}/`)));
        else files.push(path);
      }
      if (data.length < PAGE) break;
    }
    return files;
  }

  return {
    listFiles,
    async remove(paths) {
      if (paths.length === 0) return;
      const { error } = await bucket().remove(paths);
      if (error) throw new Error(`storage remove failed: ${error.message}`);
    },
  };
}
