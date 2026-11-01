import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PersonalDashboard from "@/components/PersonalDashboard";
import MyTasks from "@/components/MyTasks";
import MyCalendar from "@/components/MyCalendar";
import MyProfile from "@/components/MyProfile";
import AbsenceRequest from "@/components/AbsenceRequest";
import FFSickLineUpload from "@/components/FFSickLineUpload";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShiftHero } from "@/components/ShiftHero";
import { ShiftRunningOrder } from "@/components/home/ShiftRunningOrder";
import { 
  LayoutDashboard,
  ListTodo, 
  Calendar, 
  User, 
  FileText,
} from "lucide-react";

type TabValue = "dashboard" | "tasks" | "calendar" | "profile" | "absence";

export default function StaffPortal() {
  // "?tab=absence" (the quick-add button) opens straight on a tab.
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabValue>(() => {
    const t = searchParams.get("tab");
    return t === "tasks" || t === "calendar" || t === "profile" || t === "absence" ? t : "dashboard";
  });
  const tabParam = searchParams.get("tab");
  useEffect(() => {
    if (tabParam === "tasks" || tabParam === "calendar" || tabParam === "profile" || tabParam === "absence") setActiveTab(tabParam);
  }, [tabParam]);

  return (
    // Layout already pads the page; the shift panel replaces the old
    // "Staff Portal" heading so a firefighter sees their watch's shift and
    // where they're riding first.
    <div>
      <div className="space-y-6">
        <ShiftHero />
        <ShiftRunningOrder />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <ListTodo className="h-4 w-4" />
              <span className="hidden sm:inline">My Tasks</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="absence" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Absence</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <PersonalDashboard />
          </TabsContent>

          <TabsContent value="tasks" className="mt-6">
            <MyTasks />
          </TabsContent>

          <TabsContent value="calendar" className="mt-6">
            <MyCalendar />
          </TabsContent>

          <TabsContent value="profile" className="mt-6">
            <MyProfile />
          </TabsContent>

          <TabsContent value="absence" className="mt-6 space-y-6">
            {/* Sick line uploads — attach evidence to sickness bookings the
                WC/CC has already logged. Appears first because it's the
                most time-sensitive action (compliance clock starts when
                a GP issues a sick line). */}
            <FFSickLineUpload />
            {/* Request other leave types (annual leave, TOIL, etc.). */}
            <AbsenceRequest />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
