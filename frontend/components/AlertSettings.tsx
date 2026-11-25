import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Check } from "lucide-react";
import backend from "@/lib/backend";
import type { notification } from "@/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useUserRole } from "@/lib/rbac";

// Your alerts (John, 25 Nov 2026): the important ones always ring the bell
// and have no switch; the extras are off until you turn them on here. The
// rules are in backend/lib/bellRules.ts.

type Prefs = notification.AlertPrefs;
const KEY = ["alert-prefs"];

const EXTRAS: { key: keyof Prefs; label: string; hint: string; managers?: boolean }[] = [
  { key: "watch_tasks", label: "Overdue watch tasks", hint: "Every overdue task on your watch, not only the ones given to you. Home counts them either way." },
  { key: "certs_soon", label: "Certificates expiring soon", hint: "Anyone on your watch within 30 days of a certificate running out. You're always told once one has expired.", managers: true },
  { key: "bookings", label: "Bookings logged", hint: "When someone on your watch logs TOIL, an orange day, training or overtime. They're on the calendar either way.", managers: true },
];

const ALWAYS_CREW = ["A task given to you", "Bulletins and policies to read", "Changes someone makes to your calendar", "Your own certificates running out", "Your TOIL being approved"];
const ALWAYS_MANAGERS = [
  "Crewing gaps (no OIC or driver)", "Someone booked sick, or back fit", "Back-to-work interviews due", "Absence triggers hit",
  "TOIL to approve", "Flagged Flexi and Head for Head", "Someone changing their own orange or purple day", "An expired certificate on your watch",
];

export function AlertSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const role = useUserRole();
  const isManager = role === "WC" || role === "CC";
  const { data } = useQuery({ queryKey: KEY, queryFn: () => backend.notification.getAlertPrefs() });
  const save = useMutation({
    mutationFn: (change: Partial<Prefs>) => backend.notification.setAlertPrefs(change),
    // Flip the switch straight away; put it back if the save fails.
    onMutate: async (change) => {
      await qc.cancelQueries({ queryKey: KEY });
      const before = qc.getQueryData<Prefs>(KEY);
      if (before) qc.setQueryData<Prefs>(KEY, { ...before, ...change });
      return { before };
    },
    onError: (_e, _c, ctx) => {
      if (ctx?.before) qc.setQueryData(KEY, ctx.before);
      toast({ title: "That didn't save", description: "Try again.", variant: "destructive" });
    },
    onSuccess: (prefs) => {
      qc.setQueryData(KEY, prefs);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const always = isManager ? [...ALWAYS_MANAGERS, ...ALWAYS_CREW] : ALWAYS_CREW;
  const extras = EXTRAS.filter((e) => !e.managers || isManager);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-brand" aria-hidden="true" />
          Alerts
        </CardTitle>
        <CardDescription>What rings the bell for you. Saved to your account, so it's the same on every device.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section aria-labelledby="alerts-extra">
          <h3 id="alerts-extra" className="text-sm font-semibold text-foreground">Extra alerts</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">Off unless you turn them on.</p>
          <ul className="mt-3 divide-y divide-border/70 rounded-xl border border-border/70">
            {extras.map((e) => (
              <li key={e.key}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{e.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{e.hint}</span>
                  </span>
                  <Switch
                    className="mt-0.5 shrink-0"
                    checked={!!data?.[e.key]}
                    disabled={!data}
                    onCheckedChange={(on) => save.mutate({ [e.key]: on })}
                    aria-label={e.label}
                  />
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="alerts-always">
          <h3 id="alerts-always" className="text-sm font-semibold text-foreground">Always on</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">These need you, or change who can ride, so they can't be switched off.</p>
          <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {always.map((a) => (
              <li key={a} className="flex items-start gap-2 text-sm text-foreground/90">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                {a}
              </li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
