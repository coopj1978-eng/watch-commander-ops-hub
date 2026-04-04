import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useBackend } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, XCircle, ChevronRight } from "lucide-react";

export function WCSkillsExpiryWidget() {
  const backend = useBackend();

  const { data, isLoading } = useQuery({
    queryKey: ["wc-skills-expiring"],
    queryFn: async () => backend.skill.listExpiring(),
    refetchInterval: 5 * 60 * 1000, // refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-4">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  const skills = data?.skills ?? [];
  const expiredCount = data?.expired_count ?? 0;
  const warningCount = data?.warning_count ?? 0;
  const total = expiredCount + warningCount;

  const allClear = total === 0;

  const accentColor =
    expiredCount > 0 ? "border-t-red-500" :
    warningCount > 0 ? "border-t-amber-500" :
                       "border-t-green-500";

  return (
    <Card className={`col-span-full border-t-2 ${accentColor}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <CardTitle className="text-sm font-medium">Expiring Skills &amp; Certifications</CardTitle>
          {!allClear && (
            <div className="flex gap-2">
              {expiredCount > 0 && (
                <Badge className="bg-red-500/10 text-red-600 border-red-300 text-xs font-medium">
                  <XCircle className="h-3 w-3 mr-1" />
                  {expiredCount} expired
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-300 text-xs font-medium">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {warningCount} expiring soon
                </Badge>
              )}
            </div>
          )}
        </div>
        <AlertTriangle
          className={`h-4 w-4 flex-shrink-0 ${
            expiredCount > 0
              ? "text-red-500"
              : warningCount > 0
              ? "text-yellow-500"
              : "text-muted-foreground"
          }`}
        />
      </CardHeader>

      <CardContent>
        {allClear ? (
          <div className="flex items-center gap-2 py-2 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">All skills &amp; certifications are up to date</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Person
                  </th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Skill / Cert
                  </th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Expiry Date
                  </th>
                  <th className="text-left py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Status
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {skills.map((entry) => {
                  const isExpired = entry.status === "expired";
                  const daysAbs = Math.abs(entry.days_until_expiry ?? 0);

                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <td className="py-2.5 pr-4 font-medium">
                        <Link
                          to={`/people/${entry.user_id}`}
                          className="hover:underline hover:text-primary transition-colors"
                        >
                          {entry.user_name}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {entry.skill_name}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {entry.expiry_date
                          ? new Date(entry.expiry_date).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="py-2.5">
                        {isExpired ? (
                          <Badge className="bg-red-500/10 text-red-600 border-red-300 text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            {entry.days_until_expiry !== undefined
                              ? `Expired ${daysAbs}d ago`
                              : "Expired"}
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-300 text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {entry.days_until_expiry !== undefined
                              ? entry.days_until_expiry === 0
                                ? "Expires today"
                                : `${entry.days_until_expiry}d left`
                              : "Expiring soon"}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 pl-2">
                        <Link
                          to={`/people/${entry.user_id}`}
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
