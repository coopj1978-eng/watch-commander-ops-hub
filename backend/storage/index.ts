import { Bucket } from "encore.dev/storage/objects";

export const policyDocuments = new Bucket("policy-documents", {
  public: false,
  versioned: true,
});

export const attachments = new Bucket("attachments", {
  public: false,
  versioned: false,
});
