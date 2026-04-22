# Design Refresh — Working List

Selective adoption of the "command-room" visual refresh mockup
(`~/Desktop/watch-commanders-design-v1/`) into the real codebase.
Additive and reversible — each item is scoped to land on its own and
be revertable without touching the others.

Tick items as they ship. Keep changes small, one commit per item
where possible, and always preview on `localhost:5173` before merging.

---

## ✅ Shipped

- [x] **Typography** — IBM Plex Sans (400/500/600/700) as default
      sans-serif, IBM Plex Mono (400/500) as default monospace. Loaded
      from Google Fonts via index.html; set as Tailwind v4 `--font-sans`
      / `--font-mono` theme tokens in index.css. Applied `font-mono` to
      service numbers, phone numbers and handover timestamps. All
      existing `tabular-nums` / `font-mono` stat-card numbers upgraded
      automatically. — commit `a0be7d9`
- [x] **OperationalStatusBar** — 5-cell horizontal bar (Date · Watch ·
      Shift · Strength · Tasks) pinned to the top of the dashboard.
      Reuses existing TanStack query keys so zero extra network fetches.
      — commit `bbf2d81`
- [x] **Tighter corner radii** — global `--radius` token lowered from
      0.625rem to 0.375rem (10px → 6px). Every `rounded-*` utility
      tightens at once. Reversible in one line. — commit `db44e86`
- [x] **LatestHandoverBanner** — thin strip between the alert banner
      and the status bar surfacing the previous shift's handover. Picks
      the first non-empty of Incidents > Outstanding > General notes.
      Colour-coded accent, clickable through to /handover. Renders
      nothing when no handover exists. — commit `db44e86`
- [x] **Clickable status-bar cells** — Shift / Strength / Tasks cells
      are now links to `/handover`, `/people` and `/tasks` respectively.
      Date and Watch stay non-navigable (no natural destination).

---

## 🎯 Phase 1 — Visual shell (biggest before/after impact)

- [x] **Dark sidebar** — gradient replaced with near-black
      `bg-neutral-900` panel. New tight "WC" accent-coloured brand
      mark + "Watch Commander / OPS HUB · STATION A" block. 3
      labelled groups (Operations / Work / Admin) in expanded mode;
      collapsed rail keeps thin dividers. Indigo left-accent bar +
      icon tint on active item. Optional `count` prop added to nav
      items (unused until real counts are wired in a follow-up).
      Mobile drawer + expand/collapse UX preserved.
- [ ] **Compact top bar** — replace the "Good evening, John!" greeting
      with a breadcrumb + watch / shift / duty-count pills (like
      `Blue Watch · 07:00 → 19:00 · 11 on / 1 off`). Move the user
      avatar + notification bell inline. _~1–2 hr_

_Together these are the single biggest "this looks like a different
app" change. No feature logic touched — purely a re-skin of Layout +
SidebarNav + TopBar._

---

## 🎯 Phase 2 — Dashboard densification

- [ ] **4-KPI tile row** — a tight row of four metric tiles (Tasks on
      watch / HFSV this month / Absence today / Alerts) with sparklines
      and trend deltas, matching the mockup. Pulls from existing data
      sources. _~2 hr_
- [ ] **Crew-on-watch table** — a new read-only tabular view on the
      dashboard showing today's crew (Name / Rank / Service # / Driver
      quals / BA quals / Status). Uses the existing roster endpoint.
      Complements the existing drag-and-drop Crewing board — doesn't
      replace it. _~2 hr_
- [ ] **Compact targets sidebar** — tight list of progress bars for
      every KPI with "Day X / 30" header and pace commentary. Replaces
      or supplements the current large HFSV / Community / Multistory
      widget cards. _~1 hr_

---

## 🎯 Phase 3 — Polish & theming

- [ ] **Global search bar** — top-of-page "Search crew, tasks, SOPs..."
      input that routes to the right page with a query param. _~1.5 hr
      for UI; backend search is its own build._
- [ ] **Muted palette refinements** — reduce the variety of accent
      colours used across widgets to match the mockup's minimal
      greyscale + single accent approach. Careful: some colours do
      useful signalling work today (e.g. orange for incidents). _~2 hr_
- [ ] **Accent picker** — 6-colour accent switcher (indigo / oxblood /
      blue / teal / forest / amber) stored per user. _~1 hr_
- [ ] **Density switcher** — compact / comfortable / airy density
      swap via Tailwind custom utilities. _~1 hr_

---

## 🛑 Not planned / deliberately skipped

- **"Alarms (30d)" KPI tile** — the mockup shows alarm call volume,
      but the app doesn't track callout / incident data in that shape.
      Would need a new ingest path. Park until there's real data.
- **"A21 appliance designator"** — mockup fluff; we track B10P1 / B10P2
      call signs already and they're the truth.
- **Wholesale CSS-variable swap** — the mockup uses its own token
      system in a plain CSS file. Porting wholesale into Tailwind v4
      is high risk of visual regressions for little incremental win on
      top of Phase 1 + 2.

---

## Workflow rules

1. **Preview on localhost:5173 first.** Vite hot-reload makes this
   cheap — always eyeball before committing.
2. **One item per commit** where possible. If two land together
   (e.g. radii + banner both happened in `db44e86`), document both
   in the commit body.
3. **Backend-free by default.** Each Phase 1–3 item above is
   specifically scoped to avoid backend changes. If a task turns
   out to need backend work, stop and reassess scope.
4. **Keep this file updated.** When an item ships, tick it with the
   commit SHA. When an item turns out to be bigger than estimated,
   note it.
