// react-hook-form resolver for Zod 4 schemas.
//
// Replaces `zodResolver` from "@hookform/resolvers/zod" (3.x), which does not
// support Zod 4: it detects a validation failure via `ZodError.errors`, which
// Zod 4 removed, so every invalid submission threw a ZodError out of
// handleSubmit - no field errors, no messages (REG-003 / REG-004). Valid
// submissions were unaffected, which is why it went unnoticed.
//
// Same behaviour as the 3.x resolver otherwise: parses with the schema,
// returns the parsed data on success, and field errors (first message per
// field; all messages with criteriaMode "all") on failure. Non-validation
// errors still propagate.
//
// Can be dropped in favour of the official resolver once
// @hookform/resolvers is upgraded to a Zod 4-compatible major (5.x).

import { toNestErrors, validateFieldsNatively } from "@hookform/resolvers";
import type { FieldErrors, FieldValues, Resolver, ResolverResult } from "react-hook-form";
import type { ZodType } from "zod";
import { zodIssuesToFieldErrors } from "./zodFormErrors";

export function zodResolver<TFieldValues extends FieldValues, TContext = any>(
  schema: ZodType,
): Resolver<TFieldValues, TContext> {
  return async (values, _context, options): Promise<ResolverResult<TFieldValues>> => {
    const result = await schema.safeParseAsync(values);

    if (result.success) {
      if (options.shouldUseNativeValidation) validateFieldsNatively({}, options);
      return { values: result.data as TFieldValues, errors: {} };
    }

    const flat = zodIssuesToFieldErrors(
      result.error.issues,
      !options.shouldUseNativeValidation && options.criteriaMode === "all",
    );
    return { values: {}, errors: toNestErrors(flat as unknown as FieldErrors, options) };
  };
}
