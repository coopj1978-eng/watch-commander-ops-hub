// ──────────────────────────────────────────────────────────────────────────────
// Security headers for the static frontend.
//
// When we dropped Vercel we lost the automatic headers it used to set. This
// restores a sensible hardening baseline for the Encore-served SPA:
//
// - CSP locks down every fetch destination to 'self' with the minimum
//   exceptions needed by the current app (inline styles for Tailwind/React
//   style props, data: URIs for SVG icons, https: images).
// - HSTS + frame-ancestors + X-Frame-Options + nosniff + Permissions-Policy
//   close off the common drive-by / clickjacking / fingerprint vectors.
//
// The headers are applied to `api.static` via its `headers` option — Encore
// middleware does NOT run for static responses, so the middleware route
// silently produces nothing.
// ──────────────────────────────────────────────────────────────────────────────

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self'",
  "worker-src 'self'",           // service worker (sw.js)
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":   CSP,
  "X-Content-Type-Options":    "nosniff",
  "X-Frame-Options":           "DENY",
  "Referrer-Policy":           "strict-origin-when-cross-origin",
  "Permissions-Policy":        "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};
