import PageContainer from "@/components/PageContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DictionariesManager } from "@/components/DictionaryManager";
import { AbsenceThresholds } from "@/components/AbsenceThresholds";
import { BrandingSettings } from "@/components/BrandingSettings";
import { CSVExportUtility } from "@/components/CSVExportUtility";
import { InspectionPlans } from "@/components/InspectionPlans";
import { Settings as SettingsIcon, FileSpreadsheet, Palette, AlertTriangle, Database, ClipboardList } from "lucide-react";

export default function Settings() {
  return (
    <PageContainer>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <SettingsIcon className="h-7 w-7 text-slate-500 shrink-0" />
            Settings & Utilities
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure system settings and export data
          </p>
        </div>

        <Tabs defaultValue="dictionaries" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dictionaries" className="gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Skills & Certs</span>
            </TabsTrigger>
            <TabsTrigger value="absence" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Absence</span>
            </TabsTrigger>
            <TabsTrigger value="branding" className="gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Branding</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </TabsTrigger>
            <TabsTrigger value="inspection-plans" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Inspection Plans</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dictionaries" className="space-y-6">
            <DictionariesManager />
          </TabsContent>

          <TabsContent value="absence" className="space-y-6">
            <AbsenceThresholds />
          </TabsContent>

          <TabsContent value="branding" className="space-y-6">
            <BrandingSettings />
          </TabsContent>

          <TabsContent value="export" className="space-y-6">
            <CSVExportUtility />
          </TabsContent>

          <TabsContent value="inspection-plans" className="space-y-6">
            <InspectionPlans />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
