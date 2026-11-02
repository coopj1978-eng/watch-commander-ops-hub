import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { policyDocuments } from "../storage";
import { logActivity } from "../logging/logger";
import { Permission, requirePermission } from "../auth/rbac";
import type { CreatePolicyDocRequest, PolicyDoc } from "./types";

// Saves the record for a PDF already stored by POST /policies/files.
export const upload = api<CreatePolicyDocRequest, PolicyDoc>(
  { auth: true, expose: true, method: "POST", path: "/api/policies" },
  async (req) => {
    const auth = getAuthData()!;
    requirePermission(auth, Permission.CREATE_POLICIES);
    const doc = await db.queryRow<PolicyDoc>`
      INSERT INTO policy_docs (
        title, file_name, file_path, file_size, category, tags,
        version, effective_date, uploaded_by, total_pages
      )
      VALUES (
        ${req.title}, ${req.file_name}, ${req.file_path}, ${req.file_size},
        ${req.category}, ${req.tags}, ${req.version}, ${req.effective_date},
        ${req.uploaded_by}, ${req.total_pages}
      )
      RETURNING *
    `;

    if (!doc) {
      throw new Error("Failed to create policy document");
    }

    await logActivity({
      user_id: auth.userID,
      action: "upload_policy",
      entity_type: "policy",
      entity_id: doc.id.toString(),
      details: { title: doc.title, file_name: doc.file_name },
    });

    return doc;
  }
);
