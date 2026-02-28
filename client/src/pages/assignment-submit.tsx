import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  Upload,
  Send,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Info,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface RubricItem {
  criterion: string;
  maxPoints: number;
  description: string;
}

interface Assignment {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  rubric?: RubricItem[];
  maxScore: number;
  allowLateSubmission?: boolean;
  latePenaltyPercent?: number;
  dueDate?: string;
  status: string;
}

function getDueDateStatus(dueDate?: string, allowLate?: boolean) {
  if (!dueDate) return { label: "No due date", color: "secondary" as const };
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffMs < 0) {
    return allowLate
      ? { label: `Overdue (late submissions allowed)`, color: "destructive" as const }
      : { label: `Past due`, color: "destructive" as const };
  }
  if (diffHours < 24) return { label: `Due in ${Math.round(diffHours)}h`, color: "destructive" as const };
  if (diffHours < 72) return { label: `Due in ${Math.ceil(diffHours / 24)}d`, color: "secondary" as const };
  return { label: `Due ${due.toLocaleDateString()}`, color: "secondary" as const };
}

export default function AssignmentSubmitPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);

  const { data: assignment, isLoading } = useQuery<Assignment>({
    queryKey: [`/api/assignments/${id}`],
  });

  const submitMutation = useMutation({
    mutationFn: async (data: { content: string; fileUrl?: string }) => {
      const res = await fetch(`/api/assignment/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSubmissionResult(data);
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      toast({ title: "Assignment submitted!", description: "Your submission has been recorded." });
    },
    onError: (error: Error) => {
      toast({ title: "Submission failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!content.trim()) {
      toast({ title: "Cannot submit empty", description: "Please write your answer before submitting.", variant: "destructive" });
      return;
    }
    submitMutation.mutate({ content });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
            <p className="text-muted-foreground">Assignment not found.</p>
            <Button onClick={() => setLocation("/assignments")}>Back to Assignments</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dueDateStatus = getDueDateStatus(assignment.dueDate, assignment.allowLateSubmission);
  const isOverdue = assignment.dueDate && new Date() > new Date(assignment.dueDate);
  const cannotSubmit = isOverdue && !assignment.allowLateSubmission;

  // Success state
  if (submitted && submissionResult) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-2 border-green-500">
          <CardContent className="pt-8 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
            <h2 className="text-xl font-bold">Submitted Successfully!</h2>
            <p className="text-muted-foreground">{assignment.title}</p>
            {submissionResult.isLate && (
              <Badge variant="destructive">
                Late submission — {submissionResult.latePenaltyPercent}% penalty may apply
              </Badge>
            )}
            <div className="text-sm text-muted-foreground">
              Submission ID: <code className="text-xs">{submissionResult.submission?.id}</code>
            </div>
            <Button onClick={() => setLocation("/assignments")} className="w-full">
              Back to Assignments
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/assignments")}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Assignments
          </Button>
        </div>

        {/* Assignment Info */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl">{assignment.title}</CardTitle>
                {assignment.description && (
                  <CardDescription className="mt-1">{assignment.description}</CardDescription>
                )}
              </div>
              <Badge variant={dueDateStatus.color}>{dueDateStatus.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                <span>Max score: {assignment.maxScore} points</span>
              </div>
              {assignment.dueDate && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>Due: {new Date(assignment.dueDate).toLocaleString()}</span>
                </div>
              )}
            </div>

            {assignment.instructions && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Instructions
                  </h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{assignment.instructions}</p>
                </div>
              </>
            )}

            {isOverdue && assignment.allowLateSubmission && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  This assignment is past due. Late submissions are allowed but may incur a{" "}
                  <strong>{assignment.latePenaltyPercent}% penalty</strong>.
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rubric */}
        {assignment.rubric && assignment.rubric.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Grading Rubric</CardTitle>
              <CardDescription>Your submission will be graded based on these criteria</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium">Criterion</th>
                      <th className="text-right py-2 pr-4 font-medium w-24">Max Points</th>
                      <th className="text-left py-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignment.rubric.map((item, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{item.criterion}</td>
                        <td className="py-2 pr-4 text-right">
                          <Badge variant="secondary">{item.maxPoints} pts</Badge>
                        </td>
                        <td className="py-2 text-muted-foreground">{item.description}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 font-semibold">
                      <td className="py-2 pr-4">Total</td>
                      <td className="py-2 pr-4 text-right">
                        <Badge>{assignment.maxScore} pts</Badge>
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submission Area */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Your Submission
            </CardTitle>
            <CardDescription>Write your answer below. Be thorough and address all rubric criteria.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cannotSubmit ? (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-center space-y-2">
                <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
                <p className="text-sm font-medium text-destructive">Submission closed</p>
                <p className="text-sm text-muted-foreground">This assignment is past due and late submissions are not allowed.</p>
              </div>
            ) : (
              <>
                <Textarea
                  placeholder="Write your answer here... Address each rubric criterion to maximize your score."
                  className="min-h-[300px] resize-y font-mono text-sm"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {content.length} characters · {content.split(/\s+/).filter(Boolean).length} words
                  </p>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitMutation.isPending || !content.trim()}
                    className="flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {submitMutation.isPending ? "Submitting..." : "Submit Assignment"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
