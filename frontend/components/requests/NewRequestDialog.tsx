import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { cn } from "@/lib/utils";
import { REQUEST_LABEL } from "@/lib/shiftRequests";
import type { shift_adjustments } from "@/client";
import { CheckList } from "./CheckList";

// Asking for a Flexi Day or a Head for Head. The checks run as you fill it in,
// so you can see a problem before it reaches the WC.

type ReqType = shift_adjustments.RequestType;
type DayNight = shift_adjustments.DayNight;

const WATCHES = ["Red", "White", "Green", "Blue", "Amber"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function Toggle<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 flex-1 rounded-lg border px-3 text-sm font-medium transition-colors",
            value === o.value ? "border-foreground bg-foreground text-background" : "border-border text-foreground hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const DAY_NIGHT: { value: DayNight; label: string }[] = [{ value: "Day", label: "Day" }, { value: "Night", label: "Night" }];

function WatchPerson({ watch, onWatch, person, onPerson, exclude, label }: {
  watch: string;
  onWatch: (w: string) => void;
  person: string;
  onPerson: (id: string) => void;
  exclude?: string;
  label: string;
}) {
  const { data } = useQuery({
    queryKey: ["crewing-roster", watch],
    queryFn: () => backend.crewing.roster({ watch }),
    enabled: !!watch,
  });
  const members = (data?.members ?? []).filter((m) => m.id !== exclude);
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
      <Select value={watch} onValueChange={(w) => { onWatch(w); onPerson(""); }}>
        <SelectTrigger aria-label={`${label}: watch`}><SelectValue placeholder="Watch" /></SelectTrigger>
        <SelectContent>{WATCHES.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={person} onValueChange={onPerson} disabled={!watch}>
        <SelectTrigger aria-label={label}><SelectValue placeholder="Person" /></SelectTrigger>
        <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

export function NewRequestDialog({ open, onClose, initialType = "flexi", defaultDate, onCreated }: {
  open: boolean;
  onClose: () => void;
  initialType?: ReqType;
  defaultDate?: Date;
  onCreated?: (id: number) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isManager = user?.role === "WC" || user?.role === "CC";

  const [type, setType] = useState<ReqType>(initialType);
  const [date, setDate] = useState("");
  const [dayNight, setDayNight] = useState<DayNight>("Day");
  const [forOther, setForOther] = useState(false);
  const [forWatch, setForWatch] = useState("");
  const [forId, setForId] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [coverMode, setCoverMode] = useState<"app" | "other">("app");
  const [coverWatch, setCoverWatch] = useState("");
  const [coverId, setCoverId] = useState("");
  const [coverName, setCoverName] = useState("");
  const [coverPayroll, setCoverPayroll] = useState("");
  const [coverStation, setCoverStation] = useState("");
  const [coverOtherWatch, setCoverOtherWatch] = useState("");
  const [hasPayback, setHasPayback] = useState(false);
  const [paybackDate, setPaybackDate] = useState("");
  const [paybackShift, setPaybackShift] = useState<DayNight>("Day");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setDate(ymd(defaultDate ?? new Date()));
    setDayNight("Day");
    setForOther(false);
    setForWatch("");
    setForId("");
    setReviewer("");
    setCoverMode("app");
    setCoverWatch("");
    setCoverId("");
    setCoverName("");
    setCoverPayroll("");
    setCoverStation("");
    setCoverOtherWatch("");
    setHasPayback(false);
    setPaybackDate("");
    setPaybackShift("Day");
    setNotes("");
  }, [open, initialType, defaultDate]);

  const applicantId = forOther ? forId : user?.id ?? "";
  const { data: forRoster } = useQuery({
    queryKey: ["crewing-roster", forWatch],
    queryFn: () => backend.crewing.roster({ watch: forWatch }),
    enabled: forOther && !!forWatch,
  });
  const applicantRole = forOther ? forRoster?.members.find((m) => m.id === forId)?.system_role : user?.role;
  const needsReviewer = applicantRole === "WC";

  const { data: reviewerData } = useQuery({
    queryKey: ["shift-requests", "reviewers"],
    queryFn: () => backend.shift_adjustments.listReviewers(),
    enabled: open && needsReviewer,
  });
  const reviewers = (reviewerData?.reviewers ?? []).filter((r) => r.id !== applicantId);

  const coverReady = type === "flexi" || (coverMode === "app" ? !!coverId : !!coverName.trim());
  const applicantReady = !forOther || !!forId;
  const paybackReady = !(type === "h4h" && hasPayback) || !!paybackDate;

  const draft: shift_adjustments.RequestDraft = {
    type,
    shift_date: date,
    day_night: dayNight,
    for_user_id: forOther ? forId : undefined,
    cover_user_id: type === "h4h" && coverMode === "app" ? coverId || undefined : undefined,
    cover_name: type === "h4h" && coverMode === "other" ? coverName.trim() || undefined : undefined,
    payback_date: type === "h4h" && hasPayback ? paybackDate || undefined : undefined,
    payback_day_night: type === "h4h" && hasPayback ? paybackShift : undefined,
  };

  const { data: preview, error: previewError } = useQuery({
    queryKey: ["shift-requests", "preview", draft],
    queryFn: () => backend.shift_adjustments.previewRequest(draft),
    enabled: open && !!date && applicantReady && coverReady && paybackReady,
    placeholderData: keepPreviousData,
    retry: false,
  });

  const blocked = preview?.checks.some((c) => c.blocks);
  const canSend = !!date && applicantReady && coverReady && paybackReady && !blocked && (!needsReviewer || !!reviewer);

  const create = useMutation({
    mutationFn: () => backend.shift_adjustments.createRequest({
      ...draft,
      notes: notes.trim() || undefined,
      reviewer_user_id: needsReviewer ? reviewer : undefined,
      cover_payroll: coverMode === "other" ? coverPayroll.trim() || undefined : undefined,
      cover_station: coverMode === "other" ? coverStation.trim() || undefined : undefined,
      cover_watch: coverMode === "other" ? coverOtherWatch || undefined : undefined,
    }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["shift-requests"] });
      toast({
        title: "Request sent",
        description: d.request.status === "with_cover"
          ? `${d.request.cover_name} has been asked to confirm. It goes to the WC after that.`
          : "It's with the WC to review. You'll get a notification with the decision.",
      });
      onCreated?.(d.request.id);
      onClose();
    },
    onError: (err: Error) => toast({ title: "Couldn't send it", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 pb-3 pt-5 text-left">
          <DialogTitle className="text-base">New request</DialogTitle>
          <DialogDescription>
            The WC reviews it here first. If it's authorised, you then submit it on Kronos.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[75vh] space-y-4 overflow-y-auto px-5 py-4">
          <Toggle label="Type of request" value={type} onChange={setType} options={[
            { value: "flexi", label: REQUEST_LABEL.flexi },
            { value: "h4h", label: REQUEST_LABEL.h4h },
          ]} />

          {isManager && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={forOther} onCheckedChange={(v) => { setForOther(!!v); setForId(""); setReviewer(""); }} />
                Raise this for someone else
              </label>
              {forOther && <WatchPerson label="Who it's for" watch={forWatch} onWatch={setForWatch} person={forId} onPerson={setForId} />}
            </div>
          )}

          <div>
            <Label htmlFor="req-date" className="text-sm">{type === "flexi" ? "Shift you want off" : "Shift to swap"}</Label>
            <Input id="req-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            {preview?.shift_type && !preview.needs_day_night && /Day|Night/.test(preview.shift_type) && (
              <p className="mt-1 text-xs text-muted-foreground">{preview.shift_type}, {preview.day_night === "Night" ? "18:00 to 08:00" : "08:00 to 18:00"}</p>
            )}
          </div>

          {preview?.needs_day_night && type === "h4h" && (
            <div className="space-y-1.5">
              <Label className="text-sm">That's annual leave. Which shift are you swapping?</Label>
              <Toggle label="Which shift" value={dayNight} onChange={setDayNight} options={DAY_NIGHT} />
            </div>
          )}

          {type === "h4h" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Who's working it?</Label>
                <Toggle label="Where they are" value={coverMode} onChange={setCoverMode} options={[
                  { value: "app", label: "Someone in the app" },
                  { value: "other", label: "Not in the app" },
                ]} />
              </div>
              {coverMode === "app" ? (
                <WatchPerson label="Who's working it" watch={coverWatch} onWatch={setCoverWatch} person={coverId} onPerson={setCoverId} exclude={applicantId} />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Input aria-label="Name" placeholder="Name" className="col-span-2" value={coverName} onChange={(e) => setCoverName(e.target.value)} />
                  <Input aria-label="Payroll number" placeholder="Payroll number" value={coverPayroll} onChange={(e) => setCoverPayroll(e.target.value)} />
                  <Input aria-label="Station" placeholder="Station" value={coverStation} onChange={(e) => setCoverStation(e.target.value)} />
                  <Select value={coverOtherWatch} onValueChange={setCoverOtherWatch}>
                    <SelectTrigger aria-label="Their watch"><SelectValue placeholder="Watch" /></SelectTrigger>
                    <SelectContent>{WATCHES.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={hasPayback} onCheckedChange={(v) => setHasPayback(!!v)} />
                  Payback date already agreed
                </label>
                {hasPayback && (
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <Input aria-label="Payback date" type="date" value={paybackDate} onChange={(e) => setPaybackDate(e.target.value)} />
                    <Toggle label="Payback shift" value={paybackShift} onChange={setPaybackShift} options={DAY_NIGHT} />
                  </div>
                )}
              </div>
            </div>
          )}

          {needsReviewer && (
            <div className="space-y-1.5">
              <Label className="text-sm">Which WC should review this?</Label>
              <Select value={reviewer} onValueChange={setReviewer}>
                <SelectTrigger aria-label="Which WC should review this"><SelectValue placeholder="Choose a WC" /></SelectTrigger>
                <SelectContent>
                  {reviewers.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}{r.watch ? ` (${r.watch})` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="req-notes" className="text-sm">Note for the WC (optional)</Label>
            <Textarea id="req-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {previewError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{(previewError as Error).message}</p>}
          {preview && applicantReady && coverReady && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Checks so far</h3>
              <CheckList checks={preview.checks} />
              {type === "flexi" && <p className="text-xs text-muted-foreground">The WC also checks the pinch point on Kronos.</p>}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!canSend || create.isPending} onClick={() => create.mutate()}>
              {type === "h4h" && coverMode === "app" ? "Send to cover" : "Send to WC"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
