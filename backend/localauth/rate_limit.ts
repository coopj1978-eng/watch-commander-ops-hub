import { APIError } from "encore.dev/api";
import { currentRequest } from "encore.dev";

// ──────────────────────────────────────────────────────────────────────────────
// In-memory sliding-window rate limiter for auth endpoints.
//
// Scope: a single Encore instance. Counters reset on restart — acceptable for
// brute-force protection (restarts are rare; restart-as-attack is non-trivial).
//
// For multi-instance deployments, swap the Map for a Redis/DB-backed store.
// ──────────────────────────────────────────────────────────────────────────────

interface Attempt {
  count: number;
  firstAttempt: number;   // epoch ms of the first attempt in the current window
  blockedUntil?: number;  // epoch ms; if set and in the future, requests are rejected
}

const attempts = new Map<string, Attempt>();

// Periodic cleanup so the Map doesn't grow unbounded.
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, attempt] of attempts.entries()) {
    const windowExpired = now - attempt.firstAttempt > 60 * 60 * 1000;
    const blockExpired = attempt.blockedUntil !== undefined && now > attempt.blockedUntil;
    if (blockExpired || (windowExpired && !attempt.blockedUntil)) {
      attempts.delete(key);
    }
  }
}, 5 * 60 * 1000);
// Allow Node to exit cleanly during tests / process shutdown.
(cleanup as unknown as { unref?: () => void }).unref?.();

export interface RateLimitConfig {
  /** Length of the rolling window in ms. */
  windowMs: number;
  /** Max attempts allowed within the window before blocking. */
  maxAttempts: number;
  /** How long to block once the limit is exceeded, in ms. */
  blockMs: number;
  /** Human-readable label used in the error message (e.g. "sign-in"). */
  label: string;
}

/**
 * Throws APIError.resourceExhausted if `key` is currently rate-limited.
 * Otherwise records an attempt and returns.
 *
 * Call BEFORE performing the actual work so we count every attempt.
 * On success (e.g. correct password) call `resetRateLimit(key)` to clear.
 */
export function rateLimit(key: string, config: RateLimitConfig): void {
  const now = Date.now();
  const attempt = attempts.get(key);

  // Currently blocked
  if (attempt?.blockedUntil && now < attempt.blockedUntil) {
    const waitSec = Math.ceil((attempt.blockedUntil - now) / 1000);
    throw APIError.resourceExhausted(
      `Too many ${config.label} attempts. Please try again in ${formatWait(waitSec)}.`,
    );
  }

  // Window expired or first attempt
  if (!attempt || now - attempt.firstAttempt > config.windowMs) {
    attempts.set(key, { count: 1, firstAttempt: now });
    return;
  }

  // Increment
  attempt.count++;
  if (attempt.count > config.maxAttempts) {
    attempt.blockedUntil = now + config.blockMs;
    const waitSec = Math.ceil(config.blockMs / 1000);
    throw APIError.resourceExhausted(
      `Too many ${config.label} attempts. Please try again in ${formatWait(waitSec)}.`,
    );
  }
}

/** Clears the counter for a key — call on successful auth so good users don't rack up. */
export function resetRateLimit(key: string): void {
  attempts.delete(key);
}

/**
 * Extracts the caller's IP address from request headers.
 * Falls back to "unknown" if not inside an API request.
 *
 * Encore Cloud / Vercel / most proxies set X-Forwarded-For with the client IP first.
 */
export function getRequestIp(): string {
  const req = currentRequest();
  if (!req || req.type !== "api-call") return "unknown";

  const xff = req.headers["x-forwarded-for"];
  if (xff) {
    const first = Array.isArray(xff) ? xff[0] : xff;
    const ip = first.split(",")[0]?.trim();
    if (ip) return ip;
  }

  const realIp = req.headers["x-real-ip"];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  return "unknown";
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const mins = Math.ceil(seconds / 60);
  return mins === 1 ? "1 minute" : `${mins} minutes`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Standard configs for the auth endpoints.
// ──────────────────────────────────────────────────────────────────────────────

/** Sign-in: 5 failures per email per 15 min, then 15-min cooldown. */
export const SIGNIN_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  maxAttempts: 5,
  blockMs: 15 * 60 * 1000,
  label: "sign-in",
};

/** Sign-up: 20 per IP per hour, then 1-hour cooldown. */
export const SIGNUP_LIMIT: RateLimitConfig = {
  windowMs: 60 * 60 * 1000,
  maxAttempts: 20,
  blockMs: 60 * 60 * 1000,
  label: "sign-up",
};

/** Forgot-password: 3 per email per hour, then 1-hour cooldown. */
export const FORGOT_PASSWORD_LIMIT: RateLimitConfig = {
  windowMs: 60 * 60 * 1000,
  maxAttempts: 3,
  blockMs: 60 * 60 * 1000,
  label: "password reset request",
};

/** Reset-password: 5 attempts per token per hour (defence against token brute force). */
export const RESET_PASSWORD_LIMIT: RateLimitConfig = {
  windowMs: 60 * 60 * 1000,
  maxAttempts: 5,
  blockMs: 60 * 60 * 1000,
  label: "password reset",
};

/**
 * Change-password: 5 attempts per user per 15 min, then 15-min cooldown.
 * Defends against a stolen session being used to brute-force the *current*
 * password (e.g. to satisfy a "know current password" prompt for elevation).
 * Same shape as SIGNIN_LIMIT — same risk profile.
 */
export const CHANGE_PASSWORD_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  maxAttempts: 5,
  blockMs: 15 * 60 * 1000,
  label: "password change",
};
