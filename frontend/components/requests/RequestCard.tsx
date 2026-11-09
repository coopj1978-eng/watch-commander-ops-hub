import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { cn } from "@/lib/utils";
import { refreshCalendar } from "@/lib/calendarQueries";
import { REQUEST_LABEL, STATUS_LABEL, dayText, deadlineText, signedAs, stampText } from "@/lib/shiftRequests";
import type { shift_adjustments } from "@/client";
import { CheckList } from "./CheckList";

// One request: the WC's review card while it's waiting, the permanent record
// afterwards. Everything on the old paper form is here, along with what the
// checks showed when it was signed and a dated timeline.

type Detail = shift_adjustments.RequestDetail;
type DayNight = shift_adjustments.DayNight;
type Pinch = "green" | "white" | "red";

const DECLINE_REASONS: Record<shift_adjustments.RequestType, string[]> = {
  flexi: ["Red or white pinch point", "Skills can't be covered", "Important watch or area event", "Not enough time to check"],
  h4h: ["Shift clash", "Potential shift clash"],
};

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Choice<T extends string>({ value, options, onChange, label }: {
  value: T | null;
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

function CoverAnswer({ d, act, busy }: { d: Detail; act: (f: () => Promise<Detail>, done?: string) => void; busy: boolean }) {
  const { user } = useAuth();
  const r = d.request;
  const self = user?.id === r.cover_user_id;
  const answer = (agreed: boolean) => act(() => backend.shift_adjustments.confirmCover(r.id, { agreed }), agreed ? "Confirmed" : "Answer recorded");
  return (
    <Section title="Does the cover agree?">
      <p className="text-sm text-muted-foreground">
        {self
          ? `${r.user_name} has put you down to work ${dayText(r.shift_date)} (${r.shift_type}). Have you agreed?`
          : `${r.cover_name} hasn't answered yet. If you've checked with them, you can answer for them.`}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" disabled={busy} onClick={() => answer(false)}>{self ? "No, not agreed" : "They haven't"}</Button>
        <Button disabled={busy} onClick={() => answer(true)}>{self ? "Yes, I've agreed" : "They've agreed"}</Button>
      </div>
    </Section>
  );
}

function Decision({ d, act, busy }: { d: Detail; act: (f: () => Promise<Detail>, done?: string) => void; busy: boolean }) {
  const { user } = useAuth();
  const r = d.request;
  const [pinch, setPinch] = useState<Pinch | null>(null);
  const [comments, setComments] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [endorsed, setEndorsed] = useState(false);
  const [problem, setProblem] = useState("");

  const overLimit = d.checks.find((c) => c.key === "balance")?.state === "fail";
  const skills = d.checks.find((c) => c.key === "skills_match")?.state;
  const flagged = d.checks.filter((c) => c.state === "fail" && c.key !== "balance");

  const send = (decision: shift_adjustments.RequestOutcome) => {
    const note = comments.trim();
    if (decision === "declined" && !note) return setProblem("Say why it's declined. The person sees this.");
    if (decision !== "declined") {
      if (r.type === "flexi" && !pinch) return setProblem("Check Kronos and record the pinch point first.");
      if (r.type === "flexi" && pinch !== "green") return setProblem("A flexi day needs a green pinch point, so this should be declined.");
      if (overLimit && !(agreed && endorsed)) return setProblem("Going over the limit needs your agreement and the SC's endorsement.");
      if (flagged.length && !note) return setProblem(`Say why you're going ahead despite: ${flagged.map((c) => c.label).join(", ")}.`);
    }
    setProblem("");
    act(() => backend.shift_adjustments.decideRequest(r.id, {
      decision,
      comments: note || undefined,
      pinch_point: pinch ?? undefined,
      over_limit_agreed: overLimit ? agreed : undefined,
      sc_endorsed: overLimit ? endorsed : undefined,
    }), decision === "declined" ? "Declined. They've been told." : "Signed. They've been told to submit it on Kronos.");
  };

  const addReason = (reason: string) => {
    setProblem("");
    setComments((c) => (c.trim() ? `${c.trim()} ${reason}.` : `${reason}.`));
  };

  const rec = d.recommended;
  return (
    <Section title="Your decision">
      {r.type === "flexi" && (
        <div className="space-y-1.5">
          <Label className="text-sm">Pinch point on Kronos</Label>
          <p className="text-xs text-muted-foreground">Only Kronos has this. Look it up under Pinch Points, Time Off, for {dayText(r.shift_date)}.</p>
          <Choice label="Pinch point" value={pinch} onChange={(p) => { setPinch(p); setProblem(""); }} options={[
            { value: "green", label: "Green" }, { value: "white", label: "White" }, { value: "red", label: "Red" },
          ]} />
        </div>
      )}
      {overLimit && (
        <div className="space-y-2 rounded-xl border border-border p-3 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} /> I agree to going over the limit</label>
          <label className="flex items-center gap-2"><Checkbox checked={endorsed} onCheckedChange={(v) => setEndorsed(!!v)} /> The SC has endorsed it</label>
        </div>
      )}
      {rec && (
        <p className="text-sm text-muted-foreground">
          The checks point to <span className="font-semibold text-foreground">{rec === "authorised" ? "Authorised" : rec === "referred" ? "Referred" : "Declined"}</span>.
        </p>
      )}
      {r.type === "h4h" && !rec && <p className="text-sm text-muted-foreground">The cover isn't in the app, so check Kronos, then choose.</p>}
      <div className="space-y-1.5">
        <Label htmlFor="wc-comments" className="text-sm">Comments</Label>
        <Textarea id="wc-comments" rows={2} value={comments} onChange={(e) => { setComments(e.target.value); setProblem(""); }} />
        <div className="flex flex-wrap gap-1.5">
          {DECLINE_REASONS[r.type].map((reason) => (
            <button key={reason} type="button" onClick={() => addReason(reason)} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted">
              {reason}
            </button>
          ))}
        </div>
      </div>
      {user?.role === "CC" && <p className="text-xs text-muted-foreground">You're signing as CC, so the record will show the WC was off.</p>}
      {problem && <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">{problem}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={() => send("declined")}>Decline</Button>
        {r.type === "h4h" && skills !== "ok" && (
          <Button variant={rec === "referred" ? "default" : "outline"} disabled={busy} onClick={() => send("referred")}>Refer</Button>
        )}
        {(r.type === "flexi" || skills !== "warn") && (
          <Button variant={rec === "declined" ? "outline" : "default"} disabled={busy} onClick={() => send("authorised")}>Authorise</Button>
        )}
      </div>
    </Section>
  );
}

function KronosResult({ d, act, busy }: { d: Detail; act: (f: () => Promise<Detail>, done?: string) => void; busy: boolean }) {
  const r = d.request;
  const [date, setDate] = useState("");
  const [shift, setShift] = useState<DayNight>("Day");
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState("");
  const send = (approved: boolean) => {
    if (approved && r.type === "flexi" && !date) return setProblem("Enter the payback date Kronos gave.");
    setProblem("");
    act(() => backend.shift_adjustments.recordOutcome(r.id, {
      approved,
      note: note.trim() || undefined,
      payback_date: approved && r.type === "flexi" ? date : undefined,
      payback_day_night: approved && r.type === "flexi" ? shift : undefined,
    }), approved ? "Approved. It's on the calendar now." : "Result recorded");
  };
  return (
    <Section title="Result from Kronos">
      <p className="text-sm text-muted-foreground">
        {d.kronos_by ? `Submit it on Kronos by ${deadlineText(d.kronos_by)}. ` : "Submit it on Kronos. "}
        Record the answer here once it comes back. It only goes on the calendar when approved.
      </p>
      {r.type === "flexi" && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <div>
            <Label htmlFor="flexi-payback" className="text-sm">Payback date Kronos gave</Label>
            <Input id="flexi-payback" type="date" value={date} onChange={(e) => { setDate(e.target.value); setProblem(""); }} />
          </div>
          <Choice label="Payback shift" value={shift} onChange={setShift} options={DAY_NIGHT} />
        </div>
      )}
      <Input aria-label="Note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      {problem && <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">{problem}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={() => send(false)}>Declined on Kronos</Button>
        <Button disabled={busy} onClick={() => send(true)}>Approved on Kronos</Button>
      </div>
    </Section>
  );
}

function AddPayback({ d, act, busy }: { d: Detail; act: (f: () => Promise<Detail>, done?: string) => void; busy: boolean }) {
  const [date, setDate] = useState("");
  const [shift, setShift] = useState<DayNight>("Day");
  return (
    <Section title="Payback">
      <p className="text-sm text-muted-foreground">{d.request.status === "approved" ? "Add the date once it's agreed. It goes straight on both calendars, and the WC is told." : "Add the date once it's agreed. It goes to the WC to check first."}</p>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <div>
          <Label htmlFor="h4h-payback" className="text-sm">Payback date</Label>
          <Input id="h4h-payback" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Choice label="Payback shift" value={shift} onChange={setShift} options={DAY_NIGHT} />
      </div>
      <div className="flex justify-end">
        <Button variant="outline" disabled={busy || !date} onClick={() => act(() => backend.shift_adjustments.addPayback(d.request.id, { payback_date: date, payback_day_night: shift }), "Payback added")}>
          Add payback
        </Button>
      </div>
    </Section>
  );
}

function PaybackDecision({ d, act, busy }: { d: Detail; act: (f: () => Promise<Detail>, done?: string) => void; busy: boolean }) {
  const r = d.request;
  const [comments, setComments] = useState("");
  const [problem, setProblem] = useState("");
  const clash = d.checks.find((c) => c.key === "payback_clash")?.state === "fail";
  const send = (authorised: boolean) => {
    if (!comments.trim() && (!authorised || clash)) {
      return setProblem(authorised ? "Say why you're going ahead despite the clash." : "Say why it's declined.");
    }
    setProblem("");
    act(() => backend.shift_adjustments.decidePayback(r.id, { authorised, comments: comments.trim() || undefined }), authorised ? "Payback authorised" : "Payback declined");
  };
  return (
    <Section title="Sign the payback">
      <p className="text-sm text-muted-foreground">{r.user_name} works {r.payback_date && dayText(r.payback_date)} ({r.payback_day_night}) to pay this back.</p>
      <Textarea aria-label="Comments" rows={2} value={comments} onChange={(e) => { setComments(e.target.value); setProblem(""); }} />
      {problem && <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">{problem}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={() => send(false)}>Decline</Button>
        <Button disabled={busy} onClick={() => send(true)}>Authorise</Button>
      </div>
    </Section>
  );
}

export function RequestCard({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);
  useEffect(() => setConfirmingWithdraw(false), [id]);

  const { data: d, isLoading, error } = useQuery({
    queryKey: ["shift-request", id],
    queryFn: () => backend.shift_adjustments.getRequest(id!),
    enabled: id !== null,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: ({ run }: { run: () => Promise<Detail>; done?: string }) => run(),
    onSuccess: (detail, { done }) => {
      qc.setQueryData(["shift-request", id], detail);
      qc.invalidateQueries({ queryKey: ["shift-requests"] });
      // Approving puts it on the calendar, the crewing board and the riding count.
      refreshCalendar(qc);
      for (const key of ["shift-adjustments", "shift-adjustments-mine", "shift-adjustments-for-profile", "shift-adjustments-inbound"]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
      if (done) toast({ title: done });
    },
    onError: (err: Error) => toast({ title: "That didn't work", description: err.message, variant: "destructive" }),
  });
  const act = (run: () => Promise<Detail>, done?: string) => mutation.mutate({ run, done });
  const busy = mutation.isPending;

  const r = d?.request;
  return (
    <Dialog open={id !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 pb-3 pt-5 text-left">
          <DialogTitle className="pr-6 text-base">
            {r ? `${REQUEST_LABEL[r.type]}: ${r.user_name}` : "Request"}
          </DialogTitle>
          <DialogDescription>
            {r ? `${dayText(r.shift_date)} · ${r.shift_type} · ${r.watch} Watch` : "Loading"}
          </DialogDescription>
          {r && (
            <p className="pt-1 text-sm font-medium text-foreground">
              {STATUS_LABEL[r.status]}
              {r.payback_status === "with_wc" && " · payback with the WC"}
              {d?.kronos_by && r.status === "with_wc" && <span className="font-normal text-muted-foreground"> · on Kronos by {deadlineText(d.kronos_by)}</span>}
            </p>
          )}
        </DialogHeader>

        <div className="max-h-[75vh] space-y-5 overflow-y-auto px-5 py-4">
          {isLoading && <Skeleton className="h-48 w-full" />}
          {error && <p className="text-sm text-muted-foreground">{(error as Error).message}</p>}
          {d && r && (
            <>
              {d.can.confirm_cover && <CoverAnswer d={d} act={act} busy={busy} />}

              {d.checks.length > 0 && (
                <Section title={r.status === "with_cover" || r.status === "with_wc" || r.payback_status === "with_wc" ? "Checks" : r.decided_by_name ? "Checks when signed" : "Checks when booked"}>
                  <CheckList checks={d.checks} />
                </Section>
              )}

              {d.can.decide && <Decision key={r.id} d={d} act={act} busy={busy} />}
              {d.can.record_outcome && <KronosResult key={`k${r.id}`} d={d} act={act} busy={busy} />}
              {d.can.decide_payback && <PaybackDecision key={`p${r.id}`} d={d} act={act} busy={busy} />}
              {d.can.add_payback && <AddPayback key={`a${r.id}`} d={d} act={act} busy={busy} />}

              <Section title="Record">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-border p-3">
                  <Field label="Name" value={`${r.user_name} (${r.user_role})`} />
                  <Field label="Payroll number" value={r.payroll_number} />
                  <Field label="Station" value={r.station} />
                  <Field label="Watch" value={r.watch} />
                  {r.type === "h4h" && (
                    <>
                      <Field label="Working it" value={r.cover_name} />
                      <Field label="Their payroll number" value={r.cover_payroll} />
                      <Field label="Their station" value={r.cover_station} />
                      <Field label="Their watch" value={r.cover_watch} />
                    </>
                  )}
                  <Field label="Payback" value={r.payback_date ? `${dayText(r.payback_date)} (${r.payback_day_night})` : null} />
                  <Field label="Payback watch" value={r.payback_watch} />
                  <Field label="Reviewer asked" value={r.reviewer_name} />
                  <Field label="Signed by" value={signedAs(r)} />
                  <Field label="Signed on" value={r.decided_at ? stampText(r.decided_at) : null} />
                  <Field label="Pinch point" value={r.pinch_point ? r.pinch_point[0].toUpperCase() + r.pinch_point.slice(1) : null} />
                  <Field label="Over the limit" value={r.over_limit_agreed || r.sc_endorsed ? `WC agreed: ${r.over_limit_agreed ? "yes" : "no"}. SC endorsed: ${r.sc_endorsed ? "yes" : "no"}` : null} />
                </dl>
                {r.notes && <p className="text-sm text-muted-foreground">Their note: {r.notes}</p>}
                {r.wc_comments && <p className="text-sm text-foreground">WC comments: {r.wc_comments}</p>}
              </Section>

              <Section title="Timeline">
                <ol className="space-y-2.5 border-l border-border pl-3.5">
                  {d.events.map((e, i) => (
                    <li key={i} className="text-sm">
                      <p className="font-medium text-foreground">{e.action}</p>
                      <p className="text-xs text-muted-foreground">{e.by_name} · {stampText(e.at)}</p>
                      {e.detail && <p className="text-[13px] text-muted-foreground">{e.detail}</p>}
                    </li>
                  ))}
                </ol>
              </Section>

              {d.can.withdraw && (
                confirmingWithdraw ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="mr-auto text-sm text-muted-foreground">Withdraw this request? It stays on the record.</span>
                    <Button variant="ghost" onClick={() => setConfirmingWithdraw(false)}>Keep it</Button>
                    <Button variant="outline" disabled={busy} onClick={() => act(() => backend.shift_adjustments.withdrawRequest(r.id, {}), "Withdrawn")}>Withdraw</Button>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <Button variant="ghost" className="text-muted-foreground" onClick={() => setConfirmingWithdraw(true)}>Withdraw request</Button>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
