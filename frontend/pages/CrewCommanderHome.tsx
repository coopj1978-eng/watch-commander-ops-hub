import PageContainer from "@/components/PageContainer";
import { CrewKPIs } from "@/components/CrewKPIs";
import { QuickAssignTasks } from "@/components/QuickAssignTasks";
import { CrewUpcomingInspections } from "@/components/CrewUpcomingInspections";
import { CrewOneToOnes } from "@/components/CrewOneToOnes";
import { LayoutDashboard } from "lucide-react";

export default function CrewCommanderHome() {
  return (
    <PageContainer>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <LayoutDashboard className="h-7 w-7 text-indigo-500 shrink-0" />
            Crew Commander Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Manage your crew and assignments</p>
        </div>

        <CrewKPIs />

        <div className="grid gap-6 md:grid-cols-2">
          <CrewUpcomingInspections />
          <CrewOneToOnes />
        </div>

        <QuickAssignTasks />
      </div>
    </PageContainer>
  );
}
