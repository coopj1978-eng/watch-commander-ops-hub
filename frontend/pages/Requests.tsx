import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, CalendarDays, ChevronRight, Download, Plus } from "lucide-react";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { RequestCard } from "@/components/requests/RequestCard";
import { NewRequestDialog } from "@/components/requests/NewRequestDialog";
import { REQUEST_LABEL, STATUS_LABEL, dayText, requestsCsv, signedAs } from "@/lib/shiftRequests";
import type { shift_adjustments } from "@/client";

// Flexi Day and Head for Head requests (Nov 2026), with no paper: asking, the
// WC's review, and the record kept for audit. Everything else about a shift
// (TOIL, Orange Days, Training) is still just logged from the calendar.

type Req = shift_adjustments.ShiftRequest;
type Tab = "review" | "mine" | "records" | "balances";

const WATCHES = ["Red", "White", "Green", "Blue", "Amber"];

function RequestRow({ r, onOpen, extra }: { r: Req; onOpen: () => void; extra?: string }) {
  const Icon = r.type === "flexi" ? CalendarDays : ArrowLeftRight;
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60 sm:px-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-4 w-4" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {r.user_name}
            <span className="font-normal text-muted-foreground"> · {REQUEST_LABEL[r.type]}{r.cover_name ? ` with ${r.cover_name}` : ""}</span>
          </span>
          <span className="block truncate text-[13px] text-muted-foreground">
            {dayText(r.shift_date)} · {r.shift_type} · {r.watch}
          </span>
          <span className="block truncate text-[13px] text-muted-foreground">
            {r.payback_status === "with_wc" ? "Payback with the WC" : STATUS_LABEL[r.status]}{extra ? ` · ${extra}` : ""}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </li>
  );
}

function Group({ title, rows, onOpen, extra }: { title: string; rows: Req[]; onOpen: (id: number) => void; extra?: (r: Req) => string }) {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">{title} <span className="font-normal text-muted-foreground">{rows.length}</span></h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {rows.map((r) => <RequestRow key={r.id} r={r} onOpen={() => onOpen(r.id)} extra={extra?.(r)} />)}
      </ul>
    </section>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

const Loading = () => <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>;

/** The flags on a booking, short, for its row ("Flexi balance, Timing"). */
const flagsOf = (r: Req) => (r.checks ?? []).filter((c) => c.state === "fail" || c.state === "warn");

// What your watch has booked (since 9 Nov 2026 they go straight on, so this
// is the paper trail: flagged ones first), plus anything older still waiting.
function ReviewTab({ onOpen }: { onOpen: (id: number) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["shift-requests", "review"],
    queryFn: () => backend.shift_adjustments.listRequests({ scope: "review" }),
  });
  if (isLoading) return <Loading />;
  const rows = data?.requests ?? [];
  const booked = rows.filter((r) => r.status === "approved" && r.payback_status !== "with_wc");
  const flagged = booked.filter((r) => flagsOf(r).length > 0);
  const toSign = rows.filter((r) => r.status === "with_wc" || r.payback_status === "with_wc");
  const cover = rows.filter((r) => r.status === "with_cover");
  const kronos = rows.filter((r) => r.status === "authorised" || r.status === "referred");
  if (rows.length === 0) return <Empty title="Nothing booked coming up" body="When someone on your watch puts a Flexi Day or Head for Head on, it shows here and you get a notification." />;
  const flagText = (r: Req) => `Flagged: ${flagsOf(r).map((c) => c.label).join(", ")}`;
  return (
    <div className="space-y-5">
      <Group title="Flagged" rows={flagged} onOpen={onOpen} extra={flagText} />
      <Group title="Booked, coming up" rows={booked.filter((r) => flagsOf(r).length === 0)} onOpen={onOpen} />
      <Group title="To sign (made before 9 Nov)" rows={toSign} onOpen={onOpen} />
      <Group title="Waiting for the cover to agree" rows={cover} onOpen={onOpen} />
      <Group title="Waiting on Kronos" rows={kronos} onOpen={onOpen} />
    </div>
  );
}

function MineTab({ onOpen }: { onOpen: (id: number) => void }) {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["shift-requests", "mine"],
    queryFn: () => backend.shift_adjustments.listRequests({ scope: "mine" }),
  });
  if (isLoading) return <Loading />;
  const rows = data?.requests ?? [];
  const needsMe = (r: Req) =>
    (r.status === "with_cover" && r.cover_user_id === user?.id) ||
    ((r.status === "authorised" || r.status === "referred") && r.user_id === user?.id);
  if (rows.length === 0) return <Empty title="Nothing yet" body="Put a Flexi Day or a Head for Head on with Flexi / H4H." />;
  return (
    <div className="space-y-5">
      <Group title="Needs you" rows={rows.filter(needsMe)} onOpen={onOpen} />
      <Group title="Yours" rows={rows.filter((r) => !needsMe(r))} onOpen={onOpen} />
    </div>
  );
}

