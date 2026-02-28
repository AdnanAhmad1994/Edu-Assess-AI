import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  Brain,
  Shield,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Loader2,
  Save,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface RubricItem { criterion: string; maxPoints: number; description: string; }
interface RubricScore { criterion: string; score: number; feedback: string; }

interface SubmissionData {
  submission: {
    id: string;
    assignmentId: string;
    studentId: string;
    content: string | null;
    fileUrl: string | null;
    score: number | null;
    status: string;
    aiContentScore: number | null;
    rubricScores: RubricScore[] | null;
    instructorFeedback: string | null;
    aiFeedback: string | null;
    submittedAt: string | null;
    gradedAt: string | null;
  };
  assignment: {
    id: string;
    title: string;
    description?: string;
    instructions?: string;
    rubric?: RubricItem[];
    maxScore: number;
  };
  studentName: string;
}

export default function AssignmentGradePage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [rubricScores, setRubricScores] = useState<RubricScore[]>([]);
  const [instructorFeedback, setInstructorFeedback] = useState("");
  const [totalScore, setTotalScore] = useState<number>(0);
  const [aiDetectionResult, setAiDetectionResult] = useState<any>(null);

  const { data, isLoading } = useQuery<SubmissionData>({
    queryKey: [`/api/assignment-submissions/${id}`],
  });

  // Initialize state from loaded data
  useEffect(() => {
    if (data) {
      const { submission, assignment } = data;
      if (submission.rubricScores) {
        setRubricScores(submission.rubricScores);
      } else if (assignment.rubric) {
        setRubricScores(assignment.rubric.map(r => ({ criterion: r.criterion, score: 0, feedback: "" })));
      }
      if (submission.instructorFeedback) setInstructorFeedback(submission.instructorFeedback);
      if (submission.score !== null) setTotalScore(submission.score);
    }
  }, [data]);

  // Auto-compute total from rubric scores
  useEffect(() => {
    const sum = rubricScores.reduce((acc, r) => acc + (r.score || 0), 0);
    setTotalScore(sum);
  }, [rubricScores]);

  const aiGradeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/assignment-submissions/${id}/ai-grade`, { method: "POST" });
      if (!res.ok) throw new Error("AI grading failed");
      return res.json();
    },
    onSuccess: (result) => {
      if (result.graded?.rubricScores) setRubricScores(result.graded.rubricScores);
      if (result.submission?.aiFeedback) setInstructorFeedback(result.submission.aiFeedback);
      if (result.submission?.score !== null) setTotalScore(result.submission.score);
      queryClient.invalidateQueries({ queryKey: [`/api/assignment-submissions/${id}`] });
      toast({ title: "AI grading complete!", description: "Rubric scores and feedback have been filled in." });
    },
    onError: () => toast({ title: "AI grading failed", variant: "destructive" }),
  });

  const detectAiMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/assignment-submissions/${id}/detect-ai`, { method: "POST" });
      if (!res.ok) throw new Error("AI detection failed");
      return res.json();
    },
    onSuccess: (result) => {
      setAiDetectionResult(result);
      queryClient.invalidateQueries({ queryKey: [`/api/assignment-submissions/${id}`] });
      toast({ title: `AI Detection: ${result.aiProbability}% probability of AI content` });
    },
    onError: () => toast({ title: "AI detection failed", variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/assignment-submissions/${id}/grade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: totalScore, instructorFeedback, rubricScores }),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/assignment-submissions/${id}`] });
      toast({ title: "Grade saved!", description: "The submission has been marked as graded." });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { submission, assignment, studentName } = data;
  const aiScore = aiDetectionResult?.aiProbability ?? submission.aiContentScore;

  const getAiScoreColor = (score: number | null) => {
    if (score === null) return "bg-gray-100 text-gray-700";
    if (score >= 70) return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400";
    if (score >= 40) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400";
    return "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation(`/assignments/${assignment.id}/submissions`)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Submissions
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{assignment.title}</h1>
            <p className="text-muted-foreground text-sm">Grading: {studentName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {aiScore !== null && (
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${getAiScoreColor(aiScore)}`}>
              <Shield className="inline h-3 w-3 mr-1" />
              AI Content: {aiScore}%
            </span>
          )}
          <Badge
            className={submission.status === "graded" ? "bg-green-500" : "bg-blue-500"}
          >
            {submission.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Student Submission */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Student Submission
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => detectAiMutation.mutate()}
                  disabled={detectAiMutation.isPending || !submission.content}
                >
                  {detectAiMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Shield className="h-3 w-3 mr-1" />}
                  Detect AI
                </Button>
              </div>
              {submission.submittedAt && (
                <CardDescription>
                  Submitted {new Date(submission.submittedAt).toLocaleString()}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {submission.content ? (
                <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap font-mono leading-relaxed max-h-80 overflow-y-auto">
                  {submission.content}
                </div>
              ) : submission.fileUrl ? (
                <div className="text-center py-6">
                  <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                  <a href={submission.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm">
                    View Submitted File
                  </a>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No content submitted.</p>
              )}
            </CardContent>
          </Card>

          {/* AI Detection Result */}
          {(aiDetectionResult || submission.aiContentScore !== null) && (
            <Card className={`border-l-4 ${(aiScore ?? 0) >= 70 ? "border-l-red-500" : (aiScore ?? 0) >= 40 ? "border-l-yellow-500" : "border-l-green-500"}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  AI Content Detection
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-bold px-3 py-1 rounded-lg ${getAiScoreColor(aiScore)}`}>
                    {aiScore}%
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {(aiScore ?? 0) >= 70 ? "Likely AI-Generated" : (aiScore ?? 0) >= 40 ? "Possibly AI-Generated" : "Likely Human-Written"}
                    </p>
                    {aiDetectionResult?.confidence && (
                      <p className="text-xs text-muted-foreground">Confidence: {aiDetectionResult.confidence}</p>
                    )}
                  </div>
                </div>
                {aiDetectionResult?.reasoning && (
                  <p className="text-sm text-muted-foreground">{aiDetectionResult.reasoning}</p>
                )}
                {aiDetectionResult?.indicators?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {aiDetectionResult.indicators.map((ind: string, i: number) => (
                      <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded">{ind}</span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Grading Panel */}
        <div className="space-y-4">
          {/* AI Grade Button */}
          <Button
            className="w-full"
            variant="outline"
            onClick={() => aiGradeMutation.mutate()}
            disabled={aiGradeMutation.isPending || !submission.content}
          >
            {aiGradeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
            {aiGradeMutation.isPending ? "AI Grading…" : "AI Grade with Rubric"}
          </Button>

          {/* AI Feedback from previous AI grading */}
          {submission.aiFeedback && !aiGradeMutation.isPending && (
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                  <Brain className="h-3 w-3" /> AI Feedback (generated)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{submission.aiFeedback}</p>
              </CardContent>
            </Card>
          )}

          {/* Rubric Scoring */}
          {assignment.rubric && assignment.rubric.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rubric Scoring</CardTitle>
                <CardDescription>Score each criterion</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {assignment.rubric.map((item, i) => {
                  const scoreItem = rubricScores.find(r => r.criterion === item.criterion) ?? { criterion: item.criterion, score: 0, feedback: "" };
                  return (
                    <div key={i} className="space-y-2 p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{item.criterion}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Input
                            type="number"
                            min={0}
                            max={item.maxPoints}
                            value={scoreItem.score}
                            onChange={(e) => {
                              const val = Math.min(item.maxPoints, Math.max(0, Number(e.target.value)));
                              setRubricScores(prev => {
                                const next = [...prev];
                                const idx = next.findIndex(r => r.criterion === item.criterion);
                                if (idx >= 0) next[idx] = { ...next[idx], score: val };
                                else next.push({ criterion: item.criterion, score: val, feedback: "" });
                                return next;
                              });
                            }}
                            className="w-16 text-center text-sm"
                          />
                          <span className="text-sm text-muted-foreground">/ {item.maxPoints}</span>
                        </div>
                      </div>
                      {scoreItem.feedback && (
                        <p className="text-xs text-muted-foreground italic border-l-2 pl-2">{scoreItem.feedback}</p>
                      )}
                    </div>
                  );
                })}
                <Separator />
                <div className="flex justify-between items-center font-semibold">
                  <span>Total Score</span>
                  <span className={`text-lg ${totalScore < (assignment.maxScore * 0.6) ? "text-red-500" : totalScore >= (assignment.maxScore * 0.8) ? "text-green-600" : "text-yellow-600"}`}>
                    {totalScore} / {assignment.maxScore}
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={0}
                    max={assignment.maxScore}
                    value={totalScore}
                    onChange={(e) => setTotalScore(Math.min(assignment.maxScore, Math.max(0, Number(e.target.value))))}
                    className="w-24 text-center text-lg font-bold"
                  />
                  <span className="text-muted-foreground">/ {assignment.maxScore}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructor Feedback */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Instructor Feedback</CardTitle>
              <CardDescription>This will be visible to the student</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Write feedback for the student… You can also use the AI Grade button to auto-generate feedback."
                value={instructorFeedback}
                onChange={(e) => setInstructorFeedback(e.target.value)}
                className="min-h-[120px]"
              />
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button
            className="w-full"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {saveMutation.isPending ? "Saving…" : "Save & Publish Grade"}
          </Button>
        </div>
      </div>
    </div>
  );
}
