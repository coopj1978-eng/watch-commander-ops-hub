import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBackend } from "@/lib/backend";
import PolicyQA from "@/components/PolicyQA";
import type { PolicyQuery } from "~backend/policy/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, MessageSquare, FileText, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";

export default function PolicyQAPage() {
  const backend = useBackend();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState<string>("");

  const { data: historyData, isLoading } = useQuery({
    queryKey: ["policy-queries", user?.id],
    queryFn: async () => {
      if (!user) return { queries: [], total: 0 };
      const result = await backend.policy.queryHistory({ user_id: user.id });
      return result;
    },
    enabled: !!user,
  });

  const history = historyData?.queries || [];

  const filteredHistory = history.filter((item) => {
    const matchesSearch = 
      item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesConfidence = true;
    if (confidenceFilter === "high") {
      matchesConfidence = (item.confidence || 0) >= 0.8;
    } else if (confidenceFilter === "medium") {
      matchesConfidence = (item.confidence || 0) >= 0.5 && (item.confidence || 0) < 0.8;
    } else if (confidenceFilter === "low") {
      matchesConfidence = (item.confidence || 0) < 0.5;
    }
    
    return matchesSearch && matchesConfidence;
  });

  const getConfidenceBadge = (confidence: number | undefined) => {
    if (!confidence) {
      return <Badge variant="outline">Unknown</Badge>;
    }
    
    if (confidence >= 0.8) {
      return <Badge className="bg-green-500/10 text-green-500">High ({(confidence * 100).toFixed(0)}%)</Badge>;
    } else if (confidence >= 0.5) {
      return <Badge className="bg-yellow-500/10 text-yellow-500">Medium ({(confidence * 100).toFixed(0)}%)</Badge>;
    } else {
      return <Badge className="bg-red-500/10 text-red-500">Low ({(confidence * 100).toFixed(0)}%)</Badge>;
    }
  };

  const activeFiltersCount = [confidenceFilter].filter(Boolean).length;

  const handleQueryComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["policy-queries", user?.id] });
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Policy Q&A</h1>
        <p className="text-muted-foreground mt-1">
          Ask questions about policy documents using AI-powered search
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PolicyQA onQueryComplete={handleQueryComplete} />
        </div>

        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Recent Questions
              </CardTitle>
              <CardDescription>Your query history</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : history.length > 0 ? (
                <div className="space-y-3">
                  {history.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-border hover:border-red-600 transition-colors"
                    >
                      <p className="text-sm text-foreground font-medium line-clamp-2">
                        {item.question}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                        {getConfidenceBadge(item.confidence)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  No questions yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Query History</CardTitle>
              <CardDescription>
                All your previous questions and answers
                {activeFiltersCount > 0 && ` (${activeFiltersCount} filter active)`}
              </CardDescription>
            </div>
          </div>
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
              <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All confidence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All confidence</SelectItem>
                  <SelectItem value="high">High (80%+)</SelectItem>
                  <SelectItem value="medium">Medium (50-79%)</SelectItem>
                  <SelectItem value="low">Low (&lt;50%)</SelectItem>
                </SelectContent>
              </Select>
              {activeFiltersCount > 0 && (
                <Button variant="outline" onClick={() => setConfidenceFilter("")}>
                  <Filter className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : filteredHistory.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Answer Preview</TableHead>
                  <TableHead>Citations</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium max-w-xs line-clamp-2">
                        {item.question}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-muted-foreground max-w-md line-clamp-2">
                        {item.answer}
                      </p>
                    </TableCell>
                    <TableCell>
                      {item.citations && item.citations.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.citations.slice(0, 2).map((citation, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              <FileText className="h-3 w-3 mr-1" />
                              {citation.doc_title}
                            </Badge>
                          ))}
                          {item.citations.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{item.citations.length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getConfidenceBadge(item.confidence)}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground mt-4">
                {activeFiltersCount > 0 || searchTerm
                  ? "No queries match the search criteria"
                  : "No queries yet"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
