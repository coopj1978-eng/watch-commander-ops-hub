import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import backend from "~backend/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Download, FileSpreadsheet } from "lucide-react";

type TableName = "users" | "firefighter_profiles" | "tasks" | "inspections" | "absences" | "calendar_events" | "targets" | "policy_documents";

const TABLE_OPTIONS: { value: TableName; label: string }[] = [
  { value: "users", label: "Users" },
  { value: "firefighter_profiles", label: "Firefighter Profiles" },
  { value: "tasks", label: "Tasks" },
  { value: "inspections", label: "Inspections" },
  { value: "absences", label: "Absences" },
  { value: "calendar_events", label: "Calendar Events" },
  { value: "targets", label: "Targets" },
  { value: "policy_documents", label: "Policy Documents" },
];

export function CSVExportUtility() {
  const { toast } = useToast();
  const [selectedTable, setSelectedTable] = useState<TableName>("users");

  const exportMutation = useMutation({
    mutationFn: async (table: TableName) => {
      return await backend.report.exportTableCSV({ table });
    },
    onSuccess: (data) => {
      const blob = new Blob([data.csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export successful",
        description: `Downloaded ${data.filename}`,
      });
    },
    onError: (error: any) => {
      console.error(error);
      toast({
        title: "Export failed",
        description: "Failed to export CSV file",
        variant: "destructive",
      });
    },
  });

  const handleExport = () => {
    exportMutation.mutate(selectedTable);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          CSV Export Utility
        </CardTitle>
        <CardDescription>
          Export any table to CSV format for external analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="table-select">Select Table</Label>
          <Select
            value={selectedTable}
            onValueChange={(v) => setSelectedTable(v as TableName)}
          >
            <SelectTrigger id="table-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="p-4 bg-muted/50 rounded-lg space-y-2">
          <p className="text-sm font-medium">Export Information</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Exports all records from the selected table</li>
            <li>Downloaded as CSV file with headers</li>
            <li>Compatible with Excel, Google Sheets, and other tools</li>
            <li>Sensitive data may be included - handle securely</li>
          </ul>
        </div>

        <Button
          onClick={handleExport}
          disabled={exportMutation.isPending}
          className="w-full"
        >
          {exportMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export {TABLE_OPTIONS.find((t) => t.value === selectedTable)?.label} to CSV
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
