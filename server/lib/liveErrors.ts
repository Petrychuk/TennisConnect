/*
  A TC Live domain rule the request broke (not a bug): the route answers
  with `status` and the message instead of a 500. 400 = the request can't be
  done as sent; 409 = it conflicts with the session's current state (e.g. a
  round is still in progress, or matches have no score yet).
*/
export class LiveRuleError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 409 = 400,
    readonly code?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "LiveRuleError";
  }
}
