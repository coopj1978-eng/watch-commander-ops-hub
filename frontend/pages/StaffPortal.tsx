import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import FFSickLineUpload from "@/components/FFSickLineUpload";
import { ShiftHero } from "@/components/ShiftHero";
import { MyNextShifts } from "@/components/home/MyNextShifts";
import { PulseTiles } from "@/components/home/PulseTiles";
import { ShiftRunningOrder } from "@/components/home/ShiftRunningOrder";
import { OurReference } from "@/components/home/OurReference";

// A firefighter's Home (Nov 2026, the council's FF-first review): the shift
// panel, then your own next shifts, then what's on this shift. The old five
// tabs (an overview, my tasks, a calendar, my profile, absence) are gone —
// Tasks, Calendar and My profile have their own pages in the menu.
export default function StaffPortal() {
  return (
    <div className="flex flex-col" style={{ gap: "var(--gap-section)" }}>
      <ShiftHero />
      <MyNextShifts />
      {/* Your own shifts come first; then the watch at a glance. */}
      <PulseTiles audience="crew" />
      <SickLine />
      <ShiftRunningOrder />
      <OurReference />
    </div>
  );
}

/**
 * Attach a sick line to a sickness your WC/CC has booked. Shown while you're
 * off sick, or when you come from "Sick line" in the + menu (?tab=absence).
 * Same query as FFSickLineUpload, so it's one fetch.
 */
function SickLine() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const asked = searchParams.get("tab") === "absence";
  const ref = useRef<HTMLDivElement>(null);
  const q = useQuery({
    queryKey: ["my-absences", user?.id],
    queryFn: () => backend.absence.list({ user_id: user!.id, limit: 20 }),
    enabled: !!user?.id,
  });
  const offSick = (q.data?.absences ?? []).some((a) => a.type === "sickness" && !a.returned_to_work_at);
  const show = asked || offSick;

  // After the cards above have loaded and taken their height.
  useEffect(() => {
    if (!asked) return;
    const id = setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 600);
    return () => clearTimeout(id);
  }, [asked]);

  if (!show) return null;
  return (
    <div ref={ref} className="scroll-mt-20">
      <FFSickLineUpload />
    </div>
  );
}
