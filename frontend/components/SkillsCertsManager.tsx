import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "~backend/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus, X, BookOpen, Award } from "lucide-react";

export function SkillsCertsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newSkill, setNewSkill] = useState("");
  const [newCert, setNewCert] = useState("");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => backend.settings.get(),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { skills_dictionary?: string[]; certifications_dictionary?: string[] }) => {
      return await backend.settings.updateSkillsCerts(data);
    },
    onSuccess: () => {
      toast({
        title: "Settings updated",
        description: "Skills and certifications have been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
    },
    onError: (error: any) => {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const handleAddSkill = () => {
    if (!newSkill.trim() || !settings) return;
    const updated = [...(settings.skills_dictionary || []), newSkill.trim()];
    updateMutation.mutate({ skills_dictionary: updated });
    setNewSkill("");
  };

  const handleRemoveSkill = (skill: string) => {
    if (!settings) return;
    const updated = (settings.skills_dictionary || []).filter((s) => s !== skill);
    updateMutation.mutate({ skills_dictionary: updated });
  };

  const handleAddCert = () => {
    if (!newCert.trim() || !settings) return;
    const updated = [...(settings.certifications_dictionary || []), newCert.trim()];
    updateMutation.mutate({ certifications_dictionary: updated });
    setNewCert("");
  };

  const handleRemoveCert = (cert: string) => {
    if (!settings) return;
    const updated = (settings.certifications_dictionary || []).filter((c) => c !== cert);
    updateMutation.mutate({ certifications_dictionary: updated });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Skills & Certifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Skills Dictionary
          </CardTitle>
          <CardDescription>Manage available skills for firefighter profiles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Add new skill..."
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddSkill();
                }
              }}
            />
            <Button onClick={handleAddSkill} disabled={!newSkill.trim() || updateMutation.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {!settings?.skills_dictionary || settings.skills_dictionary.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skills defined yet</p>
            ) : (
              settings.skills_dictionary.map((skill) => (
                <Badge key={skill} variant="secondary" className="gap-1">
                  {skill}
                  <button
                    onClick={() => handleRemoveSkill(skill)}
                    className="ml-1 hover:text-destructive focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                    aria-label={`Remove ${skill}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Certifications Dictionary
          </CardTitle>
          <CardDescription>Manage available certifications for firefighter profiles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Add new certification..."
              value={newCert}
              onChange={(e) => setNewCert(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCert();
                }
              }}
            />
            <Button onClick={handleAddCert} disabled={!newCert.trim() || updateMutation.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {!settings?.certifications_dictionary || settings.certifications_dictionary.length === 0 ? (
              <p className="text-sm text-muted-foreground">No certifications defined yet</p>
            ) : (
              settings.certifications_dictionary.map((cert) => (
                <Badge key={cert} variant="secondary" className="gap-1">
                  {cert}
                  <button
                    onClick={() => handleRemoveCert(cert)}
                    className="ml-1 hover:text-destructive focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                    aria-label={`Remove ${cert}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
