import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Moon, Settings as SettingsIcon, ShieldCheck, Sun } from "lucide-react";
import { AppearanceSettings } from "@/components/AppearanceSettings";
import { useThemeMode } from "@/components/ThemeSwitcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useCanAccessAdmin } from "@/lib/rbac";

// Your own preferences (Nov 2026). Station setup — skills lists, absence
// triggers, inspection plans, branding — moved to Admin; the CSV export is
// on Reports.
const MOVED_TO_ADMIN: Record<string, string> = {
  dictionaries: "skills",
  absence: "absence",
  "inspection-plans": "inspection-plans",
  branding: "branding",
};

export default function Settings() {
  const [params] = useSearchParams();
  const canAdmin = useCanAccessAdmin();
  const { isDark, toggle } = useThemeMode();

  // Old links (e.g. ?tab=inspection-plans) go to where that now lives.
  const tab = params.get("tab") ?? "";
  if (tab === "export") return <Navigate to="/reports" replace />;
  if (MOVED_TO_ADMIN[tab]) {
    return <Navigate to={canAdmin ? `/admin?tab=${MOVED_TO_ADMIN[tab]}` : "/settings"} replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline flex-wrap gap-x-4 gap-y-1">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <SettingsIcon className="h-7 w-7 text-brand shrink-0" />
          Settings
        </h1>
        <span className="eyebrow">Your preferences · saved on this device</span>
      </div>

      {canAdmin && (
        <Link
          to="/admin"
          className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm transition-colors hover:bg-muted/60"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground/80">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="flex-1 text-muted-foreground">
            Skills lists, absence triggers, inspection plans and branding are in <span className="font-medium text-foreground">Admin</span> now.
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Dark mode is easier on the eyes on nights.</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-foreground/80">
              {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </span>
            <span className="flex-1 text-sm font-medium">Dark mode</span>
            <Switch checked={isDark} onCheckedChange={toggle} aria-label="Dark mode" />
          </label>
        </CardContent>
      </Card>

      <AppearanceSettings />
    </div>
  );
}
