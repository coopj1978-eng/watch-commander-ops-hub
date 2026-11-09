import { CrewKPIs } from "@/components/CrewKPIs";
import { QuickAssignTasks } from "@/components/QuickAssignTasks";
import { CrewUpcomingInspections } from "@/components/CrewUpcomingInspections";
import { CrewOneToOnes } from "@/components/CrewOneToOnes";
import { ShiftHero } from "@/components/ShiftHero";
import { WCAlertBanner } from "@/components/WCAlertBanner";
import { ShiftRunningOrder } from "@/components/home/ShiftRunningOrder";
import { OurReference } from "@/components/home/OurReference";
import { MyNextShifts } from "@/components/home/MyNextShifts";

// Layout already wraps every page in PageContainer, so this page doesn't.
export default function CrewCommanderHome() {
  return (
    <div className="flex flex-col" style={{ gap: "var(--gap-section)" }}>
      <ShiftHero />
      <MyNextShifts />

      {/* Triggers hit, back to work interviews, crew gaps, missed checks —
          the same "needs you" list the WC sees, for their own watch. */}
      <WCAlertBanner />

      <ShiftRunningOrder />
      <OurReference />

      <CrewKPIs />

      <div className="grid gap-6 md:grid-cols-2">
        <CrewUpcomingInspections />
        <CrewOneToOnes />
      </div>

      <QuickAssignTasks />
    </div>
  );
}
