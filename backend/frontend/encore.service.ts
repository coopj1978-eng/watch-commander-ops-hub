import { api } from "encore.dev/api";
import { Service } from "encore.dev/service";
import { sentryMiddleware } from "../observability/sentry";

export default new Service("frontend", { middlewares: [sentryMiddleware] });

// ──────────────────────────────────────────────────────────────────────────────
// Security headers for the static frontend.
//
// NOTE: Encore statically analyses api.static() at build time, so the `headers`
// option MUST be an inline object literal — referencing an imported constant
// fails the build ("headers must be an object"). Kept inline for that reason;
// the accompanying doc lives in observability/security_headers.ts.
//
// CSP is tight: self-only with inline styles for Tailwind + React style props,
// data: for icons, https: for images. All other directives locked down. HSTS,
// X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy round out the
// hardening baseline we lost when we moved off Vercel.
// ──────────────────────────────────────────────────────────────────────────────
export const assets = api.static({
  path: "/*path",
  expose: true,
  dir: "./dist",
  notFound: "./dist/index.html",
  notFoundStatus: 200,
  headers: {
    // Encore's static analyser only accepts plain string literals here —
    // string concatenation ("a" + "b") is parsed as an expression and
    // rejected with "header value must be a string or array of strings",
    // hence the single-line CSP.
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; media-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    "X-Content-Type-Options":    "nosniff",
    "X-Frame-Options":           "DENY",
    "Referrer-Policy":           "strict-origin-when-cross-origin",
    "Permissions-Policy":        "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  },
});
