import { ReferenceHolder } from "@/components/references/ReferenceHolder";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, Mail } from "lucide-react";
import backend from "@/lib/backend";
import type { hydrants } from "@/client";
import { ACTION_CODES, INSPECTION_CODES, isFault } from "@/lib/hydrantCodes";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// The fault report (John, Nov 2026): every hydrant on the route that isn't
// fully functional, written out to be emailed away — the app opens a new
// email with it in, or it can be copied or downloaded for an attachment.
// Once it's sent, a WC/CC marks those hydrants reported, so the next report
// only has new ones.

const STATION = "B10 Springburn";
// mailto bodies much longer than this get cut off by some mail apps.
const MAILTO_SAFE = 1800;

type Row = hydrants.RouteHydrant & { inspection: hydrants.HydrantInspection };

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const yn = (v: boolean | null) => (v === null ? "–" : v ? "Y" : "N");
const codeList = (codes: number[], names: Record<number, string>) => codes.map((c) => `${c} ${names[c] ?? ""}`.trim()).join("; ");

function reportText(rows: Row[], watch: string, label: string, year: number): string {
  const lines = [
    `Hydrant fault report — ${STATION}, ${watch} Watch`,
    `Route ${label} · ${year} · ${rows.length} hydrant${rows.length === 1 ? "" : "s"} not fully functional`,
    "",
  ];
  rows.forEach((h, n) => {
    const i = h.inspection;
    lines.push(`${n + 1}. SP ${h.route} #${h.seq} — ${h.street}${h.location ? `, ${h.location}` : ""}${h.ref ? ` (ID ${h.ref})` : ""}`);
    lines.push(`   Inspection: ${codeList(i.inspection_codes, INSPECTION_CODES)}`);
    lines.push(`   Action: ${codeList(i.action_codes, ACTION_CODES) || "–"}`);
    lines.push(`   Lid secured and level: ${yn(i.lid_ok)} · Trip hazard: ${yn(i.trip_hazard)}`);
    if (i.comment) lines.push(`   Comment: ${i.comment}`);
    lines.push(`   Inspected ${date(i.inspected_at)}${i.inspected_by_name ? ` by ${i.inspected_by_name}` : ""}`);
    lines.push("");
  });
  return lines.join("\n");
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function reportCsv(rows: Row[]): string {
  const head = ["Route", "Hydrant", "ID", "Street", "Location", "Inspection codes", "Inspection", "Action codes", "Action",
    "Lid secured", "Trip hazard", "Comment", "Inspected", "Inspected by"];
  const body = rows.map((h) => {
    const i = h.inspection;
    return [
      `SP ${h.route}`, h.seq, h.ref, h.street, h.location,
      i.inspection_codes.join(" "), codeList(i.inspection_codes, INSPECTION_CODES),
      i.action_codes.join(" "), codeList(i.action_codes, ACTION_CODES),
      yn(i.lid_ok), yn(i.trip_hazard), i.comment, date(i.inspected_at), i.inspected_by_name,
    ].map(csvCell).join(",");
  });
  return [head.join(","), ...body].join("\r\n");
}

export function HydrantReport({
  open, onOpenChange, data, canMark,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: hydrants.HydrantRouteResponse;
  canMark: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const faults = useMemo(
    () => data.routes.flatMap((r) => r.hydrants).filter((h): h is Row => !!h.inspection && h.in_use && isFault(h.inspection)),
    [data],
  );
  const fresh = faults.filter((h) => !h.inspection.reported_at);
  const [which, setWhich] = useState<"new" | "all">(fresh.length ? "new" : "all");
  const rows = which === "new" ? fresh : faults;
  const label = data.label ?? "";
  const text = reportText(rows, data.watch, label, data.year);
  const subject = `Hydrant fault report — ${STATION}, ${data.watch} Watch, ${label}, ${data.year}`;

  const mark = useMutation({
    mutationFn: () => backend.hydrants.markHydrantsReported({ year: data.year, hydrant_ids: fresh.map((h) => h.id) }),
    onSuccess: (r) => {
      toast({ title: `Marked ${r.marked} hydrant${r.marked === 1 ? "" : "s"} as reported` });
      qc.invalidateQueries({ queryKey: ["hydrants"] });
      onOpenChange(false);
    },
    onError: (err) => toast({ title: "Couldn't mark them reported", description: err instanceof Error ? err.message : undefined, variant: "destructive" }),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Report copied", description: "Paste it into your email." });
    } catch {
      toast({ title: "Couldn't copy — select the text and copy it instead", variant: "destructive" });
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([reportCsv(rows)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `Hydrant faults ${data.watch} ${label.replace(/\s+/g, "")} ${data.year}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  const long = text.length > MAILTO_SAFE;

  const btn = "inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Hydrant fault report</DialogTitle>
          <DialogDescription>
            {data.watch} Watch · {label} · {data.year} — every hydrant that isn't fully functional, ready to email.
          </DialogDescription>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            Hydrant defect reporting is a Reference 2 duty: <ReferenceHolder refNo={2} />
          </p>
        </DialogHeader>

        <div className="seg w-full sm:w-[320px]" role="group" aria-label="Which hydrants">
          <button data-on={which === "new"} onClick={() => setWhich("new")}>Not reported yet ({fresh.length})</button>
          <button data-on={which === "all"} onClick={() => setWhich("all")}>All {data.year} ({faults.length})</button>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
            {which === "new" ? "Nothing new to report — every fault has been reported." : "No faults on this route this year."}
          </p>
        ) : (
          <>
            <pre className="max-h-[45vh] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed">{text}</pre>
            <div className="flex flex-wrap gap-2">
              <a href={mailto} className={`${btn} border-foreground/70 bg-foreground text-background hover:bg-foreground/90`}>
                <Mail className="h-4 w-4" /> Open in email
              </a>
              <button type="button" onClick={copy} className={btn}><Copy className="h-4 w-4" /> Copy</button>
              <button type="button" onClick={download} className={btn}><Download className="h-4 w-4" /> Download (.csv)</button>
            </div>
            {long && (
              <p className="text-xs text-muted-foreground">
                It's a long report — if your email arrives cut short, use Copy and paste it in, or attach the .csv.
              </p>
            )}
          </>
        )}

        {canMark && fresh.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">Sent it? Mark these so the next report only has new ones.</span>
            <button type="button" onClick={() => mark.mutate()} disabled={mark.isPending} className={btn}>
              {mark.isPending ? "Marking…" : `Mark ${fresh.length} as reported`}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
