import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { attachments } from "../storage";
import { canEditProfiles } from "../auth/rbac";

interface DeleteDocumentRequest {
  document_id: number;
}

export const deleteDocument = api(
  { auth: true, expose: true, method: "DELETE", path: "/documents/:document_id" },
  async ({ document_id }: DeleteDocumentRequest): Promise<{ success: boolean }> => {
    const auth = getAuthData()!;

    if (!canEditProfiles(auth)) {
      throw APIError.permissionDenied("Only WC and CC can delete documents");
    }

    const document = await db.queryRow<{ storage_key: string }>`
      SELECT storage_key FROM profile_documents WHERE id = ${document_id}
    `;

    if (!document) {
      throw APIError.notFound("Document not found");
    }

    try {
      await attachments.remove(document.storage_key);
    } catch (error) {
      console.error("Failed to remove document from storage:", error);
    }

    await db.exec`
      DELETE FROM profile_documents WHERE id = ${document_id}
    `;

    return { success: true };
  }
);
