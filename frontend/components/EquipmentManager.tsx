import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  Package,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useIsWatchCommander } from "@/lib/rbac";
import backend from "@/lib/backend";

interface EquipmentManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applianceId: number;
  applianceName: string;
}

const CATEGORIES = [
  { value: "BA", label: "Breathing Apparatus" },
  { value: "Ladders", label: "Ladders" },
  { value: "Hose", label: "Hose" },
  { value: "TIC", label: "Thermal Imaging" },
  { value: "PPE", label: "PPE" },
  { value: "Tools", label: "Tools" },
  { value: "Medical", label: "Medical" },
  { value: "Other", label: "Other" },
];

interface NewItemForm {
  name: string;
  category: string;
  serial_number: string;
  quantity: number;
}

interface EditingItem {
  id: number;
  name: string;
  category: string;
  serial_number: string;
  quantity: number;
}

export default function EquipmentManager({
  open,
  onOpenChange,
  applianceId,
  applianceName,
}: EquipmentManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isWC = useIsWatchCommander();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [newItem, setNewItem] = useState<NewItemForm>({
    name: "",
    category: "Other",
    serial_number: "",
    quantity: 1,
  });

  const { data: equipmentData, isLoading } = useQuery({
    queryKey: ["equipment", applianceId],
    queryFn: async () => {
      const result = await backend.appliance.listEquipment({
        appliance_id: applianceId,
      });
      return result;
    },
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return await backend.appliance.createEquipment({
        appliance_id: applianceId,
        name: newItem.name,
        category: newItem.category,
        serial_number: newItem.serial_number || undefined,
        quantity: newItem.quantity,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment", applianceId] });
      toast({ title: "Equipment added" });
      setNewItem({ name: "", category: "Other", serial_number: "", quantity: 1 });
      setShowAddForm(false);
    },
    onError: () => {
      toast({ title: "Failed to add equipment", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (item: EditingItem) => {
      return await backend.appliance.updateEquipment({
        id: item.id,
        name: item.name,
        category: item.category,
        serial_number: item.serial_number || undefined,
        quantity: item.quantity,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment", applianceId] });
      toast({ title: "Equipment updated" });
      setEditingItem(null);
    },
    onError: () => {
      toast({ title: "Failed to update equipment", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await backend.appliance.deleteEquipment({ id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment", applianceId] });
      toast({ title: "Equipment removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove equipment", variant: "destructive" });
    },
  });

  const items = equipmentData?.items || [];

  const categoryLabel = (cat: string) =>
    CATEGORIES.find((c) => c.value === cat)?.label || cat;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Manage Equipment — {applianceName}
          </DialogTitle>
          <DialogDescription>
            Add, edit, or remove equipment items for this appliance. Changes will
            apply to future J4 checks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Add button */}
          <div className="flex justify-end">
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              variant={showAddForm ? "secondary" : "default"}
              size="sm"
            >
              {showAddForm ? (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Equipment
                </>
              )}
            </Button>
          </div>

          {/* Add form */}
          {showAddForm && (
            <div className="border rounded-lg p-4 bg-muted/50 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="new-name">Name *</Label>
                  <Input
                    id="new-name"
                    placeholder="e.g. BA Set 1035"
                    value={newItem.name}
                    onChange={(e) =>
                      setNewItem((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="new-category">Category *</Label>
                  <Select
                    value={newItem.category}
                    onValueChange={(v) =>
                      setNewItem((p) => ({ ...p, category: v }))
                    }
                  >
                    <SelectTrigger id="new-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="new-serial">Serial Number</Label>
                  <Input
                    id="new-serial"
                    placeholder="Optional"
                    value={newItem.serial_number}
                    onChange={(e) =>
                      setNewItem((p) => ({
                        ...p,
                        serial_number: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="new-qty">Quantity</Label>
                  <Input
                    id="new-qty"
                    type="number"
                    min={1}
                    value={newItem.quantity}
                    onChange={(e) =>
                      setNewItem((p) => ({
                        ...p,
                        quantity: parseInt(e.target.value) || 1,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={
                    !newItem.name.trim() || createMutation.isPending
                  }
                  size="sm"
                  className="bg-red-600 hover:bg-red-700"
                >
                  {createMutation.isPending ? "Adding..." : "Add Item"}
                </Button>
              </div>
            </div>
          )}

          {/* Equipment table */}
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">
              Loading equipment...
            </p>
          ) : items.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No equipment items configured for this appliance.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Serial No.</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) =>
                    editingItem?.id === item.id ? (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Input
                            value={editingItem.name}
                            onChange={(e) =>
                              setEditingItem((p) =>
                                p ? { ...p, name: e.target.value } : null
                              )
                            }
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={editingItem.category}
                            onValueChange={(v) =>
                              setEditingItem((p) =>
                                p ? { ...p, category: v } : null
                              )
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map((cat) => (
                                <SelectItem key={cat.value} value={cat.value}>
                                  {cat.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editingItem.serial_number}
                            onChange={(e) =>
                              setEditingItem((p) =>
                                p
                                  ? { ...p, serial_number: e.target.value }
                                  : null
                              )
                            }
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={editingItem.quantity}
                            onChange={(e) =>
                              setEditingItem((p) =>
                                p
                                  ? {
                                      ...p,
                                      quantity: parseInt(e.target.value) || 1,
                                    }
                                  : null
                              )
                            }
                            className="h-8 w-16"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() =>
                                updateMutation.mutate(editingItem)
                              }
                            >
                              <Save className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => setEditingItem(null)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {categoryLabel(item.category)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.serial_number || "—"}
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() =>
                                setEditingItem({
                                  id: item.id,
                                  name: item.name,
                                  category: item.category,
                                  serial_number: item.serial_number || "",
                                  quantity: item.quantity,
                                })
                              }
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {isWC && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                                onClick={() => deleteMutation.mutate(item.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
