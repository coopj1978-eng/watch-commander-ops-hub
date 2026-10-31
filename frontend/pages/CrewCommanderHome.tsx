import { CrewKPIs } from "@/components/CrewKPIs";
import { QuickAssignTasks } from "@/components/QuickAssignTasks";
import { CrewUpcomingInspections } from "@/components/CrewUpcomingInspections";
import { CrewOneToOnes } from "@/components/CrewOneToOnes";
import { ShiftHero } from "@/components/ShiftHero";
import { WCAlertBanner } from "@/components/WCAlertBanner";
import { ThisShiftCard } from "@/components/ThisShiftCard";

// Layout already wraps every page in PageContainer, so this page doesn't.
export default function CrewCommanderHome() {
  return (
    <div className="flex flex-col" style={{ gap: "var(--gap-section)" }}>
      <ShiftHero />

      {/* Triggers hit, back to work interviews, crew gaps, missed checks —
          the same "needs you" list the WC sees, for their own watch. */}
      <WCAlertBanner />

      <ThisShiftCard />

      <CrewKPIs />

      <div className="grid gap-6 md:grid-cols-2">
        <CrewUpcomingInspections />
        <CrewOneToOnes />
      </div>

      <QuickAssignTasks />
    </div>
  );
}
