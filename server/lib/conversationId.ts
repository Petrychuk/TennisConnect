// Deterministic id for the conversation between two users. Moved here
// unchanged from server/services/systemMessages.ts (which re-exports it) so
// it can be used without importing storage.
export function pairConversationId(idA: string, idB: string): string {
  return `conv-${[idA, idB].sort().join("-")}`;
}
