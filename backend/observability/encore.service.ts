import { Service } from "encore.dev/service";

// Observability service exists to host the shared Sentry middleware and
// secret. Encore requires `secret()` calls to live inside a service, so
// this empty service provides the home for sentry.ts.
export default new Service("observability");
