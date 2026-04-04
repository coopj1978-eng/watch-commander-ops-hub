import { useState, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import TargetsDashboard from "@/components/TargetsDashboard";
import InspectionAssignments from "@/components/InspectionAssignments";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, Calendar, Target } from "lucide-react";
import backend from "@/lib/backend";
import { useAuth } from "@/App";

type PeriodType = "month" | "quarter" | "year" | "custom";

// ── Quarterly Year-at-a-Glance ───────────────────────────────────────────────

const ACTIVITY_METRICS = [
  { key: "hfsv",      label: "HFSV",       target: 36, colour: "orange" },
  { key: "community", label: "Community",  target: 4,  colour: "teal"   },
  { key: "hydrant",   label: "Hydrant",    target: 20, colour: "purple" },
] as const;

const QUARTER_LABELS = ["Q1 Apr–Jun", "Q2 Jul–Sep", "Q3 Oct–Dec", "Q4 Jan–Mar"];

function QuarterlyOverview({ watch }: { watch: string }) {
  const now = new Date();
  const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  // Q1=Apr-Jun=1, Q2=Jul-Sep=2, Q3=Oct-Dec=3, Q4=Jan-Mar=4
  const currentQ = Math.floor(((now.getMonth() + 9) % 12) / 3) + 1;

  // Activity-based queries: 3 metrics × 4 quarters = 12
  const activityResults = useQueries({
    queries: ACTIVITY_METRICS.flatMap((metric) =>
      [1, 2, 3, 4].map((q) => ({
        queryKey: ["activities-q", metric.key, watch, fy, q],
        queryFn: () =>
          backend.activity.list({
            type: metric.key,
            watch: watch || undefined,
            financial_year: fy,
            quarter: q,
          }),
        enabled: !!watch,
      }))
    ),
  });

  // Multi-story queries: 4 quarters (uses calendar year mapping from FY quarter)
  const msResults = useQueries({
    queries: [1, 2, 3, 4].map((fq) => {
      // Map financial quarter to calendar year + calendar quarter
      // FY Q1=Apr-Jun → cal Q2 of fy, Q2=Jul-Sep → cal Q3 of fy, Q3=Oct-Dec → cal Q4 of fy, Q4=Jan-Mar → cal Q1 of fy+1
      const calYear = fq === 4 ? fy + 1 : fy;
      const calQ = fq === 4 ? 1 : fq + 1;
      return {
        queryKey: ["ms-assignments-q", watch, calYear, calQ],
        queryFn: () =>
          backend.inspection_plans.listAssignments({
            watch: watch || undefined,
            year: calYear,
            quarter: calQ,
            plan_type: "multistory",
          }),
        enabled: !!watch,
      };
    }),
  });

  function getActivityResult(metricIdx: number, q: number) {
    return activityResults[metricIdx * 4 + (q - 1)];
  }

  function getMsResult(q: number) {
    return msResults[q - 1];
  }

  function barColour(pct: number, isFuture: boolean, colourKey: string) {
    if (isFuture) return "bg-muted";
    if (pct >= 100) return "bg-green-500";
    if (pct >= 50)  return "bg-amber-400";
    return "bg-red-500";
  }

  function textColour(pct: number, isFuture: boolean) {
    if (isFuture) return "text-muted-foreground";
    if (pct >= 100) return "text-green-600 dark:text-green-400";
    if (pct >= 50)  return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  }

  const isLoading = activityResults.some((r) => r.isLoading) || msResults.some((r) => r.isLoading);

  return (
    <Card className="border-t-2 border-t-indigo-500">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-500" />
          <CardTitle className="text-base">Year at a Glance — FY {fy}/{String(fy + 1).slice(2)}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground animate-pulse">Loading quarterly data…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left font-medium text-muted-foreground pb-2 pr-4 w-24">Metric</th>
                  {QUARTER_LABELS.map((label, idx) => {
                    const q = idx + 1;
                    const isCurrent = q === currentQ;
                    return (
                      <th
                        key={q}
                        className={`text-center font-medium pb-2 px-2 ${
                          isCurrent
                            ? "text-indigo-600 dark:text-indigo-400"
                            : "text-muted-foreground"
                        }`}
                      >
                        <span className="block text-xs">{label}</span>
                        {isCurrent && (
                          <span className="inline-block mt-0.5 text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full leading-none">
                            current
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ACTIVITY_METRICS.map((metric, mIdx) => (
                  <tr key={metric.key}>
                    <td className="py-3 pr-4 font-medium text-foreground">{metric.label}</td>
                    {[1, 2, 3, 4].map((q) => {
                      const result = getActivityResult(mIdx, q);
                      const completed = result.data?.total_completed ?? 0;
                      const isFuture = q > currentQ && (result.data?.total ?? 0) === 0;
                      const pct = Math.min(100, Math.round((completed / metric.target) * 100));
                      const isCurrent = q === currentQ;

                      return (
                        <td
                          key={q}
                          className={`py-3 px-2 ${isCurrent ? "bg-indigo-50/50 dark:bg-indigo-950/20 rounded" : ""}`}
                        >
                          <div className="flex flex-col items-center gap-1.5 min-w-[72px]">
                            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${barColour(pct, isFuture, metric.colour)}`}
                                style={{ width: isFuture ? "0%" : `${pct}%` }}
                              />
                            </div>
                            <span className={`text-xs font-semibold tabular-nums ${textColour(pct, isFuture)}`}>
                              {isFuture ? "–" : `${completed}/${metric.target}`}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Multi-Story row — from inspection_plans assignments */}
                <tr>
                  <td className="py-3 pr-4 font-medium text-foreground">Multi-Story</td>
                  {[1, 2, 3, 4].map((q) => {
                    const result = getMsResult(q);
                    const total = result.data?.items?.length ?? 0;
                    const completed = result.data?.totals?.complete ?? 0;
                    const isFuture = q > currentQ && total === 0;
                    const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
                    const isCurrent = q === currentQ;

                    return (
                      <td
                        key={q}
                        className={`py-3 px-2 ${isCurrent ? "bg-indigo-50/50 dark:bg-indigo-950/20 rounded" : ""}`}
                      >
                        <div className="flex flex-col items-center gap-1.5 min-w-[72px]">
                          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${barColour(pct, isFuture, "blue")}`}
                              style={{ width: isFuture ? "0%" : `${pct}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold tabular-nums ${textColour(pct, isFuture)}`}>
                            {isFuture ? "–" : `${completed}/${total}`}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Targets() {
  const { user } = useAuth();
  const [periodType, setPeriodType] = useState<PeriodType>("quarter");
  const [selectedQuarter, setSelectedQuarter] = useState<string>(""); // start date of selected quarter
  const [selectedMonth, setSelectedMonth] = useState<string>("");     // start date of selected month
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Timezone-safe YYYY-MM-DD formatter (avoids UTC shift from toISOString)
  const toLocalDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // ── Must be defined BEFORE getPeriodDates which references them ──────────
  const quarters = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    // Use financial year quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
    const currentFY = month >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const result = [];

    // Show current FY and previous FY quarters
    for (const fy of [currentFY, currentFY - 1]) {
      // FY Q1 = Apr of fy, Q2 = Jul of fy, Q3 = Oct of fy, Q4 = Jan of fy+1
      const fyQuarters = [
        { q: 1, start: new Date(fy, 3, 1),  end: new Date(fy, 5, 30),    label: `Q1 ${fy}/${String(fy + 1).slice(2)} (Apr–Jun)` },
        { q: 2, start: new Date(fy, 6, 1),  end: new Date(fy, 8, 30),    label: `Q2 ${fy}/${String(fy + 1).slice(2)} (Jul–Sep)` },
        { q: 3, start: new Date(fy, 9, 1),  end: new Date(fy, 11, 31),   label: `Q3 ${fy}/${String(fy + 1).slice(2)} (Oct–Dec)` },
        { q: 4, start: new Date(fy + 1, 0, 1), end: new Date(fy + 1, 2, 31), label: `Q4 ${fy}/${String(fy + 1).slice(2)} (Jan–Mar)` },
      ];
      for (const fq of fyQuarters) {
        result.push({
          label: fq.label,
          start: toLocalDate(fq.start),
          end: toLocalDate(fq.end),
        });
      }
    }

    return result;
  }, []);

  const months = useMemo(() => {
    const now = new Date();
    const result = [];

    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth();
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);

      result.push({
        label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        start: toLocalDate(start),
        end: toLocalDate(end),
      });
    }

    return result;
  }, []);

  // ── Compute period start/end/label from current selections ────────────────
  const getPeriodDates = useMemo(() => {
    switch (periodType) {
      case "quarter": {
        if (selectedQuarter) {
          const match = quarters.find((q) => q.start === selectedQuarter);
          if (match) return { start: match.start, end: match.end, label: match.label };
        }
        // Default: current FY quarter
        const now = new Date();
        const m = now.getMonth(); // 0-based
        // FY quarter index: Apr-Jun=0, Jul-Sep=1, Oct-Dec=2, Jan-Mar=3
        const fyQIdx = m >= 3 ? Math.floor((m - 3) / 3) : 3;
        const defaultQ = quarters[fyQIdx]; // first 4 entries are current FY
        return defaultQ
          ? { start: defaultQ.start, end: defaultQ.end, label: defaultQ.label }
          : { start: "", end: "", label: "" };
      }
      case "month": {
        if (selectedMonth) {
          const match = months.find((m) => m.start === selectedMonth);
          if (match) return { start: match.start, end: match.end, label: match.label };
        }
        // Default: current month
        const defaultM = months[0];
        return defaultM
          ? { start: defaultM.start, end: defaultM.end, label: defaultM.label }
          : { start: "", end: "", label: "" };
      }
      case "year": {
        const now = new Date();
        const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        const start = `${fy}-04-01`;
        const end = `${fy + 1}-03-31`;
        return { start, end, label: `FY ${fy}/${String(fy + 1).slice(2)}` };
      }
      case "custom":
        return {
          start: customStart,
          end: customEnd,
          label: customStart && customEnd ? "Custom Range" : "Select dates",
        };
      default:
        return { start: "", end: "", label: "" };
    }
  }, [periodType, selectedQuarter, selectedMonth, customStart, customEnd, quarters, months]);

  // Derive year + quarter for InspectionAssignments (Multi-Story, Care Homes, Hydrants, Operational)
  const { inspYear, inspQuarter } = useMemo(() => {
    const start = getPeriodDates.start;
    if (!start) return { inspYear: new Date().getFullYear(), inspQuarter: null as number | null };
    const d = new Date(start + "T00:00:00"); // timezone-safe parse
    const startMonth = d.getMonth();
    // Full-year view → no specific quarter
    if (periodType === "year") return { inspYear: d.getFullYear(), inspQuarter: null as number | null };
    // Map start month to calendar quarter for API:
    // Apr(3)→Q2, Jul(6)→Q3, Oct(9)→Q4, Jan(0)→Q1
    const calQ = Math.floor(startMonth / 3) + 1;
    return { inspYear: d.getFullYear(), inspQuarter: calQ as number | null };
  }, [getPeriodDates, periodType]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <Target className="h-7 w-7 text-rose-500 shrink-0" />
            Performance Targets
          </h1>
          <p className="text-muted-foreground mt-1">
            Track and manage performance metrics
          </p>
        </div>
{/* Targets are auto-derived from activity records and inspection assignments */}
      </div>

      <QuarterlyOverview watch={user?.watch_unit ?? ""} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Period Selection</CardTitle>
            </div>
            <CardDescription>{getPeriodDates.label}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Period Type</label>
              <Select value={periodType} onValueChange={(value: PeriodType) => setPeriodType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="quarter">Quarterly</SelectItem>
                  <SelectItem value="year">Yearly</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {periodType === "quarter" && (
              <div>
                <label className="text-sm font-medium mb-2 block">Select Quarter</label>
                <Select
                  value={selectedQuarter || getPeriodDates.start}
                  onValueChange={(value) => setSelectedQuarter(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {quarters.map((q) => (
                      <SelectItem key={q.start} value={q.start}>
                        {q.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {periodType === "month" && (
              <div>
                <label className="text-sm font-medium mb-2 block">Select Month</label>
                <Select
                  value={selectedMonth || getPeriodDates.start}
                  onValueChange={(value) => setSelectedMonth(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m.start} value={m.start}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {periodType === "custom" && (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">Start Date</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">End Date</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </>
            )}
          </div>

          {/* Date range summary */}
          {getPeriodDates.start && getPeriodDates.end && (
            <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900">
              <Calendar className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                {new Date(getPeriodDates.start + "T00:00:00").toLocaleDateString("en-GB", {
                  day: "numeric", month: "long", year: "numeric",
                })}
                {" – "}
                {new Date(getPeriodDates.end + "T00:00:00").toLocaleDateString("en-GB", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </span>
              <span className="ml-auto text-xs font-semibold text-indigo-500">{getPeriodDates.label}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <TargetsDashboard
        periodStart={getPeriodDates.start}
        periodEnd={getPeriodDates.end}
        showPeriodSelector={false}
      />

      <InspectionAssignments year={inspYear} quarter={inspQuarter} />
    </div>
  );
}
