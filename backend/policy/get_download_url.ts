import { api, APIError } from "encore.dev/api";
import db from "../db";
import { policyDocuments } from "../storage";
import type { PolicyDoc } from "./types";

interface GetDownloadUrlRequest {
  id: number;
}

interface GetDownloadUrlResponse {
  download_url: string;
}

export const getDownloadUrl = api<GetDownloadUrlRequest, GetDownloadUrlResponse>(
  { expose: true, method: "GET", path: "/policies/:id/download-url", auth: true },
  async ({ id }) => {
    const doc = await db.queryRow<PolicyDoc>`
      SELECT * FROM policy_docs WHERE id = ${id}
    `;

    if (!doc) {
      throw APIError.notFound("policy document not found");
    }

    await db.exec`
      UPDATE policy_docs
      SET updated_at = NOW()
      WHERE id = ${id}
    `;

    const { url } = await policyDocuments.signedDownloadUrl(doc.file_path, {
      ttl: 3600,
    });

    return {
      download_url: url,
    };
  }
);
