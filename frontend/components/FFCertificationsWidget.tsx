import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/App";
import { useBackend } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export function FFCertificationsWidget() {
  const { user } = useAuth();
  const backend = useBackend();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["ff-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      return backend.profile.getByUser(user.id);
    },
    enabled: !!user,
  });

  const { data: skillsData, isLoading: skillsLoading } = useQuery({
    queryKey: ["skill-renewals", profile?.id],
    queryFn: async () => backend.skill.list({ profile_id: profile!.id }),
    enabled: !!profile?.id,
  });

  const isLoading = profileLoading || skillsLoading;

  if (isLoading) {
    return (
      <Card className="border-t-2 border-t-amber-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-3 w-40" />
        </CardContent>
      </Card>
    );
  }

  const skills = skillsData?.skills || [];
  const validCount = skills.filter(s => s.status === "valid").length;
  const warningCount = skills.filter(s => s.status === "warning").length;
  const expiredCount = skills.filter(s => s.status === "expired").length;

  const accentColor =
    expiredCount > 0 ? "border-t-red-500" :
    warningCount > 0 ? "border-t-amber-500" :
    "border-t-green-500";

  return (
    <Card className={`border-t-2 ${accentColor}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">My Skills & Certs</CardTitle>
        <Award className="h-4 w-4 text-amber-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{skills.length}</div>
        <div className="flex gap-3 mt-1 flex-wrap">
          {validCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3" />
              {validCount} valid
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-3 w-3" />
              {warningCount} expiring
            </span>
          )}
          {expiredCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
              <XCircle className="h-3 w-3" />
              {expiredCount} expired
            </span>
          )}
          {skills.length === 0 && (
            <p className="text-xs text-muted-foreground">No skills recorded. Visit your profile to add.</p>
          )}
        </div>
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {skills.slice(0, 3).map((skill) => (
              <Badge
                key={skill.id}
                variant="secondary"
                className={`text-xs ${
                  skill.status === "expired"
                    ? "border border-red-500/30 text-red-600 dark:text-red-400"
                    : skill.status === "warning"
                    ? "border border-yellow-500/30 text-yellow-600 dark:text-yellow-400"
                    : ""
                }`}
              >
                {skill.skill_name}
              </Badge>
            ))}
            {skills.length > 3 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                +{skills.length - 3} more
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
