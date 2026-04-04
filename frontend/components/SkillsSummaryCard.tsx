import { useQuery } from "@tanstack/react-query";
import { useBackend } from "@/lib/rbac";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, AlertTriangle, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface SkillsSummaryCardProps {
  profileId?: number;
}

export default function SkillsSummaryCard({ profileId }: SkillsSummaryCardProps) {
  const backend = useBackend();

  const { data: skillsData, isLoading } = useQuery({
    queryKey: ["skill-renewals", profileId],
    queryFn: async () => backend.skill.list({ profile_id: profileId! }),
    enabled: !!profileId,
  });

  const skills = skillsData?.skills || [];
  
  const validSkills = skills.filter(s => s.status === "valid").length;
  const warningSkills = skills.filter(s => s.status === "warning").length;
  const expiredSkills = skills.filter(s => s.status === "expired").length;

  if (!profileId) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Skills & Renewals
        </CardTitle>
        <CardDescription>
          Quick overview of assigned skills
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        ) : skills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills recorded. Go to Skills tab to add.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Valid</span>
                </div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{validSkills}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">Expiring Soon</span>
                </div>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{warningSkills}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium">Expired</span>
                </div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{expiredSkills}</p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <p className="text-sm font-medium text-muted-foreground">Recent Skills</p>
              <div className="space-y-1">
                {skills.slice(0, 5).map((skill) => (
                  <div key={skill.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{skill.skill_name}</span>
                    <div className="flex items-center gap-2">
                      {skill.expiry_date && (
                        <span className="text-xs text-muted-foreground">
                          Expires: {new Date(skill.expiry_date).toLocaleDateString()}
                        </span>
                      )}
                      <Badge 
                        className={
                          skill.status === "expired"
                            ? "bg-red-500/10 text-red-500"
                            : skill.status === "warning"
                            ? "bg-yellow-500/10 text-yellow-500"
                            : "bg-green-500/10 text-green-500"
                        }
                      >
                        {skill.status === "expired" ? "Expired" : skill.status === "warning" ? "Warning" : "Valid"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              {skills.length > 5 && (
                <p className="text-xs text-muted-foreground pt-1">
                  ... and {skills.length - 5} more
                </p>
              )}
            </div>

            <div className="pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => {
                  const skillsTab = document.querySelector('[value="skills"]') as HTMLElement;
                  if (skillsTab) skillsTab.click();
                }}
              >
                View All Skills
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
