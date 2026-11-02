import { Bucket } from "encore.dev/storage/objects";

export const policyDocuments = new Bucket("policy-documents", {
  public: false,
  versioned: true,
});

export const attachments = new Bucket("attachments", {
  public: true,
  versioned: false,
});

// Files attached to Notes & 1:1s. Private: they're only ever handed to the
// note's writer as short-lived signed links (the "attachments" bucket above
// is public, so anyone with a link could open a file).
export const noteAttachments = new Bucket("note-attachments", {
  public: false,
  versioned: false,
});
