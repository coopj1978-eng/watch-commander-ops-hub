import { api, APIError } from "encore.dev/api";
import db from "../db";
import { noteAttachments } from "../storage";
import { assertNoteAuthor } from "./access";
import type { NoteAttachment } from "./types";

// A file attached to a note comes up through the app itself and goes into
// the private note-attachments bucket (Nov 2026). The browser can't upload
// straight to storage: the site's content security policy only lets it talk
// to the app, so the old signed-upload-URL route never worked.

const MAX_BYTES = 10 * 1024 * 1024; // also the endpoint's bodyLimit (Encore needs a literal there)
const STATUS: Record<string, number> = {
  invalid_argument: 400,
  unauthenticated: 401,
  permission_denied: 403,
  not_found: 404,
};

/** POST /notes/:note_id/files?filename=… with the file as the body. Writer only. */
export const uploadFile = api.raw(
  { auth: true, expose: true, method: "POST", path: "/notes/:note_id/files", bodyLimit: 10485760 },
  async (req, resp) => {
    const send = (status: number, body: unknown) => {
      resp.writeHead(status, { "Content-Type": "application/json" });
      resp.end(JSON.stringify(body));
    };
    try {
      const url = new URL(req.url ?? "", "http://app");
      const noteId = Number(url.pathname.match(/\/notes\/(\d+)\/files/)?.[1]);
      if (!noteId) throw APIError.invalidArgument("Which note?");
      await assertNoteAuthor(noteId);

      const filename = (url.searchParams.get("filename") ?? "file").replace(/[/\\]/g, "_").slice(0, 120) || "file";
      const contentType = String(req.headers["content-type"] ?? "application/octet-stream");

      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BYTES) throw APIError.invalidArgument("Files can be up to 10 MB.");
        chunks.push(Buffer.from(chunk));
      }
      if (!size) throw APIError.invalidArgument("The file is empty.");

      const key = `notes/${noteId}/${Date.now()}-${filename}`;
      await noteAttachments.upload(key, Buffer.concat(chunks), { contentType });

      // No lasting link is stored: the list hands the writer a signed one.
      const attachment: NoteAttachment = {
        filename,
        key,
        url: "",
        fileType: contentType,
        fileSize: size,
        uploadedAt: new Date().toISOString(),
      };
      await db.exec`
        UPDATE notes
        SET attachments = COALESCE(attachments, '[]'::jsonb) || ${JSON.stringify(attachment)}::jsonb
        WHERE id = ${noteId}
      `;
      send(200, { success: true });
    } catch (err) {
      const code = err instanceof APIError ? err.code : "internal";
      if (!(err instanceof APIError)) console.error("Note file upload failed:", err);
      send(STATUS[code] ?? 500, {
        code,
        message: err instanceof APIError ? err.message : "Couldn't save the file.",
        details: null,
      });
    }
  }
);
