import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useBackend } from "@/lib/rbac";
import type { profile as profileApi } from "@/client";
import { DRIVER_STEPS } from "./DriverPathway";

// The History tab (Nov 2026): who changed this person's record and what —
// qualifications ticked, skills added, details edited — in plain words,
// grouped by day. It replaces the Activity Log tab, which listed the
// person's own sign-ins.

type Entry = profileApi.ProfileHistoryEntry;

const QUAL_NAMES: Record<string, string> = {
  ba: "BA", prps: "PRPS", oic: "OIC", mass_decon: "Mass Decon", hooklift_operator: "Hooklift",
};
const FIELD_NAMES: Record<string, string> = {
  phone: "phone number", service_number: "service number", emergency_contact_name: "emergency contact",
  emergency_contact_phone: "emergency contact", hire_date: "start date", customFields: "extra details",
};

function describe(e: Entry): string[] {
  const d = e.details ?? {};
  if (e.action === "create_person" || e.action === "import_person") return ["added them to the app"];
  if (e.action === "create_skill_renewal") return [`added the skill ${d.skill_name ?? ""}`.trim()];
  if (e.action === "delete_skill_renewal") return [d.skill_name ? `removed the skill ${d.skill_name}` : "removed a skill"];
  if (e.action === "update_skill_renewal") {
    const what = d.skill_name ? `${d.skill_name}` : "a skill";
    return [d.expiry_date !== undefined || d.acquired_date !== undefined ? `updated the dates on ${what}` : `updated ${what}`];
  }
  if (e.action !== "update_profile") return [e.action.replace(/_/g, " ")];

  const out: string[] = [];
  const ticked: string[] = [];
  const unticked: string[] = [];
  for (const [k, v] of Object.entries(d)) {
    if (k in QUAL_NAMES) (v ? ticked : unticked).push(QUAL_NAMES[k]);
    else if (k === "driver" && v && typeof v === "object") ((v as { lgv?: boolean }).lgv ? ticked : unticked).push("LGV");
    else if (k === "driverPathway" && v && typeof v === "object") {
      const step = DRIVER_STEPS.find((s) => s.value === (v as { status?: string }).status);
      out.push(step ? `moved their driver pathway to ${step.label.toLowerCase()}` : "updated their driver pathway");
    } else if (k === "rank" && v) out.push(`changed their rank to ${v}`);
    else if (k === "station" && v) out.push(`moved them to ${v}`);
    else if (k === "watch") out.push(v ? `moved them to ${v} Watch` : "took them off a watch");
    else if (FIELD_NAMES[k]) out.push(`changed their ${FIELD_NAMES[k]}`);
  }
  if (ticked.length) out.unshift(`gave them ${ticked.join(", ")}`);
  if (unticked.length) out.push(`took ${unticked.join(", ")} off`);
  return [...new Set(out)].length ? [...new Set(out)] : ["updated their record"];
}

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function RecordHistory({ profileId }: { profileId: number }) {
  const backend = useBackend();
  const { data, isLoading, error } = useQuery({
    queryKey: ["profile-history", profileId],
    queryFn: () => backend.profile.profileHistory(profileId),
  });
  const entries = data?.entries ?? [];
  const days: [string, Entry[]][] = [];
  for (const e of entries) {
    const k = dayKey(e.at);
    const last = days[days.length - 1];
    if (last && last[0] === k) last[1].push(e);
    else days.push([k, [e]]);
  }

  return (
    <section className="rounded-2xl border border-border/70 bg-card px-4 py-4 sm:px-5">
      <h2 className="text-sm font-semibold">History</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Changes to this person's record, newest first. Absences aren't included.</p>
      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Couldn't load the history.</p>
      ) : !entries.length ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <History className="h-5 w-5" /> No changes recorded yet.
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-5">
          {days.map(([day, list]) => (
            <div key={day}>
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{day}</h3>
              <ol className="relative ml-1.5 border-l border-border/70">
                {list.map((e) => (
                  <li key={e.id} className="relative pb-3 pl-4 last:pb-0">
                    <span aria-hidden className="absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full bg-foreground/70" />
                    <p className="text-sm">
                      <span className="font-medium">{e.by ?? "The system"}</span>{" "}
                      <span className="text-muted-foreground">{describe(e).join("; ")}</span>
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">{time(e.at)}</p>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
