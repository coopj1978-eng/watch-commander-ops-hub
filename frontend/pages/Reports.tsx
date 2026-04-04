import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "@/lib/backend";
import { useAuth } from "@/App";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Download,
  Upload,
  FileSpreadsheet,
  ClipboardList,
  Plus,
  ChevronRight,
  CheckCircle2,
  Clock,
  BarChart2,
} from "lucide-react";
import type { quarterly_report } from "@/client";

// ── helpers ───────────────────────────────────────────────────────────────────

function getCurrentFinancialQuarter(): { quarter: number; financialYear: number } {
  const m = new Date().getMonth() + 1;
  const y = new Date().getFullYear();
  if (m >= 4 && m <= 6) return { quarter: 1, financialYear: y };
  if (m >= 7 && m <= 9) return { quarter: 2, financialYear: y };
  if (m >= 10 && m <= 12) return { quarter: 3, financialYear: y };
  return { quarter: 4, financialYear: y - 1 };
}

function quarterLabel(q: number, fy: number): string {
  const periods = ["Apr–Jun", "Jul–Sep", "Oct–Dec", "Jan–Mar"];
  return `Q${q} ${periods[q - 1]} ${fy}/${String(fy + 1).slice(2)}`;
}

const WATCHES = ["Blue", "Red", "Green", "Amber", "White"] as const;

const EXPORT_TABLES = [
  { value: "users", label: "Users" },
  { value: "firefighter_profiles", label: "Firefighter Profiles" },
  { value: "absences", label: "Absences" },
  { value: "tasks", label: "Tasks" },
  { value: "inspections", label: "Inspections" },
  { value: "targets", label: "Targets" },
  { value: "policy_docs", label: "Policy Documents" },
  { value: "calendar_events", label: "Calendar Events" },
  { value: "activity_log", label: "Activity Log" },
];

// ── New Report Dialog ─────────────────────────────────────────────────────────

