import { api } from "encore.dev/api";
import { policyDocuments } from "../storage";

interface GetUploadUrlRequest {
  file_name: string;
}

interface GetUploadUrlResponse {
  upload_url: string;
  file_path: string;
}

export const getUploadUrl = api<GetUploadUrlRequest, GetUploadUrlResponse>(
  { expose: true, method: "POST", path: "/policies/upload-url", auth: true },
  async ({ file_name }) => {
    const timestamp = Date.now();
    const file_path = `policies/${timestamp}-${file_name}`;

    const { url } = await policyDocuments.signedUploadUrl(file_path, {
      ttl: 3600,
    });

    return {
      upload_url: url,
      file_path: file_path,
    };
  }
);
