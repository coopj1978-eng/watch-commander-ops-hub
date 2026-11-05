import { addDaysIso, ukInstant, ukParts, watchShiftOn } from "./shiftRota";

// The checks a WC sees when a Flexi Day or Head for Head request comes in
// (Nov 2026), and who may sign one. Pure, so they can be tested and so the
// applicant's own preview and the WC's card can't disagree.
//
// The limits are settings (system_settings) because the procedures may
// change; the wording of the procedures themselves stays out of this repo.

export type RequestType = "flexi" | "h4h";
export type DayNight = "Day" | "Night";
export type CheckState = "ok" | "warn" | "fail" | "manual" | "info";

export interface RequestCheck {
  key: string;
  label: string;
  state: CheckState;
  detail: string;
  /** Can't be sent at all like this (the WC would have to decline it). */
  blocks?: boolean;
  /** Crew numbers come from sickness and leave, so only a WC/CC sees them. */
  managersOnly?: boolean;
}

export interface FlexiLimits {
  per_year: number;
  days_ahead: number;
  notice_hours: number;
}

const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T12:00:00Z`) / 86_400_000);
/** Day, night and the next day are consecutive numbers: 1 apart means they touch. */
const slotIndex = (date: string, dn: DayNight) => dayNumber(date) * 2 + (dn === "Night" ? 1 : 0);

export const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function rotaFor(watch: string, date: string) {
  const label = watchShiftOn(watch, date);
  const working = !!label && /Day|Night/.test(label);
  return {
    label,
    working,
    leave: label === "Annual Leave",
    dayNight: (working ? (label!.includes("Night") ? "Night" : "Day") : null) as DayNight | null,
  };
}

export const shiftStart = (date: string, dn: DayNight) => ukInstant(date, dn === "Night" ? 18 : 8);

/** When an authorised flexi must be on Kronos by. */
export function kronosDeadline(date: string, dn: DayNight, noticeHours: number): Date {
  return new Date(shiftStart(date, dn).getTime() - noticeHours * 3_600_000);
}

// ─── Shift clashes ────────────────────────────────────────────────────────────
// A clash: already working that shift. A potential clash: a shift that runs
// straight into this one, such as agreeing a night with a day shift the next
// morning (John, Nov 2026).

export interface Commitment {
  date: string;
  /** Null: an older booking with no Day/Night, so either could be meant. */
  dayNight: DayNight | null;
  what: string;
  /** False for a request nobody has approved yet. */
  firm: boolean;
}

export interface Clash {
  kind: "same_shift" | "runs_into";
  firm: boolean;
  text: string;
}

export function findClashes(i: {
  watch: string | null;
  date: string;
  dayNight: DayNight;
  commitments: Commitment[];
  /** Days they're already booked off their own shift. */
  offDates?: Set<string>;
}): Clash[] {
  const own: Commitment[] = [];
  if (i.watch) {
    for (const d of [addDaysIso(i.date, -1), i.date, addDaysIso(i.date, 1)]) {
      const rota = rotaFor(i.watch, d);
      if (rota.working && !i.offDates?.has(d)) {
        own.push({ date: d, dayNight: rota.dayNight, what: `their own ${rota.label}`, firm: true });
      }
    }
  }

  const target = slotIndex(i.date, i.dayNight);
  const clashes: Clash[] = [];
  for (const c of [...own, ...i.commitments]) {
    const slots: DayNight[] = c.dayNight ? [c.dayNight] : [i.dayNight, i.dayNight === "Day" ? "Night" : "Day"];
    for (const dn of slots) {
      const gap = slotIndex(c.date, dn) - target;
      if (gap === 0) {
        clashes.push({ kind: "same_shift", firm: c.firm, text: `Already on ${c.what} that shift` });
        break;
      }
      if (Math.abs(gap) === 1) {
        const when = gap > 0
          ? `${c.what} starts at ${dn === "Night" ? "18:00" : "08:00"} on ${dayLabel(c.date)}, straight after this shift`
          : `${c.what} finishes at ${dn === "Night" ? "08:00" : "18:00"} on ${dayLabel(dn === "Night" ? addDaysIso(c.date, 1) : c.date)}, straight before this shift`;
        clashes.push({ kind: "runs_into", firm: c.firm, text: when.charAt(0).toUpperCase() + when.slice(1) });
        break;
      }
    }
  }
  return clashes;
}

function clashCheck(key: string, label: string, name: string, clashes: Clash[]): RequestCheck {
  if (clashes.length === 0) return { key, label, state: "ok", detail: `${name} is free, with nothing straight before or after` };
  return {
    key,
    label,
    state: clashes.some((c) => c.firm) ? "fail" : "warn",
    detail: `${name}: ${clashes.map((c) => (c.firm ? c.text : `${c.text} (not yet approved)`)).join(". ")}`,
  };
}

// ─── Skills ───────────────────────────────────────────────────────────────────
export interface Quals {
  oic: boolean;
  ba: boolean;
  prps: boolean;
  driver_lgv: boolean;
  driver_erd: boolean;
  mass_decon: boolean;
  hooklift_operator: boolean;
}

const QUAL_LABEL: Record<keyof Quals, string> = {
  oic: "OIC",
  ba: "BA",
  prps: "PRPS",
  driver_lgv: "LGV",
  driver_erd: "ERD",
  mass_decon: "Mass decon",
  hooklift_operator: "Hooklift",
};

/** What the person being covered has that the person covering doesn't. */
export function missingSkills(applicant: Quals, cover: Quals): string[] {
  return (Object.keys(QUAL_LABEL) as (keyof Quals)[])
    .filter((k) => applicant[k] && !cover[k])
    .map((k) => QUAL_LABEL[k]);
}

// ─── Flexi Day ────────────────────────────────────────────────────────────────
export function flexiChecks(i: {
  watch: string;
  date: string;
  dayNight: DayNight;
  now: Date;
  limits: FlexiLimits;
  /** Flexi days already used or asked for this calendar year, not counting this one. */
  used: number;
  crew?: { available: number; total: number; rideOne: number; rideBoth: number };
  skillsLeft?: { oic: number; drivers: number; ba: number };
  events: string[];
}): RequestCheck[] {
  const checks: RequestCheck[] = [];
  const rota = rotaFor(i.watch, i.date);
  checks.push(
    rota.working
      ? { key: "working_shift", label: "Working shift", state: "ok", detail: `${rota.label} on ${i.watch}'s rota` }
      : { key: "working_shift", label: "Working shift", state: "fail", blocks: true, detail: `${rota.leave ? "Annual leave" : "A rest day"} on ${i.watch}'s rota, so there's no shift to take off` }
  );

  const start = shiftStart(i.date, i.dayNight);
  const deadline = kronosDeadline(i.date, i.dayNight, i.limits.notice_hours);
  const ahead = dayNumber(i.date) - dayNumber(ukParts(i.now).date);
  const by = deadline.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  if (start.getTime() <= i.now.getTime()) {
    checks.push({ key: "timing", label: "Timing", state: "fail", blocks: true, detail: "That shift has already started" });
  } else if (ahead > i.limits.days_ahead) {
    checks.push({ key: "timing", label: "Timing", state: "fail", blocks: true, detail: `${ahead} days ahead. The limit is ${i.limits.days_ahead} days` });
  } else if (deadline.getTime() <= i.now.getTime()) {
    checks.push({ key: "timing", label: "Timing", state: "fail", blocks: true, detail: `Too late. Kronos needs ${i.limits.notice_hours} hours' notice before the shift` });
  } else if (deadline.getTime() - i.now.getTime() < 24 * 3_600_000) {
    checks.push({ key: "timing", label: "Timing", state: "warn", detail: `Tight: on Kronos by ${by}` });
  } else {
    checks.push({ key: "timing", label: "Timing", state: "ok", detail: `${ahead} days ahead. On Kronos by ${by}` });
  }

  const would = i.used + 1;
  const year = i.date.slice(0, 4);
  checks.push(
    would <= i.limits.per_year
      ? { key: "balance", label: "Flexi balance", state: "ok", detail: `This would be ${would} of ${i.limits.per_year} in ${year}` }
      : { key: "balance", label: "Flexi balance", state: "fail", detail: `This would be ${would} in ${year}, over the limit of ${i.limits.per_year}. Needs WC agreement and SC endorsement` }
  );

  if (i.crew) {
    const { available, total, rideOne, rideBoth } = i.crew;
    checks.push(
      available >= rideBoth
        ? { key: "crew", label: "Crew", state: "ok", managersOnly: true, detail: `${available} of ${total} if authorised, enough for both pumps` }
        : available >= rideOne
        ? { key: "crew", label: "Crew", state: "warn", managersOnly: true, detail: `${available} of ${total} if authorised, ${rideBoth - available} short to ride both pumps` }
        : { key: "crew", label: "Crew", state: "fail", managersOnly: true, detail: `${available} of ${total} if authorised, not enough to ride a pump` }
    );
  }
  if (i.skillsLeft) {
    const { oic, drivers, ba } = i.skillsLeft;
    // Both pumps: 2 OIC, 2 drivers, and 5 BA for the seats behind them.
    const short = oic < 2 || drivers < 2 || ba < 5;
    checks.push({
      key: "skills",
      label: "Skills left",
      state: short ? "warn" : "ok",
      managersOnly: true,
      detail: `${oic} OIC, ${drivers} LGV and ${ba} BA left on the watch${short ? ". Check a detached duty could cover it" : ""}`,
    });
  }
  checks.push(
    i.events.length
      ? { key: "events", label: "Events that shift", state: "warn", detail: `${i.events.join(", ")}. Your call if it matters` }
      : { key: "events", label: "Events that shift", state: "ok", detail: "Nothing on the watch or station calendar" }
  );
  return checks;
}

