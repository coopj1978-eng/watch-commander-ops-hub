import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import backend from "@/lib/backend";
import type { shift_adjustments } from "@/client";
import { useToast } from "@/components/ui/use-toast";
import { refreshCalendar } from "@/lib/calendarQueries";
import { KIND_LABEL } from "@/lib/rosterDays";
import { ROSTER_DAYS_KEY } from "./RosterDayDialog";

// WC/CC, under the calendar: the watch's own orange days and purple shifts
// in the dates shown — who might be called in, and who's confirmed (John,
// 25 Nov 2026: "WC must see … orange shifts"; either the person or the
// WC/CC confirms). Nothing shows when the watch has none in these dates.

type RosterDay = shift_adjustments.RosterDay;
const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

function pill(d: RosterDay): { text: string; style: React.CSSProperties } {
  const when = d.day_night ? ` · ${d.day_night}` : "";
  if (d.kind === "orange") {
    return d.confirmed
      ? { text: `Orange${when} · confirmed`, style: { background: "var(--cal-orange-bg)", color: "var(--cal-orange-fg)" } }
      : { text: `Orange${when} · might be called in`, style: { background: "var(--cal-maybe-bg)", color: "var(--cal-maybe-fg)", border: "1px dashed var(--cal-orange-dot)" } };
  }
  if (d.kind === "purple") return { text: `Purple${when}`, style: { background: "var(--cal-purple-bg)", color: "var(--cal-purple-fg)" } };
  return { text: `${KIND_LABEL[d.kind]}${when}`, style: { background: "var(--cal-surface-2)", color: "var(--cal-ink-2)" } };
}

export default function WatchRosterDays({ watch, from, to, meId, onOpen }: {
  watch: string;
  /** YYYY-MM-DD, the dates the calendar is showing. */
  from: string;
  to: string;
  meId: string;
  onOpen: (day: RosterDay) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery({
    queryKey: [ROSTER_DAYS_KEY, "watch", watch, from, to],
    queryFn: () => backend.shift_adjustments.listRosterDays({ from, to, watch }),
    enabled: !!watch,
    staleTime: 60_000,
  });
  const confirm = useMutation({
    mutationFn: (d: RosterDay) => backend.shift_adjustments.confirmRosterDay(d.id, { confirmed: true }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: [ROSTER_DAYS_KEY] });
      refreshCalendar(qc);
      toast({ title: "Orange day confirmed", description: d.user_id === meId ? "Your WC and CC are told." : `${d.user_name} will be told.` });
    },
    onError: (e) => toast({ title: "That didn't save", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" }),
  });

  const days = data?.days ?? [];
  if (days.length === 0) return null;
  const waiting = days.filter((d) => d.kind === "orange" && !d.confirmed).length;

  return (
    <section className="cal-card" aria-label={`${watch} Watch orange and purple days`} style={{ marginTop: 16, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--cal-ink)" }}>Orange and purple days · {watch} Watch</h2>
        <span style={{ fontSize: 12, color: "var(--cal-muted)" }}>
          {waiting > 0 ? `${waiting} orange ${waiting === 1 ? "day" : "days"} not confirmed yet` : "All orange days confirmed"}
        </span>
      </div>
      <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
        {days.map((d) => {
          const p = pill(d);
          return (
            <li
              key={d.id}
              style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 0", borderTop: "1px solid var(--cal-line)" }}
            >
              <button
                type="button"
                onClick={() => onOpen(d)}
                className="cal-focus"
                style={{
                  flex: "1 1 220px", minWidth: 0, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", border: "none",
                  background: "transparent", padding: 0, font: "inherit", textAlign: "left", cursor: "pointer", color: "var(--cal-ink)",
                }}
              >
                <span className="cal-mono" style={{ width: 92, flex: "none", fontSize: 13, color: "var(--cal-ink-2)" }}>{shortDay(d.day)}</span>
                <span style={{ fontSize: 14, fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.user_name}</span>
                <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap", ...p.style }}>{p.text}</span>
              </button>
              {d.kind === "orange" && !d.confirmed && (
                <button
                  type="button"
                  className="cal-btn tap-chip"
                  disabled={confirm.isPending}
                  onClick={() => confirm.mutate(d)}
                  style={{ height: 34, padding: "0 12px", fontSize: 13 }}
                >
                  Confirm in
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
