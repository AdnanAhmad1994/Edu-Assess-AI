import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Sparkles, Grid3X3, KeyRound } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import PatternLockGrid from "@/components/pattern-lock-grid";

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, refetchUser } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<"password" | "pattern">("password");
  const [patternUsername, setPatternUsername] = useState("");
  const [patternError, setPatternError] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    const success = await login(data.username, data.password);
    setIsLoading(false);

    if (success) {
      toast({ title: "Welcome back!", description: "You have successfully logged in." });
      setLocation("/dashboard");
    } else {
      toast({ title: "Login failed", description: "Invalid username or password.", variant: "destructive" });
    }
  };

  const handlePatternLogin = useCallback(async (pattern: number[]) => {
    if (!patternUsername.trim()) {
      toast({ title: "Username required", description: "Please enter your username first.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setPatternError(false);
    try {
      const res = await apiRequest("POST", "/api/auth/pattern-login", {
        username: patternUsername.trim(),
        pattern,
      });
      await res.json();
      await refetchUser();
      toast({ title: "Welcome back!", description: "You have successfully logged in." });
      setLocation("/dashboard");
    } catch {
      setPatternError(true);
      toast({ title: "Login failed", description: "Invalid username or pattern.", variant: "destructive" });
      setTimeout(() => setPatternError(false), 1000);
    } finally {
      setIsLoading(false);
    }
  }, [patternUsername, toast, setLocation, refetchUser]);

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 gradient-primary items-center justify-center p-12">
        <div className="max-w-lg text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
              <GraduationCap className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">EduAssess AI</h1>
              <p className="text-white/80 text-sm">Powered by Google Gemini</p>
            </div>
          </div>
          <h2 className="text-4xl font-bold mb-6 leading-tight">
            Intelligent Educational Assessment Platform
          </h2>
          <p className="text-lg text-white/90 mb-8">
            Transform your teaching with AI-powered quiz generation, automated grading, 
            and comprehensive anti-cheating proctoring.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <span>AI-Generated Questions from Your Content</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <span>Automated Essay Grading with Feedback</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <span>Multi-layer Anti-Cheating Detection</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="lg:hidden flex items-center justify-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold">EduAssess AI</span>
            </div>
            <CardTitle className="text-2xl">Welcome Back</CardTitle>
            <CardDescription>Sign in to your account to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1 mb-6 p-1 rounded-md bg-muted">
              <Button
                type="button"
                variant={loginMode === "password" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setLoginMode("password")}
                data-testid="button-mode-password"
              >
                <KeyRound className="w-4 h-4 mr-2" />
                Password
              </Button>
              <Button
                type="button"
                variant={loginMode === "pattern" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setLoginMode("pattern")}
                data-testid="button-mode-pattern"
              >
                <Grid3X3 className="w-4 h-4 mr-2" />
                Pattern
              </Button>
            </div>

            {loginMode === "password" ? (
              <>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter your username" 
                              data-testid="input-username"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="Enter your password"
                              data-testid="input-password"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isLoading}
                      data-testid="button-login"
                    >
                      {isLoading ? "Signing in..." : "Sign In"}
                    </Button>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Button
                        type="button"
                        variant="ghost"
                        className="p-0 h-auto font-normal text-xs text-muted-foreground"
                        onClick={() => setLocation("/forgot-password")}
                        data-testid="link-forgot-password"
                      >
                        Forgot password?
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="p-0 h-auto font-normal text-xs text-muted-foreground"
                        onClick={() => setLocation("/forgot-username")}
                        data-testid="link-forgot-username"
                      >
                        Forgot username?
                      </Button>
                    </div>
                  </form>
                </Form>
              </>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Username</label>
                  <Input
                    placeholder="Enter your username"
                    value={patternUsername}
                    onChange={(e) => setPatternUsername(e.target.value)}
                    data-testid="input-pattern-username"
                  />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm text-muted-foreground" data-testid="text-pattern-instruction">
                    Draw your pattern to sign in
                  </p>
                  <PatternLockGrid
                    onComplete={handlePatternLogin}
                    disabled={isLoading || !patternUsername.trim()}
                    error={patternError}
                  />
                  {isLoading && (
                    <p className="text-sm text-muted-foreground">Signing in...</p>
                  )}
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Set up pattern login in Settings after signing in with your password.
                </p>
              </div>
            )}

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Button 
                variant="ghost" 
                className="p-0 h-auto font-medium text-primary"
                onClick={() => setLocation("/register")}
                data-testid="link-register"
              >
                Create one
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
