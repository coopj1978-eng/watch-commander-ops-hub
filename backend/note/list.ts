import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { canViewProfile } from "../auth/rbac";
import type { ListNotesResponse, ProfileNote } from "./types";

interface ListNotesRequest {
  profile_id: number;
}

export const list = api(
  { auth: true, expose: true, method: "GET", path: "/notes/:profile_id" },
  async ({ profile_id }: ListNotesRequest): Promise<ListNotesResponse> => {
    const auth = getAuthData()!;

    const profile = await db.queryRow<{ user_id: string }>`
      SELECT user_id FROM firefighter_profiles WHERE id = ${profile_id}
    `;

    if (!profile) {
      throw APIError.notFound("Profile not found");
    }

    if (!canViewProfile(auth, profile.user_id)) {
      throw APIError.permissionDenied("Cannot view notes for this profile");
    }

    const notes: ProfileNote[] = [];
    const query = db.query<ProfileNote>`
      SELECT * FROM profile_notes
      WHERE profile_id = ${profile_id}
      ORDER BY created_at DESC
    `;
    
    for await (const note of query) {
      notes.push(note);
    }

    return { notes };
  }
);
