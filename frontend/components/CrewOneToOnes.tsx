import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, User, AlertTriangle } from "lucide-react";
import { format, differenceInDays } from "date-fns";

export function CrewOneToOnes() {
  const { user: currentUser } = useAuth();

  const { data: user } = useQuery({
    queryKey: ["current-user", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      return await backend.user.get({ id: currentUser.id });
    },
    enabled: !!currentUser?.id,
  });

  const { data: crewMembers } = useQuery({
    queryKey: ["crew-members", user?.watch_unit],
    queryFn: async () => {
      if (!user?.watch_unit) return [];
      const response = await backend.user.list({});
      return response.users.filter(
        (u) => u.role === "FF" && u.watch_unit === user.watch_unit
      );
    },
    enabled: !!user?.watch_unit,
  });

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["crew-profiles", crewMembers],
    queryFn: async () => {
      if (!crewMembers || crewMembers.length === 0) return [];
      const response = await backend.profile.list({});
      const crewIds = crewMembers.map((m) => m.id);
      
      return response.profiles
        .filter((p) => crewIds.includes(p.user_id))
        .filter((p) => p.next_one_to_one_date)
        .map((p) => {
          const member = crewMembers.find((m) => m.id === p.user_id);
          return {
            profile: p,
            user: member,
          };
        })
        .sort((a, b) => {
          const dateA = a.profile.next_one_to_one_date!;
          const dateB = b.profile.next_one_to_one_date!;
          return new Date(dateA).getTime() - new Date(dateB).getTime();
        });
    },
    enabled: !!crewMembers && crewMembers.length > 0,
  });

  const getStatusBadge = (date: Date) => {
    const daysUntil = differenceInDays(new Date(date), new Date());
    
    if (daysUntil < 0) {
      return {
        label: `${Math.abs(daysUntil)} days overdue`,
        variant: "destructive" as const,
      };
    } else if (daysUntil === 0) {
      return {
        label: "Due today",
        variant: "default" as const,
      };
    } else if (daysUntil <= 7) {
      return {
        label: `Due in ${daysUntil} days`,
        variant: "outline" as const,
      };
    } else {
      return {
        label: `Due in ${daysUntil} days`,
        variant: "secondary" as const,
      };
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>1:1 Schedule</CardTitle>
          <CardDescription>Upcoming one-to-ones with your crew</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border rounded-lg p-3">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const overdueProfiles = profiles?.filter((p) => {
    const daysUntil = differenceInDays(new Date(p.profile.next_one_to_one_date!), new Date());
    return daysUntil < 0;
  }) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          1:1 Schedule
          {overdueProfiles.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {overdueProfiles.length} Overdue
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          One-to-one meetings with your crew members
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!profiles || profiles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No scheduled 1:1s for your crew</p>
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map(({ profile, user }) => {
              if (!profile.next_one_to_one_date || !user) return null;
              
              const status = getStatusBadge(profile.next_one_to_one_date);
              const isOverdue = differenceInDays(new Date(profile.next_one_to_one_date), new Date()) < 0;

              return (
                <div
                  key={profile.id}
                  className={`border rounded-lg p-3 hover:bg-accent/50 transition-colors ${
                    isOverdue ? "border-red-500/50 bg-red-500/5" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{user.name}</span>
                      {user.rank && (
                        <Badge variant="outline" className="text-xs">
                          {user.rank}
                        </Badge>
                      )}
                    </div>
                    {isOverdue && (
                      <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span className={isOverdue ? "text-red-500 font-medium" : ""}>
                        {format(new Date(profile.next_one_to_one_date), "MMM d, yyyy")}
                      </span>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>

                  {profile.last_one_to_one_date && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Last 1:1: {format(new Date(profile.last_one_to_one_date), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
