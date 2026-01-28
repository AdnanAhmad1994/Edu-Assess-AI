import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, FileText, AlertCircle, Trophy, Send } from "lucide-react";
import type { Quiz, Question } from "@shared/schema";

interface PublicQuizData {
  quiz: Quiz;
  questions: { question: Question; orderIndex: number }[];
  requiredFields: string[];
  canAttempt: boolean;
}

export default function PublicQuizPage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  
  const [step, setStep] = useState<"identify" | "quiz" | "results">("identify");
  const [identificationData, setIdentificationData] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [results, setResults] = useState<{ score: number; totalPoints: number; percentage: number; passed: boolean } | null>(null);

  const { data, isLoading, error } = useQuery<PublicQuizData>({
    queryKey: [`/api/public/quiz/${token}`],
    enabled: !!token,
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: { identificationData: Record<string, string>; answers: { questionId: string; answer: string }[] }) => {
      const res = await fetch(`/api/public/quiz/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to submit");
      return res.json();
    },
    onSuccess: (data) => {
      setResults(data);
      setStep("results");
      toast({
        title: data.passed ? "Congratulations!" : "Quiz Completed",
        description: `You scored ${data.percentage}%`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit quiz. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (data?.quiz?.timeLimitMinutes && step === "quiz") {
      setTimeLeft(data.quiz.timeLimitMinutes * 60);
    }
  }, [data, step]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleIdentificationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const requiredFields = data?.requiredFields || ["name", "email"];
    const allFilled = requiredFields.every(field => identificationData[field]?.trim());
    
    if (!allFilled) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    
    setStep("quiz");
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = () => {
    const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => ({
      questionId,
      answer,
    }));
    
    submitMutation.mutate({
      identificationData,
      answers: formattedAnswers,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <AlertCircle className="w-16 h-16 mx-auto text-destructive mb-4" />
            <CardTitle>Quiz Not Found</CardTitle>
            <CardDescription>
              This quiz link may have expired or is no longer available.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { quiz, questions, requiredFields, canAttempt } = data;

  if (step === "identify") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">{quiz.title}</CardTitle>
            <CardDescription>
              {quiz.description || "Complete the form below to access the quiz"}
            </CardDescription>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {quiz.timeLimitMinutes && (
                <Badge variant="secondary">
                  <Clock className="w-3 h-3 mr-1" />
                  {quiz.timeLimitMinutes} minutes
                </Badge>
              )}
              <Badge variant="secondary">
                {questions.length} questions
              </Badge>
              <Badge variant={canAttempt ? "default" : "secondary"}>
                {canAttempt ? "Attempt Mode" : "View Only"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleIdentificationSubmit} className="space-y-4">
              {requiredFields.map(field => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={field} className="capitalize">
                    {field.replace(/_/g, " ")} *
                  </Label>
                  <Input
                    id={field}
                    data-testid={`input-${field}`}
                    value={identificationData[field] || ""}
                    onChange={(e) => setIdentificationData(prev => ({ ...prev, [field]: e.target.value }))}
                    placeholder={`Enter your ${field.replace(/_/g, " ")}`}
                    required
                  />
                </div>
              ))}
              <Button type="submit" className="w-full" data-testid="button-start-quiz">
                {canAttempt ? "Start Quiz" : "View Quiz"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "results" && results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className={`mx-auto mb-4 p-4 rounded-full w-fit ${results.passed ? "bg-green-100" : "bg-orange-100"}`}>
              {results.passed ? (
                <Trophy className="w-12 h-12 text-green-600" />
              ) : (
                <AlertCircle className="w-12 h-12 text-orange-600" />
              )}
            </div>
            <CardTitle className="text-3xl">
              {results.passed ? "Congratulations!" : "Quiz Completed"}
            </CardTitle>
            <CardDescription>
              {results.passed 
                ? "You have successfully passed this quiz!" 
                : "Keep practicing and try again!"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-primary mb-2">
                {results.percentage}%
              </div>
              <p className="text-muted-foreground">
                {results.score} out of {results.totalPoints} points
              </p>
            </div>
            <Progress value={results.percentage} className="h-3" />
            <Badge 
              variant={results.passed ? "default" : "secondary"}
              className="text-lg px-4 py-2"
            >
              {results.passed ? "PASSED" : "NOT PASSED"}
            </Badge>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-sm text-muted-foreground">
              Thank you for completing this quiz!
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-quiz-title">{quiz.title}</h1>
            <p className="text-muted-foreground">
              Question {currentQuestion + 1} of {questions.length}
            </p>
          </div>
          {timeLeft !== null && (
            <Badge variant={timeLeft < 60 ? "destructive" : "secondary"} className="text-lg px-4 py-2">
              <Clock className="w-4 h-4 mr-2" />
              {formatTime(timeLeft)}
            </Badge>
          )}
        </div>

        <Progress value={progress} className="mb-6 h-2" />

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <CardTitle className="text-lg" data-testid={`text-question-${currentQuestion}`}>
                {currentQ?.question.text}
              </CardTitle>
              <Badge variant="outline">
                {currentQ?.question.points} {currentQ?.question.points === 1 ? "point" : "points"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {canAttempt ? (
              currentQ?.question.type === "mcq" ? (
                <RadioGroup
                  value={answers[currentQ.question.id] || ""}
                  onValueChange={(value) => handleAnswerChange(currentQ.question.id, value)}
                  className="space-y-3"
                >
                  {(currentQ.question.options as string[] || []).map((option, idx) => (
                    <div key={idx} className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer">
                      <RadioGroupItem 
                        value={option} 
                        id={`option-${idx}`}
                        data-testid={`radio-option-${idx}`}
                      />
                      <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : currentQ?.question.type === "true_false" ? (
                <RadioGroup
                  value={answers[currentQ.question.id] || ""}
                  onValueChange={(value) => handleAnswerChange(currentQ.question.id, value)}
                  className="space-y-3"
                >
                  {["True", "False"].map((option) => (
                    <div key={option} className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer">
                      <RadioGroupItem 
                        value={option} 
                        id={`option-${option}`}
                        data-testid={`radio-${option.toLowerCase()}`}
                      />
                      <Label htmlFor={`option-${option}`} className="flex-1 cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <Textarea
                  placeholder="Type your answer here..."
                  value={answers[currentQ?.question.id] || ""}
                  onChange={(e) => handleAnswerChange(currentQ.question.id, e.target.value)}
                  className="min-h-[120px]"
                  data-testid="textarea-answer"
                />
              )
            ) : (
              <div className="space-y-3">
                {currentQ?.question.type === "mcq" && (currentQ.question.options as string[] || []).map((option, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-lg border flex items-center gap-2 ${
                      option === currentQ.question.correctAnswer 
                        ? "bg-green-50 border-green-200 dark:bg-green-950/20" 
                        : ""
                    }`}
                  >
                    {option === currentQ.question.correctAnswer && (
                      <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                    )}
                    <span>{option}</span>
                  </div>
                ))}
                {currentQ?.question.type === "true_false" && (
                  <div className="space-y-2">
                    {["True", "False"].map((option) => (
                      <div 
                        key={option}
                        className={`p-3 rounded-lg border flex items-center gap-2 ${
                          option === currentQ.question.correctAnswer 
                            ? "bg-green-50 border-green-200 dark:bg-green-950/20" 
                            : ""
                        }`}
                      >
                        {option === currentQ.question.correctAnswer && (
                          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                        )}
                        <span>{option}</span>
                      </div>
                    ))}
                  </div>
                )}
                {currentQ?.question.explanation && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-1">Explanation:</p>
                    <p className="text-sm text-muted-foreground">{currentQ.question.explanation}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between gap-4">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
            disabled={currentQuestion === 0}
            data-testid="button-prev-question"
          >
            Previous
          </Button>
          
          <div className="flex gap-2">
            {currentQuestion < questions.length - 1 ? (
              <Button
                onClick={() => setCurrentQuestion(prev => Math.min(questions.length - 1, prev + 1))}
                data-testid="button-next-question"
              >
                Next
              </Button>
            ) : canAttempt && (
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                data-testid="button-submit-quiz"
              >
                <Send className="w-4 h-4 mr-2" />
                {submitMutation.isPending ? "Submitting..." : "Submit Quiz"}
              </Button>
            )}
          </div>
        </div>

        {canAttempt && (
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            {questions.map((_, idx) => (
              <Button
                key={idx}
                variant={answers[questions[idx].question.id] ? "default" : "outline"}
                size="sm"
                className={`w-10 h-10 ${currentQuestion === idx ? "ring-2 ring-primary" : ""}`}
                onClick={() => setCurrentQuestion(idx)}
                data-testid={`button-question-${idx}`}
              >
                {idx + 1}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}