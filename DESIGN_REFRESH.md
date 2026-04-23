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
- [x] **Compact top bar** — greeting replaced with a breadcrumb
      ("Ops / {Current Page}") plus a watch/shift/duty pill
      (`● White Watch · 08:00–18:00 · 11 on / 1 off`) that's hidden
      on the dashboard where the OperationalStatusBar already
      covers it. Notification bell drawer preserved verbatim. Added
      a jump-to-page search (⌘K to focus) that filters the nav
      registry. — commit _(next push)_

_Together these were the single biggest "this looks like a different
app" change. No feature logic touched — purely a re-skin of
SidebarNav + TopBar._

---

## 🎯 Phase 2 — Dashboard densification

- [x] **4-KPI tile row** — Tasks on watch / HFSV this quarter /
      Absence today / Alerts rendered as a tight 4-tile row above the
      Operational Status section. Every tile pulls from existing query
      caches (wc-crew-stats, wc-hfsv, wc-profiles, wc-absences-today,
      wc-sickness-triggers, wc-skills-expiring) so zero extra network
      traffic. Alert tile gets a red-tinted border when count > 0.
      Tiles are clickable — navigate to /tasks, /targets, /people.
      Sparklines and "+3 vs last shift" trend deltas deliberately
      skipped — we have no historical series endpoint; adding them is
      a separate backend task. — commit _(next push)_
- [x] **Crew-on-watch table** — new CrewOnWatchTable component added
      as its own "Crew on Watch" section between Operational Status
      and Today's Shift. Read-only table: Name / Rank / Service # /
      Driver / Quals / Status with on-duty sort at the top, Stage 3
      / Sick / Leave highlighted via coloured badges. Joins three
      existing query caches (crewing-roster, wc-profiles,
      wc-absences-today) so no extra network traffic. Does NOT
      replace the interactive Crewing board at /handover — this is
      the at-a-glance read view; that page is still the editing
      surface. — commit _(next push)_
- [x] **Compact targets sidebar** — new TargetsCompact component
      added inside the Performance Targets section, rendered above
      the existing widget grid. Tight full-width list of 4 metrics
      (HFSV / High-Rise / Hydrant / Community) with label, progress
      bar, actual/target, and pace pill (On pace / Slightly behind /
      Behind / Complete / No target). Period label shows the current
      SFRS financial quarter + day-of-quarter counter in the header.
      All 4 queries reuse the caches of the individual widgets below
      so no extra network traffic. Mockup's 'Training Certifications'
      and 'Local Property Visits' deliberately skipped — both are
      fictional in the mockup and we have no data source. — commit
      _(next push)_

---

## 🧹 Editorial cleanup

- [x] **Drop redundant dashboard widgets** — command strip removed
      (watch/date/shift now live in the TopBar + status bar);
      WCTasksWidget removed (KPI row covers it); WCHFSVWidget /
      WCCommunityWidget / WCMultiStoryWidget removed (TargetsCompact
      covers all three). Layout customisation preserved via a small
      Reset-layout link that only appears when the WC has re-ordered
      things. Widget components left on disk so they can be
      re-surfaced if we add a widget picker later.

## 🎯 Phase 3 — Polish & theming

- [ ] **Global search bar** — top-of-page "Search crew, tasks, SOPs..."
      input that routes to the right page with a query param. _~1.5 hr
      for UI; backend search is its own build._
- [x] **Muted palette refinements** — decorative `indigo-500` /
      `purple-500` top-borders + icon tints on dashboard widgets,
      settings links, and CrewOnWatchTable avatar gradient all swapped
      to `--brand`. Semantic colours (red for overdue/expired/Stage 3,
      amber/orange for warnings, green for all-clear, blue for
      InProgress) preserved everywhere. TargetsCompact demoted from
      HFSV-orange to brand since it's a multi-metric summary, not
      HFSV-specific. Affects ~15 widget files + 3 page headers. Net:
      picking Oxblood / Teal / Forest in Settings now repaints the
      whole dashboard, not just the sidebar and avatar. — commit
      _(next push)_
- [x] **Accent picker** — 6-colour picker (indigo / oxblood / blue /
      teal / forest / amber) in a new Appearance tab on Settings,
      stored per-device in localStorage. Swaps --brand +
      --brand-bright CSS variables via `data-accent` on <html>.
      Applied to the sidebar brand mark, active nav state, TopBar
      avatar, watch-pill dot, and mobile bottom-nav active indicator.
      Widget colours and status pills deliberately untouched — they
      still do semantic signalling. — commit _(next push)_
- [x] **Density switcher** — 3 options (Compact / Comfortable /
      Airy) in the Appearance tab. Flexes section gap + vertical
      padding inside dashboard cards (KPI row, status bar cells,
      targets rows) + table row padding (Crew on Watch body rows)
      via --gap-section / --pad-block / --pad-row CSS variables.
      Horizontal padding and font sizes stay fixed. Cleaner 3-var
      token design vs the earlier v1 which had unused --pad-card
      and --row-h. — commit _(next push)_

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
