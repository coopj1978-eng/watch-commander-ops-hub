import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { QUALIFICATIONS, qualificationForSkill, type QualificationKey } from "@/lib/qualifications";

// Qualifications and skills in one place (Nov 2026). The crewing
// qualifications are tiles — held or not, and amber / red when the skill
// behind them is expiring or has expired — and every other skill is listed
// underneath. Ticking a tile adds the skill; unticking removes it (the server
// keeps the two in step).

export interface SkillLite {
  id: number;
  skill_name: string;
  expiry_date?: string | Date | null;
  status?: "valid" | "warning" | "expired";
}

const short = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;

function expiryNote(s?: SkillLite): { text: string; tone: "warning" | "critical" } | null {
  if (!s?.status || s.status === "valid") return null;
  const when = short(s.expiry_date);
  return s.status === "expired"
    ? { text: when ? `Expired ${when}` : "Expired", tone: "critical" }
    : { text: when ? `Expires ${when}` : "Due soon", tone: "warning" };
}

export function QualificationsPanel({
  held, skills, editing, onToggle, onOpenSkills,
}: {
  held: Record<QualificationKey, boolean>;
  skills: SkillLite[];
  editing: boolean;
  onToggle: (key: QualificationKey) => void;
  onOpenSkills: () => void;
}) {
  const skillFor = (key: QualificationKey) => skills.find((s) => qualificationForSkill(s.skill_name) === key);
  const others = skills
    .filter((s) => !qualificationForSkill(s.skill_name))
    .sort((a, b) => a.skill_name.localeCompare(b.skill_name));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {QUALIFICATIONS.map((q) => {
          const on = held[q.key];
          const note = on ? expiryNote(skillFor(q.key)) : null;
          const Tile = editing ? "button" : "div";
          return (
            <Tile
              key={q.key}
              {...(editing ? { type: "button" as const, onClick: () => onToggle(q.key), "aria-pressed": on } : {})}
              title={q.label}
              className={cn(
                "relative flex min-h-[76px] flex-col justify-between rounded-xl border p-2.5 text-left transition-colors",
                on ? "border-foreground/80 bg-foreground/[0.03]" : "border-dashed border-border text-muted-foreground",
                note?.tone === "critical" && "border-red-500 bg-red-500/5",
                note?.tone === "warning" && "border-amber-500 bg-amber-500/5",
                editing && "cursor-pointer hover:border-foreground"
              )}
            >
              <span className="flex items-center justify-between gap-1">
                <span className={cn("text-base font-semibold tracking-tight", on && "text-foreground")}>{q.short}</span>
                {on && (
                  <span aria-hidden className="grid h-4 w-4 place-items-center rounded-full bg-foreground text-background">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[11px] leading-tight",
                  note?.tone === "critical" ? "font-medium text-red-700 dark:text-red-400"
                    : note?.tone === "warning" ? "font-medium text-amber-800 dark:text-amber-300"
                    : "text-muted-foreground"
                )}
              >
                {note ? note.text : on ? q.label : editing ? "Tap to add" : "Not held"}
              </span>
            </Tile>
          );
        })}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Other skills</h3>
          <button type="button" onClick={onOpenSkills} className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            Dates & renewals <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        {others.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {others.map((s) => {
              const note = expiryNote(s);
              return (
                <li
                  key={s.id}
                  className={cn(
                    "rounded-lg border px-2 py-1 text-xs font-medium",
                    note?.tone === "critical" ? "border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-400"
                      : note?.tone === "warning" ? "border-amber-500/40 bg-amber-500/5 text-amber-800 dark:text-amber-300"
                      : "border-border/70"
                  )}
                  title={note?.text}
                >
                  {s.skill_name}
                  {note && <span className="ml-1 font-normal">· {note.text}</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">None recorded.</p>
        )}
      </div>
      {editing && (
        <p className="text-[11px] text-muted-foreground">
          The crewing board uses these. Each one is also a skill: adding one puts it on their Skills tab, and removing it takes the skill (and its dates) off.
        </p>
      )}
    </div>
  );
}
