// Image compression helper used when a firefighter uploads a sick line
// photo (and anywhere else we accept user-supplied images). Resizes down
// to a max width, re-encodes as JPEG at ~82% quality, and returns a
// base64 data URL ready to stuff into a Postgres TEXT column.
//
// Keeps photos from iPhones (easily 5-10 MB raw) down to ~200-400 KB
// without visibly hurting quality. If we ever move to object storage
// (S3/R2) this function's output is still a valid data URL the
// uploader can send — just the storage backend would change.
export function compressImage(file: File, maxWidth = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}
