import { useState } from "react";
import PersonalDashboard from "@/components/PersonalDashboard";
import MyTasks from "@/components/MyTasks";
import MyCalendar from "@/components/MyCalendar";
import MyProfile from "@/components/MyProfile";
import AbsenceRequest from "@/components/AbsenceRequest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LayoutDashboard,
  ListTodo, 
  Calendar, 
  User, 
  FileText,
} from "lucide-react";

type TabValue = "dashboard" | "tasks" | "calendar" | "profile" | "absence";

export default function StaffPortal() {
  const [activeTab, setActiveTab] = useState<TabValue>("dashboard");

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 md:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Staff Portal</h1>
          <p className="text-muted-foreground mt-1">Your personal workspace</p>
        </div>

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

          <TabsContent value="absence" className="mt-6">
            <AbsenceRequest />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
