import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, CheckCircle, XCircle, Lock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ token: string }>();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"form" | "success" | "error">("form");
  const [errorMessage, setErrorMessage] = useState("");

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", {
        token: params.token,
        newPassword: data.newPassword,
      });
      setStatus("success");
    } catch (error: any) {
      const message = error?.message || "Failed to reset password. The link may be invalid or expired.";
      setErrorMessage(message);
      setStatus("error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold">EduAssess AI</span>
          </div>
          <CardTitle className="text-2xl" data-testid="text-reset-password-title">
            {status === "success" ? "Password Reset" : status === "error" ? "Reset Failed" : "Set New Password"}
          </CardTitle>
          <CardDescription>
            {status === "success"
              ? "Your password has been updated"
              : status === "error"
              ? "There was a problem resetting your password"
              : "Enter your new password below"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "success" ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-reset-success">
                Your password has been successfully reset. You can now sign in with your new password.
              </p>
              <Button
                className="w-full"
                onClick={() => setLocation("/login")}
                data-testid="button-go-to-login"
              >
                Go to Login
              </Button>
            </div>
          ) : status === "error" ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-reset-error">
                {errorMessage}
              </p>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setLocation("/forgot-password")}
                  data-testid="button-try-again"
                >
                  Request New Reset Link
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setLocation("/login")}
                  data-testid="button-back-to-login"
                >
                  Back to Login
                </Button>
              </div>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter new password"
                          data-testid="input-new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Confirm new password"
                          data-testid="input-confirm-password"
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
                  data-testid="button-reset-password"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  {isLoading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
