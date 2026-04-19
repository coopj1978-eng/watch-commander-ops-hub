import { api } from "encore.dev/api";
import { Service } from "encore.dev/service";
import { sentryMiddleware } from "../observability/sentry";
import { SECURITY_HEADERS } from "../observability/security_headers";

export default new Service("frontend", { middlewares: [sentryMiddleware] });

// Security headers are applied directly via api.static's `headers` option.
// That's the supported path for static endpoints — middleware isn't invoked
// on static responses, so setting headers through middleware silently does
// nothing. Details (CSP, HSTS, etc.) live in observability/security_headers.
export const assets = api.static({
  path: "/*path",
  expose: true,
  dir: "./dist",
  notFound: "./dist/index.html",
  notFoundStatus: 200,
  headers: SECURITY_HEADERS,
});
