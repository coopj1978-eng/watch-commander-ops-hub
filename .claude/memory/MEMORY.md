# Watch Commander Ops Hub — Project Memory

## App Overview
A firefighter crew management and operations platform for fire stations. Covers personnel, absences, tasks, inspections, equipment checks, targets, policies, and reporting. Built with React 19 + TypeScript + Vite + TailwindCSS + Encore.dev backend + PostgreSQL + Clerk auth.

---

## Feature Backlog (Ordered: Simplest → Most Complex)

| # | Feature | Status |
|---|---------|--------|
| 1 | Search (client-side filtering) | ⬜ Pending |
| 2 | Dashboard Widgets (live data on all role dashboards) | ✅ Done |
| 3 | Certification / Qualification Expiry Tracking | ⬜ Pending |
| 4 | Handover Notes | ✅ Done |
| 5 | Notification System (in-app) + Sick Booking | ✅ Done |
| 6 | Mobile Responsiveness | ✅ Done |
| 7 | Policy Q&A (AI) — wire up vector embeddings | ⬜ Pending |
| 8 | Real-time / Live Crew Status board | ⬜ Pending |
| 9 | Reports & Analytics (charts, trends) | ⬜ Pending |
| 10 | Shift Rota / Duty Planning | ⬜ Pending |
| 11 | Audit Trail / Change History | ⬜ Pending |
| 12 | Dispatch / CAD System Integration | ⬜ Pending |

---

## Current Work: #2 — Dashboard Widgets

### Goal
Replace the hardcoded stat cards on the WC (Watch Commander) dashboard with live, real data. Add meaningful at-a-glance widgets.

### Planned Widgets for WC Dashboard
- **Staffing Today** — total crew, on leave, sick, on duty (from `absence.list` + `profile.list`)
- **Tasks Overview** — total, overdue, in progress, completion % (from `task.list`)
- **Upcoming Inspections** — inspections due in next 14 days (from `inspection.list`)
- **Certifications Expiring** — crew certs expiring in 30 days (from `profile.list → certifications[]`)
- **Targets Progress** — current period overall % (from `targets.list`)
- **Sickness Alerts** — staff at trigger stage 1/2/3 (from `profile.list → trigger_stage`)

### Key Files
| Component | Path |
|-----------|------|
| Main Dashboard | `frontend/pages/Dashboard.tsx` |
| Role-based dashboards | `frontend/components/RoleDashboard.tsx` |
| Crew Commander Home | `frontend/pages/CrewCommanderHome.tsx` |
| Personal Dashboard | `frontend/components/PersonalDashboard.tsx` |
| Crew KPIs | `frontend/components/CrewKPIs.tsx` |
| Backend client | `frontend/lib/backend.ts` |
| Generated API types | `frontend/client.ts` |

### Available API Endpoints
- `backend.task.list({ status?, priority?, assigned_to? })` → tasks + total
- `backend.absence.list({ status?, start_date?, end_date? })` → absences + total
- `backend.absence.getStats(user_id)` → sick days, trigger stage, 6-month total
- `backend.inspection.list({ status? })` → inspections + total
- `backend.targets.list({ period_start?, period_end? })` → targets + total
- `backend.profile.list({})` → profiles with certifications[], skills[], trigger_stage
- `backend.crew.getStats()` → total_firefighters, completion_rate, overdue_tasks, upcoming_inspections, overdue_one_to_ones

### Patterns to Follow
- Use `useQuery` from `@tanstack/react-query`
- Use `Card / CardContent / CardHeader / CardTitle` from `@/components/ui/card`
- Use `Skeleton` for loading states
- Grid layout: `grid gap-4 md:grid-cols-2 lg:grid-cols-3`
- Icons from `lucide-react`
- Status colours: green = good, yellow = warning, red = overdue/alert

---

## Notes
- WC dashboard currently shows 4 **hardcoded** stat cards (Total Staff: 24, Active Tasks: 12, Targets Progress: 68%, Policy Queries: 45)
- CC dashboard (`CrewCommanderHome.tsx`) already has real data via `CrewKPIs` — good reference
- All components use JWT from `localStorage.auth_token` via Clerk
