import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBackend } from "@/lib/backend";
import type { PolicyQuery } from "~backend/policy/types";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Filter, FileText, Calendar, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function PolicyQueryHistory() {
  const backend = useBackend();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");

  const { data: queriesData, isLoading } = useQuery({
    queryKey: ["policy-queries"],
    queryFn: async () => {
      return await backend.policy.queryHistory({ limit: 100 });
    },
  });

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const result = await backend.user.list({ limit: 200 });
      return result.users;
    },
  });

  const queries = queriesData?.queries || [];
  const userMap = new Map(usersData?.map((u) => [u.id, u.name]) || []);

  const filteredQueries = queries.filter((query) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (
        !query.question.toLowerCase().includes(search) &&
        !query.answer.toLowerCase().includes(search)
      ) {
        return false;
      }
    }

    if (dateFilter !== "all") {
      const queryDate = new Date(query.created_at);
      const now = new Date();
      const daysDiff = Math.floor(
        (now.getTime() - queryDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (dateFilter === "today" && daysDiff !== 0) return false;
      if (dateFilter === "week" && daysDiff > 7) return false;
      if (dateFilter === "month" && daysDiff > 30) return false;
    }

    return true;
  });

  const getConfidenceBadge = (confidence?: number) => {
    if (confidence === undefined || confidence === null) {
      return <Badge variant="outline">Unknown</Badge>;
    }

    if (confidence >= 0.8) {
      return <Badge className="bg-green-500/10 text-green-500">High</Badge>;
    } else if (confidence >= 0.5) {
      return <Badge className="bg-yellow-500/10 text-yellow-500">Medium</Badge>;
    } else {
      return <Badge className="bg-red-500/10 text-red-500">Low</Badge>;
    }
  };

  const activeFiltersCount = [searchTerm, dateFilter !== "all" ? dateFilter : ""].filter(Boolean).length;

  const clearFilters = () => {
    setSearchTerm("");
    setDateFilter("all");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Query History</CardTitle>
        <CardDescription>
          View past policy questions and answers with citations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search questions and answers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Past week</SelectItem>
                <SelectItem value="month">Past month</SelectItem>
              </SelectContent>
            </Select>
            {activeFiltersCount > 0 && (
              <Button variant="outline" onClick={clearFilters}>
                <Filter className="h-4 w-4 mr-2" />
                Clear ({activeFiltersCount})
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : filteredQueries.length > 0 ? (
          <div className="space-y-4">
            {filteredQueries.map((query) => (
              <Card key={query.id} className="border-l-4 border-l-red-500">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {userMap.get(query.asked_by_user_id) || "Unknown User"}
                        </span>
                        <Calendar className="h-4 w-4 text-muted-foreground ml-2" />
                        <span className="text-sm text-muted-foreground">
                          {new Date(query.created_at).toLocaleDateString()}
                        </span>
                        {getConfidenceBadge(query.confidence)}
                      </div>
                      <CardTitle className="text-base font-semibold">
                        {query.question}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-foreground/90">
                    {query.answer.length > 300
                      ? `${query.answer.substring(0, 300)}...`
                      : query.answer}
                  </div>

                  {query.citations && query.citations.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">
                          Sources:
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {query.citations.map((citation, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {citation.doc_title} - Page {citation.page}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground mt-4">
              {activeFiltersCount > 0 || searchTerm
                ? "No queries match the filters"
                : "No policy queries yet"}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Ask a question to see it appear here
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
