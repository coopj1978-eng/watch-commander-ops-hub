import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/App";
import InspectionAssignments from "@/components/InspectionAssignments";
import { QuarterStrip } from "@/components/targets/QuarterStrip";
import { HfsvCard } from "@/components/targets/HfsvCard";
import { CommunityCard } from "@/components/targets/CommunityCard";
import { HydrantCard, MultiStoryCard } from "@/components/targets/InspectionCards";
import { STATION_WATCHES, StationComparison } from "@/components/targets/StationComparison";
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
  const ownWatch = user?.watch_unit ?? "";
  const isManager = user?.role === "WC" || user?.role === "CC";

  const now = currentFyQuarter();
  const [params, setParams] = useSearchParams();
  // WCs and CCs can see the whole station (?view=station) and open any
  // watch's cards (?w=Red) — read-only for watches other than their own.
  const station = isManager && params.get("view") === "station";
  const wParam = params.get("w");
  const watch = isManager && wParam && (STATION_WATCHES as readonly string[]).includes(wParam) ? wParam : ownWatch;
  const otherWatch = watch.toLowerCase() !== ownWatch.toLowerCase();
  const canEdit = isManager && !otherWatch;
  const fy = Number(params.get("fy")) || now.fy;
  const qParam = Number(params.get("q"));
  const q = (qParam >= 1 && qParam <= 4 ? qParam : fy === now.fy ? now.q : 1) as QuarterNo;
  const fq = useMemo(() => fyQuarter(fy, q), [fy, q]);
  const time = quarterTime(fq);
  const shifts = time.phase === "past" ? null : shiftsLeft(watch, fq);

  const select = (next: { fy?: number; q?: QuarterNo; view?: "station" | null; w?: string | null }) => {
    const p = new URLSearchParams(params);
    p.set("fy", String(next.fy ?? fy));
    p.set("q", String(next.q ?? q));
    if (next.view !== undefined) { if (next.view) p.set("view", next.view); else p.delete("view"); }
    if (next.w !== undefined) { if (next.w && next.w !== ownWatch) p.set("w", next.w); else p.delete("w"); }
    setParams(p, { replace: true });
  };

  return (
    <div className="flex flex-col" style={{ gap: "var(--gap-section)" }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <div className="eyebrow">{station ? "B10 Springburn · all watches" : watch ? `${watch} Watch` : "No watch set"} · FY {fyLabel(fy)}</div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">Targets</h1>
            {isManager && (
              <div className="seg" style={{ width: 210 }} role="group" aria-label="Show">
                <button data-on={!station} onClick={() => select({ view: null })}>{watch || "My"} Watch</button>
                <button data-on={station} onClick={() => select({ view: "station" })}>Station</button>
              </div>
            )}
          </div>
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

      {/* ── Looking at another watch (from the Station view) ──────────── */}
      {otherWatch && !station && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/40 px-4 py-2.5 text-sm">
          <span>
            Viewing <span className="font-semibold">{watch} Watch</span>
            <span className="text-muted-foreground"> — read only; their WC or CC logs their targets.</span>
          </span>
          <span className="flex gap-3 text-xs font-medium">
            <button className="text-brand hover:underline" onClick={() => select({ view: "station" })}>← Station</button>
            <button className="text-brand hover:underline" onClick={() => select({ w: null })}>Back to {ownWatch} Watch</button>
          </span>
        </div>
      )}

      {/* ── The year: pick a quarter ───────────────────────────────────── */}
      <QuarterStrip
        watch={watch}
        fy={fy}
        selected={q}
        onSelect={(next) => select({ q: next })}
        onFy={(next) => select({ fy: next, q: next === now.fy ? now.q : 4 })}
      />

      {station ? (
        /* ── Every watch side by side ─────────────────────────────────── */
        <StationComparison fq={fq} ownWatch={ownWatch} onPick={(w) => select({ view: null, w })} />
      ) : (
        <>
          {/* ── This quarter's targets ─────────────────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <HfsvCard watch={watch} fq={fq} canEdit={canEdit} />
            <CommunityCard watch={watch} fq={fq} canEdit={canEdit} />
            <MultiStoryCard watch={watch} fq={fq} canEdit={canEdit} />
            <HydrantCard watch={watch} fq={fq} />
          </div>

          {/* ── Annual inspections (care homes, operational) ──────────────── */}
          {!otherWatch && (
            <InspectionAssignments
              financialYear={fy}
              quarter={q}
              year={fq.start.getFullYear()}
              exclude={["multistory", "hydrant"]}
            />
          )}
        </>
      )}
    </div>
  );
}
