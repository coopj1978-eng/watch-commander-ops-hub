-- Notes & 1:1s are private to whoever wrote them (the notes table). These
-- profile-level note fields have no author, so they're cleared and no
-- longer read or written by the app. On staging they only held the Notion
-- import's "Not yet competent — in development" (2 profiles), which John
-- asked to delete (24 Oct 2026). The columns stay.
UPDATE firefighter_profiles
SET notes = NULL,
    last_conversation_date = NULL,
    last_conversation_text = NULL
WHERE notes IS NOT NULL
   OR last_conversation_date IS NOT NULL
   OR last_conversation_text IS NOT NULL;