// ─── Head for Head ────────────────────────────────────────────────────────────
export function h4hChecks(i: {
  watch: string;
  date: string;
  dayNight: DayNight;
  applicantName: string;
  applicantQuals: Quals;
  /** Null when the person covering isn't in the app. */
  cover: {
    name: string;
    watch: string | null;
    quals: Quals;
    commitments: Commitment[];
    offDates: Set<string>;
  } | null;
  coverName: string;
  payback?: {
    date: string;
    dayNight: DayNight;
    /** The applicant's own shifts and bookings around the payback date. */
    applicantCommitments: Commitment[];
    applicantOffDates: Set<string>;
  } | null;
}): RequestCheck[] {
  const checks: RequestCheck[] = [];
  const rota = rotaFor(i.watch, i.date);
  checks.push(
    rota.working
      ? { key: "applicant_shift", label: "Shift to swap", state: "ok", detail: `${rota.label} on ${i.watch}'s rota` }
      : rota.leave
      ? { key: "applicant_shift", label: "Shift to swap", state: "info", detail: "Annual leave swap: one request for each shift" }
      : { key: "applicant_shift", label: "Shift to swap", state: "fail", blocks: true, detail: `A rest day on ${i.watch}'s rota, so there's no shift to swap` }
  );

  if (i.cover) {
    checks.push(clashCheck("cover_clash", "Shift clash", i.cover.name, findClashes({
      watch: i.cover.watch,
      date: i.date,
      dayNight: i.dayNight,
      commitments: i.cover.commitments,
      offDates: i.cover.offDates,
    })));
    const missing = missingSkills(i.applicantQuals, i.cover.quals);
    checks.push(
      missing.length === 0
        ? { key: "skills_match", label: "Skills match", state: "ok", detail: `${i.cover.name} has the skills ${i.applicantName} holds` }
        : { key: "skills_match", label: "Skills match", state: "warn", detail: `${i.cover.name} doesn't have: ${missing.join(", ")}` }
    );
  } else {
    checks.push({ key: "cover_clash", label: "Shift clash", state: "manual", detail: `${i.coverName} isn't in the app. Check their Kronos schedule` });
    checks.push({ key: "skills_match", label: "Skills match", state: "manual", detail: `${i.coverName} isn't in the app. Check their skills` });
  }

  if (i.payback) {
    const { date, dayNight } = i.payback;
    const clashes = findClashes({
      watch: i.watch,
      date,
      dayNight,
      commitments: i.payback.applicantCommitments,
      offDates: i.payback.applicantOffDates,
    });
    const check = clashCheck("payback_clash", `Payback ${dayLabel(date)}`, i.applicantName, clashes);
    if (i.cover?.watch && rotaFor(i.cover.watch, date).dayNight !== dayNight) {
      checks.push({ ...check, state: "fail", detail: `${i.cover.name} isn't on a ${dayNight.toLowerCase()} shift that day, so there's nothing to pay back. ${clashes.length ? check.detail : ""}`.trim() });
    } else {
      checks.push(check);
    }
  } else {
    checks.push({ key: "payback", label: "Payback", state: "info", detail: "Not agreed yet. Can be added later" });
  }
  return checks;
}