function NewReportDialog({
  open,
  onClose,
  defaultWatch,
  defaultWcName,
}: {
  open: boolean;
  onClose: () => void;
  defaultWatch: string;
  defaultWcName: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { quarter: defaultQ, financialYear: defaultFY } = getCurrentFinancialQuarter();

  const [watch, setWatch] = useState(defaultWatch || "Green");
  const [wcName, setWcName] = useState(defaultWcName);
  const [quarter, setQuarter] = useState(String(defaultQ));
  const [fy, setFy] = useState(String(defaultFY));

  const createMut = useMutation({
    mutationFn: (req: quarterly_report.CreateReportRequest) =>
      backend.quarterly_report.create(req),
    onSuccess: (data) => {
      toast({
        title: "Report created",
        description: quarterLabel(data.report.quarter, data.report.financial_year),
      });
      queryClient.invalidateQueries({ queryKey: ["quarterly-reports"] });
      onClose();
      navigate(`/reports/quarterly/${data.report.id}`);
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to create report",
        description: err.message?.includes("already exists")
          ? "A report for this watch/quarter already exists."
          : err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Quarterly Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Watch</Label>
            <Select value={watch} onValueChange={setWatch}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WATCHES.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w} Watch
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Watch Commander Name</Label>
            <Input value={wcName} onChange={(e) => setWcName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quarter</Label>
              <Select value={quarter} onValueChange={setQuarter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1 (Apr–Jun)</SelectItem>
                  <SelectItem value="2">Q2 (Jul–Sep)</SelectItem>
                  <SelectItem value="3">Q3 (Oct–Dec)</SelectItem>
                  <SelectItem value="4">Q4 (Jan–Mar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Financial Year Start</Label>
              <Input
                type="number"
                value={fy}
                onChange={(e) => setFy(e.target.value)}
                placeholder="e.g. 2025"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              createMut.mutate({
                watch,
                watch_commander_name: wcName,
                quarter: Number(quarter),
                financial_year: Number(fy),
              })
            }
            disabled={createMut.isPending || !wcName.trim()}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {createMut.isPending ? "Creating…" : "Create Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Report card row ───────────────────────────────────────────────────────────

function ReportCard({ report }: { report: quarterly_report.QuarterlyReportSummary }) {
  const navigate = useNavigate();
  const pct =
    report.items_total > 0
      ? Math.round((report.items_met / report.items_total) * 100)
      : 0;

  return (
    <div
      className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
      onClick={() => navigate(`/reports/quarterly/${report.id}`)}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-2 h-10 rounded-full flex-shrink-0 ${
            report.status === "submitted" ? "bg-green-500" : "bg-yellow-500"
          }`}
        />
        <div>
          <p className="font-medium text-sm">
            {report.watch} Watch · {quarterLabel(report.quarter, report.financial_year)}
          </p>
          <p className="text-xs text-muted-foreground">
            WC: {report.watch_commander_name} · {report.station_name}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium">{pct}%</p>
          <p className="text-xs text-muted-foreground">
            {report.items_met}/{report.items_total} KPIs
          </p>
        </div>
        <Badge
          variant="outline"
          className={
            report.status === "submitted"
              ? "border-green-500 text-green-600"
              : "border-yellow-500 text-yellow-600"
          }
        >
          {report.status === "submitted" ? (
            <CheckCircle2 className="h-3 w-3 mr-1" />
          ) : (
            <Clock className="h-3 w-3 mr-1" />
          )}
          {report.status === "submitted" ? "Submitted" : "Draft"}
        </Badge>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Reports() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedTable, setSelectedTable] = useState("");
  const [csvData, setCsvData] = useState("");
  const [activeTab, setActiveTab] = useState<"quarterly" | "data">("quarterly");

  const isWcOrCc = user?.role === "WC" || user?.role === "CC";
  const userWatch: string = (user as unknown as { watch_unit?: string })?.watch_unit ?? "";

  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ["quarterly-reports"],
    queryFn: async () => backend.quarterly_report.list({}),
  });

  const allReports = reportsData?.reports ?? [];
  const myReports = allReports.filter(
    (r) => r.watch.toLowerCase() === userWatch.toLowerCase()
  );
  const otherReports = allReports.filter(
    (r) => r.watch.toLowerCase() !== userWatch.toLowerCase()
  );

  const exportMutation = useMutation({
    mutationFn: async (table: string) =>
      backend.report.exportCsv(table, { user_id: user?.id ?? "" }),
    onSuccess: (data, table) => {
      const blob = new Blob([data.csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${table}-export-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Success", description: "CSV exported successfully" });
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to export CSV", variant: "destructive" }),
  });

  const importMutation = useMutation({
    mutationFn: async (d: string) =>
      backend.report.importStaffCsv({ csv_data: d, user_id: user?.id ?? "" }),
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Imported ${data.imported_count} staff. ${data.errors.length} errors.`,
      });
      setCsvData("");
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to import", variant: "destructive" }),
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setCsvData(e.target?.result as string);
    reader.readAsText(file);
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
          <BarChart2 className="h-7 w-7 text-emerald-500 shrink-0" />
          Reports
        </h1>
        <p className="text-muted-foreground mt-1">
          Quarterly performance checklists and data exports
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {(
          [
            { key: "quarterly", label: "Quarterly Checklist", icon: ClipboardList },
            { key: "data", label: "Data Export", icon: FileSpreadsheet },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === key
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── QUARTERLY TAB ─────────────────────────────────────────── */}
      {activeTab === "quarterly" && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              City of Glasgow LSO Area · Watch Based Quarterly Checklist
            </p>
            <Button
              onClick={() => setShowNewDialog(true)}
              className="bg-indigo-600 hover:bg-indigo-700 gap-2 self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              New Report
            </Button>
          </div>

          {reportsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : allReports.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="font-medium text-foreground">No quarterly reports yet</p>
                <p className="text-sm text-muted-foreground mt-1">Create your first quarterly performance report to get started.</p>
                <Button
                  onClick={() => setShowNewDialog(true)}
                  className="mt-5 bg-indigo-600 hover:bg-indigo-700 gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create First Report
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              {isWcOrCc && userWatch && myReports.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {userWatch} Watch — My Reports
                  </h3>
                  {myReports.map((r) => (
                    <ReportCard key={r.id} report={r} />
                  ))}
                </div>
              )}
              {otherReports.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {isWcOrCc && userWatch ? "Other Watches" : "All Watches"}
                  </h3>
                  {otherReports.map((r) => (
                    <ReportCard key={r.id} report={r} />
                  ))}
                </div>
              )}
              {(!isWcOrCc || !userWatch) &&
                allReports.map((r) => <ReportCard key={r.id} report={r} />)}
            </div>
          )}
        </div>
      )}

      {/* ── DATA EXPORT TAB ───────────────────────────────────────── */}
      {activeTab === "data" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-red-500" />
                Export Data
              </CardTitle>
              <CardDescription>Download data as CSV</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="table-select">Select Table</Label>
                <Select value={selectedTable} onValueChange={setSelectedTable}>
                  <SelectTrigger id="table-select">
                    <SelectValue placeholder="Choose a table" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPORT_TABLES.map((table) => (
                      <SelectItem key={table.value} value={table.value}>
                        {table.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => exportMutation.mutate(selectedTable)}
                disabled={!selectedTable || exportMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 w-full"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {exportMutation.isPending ? "Exporting…" : "Export CSV"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-red-500" />
                Import Staff
              </CardTitle>
              <CardDescription>Upload staff data from CSV</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="csv-upload">Upload CSV File</Label>
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Required columns: id, email, name, role (WC, CC, FF, or RO)
              </p>
              <Button
                onClick={() => importMutation.mutate(csvData)}
                disabled={!csvData.trim() || importMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {importMutation.isPending ? "Importing…" : "Import Staff"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <NewReportDialog
        open={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        defaultWatch={userWatch}
        defaultWcName={user?.name ?? ""}
      />
    </div>
  );
}
