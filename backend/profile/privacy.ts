// Profiles carry two old note fields (`notes`, `lastConversation`) from
// before Notes & 1:1s became private to whoever wrote them. They have no
// author, so nobody can be "the writer" — they're never returned.
export function withoutLegacyNotes<P extends { notes?: string; lastConversation?: unknown }>(profile: P): P {
  const { notes: _notes, lastConversation: _lastConversation, ...rest } = profile;
  return rest as P;
}
