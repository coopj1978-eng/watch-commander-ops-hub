import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { attachments } from "../storage";
import type { NoteAttachment } from "./types";

interface UploadNoteAttachmentRequest {
  note_id: number;
  filename: string;
  content_type: string;
}

interface UploadNoteAttachmentResponse {
  upload_url: string;
  file_key: string;
}

export const getUploadUrl = api<UploadNoteAttachmentRequest, UploadNoteAttachmentResponse>(
  { auth: true, expose: true, method: "POST", path: "/notes/:note_id/attachments/upload-url" },
  async ({ note_id, filename, content_type }) => {
    const auth = getAuthData()!;
    
    const fileKey = `notes/${note_id}/${Date.now()}-${filename}`;
    
    const { url } = await attachments.signedUploadUrl(fileKey, {
      ttl: 3600,
    });

    return {
      upload_url: url,
      file_key: fileKey,
    };
  }
);

interface SaveAttachmentRequest {
  note_id: number;
  file_key: string;
  filename: string;
  file_type: string;
  file_size: number;
}

export const saveAttachment = api<SaveAttachmentRequest, { success: boolean }>(
  { auth: true, expose: true, method: "POST", path: "/notes/:note_id/attachments" },
  async ({ note_id, file_key, filename, file_type, file_size }) => {
    const auth = getAuthData()!;
    const db = (await import("../db")).default;

    const publicUrl = attachments.publicUrl(file_key);

    const attachment: NoteAttachment = {
      filename,
      url: publicUrl,
      fileType: file_type,
      fileSize: file_size,
      uploadedAt: new Date().toISOString(),
    };

    await db.exec`
      UPDATE notes
      SET attachments = COALESCE(attachments, '[]'::jsonb) || ${JSON.stringify(attachment)}::jsonb
      WHERE id = ${note_id}
    `;

    return { success: true };
  }
);
