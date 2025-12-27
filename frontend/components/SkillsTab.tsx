import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBackend } from "@/lib/rbac";
import { useCanEditProfiles } from "@/lib/rbac";
import type { SkillRenewal, SkillStatus } from "~backend/skill/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Edit, Trash2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface SkillsTabProps {
  profileId: number;
}

export default function SkillsTab({ profileId }: SkillsTabProps) {
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canEdit = useCanEditProfiles();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillRenewal | null>(null);
  const [selectedSkill, setSelectedSkill] = useState("");
  const [customSkillName, setCustomSkillName] = useState("");
  const [acquiredDate, setAcquiredDate] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");

  const { data: skillsData, isLoading } = useQuery({
    queryKey: ["skill-renewals", profileId],
    queryFn: async () => backend.skill.list({ profile_id: profileId }),
    enabled: !!profileId,
  });

  const { data: availableSkillsData } = useQuery({
    queryKey: ["dictionaries", "skills"],
    queryFn: async () => backend.dictionary.list({ type: "skill" }),
  });

  const availableSkills = availableSkillsData?.items || [];
  const skills = skillsData?.skills || [];

  const createSkillMutation = useMutation({
    mutationFn: async (data: { skill_name: string; acquired_date?: string; renewal_date?: string; expiry_date?: string; notes?: string }) => {
      return await backend.skill.create({
        profile_id: profileId,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-renewals", profileId] });
      toast({ title: "Skill added successfully" });
      handleCloseAddDialog();
    },
    onError: (error) => {
      console.error("Failed to create skill:", error);
      toast({
        title: "Failed to add skill",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const updateSkillMutation = useMutation({
    mutationFn: async (data: { id: number; skill_name?: string; acquired_date?: string; renewal_date?: string; expiry_date?: string; notes?: string }) => {
      const { id, ...updates } = data;
      return await backend.skill.update({ id, ...updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-renewals", profileId] });
      toast({ title: "Skill updated successfully" });
      handleCloseEditDialog();
    },
    onError: (error) => {
      console.error("Failed to update skill:", error);
      toast({
        title: "Failed to update skill",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteSkillMutation = useMutation({
    mutationFn: async (id: number) => {
      return await backend.skill.deleteSkillRenewal({ id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-renewals", profileId] });
      toast({ title: "Skill deleted successfully" });
    },
    onError: (error) => {
      console.error("Failed to delete skill:", error);
      toast({
        title: "Failed to delete skill",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleCloseAddDialog = () => {
    setShowAddDialog(false);
    setSelectedSkill("");
    setCustomSkillName("");
    setAcquiredDate("");
    setRenewalDate("");
    setExpiryDate("");
    setNotes("");
  };

  const handleCloseEditDialog = () => {
    setShowEditDialog(false);
    setEditingSkill(null);
    setSelectedSkill("");
    setCustomSkillName("");
    setAcquiredDate("");
    setRenewalDate("");
    setExpiryDate("");
    setNotes("");
  };

  const handleAddSkill = () => {
    const skillName = selectedSkill === "custom" ? customSkillName : selectedSkill;
    
    if (!skillName.trim()) {
      toast({
        title: "Skill name required",
        description: "Please enter a skill name",
        variant: "destructive",
      });
      return;
    }

    createSkillMutation.mutate({
      skill_name: skillName,
      acquired_date: acquiredDate || undefined,
      renewal_date: renewalDate || undefined,
      expiry_date: expiryDate || undefined,
      notes: notes || undefined,
    });
  };

  const handleEditSkill = () => {
    if (!editingSkill) return;

    const skillName = selectedSkill === "custom" ? customSkillName : selectedSkill;

    updateSkillMutation.mutate({
      id: editingSkill.id,
      skill_name: skillName || undefined,
      acquired_date: acquiredDate || undefined,
      renewal_date: renewalDate || undefined,
      expiry_date: expiryDate || undefined,
      notes: notes || undefined,
    });
  };

  const openEditDialog = (skill: SkillRenewal) => {
    setEditingSkill(skill);
    const isAvailableSkill = availableSkills.some(s => s.value === skill.skill_name);
    setSelectedSkill(isAvailableSkill ? skill.skill_name : "custom");
    setCustomSkillName(isAvailableSkill ? "" : skill.skill_name);
    setAcquiredDate(skill.acquired_date ? new Date(skill.acquired_date).toISOString().split("T")[0] : "");
    setRenewalDate(skill.renewal_date ? new Date(skill.renewal_date).toISOString().split("T")[0] : "");
    setExpiryDate(skill.expiry_date ? new Date(skill.expiry_date).toISOString().split("T")[0] : "");
    setNotes(skill.notes || "");
    setShowEditDialog(true);
  };

  const getStatusBadge = (status?: SkillStatus, daysUntilExpiry?: number) => {
    if (!status) return null;

    if (status === "expired") {
      return (
        <Badge className="bg-red-500/10 text-red-500">
          <XCircle className="h-3 w-3 mr-1" />
          Expired
        </Badge>
      );
    } else if (status === "warning") {
      return (
        <Badge className="bg-yellow-500/10 text-yellow-500">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Expires in {daysUntilExpiry} days
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-green-500/10 text-green-500">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Valid
        </Badge>
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Skills & Renewals</h3>
        {canEdit && (
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Skill
          </Button>
        )}
      </div>

      {isLoading ? (
        <div>Loading skills...</div>
      ) : skills.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No skills recorded</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Skill</TableHead>
                <TableHead>Acquired</TableHead>
                <TableHead>Renewal</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                {canEdit && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {skills.map((skill) => (
                <TableRow key={skill.id}>
                  <TableCell className="font-medium">{skill.skill_name}</TableCell>
                  <TableCell>
                    {skill.acquired_date ? new Date(skill.acquired_date).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell>
                    {skill.renewal_date ? new Date(skill.renewal_date).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell>
                    {skill.expiry_date ? new Date(skill.expiry_date).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(skill.status, skill.days_until_expiry)}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{skill.notes || "-"}</TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(skill)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Delete skill "${skill.skill_name}"?`)) {
                              deleteSkillMutation.mutate(skill.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={showAddDialog} onOpenChange={handleCloseAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Skill</DialogTitle>
            <DialogDescription>Add a new skill with optional renewal tracking</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Skill</Label>
              <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select skill" />
                </SelectTrigger>
                <SelectContent>
                  {availableSkills.map((skill) => (
                    <SelectItem key={skill.value} value={skill.value}>
                      {skill.value}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom Skill</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedSkill === "custom" && (
              <div>
                <Label>Custom Skill Name</Label>
                <Input
                  value={customSkillName}
                  onChange={(e) => setCustomSkillName(e.target.value)}
                  placeholder="Enter skill name"
                  className="mt-1"
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Acquired Date</Label>
                <Input
                  type="date"
                  value={acquiredDate}
                  onChange={(e) => setAcquiredDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Renewal Date</Label>
                <Input
                  type="date"
                  value={renewalDate}
                  onChange={(e) => setRenewalDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseAddDialog}>
              Cancel
            </Button>
            <Button onClick={handleAddSkill} disabled={createSkillMutation.isPending}>
              {createSkillMutation.isPending ? "Adding..." : "Add Skill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={handleCloseEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Skill</DialogTitle>
            <DialogDescription>Update skill information and renewal dates</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Skill</Label>
              <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select skill" />
                </SelectTrigger>
                <SelectContent>
                  {availableSkills.map((skill) => (
                    <SelectItem key={skill.value} value={skill.value}>
                      {skill.value}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom Skill</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedSkill === "custom" && (
              <div>
                <Label>Custom Skill Name</Label>
                <Input
                  value={customSkillName}
                  onChange={(e) => setCustomSkillName(e.target.value)}
                  placeholder="Enter skill name"
                  className="mt-1"
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Acquired Date</Label>
                <Input
                  type="date"
                  value={acquiredDate}
                  onChange={(e) => setAcquiredDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Renewal Date</Label>
                <Input
                  type="date"
                  value={renewalDate}
                  onChange={(e) => setRenewalDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseEditDialog}>
              Cancel
            </Button>
            <Button onClick={handleEditSkill} disabled={updateSkillMutation.isPending}>
              {updateSkillMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
