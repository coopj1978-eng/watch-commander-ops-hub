import PageContainer from "@/components/PageContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DictionariesManager } from "@/components/DictionaryManager";
import { AbsenceThresholds } from "@/components/AbsenceThresholds";
import { BrandingSettings } from "@/components/BrandingSettings";
import { CSVExportUtility } from "@/components/CSVExportUtility";
import { InspectionPlans } from "@/components/InspectionPlans";
import { AppearanceSettings } from "@/components/AppearanceSettings";
import { Settings as SettingsIcon, FileSpreadsheet, Palette, AlertTriangle, Database, ClipboardList, Sparkles } from "lucide-react";

export default function Settings() {
  return (
    <PageContainer>
      <div className="p-6 space-y-6">
        {/* Visual-refresh page header: h1 + eyebrow context line. */}
        <div className="flex items-baseline flex-wrap gap-x-4 gap-y-1">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <SettingsIcon className="h-7 w-7 text-brand shrink-0" />
            Settings &amp; Utilities
          </h1>
          <span className="eyebrow">
            Configure system settings and export data
          </span>
        </div>

        <Tabs defaultValue="appearance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="appearance" className="gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Appearance</span>
            </TabsTrigger>
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

          <TabsContent value="appearance" className="space-y-6">
            <AppearanceSettings />
          </TabsContent>

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
