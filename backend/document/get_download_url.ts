import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { attachments } from "../storage";
import { canViewProfile } from "../auth/rbac";
import type { GetDownloadUrlResponse } from "./types";

interface GetDownloadUrlRequest {
  document_id: number;
}

export const getDownloadUrl = api(
  { auth: true, expose: true, method: "GET", path: "/documents/:document_id/download-url" },
  async ({ document_id }: GetDownloadUrlRequest): Promise<GetDownloadUrlResponse> => {
    const auth = getAuthData()!;

    const document = await db.queryRow<{ storage_key: string; profile_id: number }>`
      SELECT storage_key, profile_id FROM profile_documents WHERE id = ${document_id}
    `;

    if (!document) {
      throw APIError.notFound("Document not found");
    }

    const profile = await db.queryRow<{ user_id: string }>`
      SELECT user_id FROM firefighter_profiles WHERE id = ${document.profile_id}
    `;

    if (!profile) {
      throw APIError.notFound("Profile not found");
    }

    if (!canViewProfile(auth, profile.user_id)) {
      throw APIError.permissionDenied("Cannot access this document");
    }

    const { url } = await attachments.signedDownloadUrl(document.storage_key, {
      ttl: 3600,
    });

    return { download_url: url };
  }
);
