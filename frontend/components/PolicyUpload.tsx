import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBackend } from "@/lib/backend";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Upload, FileText, Loader2 } from "lucide-react";
import { useAuth } from "@/App";

interface PolicyUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PolicyUpload({ open, onOpenChange }: PolicyUploadProps) {
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [version, setVersion] = useState("");
  const [tags, setTags] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !user) {
        throw new Error("No file selected or user not authenticated");
      }

      setIsUploading(true);

      const uploadUrlResponse = await backend.policy.getUploadUrl({
        file_name: selectedFile.name,
      });

      const uploadResponse = await fetch(uploadUrlResponse.upload_url, {
        method: "PUT",
        body: selectedFile,
        headers: {
          "Content-Type": "application/pdf",
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to storage");
      }

      const policyDoc = await backend.policy.upload({
        title: title || selectedFile.name,
        file_name: selectedFile.name,
        file_path: uploadUrlResponse.file_path,
        file_size: selectedFile.size,
        category: category || undefined,
        tags: tags ? tags.split(",").map((t) => t.trim()) : undefined,
        version: version || undefined,
        uploaded_by: user.id,
      });

      try {
        await backend.policy.processEmbedding({ policy_id: policyDoc.id });
      } catch (embeddingError) {
        console.warn("Embedding job queued with warning:", embeddingError);
      }

      return policyDoc;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      toast({
        title: "Policy uploaded",
        description: `${data.title} has been uploaded and queued for embedding`,
      });
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Failed to upload policy:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast({
          title: "Invalid file type",
          description: "Please select a PDF file",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(".pdf", ""));
      }
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setTitle("");
    setCategory("");
    setVersion("");
    setTags("");
  };

  const handleSubmit = () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a PDF file to upload",
        variant: "destructive",
      });
      return;
    }

    if (!title) {
      toast({
        title: "Title required",
        description: "Please enter a title for the policy document",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Policy Document</DialogTitle>
          <DialogDescription>
            Upload a PDF policy document to make it searchable via Q&A
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="file">PDF File *</Label>
            <div className="mt-2">
              <label
                htmlFor="file"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted/80 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {selectedFile ? (
                    <>
                      <FileText className="w-10 h-10 mb-3 text-green-500" />
                      <p className="text-sm font-medium text-foreground">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Click to select PDF file
                      </p>
                    </>
                  )}
                </div>
                <input
                  id="file"
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                />
              </label>
            </div>
          </div>

          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Policy title"
              disabled={isUploading}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Safety, HR, Operations"
                disabled={isUploading}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="e.g., v1.0, 2024.1"
                disabled={isUploading}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., emergency, procedures, training"
              disabled={isUploading}
              className="mt-1"
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-md p-4">
            <p className="text-sm text-blue-900 dark:text-blue-300">
              <strong>Note:</strong> After upload, the document will be processed for
              embedding generation to enable AI-powered Q&A search.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isUploading || !selectedFile || !title}
            className="bg-red-600 hover:bg-red-700"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Policy
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
