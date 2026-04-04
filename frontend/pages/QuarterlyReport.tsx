import { useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "@/lib/backend";
import type { quarterly_report } from "@/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  CheckSquare,
  Square,
  Printer,
  ArrowLeft,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────

function quarterLabel(q: number, fy: number): string {
  const periods = ["Apr–Jun", "Jul–Sep", "Oct–Dec", "Jan–Mar"];
  return `Q${q} ${periods[q - 1]} ${fy}/${String(fy + 1).slice(2)}`;
}

function rowStyle(color: string): React.CSSProperties {
  return { backgroundColor: `#${color}` };
}

// ── KPI row component ─────────────────────────────────────────────────────────

function KpiRow({
  item,
  onToggle,
  onRationale,
  onTargetText,
}: {
  item: quarterly_report.QuarterlyReportItem;
  onToggle: (itemId: number, met: boolean) => void;
  onRationale: (itemId: number, text: string) => void;
  onTargetText: (itemId: number, text: string) => void;
}) {
  const [showRationale, setShowRationale] = useState(!!item.rationale);
  const [localTarget, setLocalTarget] = useState(item.target_text);
  const [localRationale, setLocalRationale] = useState(item.rationale ?? "");

  return (
    <div
      className="border-b border-gray-200 dark:border-gray-700 last:border-b-0"
      style={rowStyle(item.row_color)}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Tick */}
        <button
          onClick={() => onToggle(item.id, !item.met)}
          className="flex-shrink-0 hover:opacity-70 transition-opacity"
          aria-label={item.met ? "Mark incomplete" : "Mark complete"}
        >
          {item.met ? (
            <CheckSquare className="h-5 w-5 text-green-700" />
          ) : (
            <Square className="h-5 w-5 text-gray-500" />
          )}
        </button>

        {/* KPI code */}
        <span className="w-16 flex-shrink-0 text-xs font-bold text-gray-700 dark:text-gray-300">
          {item.kpi_code}
        </span>

        {/* Description */}
        <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{item.description}</span>

        {/* Target (editable for "Set by SC") */}
        <div className="w-44 flex-shrink-0">
          <Input
            value={localTarget}
            onChange={(e) => setLocalTarget(e.target.value)}
            onBlur={() => {
              if (localTarget !== item.target_text) {
                onTargetText(item.id, localTarget);
              }
            }}
            className="h-7 text-xs bg-white/50 border-gray-300 dark:bg-gray-800/50 dark:border-gray-600"
          />
        </div>

        {/* Rationale toggle */}
        {!item.met && (
          <button
            onClick={() => setShowRationale((s) => !s)}
            className="flex-shrink-0 text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
            {showRationale ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        )}
      </div>

      {/* Rationale textarea */}
      {showRationale && !item.met && (
        <div className="px-4 pb-3 pt-0">
          <Textarea
            placeholder="Reason for not meeting this target…"
            value={localRationale}
            onChange={(e) => setLocalRationale(e.target.value)}
            onBlur={() => {
              if (localRationale !== (item.rationale ?? "")) {
                onRationale(item.id, localRationale);
              }
            }}
            className="text-xs h-20 bg-white/70 border-gray-300 dark:bg-gray-800/70 dark:border-gray-600 resize-none"
          />
        </div>
      )}
    </div>
  );
}

// ── Custom item row ───────────────────────────────────────────────────────────

function CustomRow({
  item,
  onToggle,
  onUpdate,
  onDelete,
}: {
  item: quarterly_report.QuarterlyReportCustomItem;
  onToggle: (itemId: number, met: boolean) => void;
  onUpdate: (itemId: number, field: "description" | "target_text" | "rationale", val: string) => void;
  onDelete: (itemId: number) => void;
}) {
  const [localDesc, setLocalDesc] = useState(item.description);
  const [localTarget, setLocalTarget] = useState(item.target_text ?? "");
  const [localRationale, setLocalRationale] = useState(item.rationale ?? "");
  const [showRationale, setShowRationale] = useState(!!item.rationale);

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-b-0 bg-gray-50 dark:bg-gray-800/30">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button
          onClick={() => onToggle(item.id, !item.met)}
          className="flex-shrink-0 hover:opacity-70"
        >
          {item.met ? (
            <CheckSquare className="h-5 w-5 text-green-700" />
          ) : (
            <Square className="h-5 w-5 text-gray-500" />
          )}
        </button>

        <Input
          value={localDesc}
          onChange={(e) => setLocalDesc(e.target.value)}
          onBlur={() => {
            if (localDesc !== item.description) onUpdate(item.id, "description", localDesc);
          }}
          placeholder="Description…"
          className="flex-1 h-7 text-xs"
        />

        <Input
          value={localTarget}
          onChange={(e) => setLocalTarget(e.target.value)}
          onBlur={() => {
            if (localTarget !== (item.target_text ?? ""))
              onUpdate(item.id, "target_text", localTarget);
          }}
          placeholder="Target…"
          className="w-44 flex-shrink-0 h-7 text-xs"
        />

        {!item.met && (
          <button
            onClick={() => setShowRationale((s) => !s)}
            className="flex-shrink-0 text-xs text-gray-500 hover:text-gray-700"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
          </button>
        )}

        <button
          onClick={() => onDelete(item.id)}
          className="flex-shrink-0 text-gray-400 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {showRationale && !item.met && (
        <div className="px-4 pb-3">
          <Textarea
            value={localRationale}
            onChange={(e) => setLocalRationale(e.target.value)}
            onBlur={() => {
              if (localRationale !== (item.rationale ?? ""))
                onUpdate(item.id, "rationale", localRationale);
            }}
            placeholder="Reason for not meeting this target…"
            className="text-xs h-16 resize-none"
          />
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QuarterlyReportPage() {
  const { id } = useParams<{ id: string }>();
  const reportId = Number(id);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [notesValue, setNotesValue] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["quarterly-report", reportId],
    queryFn: async () => backend.quarterly_report.get(reportId),
    enabled: !!reportId,
  });

  const report = data?.report;

  // Initialise local notes from fetched data (only once)
  const notes = notesValue !== null ? notesValue : (report?.notes ?? "");

  // ── Mutations ──────────────────────────────────────────────────────────────

  const updateItemMut = useMutation({
    mutationFn: ({
      itemId,
      params,
    }: {
      itemId: number;
      params: quarterly_report.UpdateItemRequest;
    }) => backend.quarterly_report.updateItem(reportId, itemId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quarterly-report", reportId] });
      queryClient.invalidateQueries({ queryKey: ["quarterly-reports"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to update item", variant: "destructive" }),
  });

  const updateReportMut = useMutation({
    mutationFn: (params: quarterly_report.UpdateReportRequest) =>
      backend.quarterly_report.updateReport(reportId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quarterly-report", reportId] });
      queryClient.invalidateQueries({ queryKey: ["quarterly-reports"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to save", variant: "destructive" }),
  });

  const addCustomMut = useMutation({
    mutationFn: () =>
      backend.quarterly_report.addCustomItem(reportId, { description: "", target_text: "" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["quarterly-report", reportId] }),
    onError: () => toast({ title: "Error", description: "Failed to add row", variant: "destructive" }),
  });

  const updateCustomMut = useMutation({
    mutationFn: ({
      itemId,
      params,
    }: {
      itemId: number;
      params: quarterly_report.UpdateCustomItemRequest;
    }) => backend.quarterly_report.updateCustomItem(reportId, itemId, params),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["quarterly-report", reportId] }),
    onError: () => toast({ title: "Error", description: "Failed to update row", variant: "destructive" }),
  });

  const deleteCustomMut = useMutation({
    mutationFn: (itemId: number) =>
      backend.quarterly_report.deleteCustomItem(reportId, itemId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["quarterly-report", reportId] }),
    onError: () => toast({ title: "Error", description: "Failed to delete row", variant: "destructive" }),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleToggle = useCallback(
    (itemId: number, met: boolean) => {
      updateItemMut.mutate({ itemId, params: { met } });
    },
    [updateItemMut]
  );

  const handleRationale = useCallback(
    (itemId: number, text: string) => {
      updateItemMut.mutate({ itemId, params: { rationale: text } });
    },
    [updateItemMut]
  );

  const handleTargetText = useCallback(
    (itemId: number, text: string) => {
      updateItemMut.mutate({ itemId, params: { target_text: text } });
    },
    [updateItemMut]
  );

  const handleCustomToggle = useCallback(
    (itemId: number, met: boolean) => {
      updateCustomMut.mutate({ itemId, params: { met } });
    },
    [updateCustomMut]
  );

  const handleCustomUpdate = useCallback(
    (itemId: number, field: "description" | "target_text" | "rationale", val: string) => {
      updateCustomMut.mutate({ itemId, params: { [field]: val } });
    },
    [updateCustomMut]
  );

  const handleNotesSave = () => {
    updateReportMut.mutate({ notes });
    toast({ title: "Notes saved" });
  };

  // ── Loading / error states ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="p-8">
        <p className="text-destructive">Failed to load report.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/reports")}>
          Back to Reports
        </Button>
      </div>
    );
  }

  const metCount = report.items.filter((i) => i.met).length +
    report.custom_items.filter((i) => i.met).length;
  const totalCount = report.items.length + report.custom_items.length;

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button
            onClick={() => navigate("/reports")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Reports
          </button>
          <h1 className="text-2xl font-bold text-foreground">
            {report.watch} Watch · {quarterLabel(report.quarter, report.financial_year)}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {report.station_name} · WC: {report.watch_commander_name}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <Badge
            variant="outline"
            className={
              report.status === "submitted"
                ? "border-green-500 text-green-600"
                : "border-yellow-500 text-yellow-600"
            }
          >
            {report.status === "submitted" ? "Submitted" : "Draft"}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {metCount}/{totalCount} complete
          </span>
          <Link to={`/reports/quarterly/${reportId}/print`} target="_blank">
            <Button className="bg-indigo-600 hover:bg-indigo-700 gap-2">
              <Printer className="h-4 w-4" />
              Generate Report
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            CITY OF GLASGOW LSO AREA PERFORMANCE — Watch Based Quarterly Checklist
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Column headers */}
          <div
            className="flex items-center gap-3 px-4 py-2 border-b border-gray-300"
            style={{ backgroundColor: "#BFBFBF" }}
          >
            <span className="w-5 flex-shrink-0" />
            <span className="w-16 flex-shrink-0 text-xs font-bold text-gray-700">KPI</span>
            <span className="flex-1 text-xs font-bold text-gray-700">Description</span>
            <span className="w-44 flex-shrink-0 text-xs font-bold text-gray-700">Target</span>
            <span className="w-4 flex-shrink-0" />
          </div>

          {report.items.map((item) => (
            <KpiRow
              key={item.id}
              item={item}
              onToggle={handleToggle}
              onRationale={handleRationale}
              onTargetText={handleTargetText}
            />
          ))}
        </CardContent>
      </Card>

      {/* Other Actions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">
            Other Actions as Designated by Station Commander
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => addCustomMut.mutate()}
            disabled={addCustomMut.isPending}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Add Row
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {report.custom_items.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-4">
              No custom actions added yet. Click "Add Row" to add one.
            </p>
          ) : (
            report.custom_items.map((item) => (
              <CustomRow
                key={item.id}
                item={item}
                onToggle={handleCustomToggle}
                onUpdate={handleCustomUpdate}
                onDelete={(itemId) => deleteCustomMut.mutate(itemId)}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={notes}
            onChange={(e) => setNotesValue(e.target.value)}
            placeholder="General notes, rationale for missed targets, additional context…"
            className="min-h-28 resize-y"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleNotesSave}
            disabled={updateReportMut.isPending}
          >
            Save Notes
          </Button>
        </CardContent>
      </Card>

      {/* Mark submitted */}
      {report.status === "draft" && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            className="border-green-500 text-green-600 hover:bg-green-50"
            onClick={() => updateReportMut.mutate({ status: "submitted" })}
            disabled={updateReportMut.isPending}
          >
            Mark as Submitted
          </Button>
        </div>
      )}
    </div>
  );
}
