import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { attachments } from "../storage";
import { canEditProfiles } from "../auth/rbac";
import type { GetUploadUrlRequest, GetUploadUrlResponse } from "./types";

export const getUploadUrl = api(
  { auth: true, expose: true, method: "POST", path: "/documents/upload-url" },
  async (req: GetUploadUrlRequest): Promise<GetUploadUrlResponse> => {
    const auth = getAuthData()!;

    if (!canEditProfiles(auth)) {
      throw APIError.permissionDenied("Only WC and CC can upload documents");
    }

    const profile = await db.queryRow<{ id: number }>`
      SELECT id FROM firefighter_profiles WHERE id = ${req.profile_id}
    `;

    if (!profile) {
      throw APIError.notFound("Profile not found");
    }

    const storageKey = `profile-${req.profile_id}/${Date.now()}-${req.file_name}`;

    const document = await db.queryRow<{ id: number }>`
      INSERT INTO profile_documents (
        profile_id,
        uploader_user_id,
        file_name,
        file_type,
        file_size,
        storage_key,
        tags
      ) VALUES (
        ${req.profile_id},
        ${auth.userID},
        ${req.file_name},
        ${req.file_type},
        ${req.file_size},
        ${storageKey},
        ${req.tags || []}
      )
      RETURNING id
    `;

    if (!document) {
      throw APIError.internal("Failed to create document record");
    }

    const { url } = await attachments.signedUploadUrl(storageKey, {
      ttl: 3600,
    });

    return {
      upload_url: url,
      document_id: document.id,
    };
  }
);
