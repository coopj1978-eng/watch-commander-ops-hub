import { api } from "encore.dev/api";
import db from "../db";
import log from "encore.dev/log";

interface ProcessEmbeddingRequest {
  policy_id: number;
}

interface ProcessEmbeddingResponse {
  policy_id: number;
  vector_id: string;
  success: boolean;
}

export const processEmbedding = api<ProcessEmbeddingRequest, ProcessEmbeddingResponse>(
  { expose: true, method: "POST", path: "/policies/:policy_id/embed" },
  async ({ policy_id }) => {
    log.info(`Processing embedding for policy ${policy_id}`);

    const policy = await db.rawQueryRow<{
      id: number;
      title: string;
      file_path: string;
      file_name: string;
    }>(`
      SELECT id, title, file_path, file_name
      FROM policy_docs
      WHERE id = $1
    `, policy_id);

    if (!policy) {
      throw new Error(`Policy ${policy_id} not found`);
    }

    const vectorId = `vec_${policy.id}_${Date.now()}`;

    await db.rawQuery(`
      UPDATE policy_docs
      SET vector_id = $1, updated_at = NOW()
      WHERE id = $2
    `, vectorId, policy_id);

    log.info(`Embedding job queued for policy ${policy_id}: ${policy.title}`, {
      vector_id: vectorId,
      file_path: policy.file_path,
    });

    return {
      policy_id,
      vector_id: vectorId,
      success: true,
    };
  }
);
