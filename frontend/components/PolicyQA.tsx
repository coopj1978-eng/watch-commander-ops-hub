import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useBackend } from "@/lib/backend";
import type { Citation } from "~backend/policy/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Send, Loader2, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { useUser } from "@clerk/clerk-react";

interface PolicyQAProps {
  onQueryComplete?: () => void;
}

export default function PolicyQA({ onQueryComplete }: PolicyQAProps) {
  const backend = useBackend();
  const { toast } = useToast();
  const { user } = useUser();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);

  const askMutation = useMutation({
    mutationFn: async () => {
      const response = await backend.policy.ask({
        query: question,
      });
      
      return response;
    },
    onSuccess: (data) => {
      setAnswer(data.answer);
      setCitations(data.citations || []);
      setConfidence(data.confidence || null);
      onQueryComplete?.();
    },
    onError: (error) => {
      console.error("Failed to ask question:", error);
      toast({
        title: "Query failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!question.trim()) {
      toast({
        title: "Question required",
        description: "Please enter a question",
        variant: "destructive",
      });
      return;
    }

    setAnswer(null);
    setCitations([]);
    setConfidence(null);
    askMutation.mutate();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getConfidenceBadge = (conf: number) => {
    if (conf >= 0.8) {
      return (
        <Badge className="bg-green-500/10 text-green-500">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          High Confidence ({(conf * 100).toFixed(0)}%)
        </Badge>
      );
    } else if (conf >= 0.5) {
      return (
        <Badge className="bg-yellow-500/10 text-yellow-500">
          <AlertCircle className="h-3 w-3 mr-1" />
          Medium Confidence ({(conf * 100).toFixed(0)}%)
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-red-500/10 text-red-500">
          <AlertCircle className="h-3 w-3 mr-1" />
          Low Confidence ({(conf * 100).toFixed(0)}%)
        </Badge>
      );
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ask a Question</CardTitle>
          <CardDescription>
            Query the policy documents using AI-powered search
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What would you like to know about the policies?"
              rows={4}
              disabled={askMutation.isPending}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Press {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+Enter to submit
            </p>
          </div>

          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {question.trim().length} characters
            </div>
            <Button
              onClick={handleSubmit}
              disabled={askMutation.isPending || !question.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {askMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Ask Question
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {answer && (
        <Card className="border-green-200 dark:border-green-900">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">Answer</CardTitle>
                <CardDescription className="mt-1">
                  Based on the uploaded policy documents
                </CardDescription>
              </div>
              {confidence !== null && getConfidenceBadge(confidence)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-foreground whitespace-pre-wrap">{answer}</p>
            </div>

            {citations.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Sources
                </h4>
                <div className="flex flex-wrap gap-2">
                  {citations.map((citation, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                    >
                      {citation.doc_title} - Page {citation.page}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {answer.includes("Not specified in uploaded docs") && (
              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                      Information not found
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      The answer was not found in the uploaded policy documents. Consider uploading additional documentation or refining your question.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {askMutation.isError && (
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900 dark:text-red-200">
                  Failed to process question
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {askMutation.error instanceof Error 
                    ? askMutation.error.message 
                    : "An unexpected error occurred"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
