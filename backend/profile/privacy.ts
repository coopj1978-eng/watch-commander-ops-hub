// Profiles carry two old note fields (`notes`, `lastConversation`) from
// before Notes & 1:1s became private to whoever wrote them. They have no
// author, so nobody can be "the writer" — they're never returned.
export function withoutLegacyNotes<P extends { notes?: string; lastConversation?: unknown }>(profile: P): P {
  const { notes: _notes, lastConversation: _lastConversation, ...rest } = profile;
  return rest as P;
}

/**
 * Phone numbers and emergency contacts go only to the person themselves and
 * to a WC/CC (John, 8 Nov 2026: "CC/WC viewable at the moment, that may
 * change"). Everyone else gets the profile without them.
 */
export function contactsFor<P extends { user_id: string; phone?: string; emergency_contact_name?: string; emergency_contact_phone?: string }>(
  profile: P,
  viewer: { userID: string; isManager: boolean },
): P {
  if (viewer.isManager || profile.user_id === viewer.userID) return profile;
  const { phone: _phone, emergency_contact_name: _name, emergency_contact_phone: _contact, ...rest } = profile;
  return rest as P;
}
