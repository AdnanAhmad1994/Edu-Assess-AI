import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  Trophy,
  AlertTriangle,
  ChevronLeft,
  Camera,
  Clock,
  BookOpen,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface GradedAnswer {
  questionId: string;
  answer: string;
  isCorrect?: boolean;
  points?: number;
}

interface Question {
  id: string;
  type: string;
  text: string;
  options?: string[];
  correctAnswer: string;
  points: number;
  imageUrl?: string;
}

interface QuizQuestion {
  id: string;
  questionId: string;
  orderIndex: number;
  question: Question;
}

interface QuizSubmission {
  id: string;
  quizId: string;
  studentId: string;
  answers: GradedAnswer[] | null;
  score: number | null;
  totalPoints: number | null;
  percentage: number | null;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  gradedAt: string | null;
  aiFeedback: string | null;
}

interface Quiz {
  id: string;
  title: string;
  description?: string;
  passingScore?: number;
  proctored?: boolean;
  showResults?: boolean;
}

export default function QuizResultsPage() {
  const { id, submissionId } = useParams<{ id: string; submissionId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery<{ submission: QuizSubmission; quiz: Quiz; questions: QuizQuestion[] }>({
    queryKey: [`/api/quiz-submissions/${submissionId}`],
  });

  const { data: violations } = useQuery<any[]>({
    queryKey: [`/api/proctoring/violations/${submissionId}`],
    enabled: !!data?.quiz?.proctored,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-3xl space-y-4">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <p className="text-muted-foreground">Could not load quiz results.</p>
            <Button onClick={() => setLocation("/quizzes")}>Back to Quizzes</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { submission, quiz, questions } = data;
  const percentage = submission.percentage ?? 0;
  const passingScore = quiz.passingScore ?? 60;
  const passed = percentage >= passingScore;
  const answers = submission.answers ?? [];

  const getAnswerForQuestion = (questionId: string): GradedAnswer | undefined =>
    answers.find((a) => a.questionId === questionId);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/quizzes")}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Quizzes
          </Button>
        </div>

        {/* Score Card */}
        <Card className={`border-2 ${passed ? "border-green-500" : "border-destructive"}`}>
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-3">
              {passed ? (
                <Trophy className="h-14 w-14 text-yellow-500" />
              ) : (
                <AlertTriangle className="h-14 w-14 text-destructive" />
              )}
            </div>
            <CardTitle className="text-2xl">{quiz.title}</CardTitle>
            <Badge className={`mx-auto mt-2 text-sm px-4 py-1 ${passed ? "bg-green-500 hover:bg-green-600" : "bg-destructive hover:bg-destructive/90"}`}>
              {passed ? "PASSED" : "FAILED"}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center mt-2">
              <div>
                <p className="text-3xl font-bold">{percentage}%</p>
                <p className="text-sm text-muted-foreground">Your Score</p>
              </div>
              <div>
                <p className="text-3xl font-bold">{submission.score ?? 0}/{submission.totalPoints ?? 0}</p>
                <p className="text-sm text-muted-foreground">Points</p>
              </div>
              <div>
                <p className="text-3xl font-bold">{passingScore}%</p>
                <p className="text-sm text-muted-foreground">Passing Score</p>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Submitted: {formatDate(submission.submittedAt)}</span>
              </div>
              {quiz.proctored && violations !== undefined && (
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  <span>{violations.length} violation{violations.length !== 1 ? "s" : ""} detected</span>
                  {user?.role !== "student" && violations.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-0 h-auto text-xs text-primary hover:underline"
                      onClick={() => setLocation(`/quiz/${id}/submissions/${submissionId}/proctoring`)}
                    >
                      Review
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Feedback */}
        {submission.aiFeedback && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                AI Feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{submission.aiFeedback}</p>
            </CardContent>
          </Card>
        )}

        {/* Question Breakdown */}
        {quiz.showResults !== false && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Question Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.map((qq, index) => {
                const answer = getAnswerForQuestion(qq.question.id);
                const isCorrect = answer?.isCorrect;
                const earnedPoints = answer?.points ?? 0;

                return (
                  <div
                    key={qq.id}
                    className={`rounded-lg border p-4 ${
                      isCorrect === true
                        ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800"
                        : isCorrect === false
                        ? "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        {isCorrect === true ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                        ) : isCorrect === false ? (
                          <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground mt-0.5 shrink-0" />
                        )}
                        <div className="space-y-2 flex-1">
                          <p className="text-sm font-medium">
                            Q{index + 1}. {qq.question.text}
                          </p>
                          {qq.question.imageUrl && (
                            <img src={qq.question.imageUrl} alt="Question" className="max-h-32 rounded" />
                          )}
                          <div className="space-y-1 text-sm">
                            <p className="text-muted-foreground">
                              Your answer:{" "}
                              <span className={isCorrect === false ? "text-destructive font-medium" : "font-medium"}>
                                {answer?.answer || "(no answer)"}
                              </span>
                            </p>
                            {isCorrect === false && (
                              <p className="text-muted-foreground">
                                Correct answer:{" "}
                                <span className="text-green-600 dark:text-green-400 font-medium">
                                  {qq.question.correctAnswer}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant={isCorrect ? "default" : "secondary"} className="shrink-0">
                        {earnedPoints}/{qq.question.points} pts
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Action buttons */}
        <div className="flex justify-center gap-3 pb-6">
          <Button variant="outline" onClick={() => setLocation("/quizzes")}>
            Back to Quizzes
          </Button>
          {user?.role !== "student" && (
            <Button variant="outline" onClick={() => setLocation(`/quiz/${id}/submissions/${submissionId}/proctoring`)}>
              View Proctoring Report
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
