import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, FileText, AlertCircle } from "lucide-react";
import type { Quiz, Question } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";

interface PublicQuizData {
  quiz: Quiz;
  questions: { question: Question; orderIndex: number }[];
  requiredFields: string[];
  canAttempt: boolean;
}

export default function PublicQuizPage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user, login } = useAuth();
  
  const [step, setStep] = useState<"identify" | "quiz" | "results">("identify");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [currentQuestion, setCurrentQuestion] = useState(0);

  const { data, isLoading, error } = useQuery<PublicQuizData>({
    queryKey: [`/api/public/quiz/${token}`],
    enabled: !!token,
  });





  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({
        title: "Missing Information",
        description: "Please enter your username and password.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoggingIn(true);
    const success = await login(username, password);
    setIsLoggingIn(false);
    
    if (!success) {
      toast({
        title: "Login Failed",
        description: "Invalid username or password.",
        variant: "destructive"
      });
    } else {
      if (canAttempt) {
        setLocation(`/quiz/${quiz.id}/take`);
      } else {
        setStep("quiz");
      }
    }
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

  const { quiz, questions, canAttempt } = data;

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
              {canAttempt ? "You must log in to access this quiz" : "Log in to view this quiz"}
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
            {user ? (
              <div className="space-y-4 text-center">
                <p className="text-sm">You are currently logged in as <strong>{user.username}</strong>.</p>
                <div className="flex flex-col gap-2 mt-4">
                  <Button
                    onClick={() => {
                      if (canAttempt) {
                        setLocation(`/quiz/${quiz.id}/take`);
                      } else {
                        setStep("quiz");
                      }
                    }}
                    className="w-full"
                  >
                    Continue to Quiz
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      fetch("/api/auth/logout", { method: "POST" }).then(() => {
                        window.location.reload();
                      });
                    }}
                    className="w-full"
                  >
                    Switch Account
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    required
                    disabled={isLoggingIn}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    disabled={isLoggingIn}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoggingIn}>
                  {isLoggingIn ? "Logging in..." : "Log In & Continue"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }



  const currentQ = questions[currentQuestion];

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
        </div>

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
            {currentQuestion < questions.length - 1 && (
              <Button
                onClick={() => setCurrentQuestion(prev => Math.min(questions.length - 1, prev + 1))}
                data-testid="button-next-question"
              >
                Next
              </Button>
            )}
          </div>
        </div>


      </div>
    </div>
  );
}