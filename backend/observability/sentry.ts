import * as Sentry from "@sentry/node";
import { secret } from "encore.dev/config";
import { APIError, middleware, HandlerResponse } from "encore.dev/api";
import { appMeta } from "encore.dev";

// ──────────────────────────────────────────────────────────────────────────────
// Sentry integration for the Encore backend.
//
// Why: we want every unhandled error (crashes, promise rejections, and 500s
// returned from API handlers) surfaced in Sentry with request context so we
// can fix problems without waiting for user reports.
//
// Init runs once per process via module side-effect. After that, each service
// opts in by adding `sentryMiddleware` to its service config.
// ──────────────────────────────────────────────────────────────────────────────

const sentryDsnRef = secret("SentryDSN");

function getDsn(): string | undefined {
  try {
    const v = sentryDsnRef();
    return v && v.trim() ? v.trim() : undefined;
  } catch {
    return undefined;
  }
}

let initialized = false;

function initSentry(): void {
  if (initialized) return;
  const dsn = getDsn();
  if (!dsn) {
    console.warn("[sentry] SentryDSN secret not set — error tracking disabled");
    return;
  }

  let env = "development";
  try {
    env = appMeta().environment.name || env;
  } catch {
    // appMeta not available during early init — fall back to dev
  }

  Sentry.init({
    dsn,
    environment: env,
    tracesSampleRate: 0,                // performance tracing off — just errors for now
    sendDefaultPii: false,              // don't auto-send IP / headers / cookies
    beforeSend(event, hint) {
      // Drop expected 4xx APIErrors (invalidArgument, unauthenticated, etc.) —
      // those are user errors, not application bugs. Keep 5xx / internal.
      const err = hint?.originalException;
      if (err instanceof APIError) {
        const isInternal = err.code === "internal" || err.code === "unknown";
        if (!isInternal) return null;
      }
      return event;
    },
  });

  // Catch-all handlers for crashes outside any request. Encore handles
  // request-scoped errors via middleware; these catch bootstrap / async work.
  process.on("uncaughtException", (err) => {
    Sentry.captureException(err);
  });
  process.on("unhandledRejection", (reason) => {
    Sentry.captureException(reason);
  });

  initialized = true;
  console.log(`[sentry] initialised for environment: ${env}`);
}

// Run init at module load — every service that imports this file gets it.
initSentry();

/**
 * Middleware that captures unhandled errors from Encore API handlers and
 * forwards them to Sentry with request context. Does NOT swallow errors —
 * they propagate to Encore's normal error handling.
 *
 * Attach to a service: `new Service("foo", { middlewares: [sentryMiddleware] })`
 */
export const sentryMiddleware = middleware(async (req, next) => {
  try {
    const resp: HandlerResponse = await next(req);
    return resp;
  } catch (err) {
    // Enrich the event with the endpoint + method before capturing.
    const meta = req.requestMeta;
    if (meta?.type === "api-call") {
      Sentry.withScope((scope) => {
        scope.setTag("endpoint", `${meta.api.service}.${meta.api.endpoint}`);
        scope.setTag("http.method", meta.method);
        scope.setContext("request", {
          path: meta.path,
          pathParams: meta.pathParams,
        });
        Sentry.captureException(err);
      });
    } else {
      Sentry.captureException(err);
    }
    throw err;
  }
});

/**
 * Explicitly report an error from a catch block. Use this when you handle an
 * error locally (log it, return a fallback) but still want visibility.
 */
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext("extra", context);
    }
    Sentry.captureException(err);
  });
}