function RecordsTab({ onOpen }: { onOpen: (id: number) => void }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["shift-requests", "records", year],
    queryFn: () => backend.shift_adjustments.listRequests({ scope: "records", year }),
  });
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.requests ?? []).filter((r) =>
      (type === "all" || r.type === type) &&
      (!q || r.user_name.toLowerCase().includes(q) || (r.cover_name ?? "").toLowerCase().includes(q) || (r.payroll_number ?? "").includes(q))
    );
  }, [data, type, search]);

  const download = () => {
    const url = URL.createObjectURL(new Blob([requestsCsv(rows)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `Flexi and H4H records ${year}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger aria-label="Year" className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>{[thisYear + 1, thisYear, thisYear - 1, thisYear - 2].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger aria-label="Type" className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All requests</SelectItem>
            <SelectItem value="flexi">{REQUEST_LABEL.flexi}</SelectItem>
            <SelectItem value="h4h">{REQUEST_LABEL.h4h}</SelectItem>
          </SelectContent>
        </Select>
        <Input aria-label="Search by name or payroll number" placeholder="Name or payroll number" className="min-w-40 flex-1" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button variant="outline" disabled={rows.length === 0} onClick={download}><Download className="mr-2 h-4 w-4" />Download</Button>
      </div>
      <p className="text-xs text-muted-foreground">Kept for good, including anything declined, withdrawn or cancelled. Your watch's requests, and any you signed.</p>
      {isLoading ? <Loading /> : rows.length === 0 ? (
        <Empty title={`No records for ${year}`} body="Each request is saved here once it's made." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {rows.map((r) => <RequestRow key={r.id} r={r} onOpen={() => onOpen(r.id)} extra={r.decided_by_name ? `signed by ${signedAs(r)}` : undefined} />)}
        </ul>
      )}
    </div>
  );
}

function OpeningInput({ person, year, disabled }: { person: { user_id: string; name: string; opening: number }; year: number; disabled: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [value, setValue] = useState(String(person.opening));
  useEffect(() => setValue(String(person.opening)), [person.opening]);
  const save = useMutation({
    mutationFn: (used: number) => backend.shift_adjustments.setFlexiOpening({ user_id: person.user_id, year, used }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shift-requests", "balances"] }),
    onError: (err: Error) => {
      setValue(String(person.opening));
      toast({ title: "Couldn't save that", description: err.message, variant: "destructive" });
    },
  });
  return (
    <Input
      aria-label={`Flexi days ${person.name} used before the app, ${year}`}
      type="number"
      inputMode="numeric"
      min={0}
      disabled={disabled}
      className="h-9 w-16 text-center"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const n = Number(value);
        if (value !== "" && Number.isInteger(n) && n >= 0 && n !== person.opening) save.mutate(n);
        else setValue(String(person.opening));
      }}
    />
  );
}

function LimitsForm({ limits }: { limits: shift_adjustments.FlexiLimits }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(limits);
  useEffect(() => setForm(limits), [limits]);
  const save = useMutation({
    mutationFn: () => backend.shift_adjustments.setFlexiLimits(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shift-requests"] });
      toast({ title: "Limits saved" });
    },
    onError: (err: Error) => toast({ title: "Couldn't save those", description: err.message, variant: "destructive" }),
  });
  const field = (key: keyof shift_adjustments.FlexiLimits, label: string) => (
    <div>
      <Label htmlFor={`limit-${key}`} className="text-xs text-muted-foreground">{label}</Label>
      <Input id={`limit-${key}`} type="number" inputMode="numeric" min={0} className="h-9 w-24" value={form[key]} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} />
    </div>
  );
  const changed = form.per_year !== limits.per_year || form.days_ahead !== limits.days_ahead || form.notice_hours !== limits.notice_hours;
  return (
    <details className="rounded-xl border border-border bg-card px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-foreground">Limits, in case the procedure changes</summary>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {field("per_year", "Flexi days a year")}
        {field("days_ahead", "Days ahead")}
        {field("notice_hours", "Hours' notice")}
        <Button variant="outline" disabled={!changed || save.isPending} onClick={() => save.mutate()}>Save</Button>
      </div>
    </details>
  );
}

function BalancesTab() {
  const { user } = useAuth();
  const thisYear = new Date().getFullYear();
  const [watch, setWatch] = useState(user?.watch_unit ?? "Blue");
  const [year, setYear] = useState(thisYear);
  const { data, isLoading } = useQuery({
    queryKey: ["shift-requests", "balances", watch, year],
    queryFn: () => backend.shift_adjustments.flexiBalances({ watch, year }),
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={watch} onValueChange={setWatch}>
          <SelectTrigger aria-label="Watch" className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{WATCHES.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger aria-label="Year" className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>{[thisYear + 1, thisYear, thisYear - 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        Enter how many flexi days each person had already used this year. The app adds its own requests on top, once they've reached the WC.
      </p>
      {isLoading || !data ? <Loading /> : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          <li className="grid grid-cols-[minmax(0,1fr)_64px_44px_64px] items-center gap-2 px-3 py-2 text-xs text-muted-foreground sm:px-4">
            <span>Person</span><span className="text-center">Before</span><span className="text-center">App</span><span className="text-right">Total</span>
          </li>
          {data.people.map((p) => {
            const total = p.opening + p.in_app;
            const over = total > data.limits.per_year;
            const atLimit = total === data.limits.per_year;
            return (
              <li key={p.user_id} className="grid grid-cols-[minmax(0,1fr)_64px_44px_64px] items-center gap-2 px-3 py-2 sm:px-4">
                <span className="min-w-0 truncate text-sm font-medium text-foreground">{p.name} <span className="font-normal text-muted-foreground">{p.role}</span></span>
                <OpeningInput person={p} year={year} disabled={!data.can_edit} />
                <span className="text-center text-sm tabular-nums text-muted-foreground">{p.in_app}</span>
                <span className={cn(
                  "text-right text-sm font-medium tabular-nums",
                  over ? "text-red-600 dark:text-red-400" : atLimit ? "text-amber-600 dark:text-amber-400" : "text-foreground",
                )}>
                  {total} of {data.limits.per_year}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {data?.can_edit_limits && <LimitsForm limits={data.limits} />}
    </div>
  );
}

export default function Requests() {
  const { user } = useAuth();
  const isManager = user?.role === "WC" || user?.role === "CC";
  const [params, setParams] = useSearchParams();

  const tabs: { key: Tab; label: string }[] = isManager
    ? [{ key: "review", label: "Booked" }, { key: "mine", label: "Mine" }, { key: "records", label: "Records" }, { key: "balances", label: "Flexi balances" }]
    : [{ key: "mine", label: "Mine" }];
  const asked = params.get("tab") as Tab | null;
  const tab: Tab = tabs.some((t) => t.key === asked) ? asked! : tabs[0].key;

  const openParam = params.get("open");
  const openId = openParam && /^\d+$/.test(openParam) ? Number(openParam) : null;
  const update = (change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    change(next);
    setParams(next, { replace: true });
  };
  const open = (id: number) => update((n) => n.set("open", String(id)));

  const [newOpen, setNewOpen] = useState(false);
  const { data: needs } = useQuery({
    queryKey: ["shift-requests", "needs-me"],
    queryFn: () => backend.shift_adjustments.requestsNeedingMe(),
    staleTime: 30_000,
  });
  const counts: Partial<Record<Tab, number>> = {
    review: needs?.to_review ?? 0,
    mine: (needs?.to_confirm ?? 0) + (needs?.to_record ?? 0),
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">Flexi Days and Head for Heads. They go straight on the calendar; each one is kept here as a record.</p>
        </div>
        <Button onClick={() => setNewOpen(true)}><Plus className="mr-2 h-4 w-4" />Flexi / H4H</Button>
      </div>

      {tabs.length > 1 && (
        <div className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-current={tab === t.key ? "page" : undefined}
              onClick={() => update((n) => n.set("tab", t.key))}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4",
                tab === t.key ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {t.label}
              {!!counts[t.key] && <span className="rounded-full bg-amber-400 px-1.5 text-xs font-semibold tabular-nums text-neutral-950">{counts[t.key]}</span>}
            </button>
          ))}
        </div>
      )}

      {tab === "review" && <ReviewTab onOpen={open} />}
      {tab === "mine" && <MineTab onOpen={open} />}
      {tab === "records" && <RecordsTab onOpen={open} />}
      {tab === "balances" && <BalancesTab />}

      <RequestCard id={openId} onClose={() => update((n) => n.delete("open"))} />
      <NewRequestDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={open} />
    </div>
  );
}
