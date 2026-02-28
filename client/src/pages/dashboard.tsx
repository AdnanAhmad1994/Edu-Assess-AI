import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import {
  BookOpen,
  FileQuestion,
  ClipboardList,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowRight,
  Brain,
  BarChart3,
} from "lucide-react";
import type { Course, Quiz, Assignment } from "@shared/schema";

interface DashboardStats {
  totalCourses: number;
  totalQuizzes: number;
  totalAssignments: number;
  totalStudents: number;
  pendingGrading: number;
  recentSubmissions: number;
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  color = "primary",
  onClick,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: any;
  trend?: string;
  color?: "primary" | "accent" | "destructive" | "warning";
  onClick?: () => void;
}) {
  const colorClasses = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    destructive: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
    warning: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
  };

  return (
    <Card
      className={onClick ? "hover-elevate cursor-pointer transition-shadow" : ""}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
        {trend && (
          <div className="flex items-center gap-1 mt-2 text-xs text-green-600 dark:text-green-400">
            <TrendingUp className="w-3 h-3" />
            {trend}
          </div>
        )}
        {onClick && (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <ArrowRight className="w-3 h-3" />
            <span>Click to view</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InstructorDashboard() {
  const [, setLocation] = useLocation();
  
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: recentCourses, isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });

  const { data: recentQuizzes, isLoading: quizzesLoading } = useQuery<Quiz[]>({
    queryKey: ["/api/quizzes"],
  });

  if (statsLoading || coursesLoading || quizzesLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's an overview of your assessments.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setLocation("/quizzes/new")} data-testid="button-new-quiz">
            <Plus className="w-4 h-4 mr-2" />
            New Quiz
          </Button>
          <Button variant="outline" onClick={() => setLocation("/assignments/new")} data-testid="button-new-assignment">
            <Plus className="w-4 h-4 mr-2" />
            New Assignment
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Courses"
          value={stats?.totalCourses || 0}
          description="Courses you're teaching"
          icon={BookOpen}
          color="primary"
          onClick={() => setLocation("/courses")}
        />
        <StatCard
          title="Published Quizzes"
          value={stats?.totalQuizzes || 0}
          description="Ready for students"
          icon={FileQuestion}
          color="accent"
          onClick={() => setLocation("/quizzes")}
        />
        <StatCard
          title="Pending Grading"
          value={stats?.pendingGrading || 0}
          description="Submissions to review"
          icon={AlertTriangle}
          color="warning"
          onClick={() => setLocation("/assignments")}
        />
        <StatCard
          title="Students Enrolled"
          value={stats?.totalStudents || 0}
          description="Across all courses"
          icon={Users}
          color="primary"
          onClick={() => setLocation("/analytics")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Courses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Recent Courses</CardTitle>
              <CardDescription>Your active courses</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/courses")} data-testid="button-view-all-courses">
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentCourses && recentCourses.length > 0 ? (
              <div className="space-y-3">
                {recentCourses.slice(0, 4).map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer"
                    onClick={() => setLocation("/courses")}
                    data-testid={`course-item-${course.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium truncate max-w-[140px]">{course.name}</p>
                        <p className="text-xs text-muted-foreground">{course.code} · {course.semester}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={BookOpen}
                title="No courses yet"
                description="Create your first course"
                action={
                  <Button size="sm" onClick={() => setLocation("/courses")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Go to Courses
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Recent Quizzes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Recent Quizzes</CardTitle>
              <CardDescription>Your latest created quizzes</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/quizzes")} data-testid="button-view-all-quizzes">
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentQuizzes && recentQuizzes.length > 0 ? (
              <div className="space-y-3">
                {recentQuizzes.slice(0, 4).map((quiz) => (
                  <div
                    key={quiz.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer"
                    onClick={() => setLocation(`/quizzes/new?edit=${quiz.id}`)}
                    data-testid={`quiz-item-${quiz.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileQuestion className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium truncate max-w-[100px]">{quiz.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : "No time limit"}
                        </p>
                      </div>
                    </div>
                    <Badge variant={quiz.status === "published" ? "default" : "secondary"}>
                      {quiz.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FileQuestion}
                title="No quizzes yet"
                description="Create your first quiz to get started"
                action={
                  <Button size="sm" onClick={() => setLocation("/quizzes/new")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Quiz
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* AI Features */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>AI Features</CardTitle>
              <CardDescription>Powered by Kimi K2 · OpenRouter</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div
                className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                onClick={() => setLocation("/quizzes/new?mode=ai")}
                data-testid="ai-feature-generate-questions"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">Generate Questions</p>
                    <p className="text-xs text-muted-foreground">
                      AI creates questions from your content
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>

              <div
                className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                onClick={() => setLocation("/assignments?grading=ai")}
                data-testid="ai-feature-essay-grading"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg gradient-accent flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">AI Essay Grading</p>
                    <p className="text-xs text-muted-foreground">
                      Automatic evaluation with feedback
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>

              <div
                className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                onClick={() => setLocation("/analytics")}
                data-testid="ai-feature-analytics"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">Performance Insights</p>
                    <p className="text-xs text-muted-foreground">
                      Best, worst, average analytics
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StudentDashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: upcomingQuizzes, isLoading } = useQuery<Quiz[]>({
    queryKey: ["/api/student/quizzes/upcoming"],
  });

  const { data: assignments } = useQuery<Assignment[]>({
    queryKey: ["/api/student/assignments/pending"],
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-bold">Welcome, {user?.name?.split(" ")[0]}!</h1>
        <p className="text-muted-foreground mt-1">
          Here's what's coming up for you.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Upcoming Quizzes"
          value={upcomingQuizzes?.length || 0}
          description="Scheduled for you"
          icon={FileQuestion}
          color="primary"
        />
        <StatCard
          title="Pending Assignments"
          value={assignments?.length || 0}
          description="Due soon"
          icon={ClipboardList}
          color="warning"
        />
        <StatCard
          title="Completed"
          value={0}
          description="This semester"
          icon={CheckCircle2}
          color="accent"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Upcoming Quizzes
            </CardTitle>
            <CardDescription>Quizzes scheduled for you</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingQuizzes && upcomingQuizzes.length > 0 ? (
              <div className="space-y-3">
                {upcomingQuizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    data-testid={`upcoming-quiz-${quiz.id}`}
                  >
                    <div>
                      <p className="font-medium">{quiz.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {quiz.timeLimitMinutes} minutes
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setLocation(`/quiz/${quiz.id}/take`)}>
                      Start Quiz
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FileQuestion}
                title="No upcoming quizzes"
                description="You're all caught up!"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-500" />
              Pending Assignments
            </CardTitle>
            <CardDescription>Assignments due soon</CardDescription>
          </CardHeader>
          <CardContent>
            {assignments && assignments.length > 0 ? (
              <div className="space-y-3">
                {assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    data-testid={`pending-assignment-${assignment.id}`}
                  >
                    <div>
                      <p className="font-medium">{assignment.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Due: {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : "No deadline"}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setLocation(`/assignment/${assignment.id}/submit`)}>
                      Submit
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="No pending assignments"
                description="You're all caught up!"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: any;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-72 mt-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  if (user?.role === "instructor" || user?.role === "admin") {
    return <InstructorDashboard />;
  }

  return <StudentDashboard />;
}
