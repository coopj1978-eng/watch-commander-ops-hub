import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Settings2, Plus, Eye, EyeOff } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ColumnsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  visibleColumns: Record<string, boolean>;
  setVisibleColumns: (cols: Record<string, boolean>) => void;
  canManageSchema: boolean;
}

export default function ColumnsDrawer({
  isOpen,
  onClose,
  visibleColumns,
  setVisibleColumns,
  canManageSchema,
}: ColumnsDrawerProps) {
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState<"string" | "number" | "boolean">("string");
  const [customColumns, setCustomColumns] = useState<
    Array<{ name: string; type: "string" | "number" | "boolean" }>
  >([]);

  const defaultColumns = [
    { key: "name", label: "Name", locked: true },
    { key: "watch", label: "Watch", locked: false },
    { key: "phone", label: "Phone", locked: false },
    { key: "email", label: "Email", locked: false },
    { key: "rank", label: "Rank", locked: false },
    { key: "staffNumber", label: "Staff Number", locked: false },
    { key: "niNumber", label: "NI Number", locked: false },
    { key: "skills", label: "Skills", locked: false },
    { key: "driverPathway", label: "Driver Pathway", locked: false },
    { key: "absence", label: "Absence (6m/1y)", locked: false },
    { key: "lastConversation", label: "Last Conversation", locked: false },
  ];

  const toggleColumn = (key: string) => {
    setVisibleColumns({
      ...visibleColumns,
      [key]: !visibleColumns[key],
    });
  };

  const addCustomColumn = () => {
    if (!newColumnName.trim()) return;
    
    const columnKey = newColumnName.toLowerCase().replace(/\s+/g, "_");
    setCustomColumns([...customColumns, { name: newColumnName, type: newColumnType }]);
    setVisibleColumns({
      ...visibleColumns,
      [columnKey]: true,
    });
    setNewColumnName("");
    setNewColumnType("string");
  };

  const showAllColumns = () => {
    const allVisible: Record<string, boolean> = {};
    defaultColumns.forEach(col => {
      allVisible[col.key] = true;
    });
    customColumns.forEach(col => {
      const key = col.name.toLowerCase().replace(/\s+/g, "_");
      allVisible[key] = true;
    });
    setVisibleColumns(allVisible);
  };

  const hideAllOptional = () => {
    const visible: Record<string, boolean> = {};
    defaultColumns.forEach(col => {
      visible[col.key] = col.locked;
    });
    setVisibleColumns(visible);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Manage Columns
          </DialogTitle>
          <DialogDescription>
            Show or hide columns in the People table. {canManageSchema && "As a Watch Commander, you can add custom columns."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={showAllColumns} className="flex-1">
              <Eye className="h-4 w-4 mr-1" />
              Show All
            </Button>
            <Button variant="outline" size="sm" onClick={hideAllOptional} className="flex-1">
              <EyeOff className="h-4 w-4 mr-1" />
              Hide Optional
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Default Columns</h3>
            {defaultColumns.map((col) => (
              <label
                key={col.key}
                className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
              >
                <Checkbox
                  checked={visibleColumns[col.key]}
                  onCheckedChange={() => toggleColumn(col.key)}
                  disabled={col.locked}
                />
                <span className="text-sm flex-1">{col.label}</span>
                {col.locked && (
                  <span className="text-xs text-muted-foreground">(required)</span>
                )}
              </label>
            ))}
          </div>

          {customColumns.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Custom Columns</h3>
                {customColumns.map((col, idx) => {
                  const key = col.name.toLowerCase().replace(/\s+/g, "_");
                  return (
                    <label
                      key={idx}
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
                    >
                      <Checkbox
                        checked={visibleColumns[key]}
                        onCheckedChange={() => toggleColumn(key)}
                      />
                      <span className="text-sm flex-1">{col.name}</span>
                      <span className="text-xs text-muted-foreground">({col.type})</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          {canManageSchema && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Add Custom Column</h3>
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="columnName">Column Name</Label>
                    <Input
                      id="columnName"
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      placeholder="e.g., Badge Number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="columnType">Data Type</Label>
                    <Select value={newColumnType} onValueChange={(v: any) => setNewColumnType(v)}>
                      <SelectTrigger id="columnType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">Text</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="boolean">Yes/No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={addCustomColumn}
                    disabled={!newColumnName.trim()}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Column
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
