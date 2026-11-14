// One Save as Draft, whichever step it is pressed on.
//
// The wizard used to POST a NEW session on every Save as Draft (so three saves =
// three drafts), refused to save without name + venue + date, and jumped away
// afterwards. The saver keeps the id of the row it created and from then on only
// updates that row.
//
//  - first save: make sure the organisation exists, POST, remember id + updatedAt
//  - later saves: PUT the same id with expectedUpdatedAt (stale-write guard)
//  - one save at a time: a second press while one is in flight gets the same
//    promise, so a double click can never create two drafts
//  - a failed save changes nothing: the id / updatedAt stay at the last good
//    values, and the error is thrown for the page to show - never a false success

export interface SavedRow {
  id: string;
  updatedAt: string | Date;
}

export interface DraftSaverApi<P extends object, R extends SavedRow> {
  ensureOrganization(): Promise<unknown>;
  create(payload: P): Promise<R>;
  update(id: string, payload: P & { expectedUpdatedAt: string }): Promise<R>;
}

/** The row was changed by someone/something else since it was loaded (409, code "stale"). */
export class DraftConflictError extends Error {
  constructor(message = "This draft was changed somewhere else.") {
    super(message);
    this.name = "DraftConflictError";
  }
}

/** apiRequest throws `409: {"code":"stale",...}`. */
export function isStaleDraftError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /^409:/.test(message) && /"code"\s*:\s*"stale"/.test(message);
}

const iso = (v: string | Date) => (v instanceof Date ? v.toISOString() : new Date(v).toISOString());

export function createDraftSaver<P extends object, R extends SavedRow>(
  api: DraftSaverApi<P, R>,
  initial?: { id: string; updatedAt: string | Date },
) {
  let id: string | null = initial?.id ?? null;
  let updatedAt: string | null = initial ? iso(initial.updatedAt) : null;
  let inFlight: Promise<R> | null = null;

  async function run(build: (mode: "create" | "update") => P): Promise<R> {
    let row: R;
    if (id === null) {
      await api.ensureOrganization();
      row = await api.create(build("create"));
    } else {
      try {
        row = await api.update(id, { ...build("update"), expectedUpdatedAt: updatedAt as string });
      } catch (error) {
        if (isStaleDraftError(error)) throw new DraftConflictError();
        throw error;
      }
    }
    id = row.id;
    updatedAt = iso(row.updatedAt);
    return row;
  }

  return {
    id: () => id,
    updatedAt: () => updatedAt,
    isSaving: () => inFlight !== null,
    /** `build` gets the mode the saver decided on (create the first time, update after) so the payload can differ. */
    save(build: (mode: "create" | "update") => P): Promise<R> {
      if (inFlight) return inFlight;
      const p = run(build).finally(() => {
        inFlight = null;
      });
      inFlight = p;
      return p;
    },
    /** After a publish or reload the page knows a newer row; keeps the guard in step. */
    adopt(row: SavedRow) {
      id = row.id;
      updatedAt = iso(row.updatedAt);
    },
  };
}
