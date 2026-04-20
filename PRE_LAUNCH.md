# Pre-Launch Checklist

Things to do before opening the Watch Commander Ops Hub to real users beyond
your own watch. These are things Claude can't do for you — they involve
external services (Namecheap, Encore Cloud dashboard), real money or
credentials that shouldn't be in source control.

Work through the sections in order — each one depends on the last.

## 1 · Custom domain

**Why**: `staging-watch-commander-ops-hub-8spi.encr.app` looks like a
prototype URL. A real domain (e.g. `watchcommander.co.uk`) signals trust to
anyone you share it with and is cheap to own (~£10/yr).

1. Buy the domain from a registrar — **Namecheap** or **Cloudflare Registrar**
   are both fine. The whole transaction takes ~3 minutes.
2. In Encore Cloud: **App → Settings → Custom Domains → Add Domain** → enter
   the domain.
3. Encore gives you a CNAME record. Copy it, go back to the registrar's DNS
   settings, add the CNAME. Wait 5–30 min for DNS propagation.
4. In Encore Cloud: verify the domain (button appears next to it once DNS
   resolves). Encore auto-provisions a Let's Encrypt TLS cert — usually under
   a minute.
5. Test — visit the new URL, confirm the app loads with a valid https cert.

After this, you can share the clean URL with other WCs. The encr.app URL
keeps working alongside.

## 2 · Production environment

**Why**: right now everything deploys to `staging`. You want a separate
`production` env so you can test risky changes on staging without affecting
real users.

1. Encore Cloud → **App → Environments → Create Environment** → name it
   `production`.
2. Pick a region (UK users → `europe-west2` / London).
3. Encore provisions a fresh PostgreSQL + compute. Takes a few minutes.
4. Deploy to it: Encore will by default push the main branch to every env —
   check its deploy settings and tie `production` to the `main` branch (or a
   `release` branch if you want an extra gating step).
5. Move the custom domain from `staging` → `production` once you've tested
   that prod works end-to-end.

**Important**: prod starts with an empty database. You'll need to:
- Run the migrations (Encore does this automatically).
- Seed initial users (WC admin accounts).  There's a setup script / token
  system already in the app — check `backend/auth` / `backend/admin`.
- Import your watch roster if you want to start with real data.

## 3 · Rotate the JWT secret

**Why**: the JWT secret signs login tokens. It's currently set to the same
value on all environments. Prod should have its own, unpredictable secret so
a leak on staging doesn't compromise prod logins.

1. Generate a fresh secret (48 random bytes, base64):

   ```sh
   openssl rand -base64 48
   ```

2. Set it on the production environment **only**:

   ```sh
   encore secret set --env=production JWTSecret "<paste the generated value>"
   ```

   Encore will prompt for the value — paste it without quotes. Don't commit
   the secret anywhere. Don't log it.

3. (Optional but recommended) rotate it on `staging` too:

   ```sh
   encore secret set --env=staging JWTSecret "<another fresh value>"
   ```

4. After rotating, **every user will need to log in again** because their
   existing tokens no longer verify.  Do this outside a busy shift.

## 4 · CORS lockdown

**Status**: not critical. Because the frontend and backend are served from
the same Encore service (`/api/*` and `/*` on the same origin), the browser
never sends a cross-origin request in normal operation, so CORS is mostly a
non-issue.

`backend/encore.app` currently allows `localhost:5173` and `localhost:4000`
— only needed for local dev.

**Only do this** if you later decide to host the frontend somewhere else
(e.g. a separate Vercel deploy): add the prod origin(s) to
`allow_origins_with_credentials` in `encore.app`.

## 5 · PWA install — already done ✅

On iPhone and Android, users now see a friendly "Install to Home Screen"
prompt after a few page visits. iOS gets step-by-step instructions (Apple
blocks the automatic flow); Android Chrome gets an instant Install button.

Dismissed? It re-appears after 7 days. Once installed, the prompt never
shows again.

## 6 · Other things to do before sharing widely

- **Create real WC admin accounts** for each watch you want to onboard —
  don't reuse the `admin` / test accounts.
- **Seed the five document categories** (Operational Guidance, Policy,
  Safety Bulletin, SOP, Training Material) with a few real SFRS documents
  so the docs page isn't empty.
- **Populate qualifications** on firefighter profiles (Driver, OIC, BA,
  Mass Decon, Hooklift) — the crewing board's amber warnings only fire
  once the data is in.
- **Test handover / task / crewing flows end-to-end on the new domain** —
  same-origin redirects, service worker caching, JWT tokens should all
  behave.
- **Check GDPR / data-handling**: personal data (names, phone numbers,
  absence reasons, sickness records) is in the database. If another watch
  adopts this, confirm with your data-protection officer that the hosting
  region is acceptable and who's the data controller / processor.

## 7 · Monitoring (after launch)

- **Sentry** is already wired up for backend errors. Make sure the
  `SentryDSN` secret is set on production too (same command as JWT).
- **Encore Cloud → Metrics tab** gives you request volume, error rate and
  latency out of the box. Worth glancing at after any deploy.

---

Once 1–3 are done you're in a good place to invite another watch to use it
without embarrassment. Everything else can follow over time.
