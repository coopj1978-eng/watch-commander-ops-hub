import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/App";
import InspectionAssignments from "@/components/InspectionAssignments";
import { QuarterStrip } from "@/components/targets/QuarterStrip";
import { HfsvCard } from "@/components/targets/HfsvCard";
import { CommunityCard } from "@/components/targets/CommunityCard";
import { HydrantCard, MultiStoryCard } from "@/components/targets/InspectionCards";
import { currentFyQuarter, fyLabel, fyQuarter, quarterTime, shiftsLeft, type QuarterNo } from "@/lib/quarters";

// Targets — one financial quarter at a time (Nov 2026 redesign).
//
// The quarter strip picks the quarter and shows the whole year at a glance;
// the four cards below show each target against an even pace through the
// quarter, with the actions to log progress right on them; annual inspections
// sit at the bottom. Replaces Year at a Glance + Period Selection + Overall
// Progress + metric cards, which showed the same numbers three ways (and a
// Monthly/Custom period that only ever showed quarter totals).
// The quarter lives in the URL (?fy=2026&q=3) so Back and links work.

export default function Targets() {
  const { user } = useAuth();
  const watch = user?.watch_unit ?? "";
  const canEdit = user?.role === "WC" || user?.role === "CC";

  const now = currentFyQuarter();
  const [params, setParams] = useSearchParams();
  const fy = Number(params.get("fy")) || now.fy;
  const qParam = Number(params.get("q"));
  const q = (qParam >= 1 && qParam <= 4 ? qParam : fy === now.fy ? now.q : 1) as QuarterNo;
  const fq = useMemo(() => fyQuarter(fy, q), [fy, q]);
  const time = quarterTime(fq);
  const shifts = time.phase === "past" ? null : shiftsLeft(watch, fq);

  const select = (next: { fy?: number; q?: QuarterNo }) => {
    const p = new URLSearchParams(params);
    p.set("fy", String(next.fy ?? fy));
    p.set("q", String(next.q ?? q));
    setParams(p, { replace: true });
  };

  return (
    <div className="flex flex-col" style={{ gap: "var(--gap-section)" }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <div className="eyebrow">{watch ? `${watch} Watch` : "No watch set"} · FY {fyLabel(fy)}</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Targets</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{fq.label} · {fq.months}</span>
          {time.phase === "now" && (
            <>
              {" "}— day {time.dayOf} of {time.totalDays} ·{" "}
              <span className="font-mono tabular-nums text-foreground">{time.daysLeft}</span> days
              {shifts !== null && (
                <>
                  , <span className="font-mono tabular-nums text-foreground">{shifts}</span> {watch} shifts left
                </>
              )}
            </>
          )}
          {time.phase === "past" && " — finished"}
          {time.phase === "future" && " — not started"}
        </p>
      </div>

      {/* ── The year: pick a quarter ───────────────────────────────────── */}
      <QuarterStrip
        watch={watch}
        fy={fy}
        selected={q}
        onSelect={(next) => select({ q: next })}
        onFy={(next) => select({ fy: next, q: next === now.fy ? now.q : 4 })}
      />

      {/* ── This quarter's targets ─────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <HfsvCard watch={watch} fq={fq} canEdit={canEdit} />
        <CommunityCard watch={watch} fq={fq} canEdit={canEdit} />
        <MultiStoryCard watch={watch} fq={fq} canEdit={canEdit} />
        <HydrantCard watch={watch} fq={fq} canEdit={canEdit} />
      </div>

      {/* ── Annual inspections (care homes, hydrant route, operational) ── */}
      <InspectionAssignments
        financialYear={fy}
        quarter={q}
        year={fq.start.getFullYear()}
        exclude={["multistory"]}
      />
    </div>
  );
}
