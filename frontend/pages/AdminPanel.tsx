import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import backend from "@/lib/backend";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminUsers } from "./AdminUsers";
import { ShieldCheck } from "lucide-react";

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState("activity");
  
  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-indigo-500 shrink-0" />
          Admin Panel
        </h1>
        <p className="text-muted-foreground mt-1">System administration and audit logs</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-6">
          <ActivityLogTab />
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <AdminUsers />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ActivityLogTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["activity-log"],
    queryFn: async () => {
      const result = await backend.admin.getActivityLog({ limit: 50 });
      return result.logs;
    },
  });

  return (
    <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>Recent system activity and audit trail</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.user_id || "System"}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.action.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      <Badge>{log.entity_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {JSON.stringify(log.details)}
                    </TableCell>
                  </TableRow>
                ))}
                {data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-muted-foreground">No activity logs yet</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
  );
}
