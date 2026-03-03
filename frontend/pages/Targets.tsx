import { useState, useMemo } from "react";
import TargetsDashboard from "@/components/TargetsDashboard";
import InspectionAssignments from "@/components/InspectionAssignments";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Calendar } from "lucide-react";

type PeriodType = "month" | "quarter" | "year" | "custom";

export default function Targets() {
  const [periodType, setPeriodType] = useState<PeriodType>("quarter");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const getPeriodDates = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    switch (periodType) {
      case "month": {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        return {
          start: start.toISOString().split("T")[0],
          end: end.toISOString().split("T")[0],
          label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        };
      }
      case "quarter": {
        const quarter = Math.floor(month / 3);
        const start = new Date(year, quarter * 3, 1);
        const end = new Date(year, quarter * 3 + 3, 0);
        return {
          start: start.toISOString().split("T")[0],
          end: end.toISOString().split("T")[0],
          label: `Q${quarter + 1} ${year}`,
        };
      }
      case "year": {
        const start = new Date(year, 0, 1);
        const end = new Date(year, 11, 31);
        return {
          start: start.toISOString().split("T")[0],
          end: end.toISOString().split("T")[0],
          label: year.toString(),
        };
      }
      case "custom": {
        return {
          start: customStart,
          end: customEnd,
          label: customStart && customEnd ? `${customStart} to ${customEnd}` : "Custom Period",
        };
      }
      default:
        return { start: "", end: "", label: "" };
    }
  }, [periodType, customStart, customEnd]);

  const quarters = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const result = [];
    
    for (let year = currentYear; year >= currentYear - 1; year--) {
      for (let q = 3; q >= 0; q--) {
        const start = new Date(year, q * 3, 1);
        const end = new Date(year, q * 3 + 3, 0);
        result.push({
          label: `Q${q + 1} ${year}`,
          start: start.toISOString().split("T")[0],
          end: end.toISOString().split("T")[0],
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
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0],
      });
    }
    
    return result;
  }, []);

  // Derive year + quarter number from the selected period so InspectionAssignments
  // can stay in sync with the Targets period selector.
  const { inspYear, inspQuarter } = useMemo(() => {
    const start = getPeriodDates.start;
    const end   = getPeriodDates.end;
    if (!start) return { inspYear: new Date().getFullYear(), inspQuarter: null as number | null };
    const d          = new Date(start);
    const y          = d.getFullYear();
    const startMonth = d.getMonth();
    const endMonth   = end ? new Date(end).getMonth() : 11;
    // Full-year view → no specific quarter
    if (startMonth === 0 && endMonth === 11) return { inspYear: y, inspQuarter: null as number | null };
    return { inspYear: y, inspQuarter: (Math.floor(startMonth / 3) + 1) as number | null };
  }, [getPeriodDates]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Performance Targets</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage performance metrics
          </p>
        </div>
        <Button className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" />
          New Target
        </Button>
      </div>

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
                  value={getPeriodDates.start}
                  onValueChange={(value) => {
                    const quarter = quarters.find((q) => q.start === value);
                    if (quarter) {
                      setCustomStart(quarter.start);
                      setCustomEnd(quarter.end);
                      setPeriodType("custom");
                    }
                  }}
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
                  value={getPeriodDates.start}
                  onValueChange={(value) => {
                    const month = months.find((m) => m.start === value);
                    if (month) {
                      setCustomStart(month.start);
                      setCustomEnd(month.end);
                      setPeriodType("custom");
                    }
                  }}
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
