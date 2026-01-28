import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppSidebar } from "@/components/AppSidebar";
import { Skeleton } from "@/components/ui/skeleton";

import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import DashboardPage from "@/pages/dashboard";
import CoursesPage from "@/pages/courses";
import QuizzesPage from "@/pages/quizzes";
import QuizBuilderPage from "@/pages/quiz-builder";
import QuizTakePage from "@/pages/quiz-take";
import AssignmentsPage from "@/pages/assignments";
import AnalyticsPage from "@/pages/analytics";
import LecturesPage from "@/pages/lectures";
import PublicQuizPage from "@/pages/public-quiz";
import Chatbot from "@/components/Chatbot";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to={`/login?redirect=${encodeURIComponent(location)}`} />;
  }

  return <Component />;
}

function PublicOnlyRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (user) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-2 px-4 py-2 border-b bg-card shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/login">
        <PublicOnlyRoute component={LoginPage} />
      </Route>
      <Route path="/register">
        <PublicOnlyRoute component={RegisterPage} />
      </Route>

      <Route path="/dashboard">
        <AuthenticatedLayout>
          <ProtectedRoute component={DashboardPage} />
        </AuthenticatedLayout>
      </Route>
      <Route path="/courses">
        <AuthenticatedLayout>
          <ProtectedRoute component={CoursesPage} />
        </AuthenticatedLayout>
      </Route>
      <Route path="/quizzes">
        <AuthenticatedLayout>
          <ProtectedRoute component={QuizzesPage} />
        </AuthenticatedLayout>
      </Route>
      <Route path="/quizzes/new">
        <AuthenticatedLayout>
          <ProtectedRoute component={QuizBuilderPage} />
        </AuthenticatedLayout>
      </Route>
      <Route path="/quiz/:id/take">
        <ProtectedRoute component={QuizTakePage} />
      </Route>
      <Route path="/public/quiz/:token">
        <PublicQuizPage />
      </Route>
      <Route path="/assignments">
        <AuthenticatedLayout>
          <ProtectedRoute component={AssignmentsPage} />
        </AuthenticatedLayout>
      </Route>
      <Route path="/analytics">
        <AuthenticatedLayout>
          <ProtectedRoute component={AnalyticsPage} />
        </AuthenticatedLayout>
      </Route>
      <Route path="/lectures">
        <AuthenticatedLayout>
          <ProtectedRoute component={LecturesPage} />
        </AuthenticatedLayout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function ChatbotWrapper() {
  const { user } = useAuth();
  if (!user || user.role === "student") return null;
  return <Chatbot />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <ChatbotWrapper />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
