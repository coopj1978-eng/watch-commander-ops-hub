import { api, APIError } from "encore.dev/api";

// TEMPORARY: throwaway endpoint to verify Sentry integration on the live
// backend after the first Sentry deploy attempt failed (SentryDSN wasn't set
// in the cloud env yet). DELETE after confirming the test error lands in the
// Sentry dashboard.
export const sentryTestLive = api<void, { ok: boolean }>(
  { expose: true, method: "GET", path: "/admin/sentry-test-live" },
  async () => {
    throw APIError.internal("Sentry live-backend integration test — should appear in Sentry dashboard");
  },
);
