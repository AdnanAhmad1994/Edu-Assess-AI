import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Send,
  Video,
  VideoOff,
  Shield,
  Eye,
  Copy,
  ExternalLink,
  Loader2,
} from "lucide-react";
import type { Quiz, Question } from "@shared/schema";

interface QuizWithQuestions extends Quiz {
  questions: Question[];
}

interface Answer {
  questionId: string;
  answer: string;
}

interface ViolationEvent {
  type: string;
  description: string;
  timestamp: Date;
}

export default function QuizTakePage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [violations, setViolations] = useState<ViolationEvent[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: quiz, isLoading } = useQuery<QuizWithQuestions>({
    queryKey: ["/api/quiz", id, "take"],
  });

  const startQuizMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/quiz/${id}/start`);
    },
    onSuccess: (data: any) => {
      setSubmissionId(data.submissionId);
      if (quiz?.timeLimitMinutes) {
        setTimeRemaining(quiz.timeLimitMinutes * 60);
      }
    },
  });

  const submitQuizMutation = useMutation({
    mutationFn: async (data: { submissionId: string; answers: Answer[] }) => {
      return apiRequest("POST", `/api/quiz/${id}/submit`, data);
    },
    onSuccess: (data: any) => {
      toast({ title: "Quiz submitted!", description: "Your answers have been recorded." });
      setLocation(`/quiz/${id}/results/${data.submissionId}`);
    },
    onError: () => {
      toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" });
      setIsSubmitting(false);
    },
  });

  const logViolationMutation = useMutation({
    mutationFn: async (data: { submissionId: string; type: string; description: string; screenshotUrl?: string }) => {
      return apiRequest("POST", `/api/proctoring/violation`, data);
    },
  });

  useEffect(() => {
    if (quiz && !submissionId) {
      startQuizMutation.mutate();
    }
  }, [quiz]);

  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  useEffect(() => {
    if (quiz?.proctored && submissionId) {
      initializeProctoring();
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [quiz?.proctored, submissionId]);

  useEffect(() => {
    if (!quiz?.proctored || !submissionId) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation("tab_switch", "Student switched to another tab or window");
      }
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      logViolation("copy_paste", "Copy/paste action detected");
      toast({ title: "Warning", description: "Copy/paste is disabled during this exam.", variant: "destructive" });
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logViolation("suspicious_behavior", "Right-click menu attempted");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [quiz?.proctored, submissionId]);

  const initializeProctoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraEnabled(true);

      startPeriodicAnalysis();
    } catch (error) {
      console.error("Camera access denied:", error);
      logViolation("no_face", "Camera access denied or unavailable");
      toast({
        title: "Camera Required",
        description: "Please enable camera access for proctored exams.",
        variant: "destructive",
      });
    }
  };

  const startPeriodicAnalysis = () => {
    const analyzeFrame = async () => {
      if (!canvasRef.current || !videoRef.current || !submissionId) return;

      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas.getContext("2d");

      if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        const imageData = canvas.toDataURL("image/jpeg", 0.8);

        try {
          const response = await fetch("/api/proctoring/analyze-frame", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ submissionId, imageData }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.violations && result.violations.length > 0) {
              result.violations.forEach((v: any) => {
                logViolation(v.type, v.description, imageData);
              });
            }
          }
        } catch (error) {
          console.error("Frame analysis failed:", error);
        }
      }
    };

    const intervalId = setInterval(analyzeFrame, 10000);
    return () => clearInterval(intervalId);
  };

  const logViolation = (type: string, description: string, screenshotUrl?: string) => {
    const event: ViolationEvent = { type, description, timestamp: new Date() };
    setViolations((prev) => [...prev, event]);

    if (submissionId) {
      logViolationMutation.mutate({ submissionId, type, description, screenshotUrl });
    }

    toast({
      title: "Violation Detected",
      description: description,
      variant: "destructive",
    });
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = useCallback(() => {
    if (!submissionId) return;

    setIsSubmitting(true);
    const answerArray: Answer[] = Object.entries(answers).map(([questionId, answer]) => ({
      questionId,
      answer,
    }));

    submitQuizMutation.mutate({ submissionId, answers: answerArray });
  }, [submissionId, answers]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <Card className="max-w-md mx-auto mt-20">
        <CardContent className="py-10 text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Quiz Not Found</h2>
          <p className="text-muted-foreground mb-4">This quiz may not exist or is not available.</p>
          <Button onClick={() => setLocation("/quizzes")}>Back to Quizzes</Button>
        </CardContent>
      </Card>
    );
  }

  const questions = quiz.questions || [];
  const currentQ = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-card border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="font-bold text-lg truncate">{quiz.title}</h1>
              {quiz.proctored && (
                <Badge variant="outline" className="gap-1 shrink-0">
                  <Shield className="w-3 h-3" />
                  Proctored
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4">
              {quiz.proctored && (
                <div className="flex items-center gap-2">
                  {cameraEnabled ? (
                    <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <Video className="w-3 h-3 mr-1" />
                      Recording
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="proctoring-active">
                      <VideoOff className="w-3 h-3 mr-1" />
                      Camera Off
                    </Badge>
                  )}
                </div>
              )}

              {timeRemaining !== null && (
                <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${timeRemaining < 300 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-muted"}`}>
                  <Clock className="w-4 h-4" />
                  <span className="font-mono font-medium">{formatTime(timeRemaining)}</span>
                </div>
              )}

              <Badge variant="secondary">
                {answeredCount}/{questions.length} Answered
              </Badge>
            </div>
          </div>
          <Progress value={progress} className="mt-3 h-2" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          <div className="flex-1 space-y-6">
            {currentQ && (
              <Card data-testid={`question-${currentQuestion}`}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge variant="outline">Question {currentQuestion + 1} of {questions.length}</Badge>
                    <Badge variant="secondary">{currentQ.points} point{currentQ.points !== 1 ? "s" : ""}</Badge>
                  </div>
                  <CardTitle className="text-xl leading-relaxed">{currentQ.text}</CardTitle>
                </CardHeader>
                <CardContent>
                  {currentQ.type === "mcq" && currentQ.options && (
                    <RadioGroup
                      value={answers[currentQ.id] || ""}
                      onValueChange={(value) => handleAnswerChange(currentQ.id, value)}
                      className="space-y-3"
                    >
                      {(currentQ.options as string[]).map((option, index) => (
                        <div
                          key={index}
                          className={`flex items-center space-x-3 p-4 rounded-lg border transition-colors ${
                            answers[currentQ.id] === option ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                          }`}
                        >
                          <RadioGroupItem value={option} id={`option-${index}`} data-testid={`option-${index}`} />
                          <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}

                  {currentQ.type === "true_false" && (
                    <RadioGroup
                      value={answers[currentQ.id] || ""}
                      onValueChange={(value) => handleAnswerChange(currentQ.id, value)}
                      className="flex gap-4"
                    >
                      <div className={`flex-1 flex items-center justify-center p-6 rounded-lg border cursor-pointer transition-colors ${answers[currentQ.id] === "true" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                        <RadioGroupItem value="true" id="true" className="sr-only" />
                        <Label htmlFor="true" className="cursor-pointer text-lg font-medium">True</Label>
                      </div>
                      <div className={`flex-1 flex items-center justify-center p-6 rounded-lg border cursor-pointer transition-colors ${answers[currentQ.id] === "false" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                        <RadioGroupItem value="false" id="false" className="sr-only" />
                        <Label htmlFor="false" className="cursor-pointer text-lg font-medium">False</Label>
                      </div>
                    </RadioGroup>
                  )}

                  {currentQ.type === "short_answer" && (
                    <Input
                      value={answers[currentQ.id] || ""}
                      onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                      placeholder="Type your answer..."
                      className="text-lg"
                      data-testid="input-short-answer"
                    />
                  )}

                  {currentQ.type === "essay" && (
                    <Textarea
                      value={answers[currentQ.id] || ""}
                      onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                      placeholder="Write your essay response..."
                      className="min-h-[200px] text-base"
                      data-testid="textarea-essay"
                    />
                  )}

                  {currentQ.type === "fill_blank" && (
                    <Input
                      value={answers[currentQ.id] || ""}
                      onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                      placeholder="Fill in the blank..."
                      className="text-lg"
                      data-testid="input-fill-blank"
                    />
                  )}
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
                disabled={currentQuestion === 0}
                data-testid="button-previous"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              {currentQuestion < questions.length - 1 ? (
                <Button
                  onClick={() => setCurrentQuestion((prev) => Math.min(questions.length - 1, prev + 1))}
                  data-testid="button-next"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={() => setShowSubmitDialog(true)} data-testid="button-submit-quiz">
                  <Send className="w-4 h-4 mr-2" />
                  Submit Quiz
                </Button>
              )}
            </div>
          </div>

          {quiz.proctored && (
            <div className="w-48 shrink-0 space-y-4">
              <Card className="overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full aspect-video bg-black"
                />
                <canvas ref={canvasRef} className="hidden" />
              </Card>

              {violations.length > 0 && (
                <Card className="border-destructive">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                      <AlertTriangle className="w-4 h-4" />
                      Violations ({violations.length})
                    </CardTitle>
                  </CardHeader>
                </Card>
              )}
            </div>
          )}
        </div>

        <Card className="mt-6">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Question Navigator</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {questions.map((q, index) => (
                <Button
                  key={q.id}
                  variant={currentQuestion === index ? "default" : answers[q.id] ? "secondary" : "outline"}
                  size="sm"
                  className="w-10 h-10"
                  onClick={() => setCurrentQuestion(index)}
                  data-testid={`nav-question-${index}`}
                >
                  {index + 1}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Quiz?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered {answeredCount} out of {questions.length} questions.
              {answeredCount < questions.length && " Some questions are still unanswered."}
              <br /><br />
              Are you sure you want to submit? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Quiz</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Quiz"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
