import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { canViewProfile } from "../auth/rbac";
import type { ListDocumentsResponse, ProfileDocument } from "./types";

interface ListDocumentsRequest {
  profile_id: number;
}

export const list = api(
  { auth: true, expose: true, method: "GET", path: "/documents/:profile_id" },
  async ({ profile_id }: ListDocumentsRequest): Promise<ListDocumentsResponse> => {
    const auth = getAuthData()!;

    const profile = await db.queryRow<{ user_id: string }>`
      SELECT user_id FROM firefighter_profiles WHERE id = ${profile_id}
    `;

    if (!profile) {
      throw APIError.notFound("Profile not found");
    }

    if (!canViewProfile(auth, profile.user_id)) {
      throw APIError.permissionDenied("Cannot view documents for this profile");
    }

    const documents: ProfileDocument[] = [];
    for await (const doc of db.query<ProfileDocument>`
      SELECT * FROM profile_documents
      WHERE profile_id = ${profile_id}
      ORDER BY uploaded_at DESC
    `) {
      documents.push(doc);
    }

    return { documents };
  }
);
