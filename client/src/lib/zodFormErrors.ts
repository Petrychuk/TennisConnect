// Maps Zod 4 validation issues to react-hook-form's flat field errors.
//
// Why this exists: @hookform/resolvers 3.x recognises a Zod failure by
// `Array.isArray(error.errors)`. Zod 4 removed `ZodError.errors` (only
// `.issues` remains), so the 3.x zodResolver re-threw every validation
// failure instead of returning field errors - forms blocked submission
// but showed no message at all (REG-003 / REG-004). See ./zodResolver.ts.
//
// Pure (no React, no react-hook-form runtime) - unit-tested in
// ./zodFormErrors.test.ts.

/** The parts of a Zod 4 issue this mapping uses. */
export interface ZodIssueLike {
  code: string;
  message: string;
  path: readonly PropertyKey[];
  /** Present on Zod 4 `invalid_union` issues: one issue list per union option. */
  errors?: readonly (readonly ZodIssueLike[])[];
}

export interface FlatFieldError {
  type: string;
  message: string;
  /** Every message per issue code, only when all criteria are requested. */
  types?: Record<string, string | string[]>;
}

/**
 * Flat errors keyed by dotted path ("email", "address.city", "" for the
 * root). The first issue for a path wins, as with the previous resolver;
 * with `allCriteria` every message is also kept under `types`.
 */
export function zodIssuesToFieldErrors(
  issues: readonly ZodIssueLike[],
  allCriteria = false,
): Record<string, FlatFieldError> {
  const errors: Record<string, FlatFieldError> = {};
  const queue = [...issues];

  while (queue.length > 0) {
    const issue = queue.shift()!;
    const path = issue.path.map(String).join(".");
    // A failed union reports why each option failed; use the first option's first reason.
    const unionFirst = issue.code === "invalid_union" ? issue.errors?.[0]?.[0] : undefined;
    const message = unionFirst?.message ?? issue.message;
    const type = unionFirst?.code ?? issue.code;

    if (!errors[path]) errors[path] = { type, message };

    if (allCriteria) {
      const types = (errors[path].types ??= {});
      const previous = types[type];
      types[type] = previous === undefined ? message : ([] as string[]).concat(previous, message);
    }
  }

  return errors;
}
