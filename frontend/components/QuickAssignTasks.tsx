import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

const CATEGORIES = ["Training", "Inspection", "HFSV", "Admin", "Other"];
const PRIORITIES = ["Low", "Med", "High"];

export function QuickAssignTasks() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "Training",
    priority: "Med",
    stagger_days: 1,
    start_date: new Date().toISOString().split("T")[0],
  });

  const [selectedFFs, setSelectedFFs] = useState<Set<string>>(new Set());

  const { data: users } = useQuery({
    queryKey: ["crew-firefighters"],
    queryFn: async () => {
      const response = await backend.user.list({});
      const foundUser = response.users.find((u) => u.id === currentUser?.id);
      if (!foundUser?.watch_unit) return [];
      return response.users.filter(
        (u) => u.role === "FF" && u.watch_unit === foundUser.watch_unit
      );
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async () => {
      const result = await backend.crew.bulkAssign({
        assigned_to_ids: Array.from(selectedFFs),
        title: formData.title,
        description: formData.description || undefined,
        category: formData.category,
        priority: formData.priority,
        stagger_days: formData.stagger_days,
        start_date: new Date(formData.start_date),
      });
      return result.tasks;
    },
    onSuccess: () => {
      toast({
        title: "Tasks assigned",
        description: `Successfully assigned ${selectedFFs.size} task(s)`,
      });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["crew-stats"] });
      setFormData({
        title: "",
        description: "",
        category: "Training",
        priority: "Med",
        stagger_days: 1,
        start_date: new Date().toISOString().split("T")[0],
      });
      setSelectedFFs(new Set());
    },
    onError: (error: any) => {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to assign tasks",
        variant: "destructive",
      });
    },
  });

  const handleToggleFF = (ffId: string) => {
    const newSet = new Set(selectedFFs);
    if (newSet.has(ffId)) {
      newSet.delete(ffId);
    } else {
      newSet.add(ffId);
    }
    setSelectedFFs(newSet);
  };

  const handleSelectAll = () => {
    if (!users) return;
    if (selectedFFs.size === users.length) {
      setSelectedFFs(new Set());
    } else {
      setSelectedFFs(new Set(users.map((u) => u.id)));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Task title is required",
        variant: "destructive",
      });
      return;
    }
    if (selectedFFs.size === 0) {
      toast({
        title: "Error",
        description: "Please select at least one firefighter",
        variant: "destructive",
      });
      return;
    }
    bulkAssignMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Assign Tasks</CardTitle>
        <CardDescription>
          Assign tasks to multiple firefighters with staggered due dates
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Task Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Complete Fire Safety Training"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(v) => setFormData({ ...formData, priority: v })}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stagger_days">Stagger Days</Label>
              <Input
                id="stagger_days"
                type="number"
                min="0"
                value={formData.stagger_days}
                onChange={(e) =>
                  setFormData({ ...formData, stagger_days: parseInt(e.target.value) || 0 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Days between each assignment
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add task details..."
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Select Firefighters ({selectedFFs.size} selected)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedFFs.size === users?.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <div className="border rounded-md p-4 max-h-48 overflow-y-auto space-y-2">
              {!users || users.length === 0 ? (
                <p className="text-sm text-muted-foreground">No firefighters found in your crew</p>
              ) : (
                users.map((ff) => (
                  <div key={ff.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`ff-${ff.id}`}
                      checked={selectedFFs.has(ff.id)}
                      onCheckedChange={() => handleToggleFF(ff.id)}
                    />
                    <label
                      htmlFor={`ff-${ff.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                    >
                      {ff.name} {ff.rank && `(${ff.rank})`}
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormData({
                  title: "",
                  description: "",
                  category: "Training",
                  priority: "Med",
                  stagger_days: 1,
                  start_date: new Date().toISOString().split("T")[0],
                });
                setSelectedFFs(new Set());
              }}
            >
              Reset
            </Button>
            <Button type="submit" disabled={bulkAssignMutation.isPending}>
              {bulkAssignMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Assign Tasks
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
