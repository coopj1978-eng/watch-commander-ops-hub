// ──────────────────────────────────────────────────────────────────────────────
// Security headers documentation for the static frontend.
//
// IMPORTANT: The actual header values are inlined in
// backend/frontend/encore.service.ts because Encore statically analyses the
// api.static() options at build time and rejects variable references
// ("headers must be an object"). This file is intentionally documentation-
// only — keep the values here and in encore.service.ts in sync if either
// changes.
//
// Rationale for each header:
//
//   Content-Security-Policy
//     - default-src 'self'                 block any external resource by default
//     - script-src 'self'                  no inline / eval JavaScript
//     - style-src 'self' 'unsafe-inline'   Tailwind + React `style={}` props
//     - img-src 'self' data: https:        inline SVG (data:), external imgs
//     - font-src 'self' data:              base64-embedded fonts
//     - connect-src 'self'                 API is same-origin (Encore)
//     - worker-src 'self'                  service worker (/sw.js)
//     - manifest-src 'self'                PWA manifest
//     - object-src 'none'                  no flash/applet objects
//     - base-uri 'self'                    prevent <base> tag hijacking
//     - form-action 'self'                 forms can only post same-origin
//     - frame-ancestors 'none'             never iframe this app
//
//   Strict-Transport-Security   one-year HSTS with subdomains
//   X-Frame-Options DENY        belt-and-braces with frame-ancestors
//   X-Content-Type-Options      stop MIME-type sniffing
//   Referrer-Policy             only send origin on cross-site nav
//   Permissions-Policy          disable camera / mic / geo / payments / usb
//
// If you loosen the CSP in future, double-check the Sentry/analytics
// integration (connect-src may need their domains) and any third-party
// fonts or images added to the UI.
// ──────────────────────────────────────────────────────────────────────────────

export const SECURITY_HEADERS_DOC = "See inline literal in backend/frontend/encore.service.ts";
