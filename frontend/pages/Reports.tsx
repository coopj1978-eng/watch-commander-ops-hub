import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import backend from "~backend/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Download, Upload, FileSpreadsheet } from "lucide-react";

const MOCK_USER_ID = "user_123";

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

export default function Reports() {
  const { toast } = useToast();
  const [selectedTable, setSelectedTable] = useState("");
  const [csvData, setCsvData] = useState("");

  const exportMutation = useMutation({
    mutationFn: async (table: string) => {
      return backend.report.exportCsv({ table, user_id: MOCK_USER_ID });
    },
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

      toast({
        title: "Success",
        description: "CSV exported successfully",
      });
    },
    onError: (error) => {
      console.error("Export error:", error);
      toast({
        title: "Error",
        description: "Failed to export CSV",
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (data: string) => {
      return backend.report.importStaffCsv({ csv_data: data, user_id: MOCK_USER_ID });
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Imported ${data.imported_count} staff members. ${data.errors.length} errors.`,
      });
      setCsvData("");
    },
    onError: (error) => {
      console.error("Import error:", error);
      toast({
        title: "Error",
        description: "Failed to import staff CSV",
        variant: "destructive",
      });
    },
  });

  const handleExport = () => {
    if (!selectedTable) return;
    exportMutation.mutate(selectedTable);
  };

  const handleImport = () => {
    if (!csvData.trim()) return;
    importMutation.mutate(csvData);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvData(text);
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Reports</h1>
        <p className="text-muted-foreground mt-1">Export and import data</p>
      </div>

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
              onClick={handleExport}
              disabled={!selectedTable || exportMutation.isPending}
              className="bg-red-600 hover:bg-red-700 w-full"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {exportMutation.isPending ? "Exporting..." : "Export CSV"}
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
              onClick={handleImport}
              disabled={!csvData.trim() || importMutation.isPending}
              className="bg-red-600 hover:bg-red-700 w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {importMutation.isPending ? "Importing..." : "Import Staff"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Templates</CardTitle>
          <CardDescription>Pre-configured reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <Button variant="outline" className="justify-start">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Absence Summary Report
            </Button>
            <Button variant="outline" className="justify-start">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Task Completion Report
            </Button>
            <Button variant="outline" className="justify-start">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Inspection Status Report
            </Button>
            <Button variant="outline" className="justify-start">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Target Progress Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
