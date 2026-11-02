import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { policyDocuments } from "../storage";
import { logActivity } from "../logging/logger";
import { Permission, requirePermission } from "../auth/rbac";

interface DeletePolicyRequest {
  id: number;
}

interface DeletePolicyResponse {
  success: boolean;
}

/** Removes a policy document for everyone: its record, acknowledgements
 *  (they cascade) and the stored PDF. WC only, like uploading. */
export const deletePolicy = api<DeletePolicyRequest, DeletePolicyResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/policies/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;
    requirePermission(auth, Permission.CREATE_POLICIES);

    const doc = await db.queryRow<{ title: string; file_name: string; file_path: string }>`
      DELETE FROM policy_docs WHERE id = ${id}
      RETURNING title, file_name, file_path
    `;
    if (!doc) {
      throw APIError.notFound("policy document not found");
    }

    // Best effort: the record is already gone. The bucket is versioned, so
    // the stored version is named in the delete; deleting by file name alone
    // would only turn the file into an older version that's still kept.
    try {
      const { version } = await policyDocuments.attrs(doc.file_path);
      await policyDocuments.remove(doc.file_path, { version });
    } catch (err) {
      console.error(`Couldn't remove policy file ${doc.file_path}:`, err);
    }

    await logActivity({
      user_id: auth.userID,
      action: "delete_policy",
      entity_type: "policy",
      entity_id: id.toString(),
      details: { title: doc.title, file_name: doc.file_name },
    });

    return { success: true };
  }
);
