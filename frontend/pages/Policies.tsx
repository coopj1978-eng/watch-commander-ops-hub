import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBackend } from "@/lib/backend";
import PolicyUpload from "@/components/PolicyUpload";
import type { PolicyDoc } from "~backend/policy/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/components/ui/use-toast";
import { Upload, Download, FileText, Search, Filter, Grid3x3, Table as TableIcon, BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type ViewMode = "grid" | "table";

export default function Policies() {
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: policiesData, isLoading } = useQuery({
    queryKey: ["policies"],
    queryFn: async () => {
      const result = await backend.policy.list({ limit: 100 });
      return result;
    },
  });

  const policies = (policiesData?.policies || []) as unknown as PolicyDoc[];

  const categories = Array.from(
    new Set(policies.map((p) => p.category).filter(Boolean) as string[])
  ).sort();

  const filteredPolicies = policies.filter((policy) => {
    const matchesSearch = policy.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         policy.file_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || policy.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const downloadMutation = useMutation({
    mutationFn: async (id: number) => {
      const result = await backend.policy.getDownloadUrl(id);
      window.open(result.download_url, "_blank");
    },
    onError: (error) => {
      console.error("Download error:", error);
      toast({
        title: "Download failed",
        description: "Could not download the policy document",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (policy: PolicyDoc) => {
    if (policy.vector_id) {
      return <Badge className="bg-green-500/10 text-green-500">Indexed</Badge>;
    }
    return <Badge className="bg-yellow-500/10 text-yellow-500">Processing</Badge>;
  };

  const activeFiltersCount = [categoryFilter !== "all" ? categoryFilter : ""].filter(Boolean).length;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <BookOpen className="h-7 w-7 text-orange-500 shrink-0" />
            Policy Documents
          </h1>
          <p className="text-muted-foreground mt-1">
            {filteredPolicies.length} document{filteredPolicies.length === 1 ? "" : "s"}
            {activeFiltersCount > 0 && ` (${activeFiltersCount} filter active)`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="rounded-r-none"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="rounded-l-none"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
          </div>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={() => setUploadDialogOpen(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Policy
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search policies by title or filename..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeFiltersCount > 0 && (
            <Button variant="outline" onClick={() => setCategoryFilter("all")}>
              <Filter className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4">
          {filteredPolicies.map((policy) => (
            <Card key={policy.id} className="hover:border-indigo-600 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <FileText className="h-5 w-5 text-red-500 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg">{policy.title}</CardTitle>
                        {getStatusBadge(policy)}
                      </div>
                      <CardDescription className="mt-1">
                        Uploaded {new Date(policy.uploaded_at).toLocaleDateString()}
                        {policy.uploaded_by && ` by ${policy.uploaded_by}`}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadMutation.mutate(policy.id)}
                    disabled={downloadMutation.isPending}
                    className="flex-shrink-0"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {policy.category && (
                    <Badge variant="outline">{policy.category}</Badge>
                  )}
                  {policy.version && (
                    <span className="text-muted-foreground">v{policy.version}</span>
                  )}
                  <span className="text-muted-foreground">
                    {(policy.file_size / 1024 / 1024).toFixed(2)} MB
                  </span>
                  {policy.total_pages && (
                    <span className="text-muted-foreground">{policy.total_pages} pages</span>
                  )}
                  {policy.tags && policy.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {policy.tags.map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPolicies.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                      <span className="font-medium">{policy.title}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {policy.category ? (
                      <Badge variant="outline">{policy.category}</Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{policy.version || "-"}</TableCell>
                  <TableCell>{(policy.file_size / 1024 / 1024).toFixed(2)} MB</TableCell>
                  <TableCell>{new Date(policy.uploaded_at).toLocaleDateString()}</TableCell>
                  <TableCell>{getStatusBadge(policy)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadMutation.mutate(policy.id)}
                      disabled={downloadMutation.isPending}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </Card>
      )}

      {!isLoading && filteredPolicies.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <FileText className="mx-auto h-10 w-10 mb-3 text-muted-foreground/40" />
            <p className="font-medium text-foreground">
              {activeFiltersCount > 0 || searchTerm
                ? "No policies match the search criteria"
                : "No policy documents uploaded yet"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {activeFiltersCount > 0 || searchTerm
                ? "Try adjusting the filters or search term."
                : "Upload PDF policy documents to make them searchable."}
            </p>
            {!searchTerm && activeFiltersCount === 0 && (
              <Button
                className="mt-5 bg-indigo-600 hover:bg-indigo-700"
                onClick={() => setUploadDialogOpen(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload your first policy
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <PolicyUpload open={uploadDialogOpen} onOpenChange={setUploadDialogOpen} />
    </div>
  );
}
