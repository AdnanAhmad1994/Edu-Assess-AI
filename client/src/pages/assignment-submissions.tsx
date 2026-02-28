import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  Brain,
  Users,
  Clock,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  content: string | null;
  fileUrl: string | null;
  score: number | null;
  status: string;
  aiContentScore: number | null;
  plagiarismScore: number | null;
  rubricScores: any[] | null;
  aiFeedback: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
}

interface Assignment {
  id: string;
  title: string;
  description?: string;
  maxScore: number;
  dueDate?: string;
  rubric?: any[];
}

const STATUS_COLORS: Record<string, string> = {
  in_progress: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  graded: "bg-green-100 text-green-700",
};

export default function AssignmentSubmissionsPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: assignment } = useQuery<Assignment>({
    queryKey: [`/api/assignments/${id}`],
  });

  const { data: submissions, isLoading } = useQuery<Submission[]>({
    queryKey: [`/api/assignments/${id}/submissions`],
  });

  const bulkGradeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/assignments/${id}/ai-grade-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Bulk grading failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/assignments/${id}/submissions`] });
      toast({
        title: "AI Grading Complete",
        description: `Graded ${data.gradedCount} submission(s). ${data.failedCount > 0 ? `${data.failedCount} failed.` : ""}`,
      });
    },
    onError: () => {
      toast({ title: "Bulk grading failed", variant: "destructive" });
    },
  });

  const ungradedCount = (submissions ?? []).filter(s => s.status === "submitted").length;
  const gradedCount = (submissions ?? []).filter(s => s.status === "graded").length;
  const totalCount = (submissions ?? []).length;
  const avgScore = gradedCount > 0
    ? Math.round((submissions ?? []).filter(s => s.score !== null).reduce((sum, s) => sum + (s.score ?? 0), 0) / gradedCount)
    : null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/assignments")}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{assignment?.title}</h1>
            <p className="text-muted-foreground text-sm">Submissions ({totalCount})</p>
          </div>
        </div>
        <Button
          onClick={() => bulkGradeMutation.mutate()}
          disabled={bulkGradeMutation.isPending || ungradedCount === 0}
          className="flex items-center gap-2"
        >
          {bulkGradeMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Brain className="h-4 w-4" />
          )}
          {bulkGradeMutation.isPending ? `Grading…` : `AI Grade All (${ungradedCount} ungraded)`}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" /> Total</CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{totalCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4" /> Pending</CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-blue-600">{ungradedCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Graded</CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-green-600">{gradedCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><FileText className="h-4 w-4" /> Avg Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{avgScore !== null ? `${avgScore}` : "—"}</p>
            {assignment && avgScore !== null && (
              <p className="text-xs text-muted-foreground">/ {assignment.maxScore}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grading progress */}
      {totalCount > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Grading Progress</span>
              <span className="font-medium">{gradedCount}/{totalCount}</span>
            </div>
            <Progress value={(gradedCount / totalCount) * 100} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Submissions List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Submissions</CardTitle>
          <CardDescription>Click a row to view and grade the submission</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(submissions ?? []).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="mx-auto h-10 w-10 mb-2" />
              <p>No submissions yet.</p>
            </div>
          ) : (
            (submissions ?? []).map(sub => (
              <div
                key={sub.id}
                className="flex items-center justify-between gap-4 p-3 rounded-lg border hover:bg-muted/40 cursor-pointer transition-colors"
                onClick={() => setLocation(`/assignment-submissions/${sub.id}/grade`)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold shrink-0">
                    {sub.studentName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{sub.studentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {sub.submittedAt ? `Submitted ${new Date(sub.submittedAt).toLocaleString()}` : "Not yet submitted"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {sub.aiContentScore !== null && (
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        sub.aiContentScore >= 70
                          ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                          : sub.aiContentScore >= 40
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400"
                          : "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                      }`}
                      title="AI Content Score"
                    >
                      AI: {sub.aiContentScore}%
                    </span>
                  )}
                  {sub.score !== null && assignment && (
                    <Badge variant="outline" className="text-xs">
                      {sub.score}/{assignment.maxScore}
                    </Badge>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[sub.status] ?? STATUS_COLORS.in_progress}`}>
                    {sub.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
