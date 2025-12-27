import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBackend } from "@/lib/rbac";
import type { DictionaryType } from "~backend/dictionary/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useIsWC } from "@/lib/rbac";
import { useUser } from "@clerk/clerk-react";
import { Loader2, Plus, Pencil, Trash2, X, Check, BookOpen, Award, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DictionaryManagerProps {
  type: DictionaryType;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  isOpen?: boolean;
  onClose?: () => void;
}

export function DictionaryManager({ type, title, description, icon, isOpen, onClose }: DictionaryManagerProps) {
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isWC = useIsWC();
  const { user } = useUser();

  const [newValue, setNewValue] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: dictionaries, isLoading } = useQuery({
    queryKey: ["dictionaries", type],
    queryFn: async () => {
      const response = await backend.dictionary.list({ type });
      return response.items;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (value: string) => {
      return await backend.dictionary.create({ type, value });
    },
    onSuccess: async (data) => {
      if (user?.id) {
        try {
          await backend.admin.createActivityLog({
            actor_user_id: user.id,
            action: "create_dictionary",
            entity_type: "dictionary",
            entity_id: data.id.toString(),
            metadata: { type, value: data.value },
          });
        } catch (error) {
          console.error("Failed to log activity:", error);
        }
      }

      toast({
        title: `${type === "skill" ? "Skill" : "Certification"} added`,
        description: "Dictionary entry has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["dictionaries", type] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setNewValue("");
    },
    onError: (error) => {
      console.error("Failed to create dictionary entry:", error);
      toast({
        title: "Failed to add entry",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, value }: { id: number; value: string }) => {
      return await backend.dictionary.update({ id, value });
    },
    onSuccess: async (data) => {
      if (user?.id) {
        try {
          await backend.admin.createActivityLog({
            actor_user_id: user.id,
            action: "update_dictionary",
            entity_type: "dictionary",
            entity_id: data.id.toString(),
            metadata: { type, value: data.value },
          });
        } catch (error) {
          console.error("Failed to log activity:", error);
        }
      }

      toast({
        title: "Entry updated",
        description: "Dictionary entry has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["dictionaries", type] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setEditingId(null);
      setEditValue("");
    },
    onError: (error) => {
      console.error("Failed to update dictionary entry:", error);
      toast({
        title: "Failed to update entry",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await backend.dictionary.deleteDictionary({ id });
    },
    onSuccess: async (_, id) => {
      if (user?.id) {
        try {
          await backend.admin.createActivityLog({
            actor_user_id: user.id,
            action: "delete_dictionary",
            entity_type: "dictionary",
            entity_id: id.toString(),
            metadata: { type },
          });
        } catch (error) {
          console.error("Failed to log activity:", error);
        }
      }

      toast({
        title: "Entry deleted",
        description: "Dictionary entry has been removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["dictionaries", type] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) => {
      console.error("Failed to delete dictionary entry:", error);
      toast({
        title: "Failed to delete entry",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!newValue.trim()) return;
    createMutation.mutate(newValue.trim());
  };

  const handleStartEdit = (id: number, value: string) => {
    setEditingId(id);
    setEditValue(value);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const handleSaveEdit = (id: number) => {
    if (!editValue.trim()) return;
    updateMutation.mutate({ id, value: editValue.trim() });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this entry? It may be in use by firefighter profiles.")) {
      deleteMutation.mutate(id);
    }
  };

  const defaultTitle = type === "skill" ? "Skills Dictionary" : "Certifications Dictionary";
  const defaultDescription = type === "skill" 
    ? "Manage global skills that can be assigned to firefighters"
    : "Manage certifications";
  const defaultIcon = type === "skill" ? <BookOpen className="h-5 w-5" /> : <Award className="h-5 w-5" />;

  const content = (
    <>
      {isWC && (
        <div className="flex gap-2 mb-4">
          <div className="flex-1">
            <Input
              placeholder={`Add new ${type === "skill" ? "skill" : "certification"}...`}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>
          <Button
            onClick={handleCreate}
            disabled={!newValue.trim() || createMutation.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      )}

      {!isWC && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Lock className="h-4 w-4" />
          <span>Read-only (Watch Commander access required)</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                {isWC && <TableHead className="w-[100px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {!dictionaries || dictionaries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isWC ? 4 : 3} className="text-center py-8 text-muted-foreground">
                    No entries yet. {isWC && "Add one above to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                dictionaries.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {editingId === item.id ? (
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSaveEdit(item.id);
                            }
                            if (e.key === "Escape") {
                              handleCancelEdit();
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium">{item.value}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.active ? "default" : "outline"}>
                        {item.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(item.created_at).toLocaleDateString()}
                    </TableCell>
                    {isWC && (
                      <TableCell>
                        {editingId === item.id ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSaveEdit(item.id)}
                              disabled={!editValue.trim() || updateMutation.isPending}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEdit}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStartEdit(item.id, item.value)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(item.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
  
  if (isOpen !== undefined && onClose) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {icon || defaultIcon}
              {title || defaultTitle}
            </DialogTitle>
            <DialogDescription>{description || defaultDescription}</DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon || defaultIcon}
          {title || defaultTitle}
        </CardTitle>
        <CardDescription>{description || defaultDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {content}
      </CardContent>
    </Card>
  );
}

export default DictionaryManager;

export function DictionariesManager() {
  return (
    <div className="space-y-6">
      <DictionaryManager
        type="skill"
        title="Skills Dictionary"
        description="Manage available skills for firefighter profiles"
        icon={<BookOpen className="h-5 w-5" />}
      />
      <DictionaryManager
        type="cert"
        title="Certifications Dictionary"
        description="Manage available certifications for firefighter profiles"
        icon={<Award className="h-5 w-5" />}
      />
    </div>
  );
}
