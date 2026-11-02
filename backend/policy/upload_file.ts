import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { policyDocuments } from "../storage";
import { Permission, requirePermission } from "../auth/rbac";

// A policy PDF comes up through the app itself and goes into the private
// policy-documents bucket (Nov 2026). The browser can't upload straight to
// storage: the site's content security policy only lets it talk to the app,
// so the old signed-upload-URL route never worked. Saving the record is still
// a separate step (POST /api/policies) with the file_path this returns.

const MAX_BYTES = 25 * 1024 * 1024; // also the endpoint's bodyLimit (Encore needs a literal there)
const STATUS: Record<string, number> = {
  invalid_argument: 400,
  unauthenticated: 401,
  permission_denied: 403,
};

/** POST /policies/files?filename=… with the PDF as the body. WC only. */
export const uploadFile = api.raw(
  { auth: true, expose: true, method: "POST", path: "/policies/files", bodyLimit: 26214400 },
  async (req, resp) => {
    const send = (status: number, body: unknown) => {
      resp.writeHead(status, { "Content-Type": "application/json" });
      resp.end(JSON.stringify(body));
    };
    try {
      requirePermission(getAuthData()!, Permission.CREATE_POLICIES);

      const url = new URL(req.url ?? "", "http://app");
      const filename = (url.searchParams.get("filename") ?? "document.pdf").replace(/[/\\]/g, "_").slice(0, 120) || "document.pdf";

      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BYTES) throw APIError.invalidArgument("PDFs can be up to 25 MB.");
        chunks.push(Buffer.from(chunk));
      }
      if (!size) throw APIError.invalidArgument("The file is empty.");
      const body = Buffer.concat(chunks);
      if (body.subarray(0, 5).toString("latin1") !== "%PDF-") {
        throw APIError.invalidArgument("Only PDF files can be uploaded.");
      }

      const file_path = `policies/${Date.now()}-${filename}`;
      await policyDocuments.upload(file_path, body, { contentType: "application/pdf" });
      send(200, { file_path, file_size: size });
    } catch (err) {
      const code = err instanceof APIError ? err.code : "internal";
      if (!(err instanceof APIError)) console.error("Policy file upload failed:", err);
      send(STATUS[code] ?? 500, {
        code,
        message: err instanceof APIError ? err.message : "Couldn't save the file.",
        details: null,
      });
    }
  }
);
