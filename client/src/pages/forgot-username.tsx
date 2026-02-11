import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, ArrowLeft, Mail, CheckCircle, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const forgotUsernameSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotUsernameFormData = z.infer<typeof forgotUsernameSchema>;

export default function ForgotUsernamePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotUsernameFormData>({
    resolver: zodResolver(forgotUsernameSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotUsernameFormData) => {
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-username", { email: data.email });
      setSubmitted(true);
    } catch (error) {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
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
          <CardTitle className="text-2xl" data-testid="text-forgot-username-title">Forgot Username</CardTitle>
          <CardDescription>
            {submitted
              ? "Check your email for your username"
              : "Enter your email and we'll send you your username"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-username-sent">
                If an account with that email exists, your username has been sent. 
                Please check your inbox and spam folder.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setLocation("/login")}
                data-testid="button-back-to-login"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Button>
            </div>
          ) : (
            <>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="Enter your email"
                            data-testid="input-forgot-email"
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
                    data-testid="button-send-username"
                  >
                    <User className="w-4 h-4 mr-2" />
                    {isLoading ? "Sending..." : "Send My Username"}
                  </Button>
                </form>
              </Form>
              <div className="mt-6 text-center text-sm text-muted-foreground">
                Remember your username?{" "}
                <Button
                  variant="ghost"
                  className="p-0 h-auto font-medium text-primary"
                  onClick={() => setLocation("/login")}
                  data-testid="link-back-to-login"
                >
                  Sign in
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