/** The outcome the checks point to; null when the WC has to look it up. */
export function recommendedH4H(checks: RequestCheck[]): "authorised" | "referred" | "declined" | null {
  if (checks.some((c) => (c.key === "cover_clash" || c.key === "payback_clash") && c.state === "fail")) return "declined";
  const skills = checks.find((c) => c.key === "skills_match");
  if (!skills || skills.state === "manual" || checks.find((c) => c.key === "cover_clash")?.state === "manual") return null;
  return skills.state === "ok" ? "authorised" : "referred";
}

// ─── Who signs ────────────────────────────────────────────────────────────────
// The watch's WC, or its CC when the WC is off (John, Nov 2026); the record
// shows who signed and as what. A WC's own request goes to another WC they
// choose, since the SC isn't in the app yet. Nobody signs their own request
// or a swap they're part of.
export interface RequestViewer {
  id: string;
  role: string;
  watch: string | null;
}

export interface RequestParties {
  user_id: string | null;
  user_role: string;
  watch: string;
  cover_user_id: string | null;
  cover_watch: string | null;
  reviewer_user_id: string | null;
}

const sameWatch = (a: string | null, b: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const isManagerRole = (role: string) => role === "WC" || role === "CC";

export function canDecide(v: RequestViewer, r: RequestParties): boolean {
  if (!isManagerRole(v.role)) return false;
  if (v.id === r.user_id || v.id === r.cover_user_id) return false;
  if (r.user_role === "WC") return v.role === "WC" && (v.id === r.reviewer_user_id || sameWatch(v.watch, r.watch));
  return sameWatch(v.watch, r.watch);
}

/** Who can open the record: the two people, whoever signs, and either watch's WC/CC. */
export function canViewRequest(v: RequestViewer, r: RequestParties): boolean {
  if (v.id === r.user_id || v.id === r.cover_user_id || v.id === r.reviewer_user_id) return true;
  return isManagerRole(v.role) && (sameWatch(v.watch, r.watch) || sameWatch(v.watch, r.cover_watch));
}

/** The applicant can record the Kronos result, as can their watch's WC/CC. */
export function canRecordOutcome(v: RequestViewer, r: RequestParties): boolean {
  return v.id === r.user_id || canDecide(v, r);
}
