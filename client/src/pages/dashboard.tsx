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
  Trophy,
  Zap,
  Calendar,
  FileText,
  Download,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import type { Course, Quiz, Assignment, Lecture } from "@shared/schema";

interface DashboardStats {
  totalCourses: number;
  totalQuizzes: number;
  totalAssignments: number;
  totalStudents: number;
  pendingGrading: number;
  recentSubmissions: number;
  averageScore: number;
  recentSubmissionsList: Array<{
    id: string;
    studentName: string;
    quizTitle: string;
    score: number | null;
    totalPoints: number | null;
    percentage: number | null;
    submittedAt: Date | null;
  }>;
  scoreDistribution: Array<{ range: string; count: number }>;
}

function PerformanceChart({ data }: { data: Array<{ range: string; count: number }> }) {
  return (
    <div className="h-[300px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="range"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748b", fontSize: 12 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748b", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            contentStyle={{
              borderRadius: "12px",
              border: "none",
              boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)"
            }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={index >= 3 ? "#3b82f6" : "#94a3b8"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
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

function AdminDashboard() {
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
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <StatCard
          title="Active Courses"
          value={stats?.totalCourses || 0}
          description="Courses you're teaching"
          icon={BookOpen}
          color="primary"
          onClick={() => setLocation("/courses")}
        />
        <StatCard
          title="Students Enrolled"
          value={stats?.totalStudents || 0}
          description="Across all courses"
          icon={Users}
          color="primary"
          onClick={() => setLocation("/users")}
        />
      </div>

      <div className="grid gap-6">
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
      </div>
    </div>
  );
}

function InstructorDashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Instructor Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {user?.name}! Here's your teaching overview.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <Button
            onClick={() => setLocation("/quizzes/new")}
            className="shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Quiz
          </Button>
          <Button
            variant="outline"
            onClick={() => setLocation("/assignments?action=create")}
            className="shadow-sm transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Assignment
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Students"
          value={stats?.totalStudents || 0}
          description="Enrolled in your courses"
          icon={Users}
          color="primary"
          onClick={() => setLocation("/users")}
        />
        <StatCard
          title="Avg. Class Score"
          value={`${stats?.averageScore || 0}%`}
          description="Across all assessments"
          icon={TrendingUp}
          color="accent"
          onClick={() => setLocation("/analytics")}
        />
        <StatCard
          title="Pending Grading"
          value={stats?.pendingGrading || 0}
          description="Items awaiting review"
          icon={AlertTriangle}
          color="warning"
          onClick={() => setLocation("/assignments")}
        />
        <StatCard
          title="Total Quizzes"
          value={stats?.totalQuizzes || 0}
          description="Published & active"
          icon={FileQuestion}
          color="primary"
          onClick={() => setLocation("/quizzes")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Class Performance Distribution */}
        <Card className="lg:col-span-8 shadow-md border-2 hover:border-primary/20 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                Performance Overview
              </CardTitle>
              <CardDescription>Score distribution across all active quizzes</CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-normal">
              Live Data
            </Badge>
          </CardHeader>
          <CardContent>
            {stats?.scoreDistribution && stats.scoreDistribution.some(d => d.count > 0) ? (
              <PerformanceChart data={stats.scoreDistribution} />
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center border-2 border-dashed rounded-xl bg-muted/5 mt-4">
                <BarChart3 className="w-10 h-10 text-muted-foreground mb-3 opacity-20" />
                <p className="text-sm text-muted-foreground">Not enough data to generate chart</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Student Results - MAIN LOGIC ADDITION */}
        <Card className="lg:col-span-12 shadow-md border-2 overflow-hidden hover:border-primary/20 transition-colors">
          <CardHeader className="bg-muted/5 border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Recent Student Performance
                </CardTitle>
                <CardDescription>Latest quiz results from your students</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/analytics")}
                className="text-primary font-medium"
              >
                View Analytics
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {stats?.recentSubmissionsList && stats.recentSubmissionsList.length > 0 ? (
              <div className="divide-y">
                {stats.recentSubmissionsList.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
                        {result.studentName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{result.studentName}</p>
                        <p className="text-sm text-muted-foreground truncate">{result.quizTitle}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm text-muted-foreground">
                          {result.submittedAt ? new Date(result.submittedAt).toLocaleDateString() : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">Submitted</p>
                      </div>

                      <div className="flex items-center gap-4 min-w-[100px] justify-end">
                        <div className="text-right">
                          <p className={`text-xl font-bold ${(result.percentage ?? 0) >= 60 ? "text-green-600" : "text-red-600"}`}>
                            {result.percentage ?? 0}%
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase h-5 ${(result.percentage ?? 0) >= 60 ? "border-green-500 text-green-600" : "border-red-500 text-red-600"}`}
                          >
                            {(result.percentage ?? 0) >= 60 ? "Pass" : "Fail"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-muted/5">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                  <BarChart3 className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="font-medium text-slate-600">No recent submissions</p>
                <p className="text-sm text-muted-foreground">Student results will appear here once they complete a quiz.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StudentDashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Extended quiz type with attempt info
  interface QuizWithAttempt {
    id: string;
    title: string;
    description?: string | null;
    timeLimitMinutes?: number | null;
    attempted: boolean;
    submissionId: string | null;
    score: number | null;
    totalPoints: number | null;
    percentage: number | null;
    startDate?: string | null;
    endDate?: string | null;
  }

  const { data: quizzes, isLoading } = useQuery<QuizWithAttempt[]>({
    queryKey: ["/api/student/quizzes/upcoming"],
  });

  const { data: assignments } = useQuery<Assignment[]>({
    queryKey: ["/api/student/assignments/pending"],
  });

  const { data: lectures } = useQuery<Lecture[]>({
    queryKey: ["/api/lectures"],
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const upcomingCount = quizzes?.filter(q => !q.attempted).length ?? 0;

  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-bold">Welcome, {user?.name?.split(" ")[0]}!</h1>
        <p className="text-muted-foreground mt-1">
          Stay on track with your learning journey.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <StatCard
          title="Active Quizzes"
          value={upcomingCount}
          description="Available for attempt"
          icon={FileQuestion}
          color="primary"
        />
        <StatCard
          title="Assignments"
          value={assignments?.length || 0}
          description="Pending submissions"
          icon={ClipboardList}
          color="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* All Quizzes Card */}
        <Card className="lg:col-span-1 shadow-sm border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Your Quizzes
            </CardTitle>
            <CardDescription>All assigned assessments and their status</CardDescription>
          </CardHeader>
          <CardContent>
            {quizzes && quizzes.length > 0 ? (
              <div className="space-y-3">
                {quizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-all ${quiz.attempted
                        ? "bg-muted/20 border-muted grayscale-[0.3]"
                        : "bg-primary/5 border-primary/10 hover:border-primary/20"
                      }`}
                  >
                    {(() => {
                      const now = new Date();
                      const startDate = quiz.startDate ? new Date(quiz.startDate) : null;
                      const endDate = quiz.endDate ? new Date(quiz.endDate) : null;
                      
                      const isUpcoming = startDate && now < startDate;
                      const isExpired = endDate && now > endDate;
                      const isActive = (!startDate || now >= startDate) && (!endDate || now <= endDate);
                      
                      return (
                        <>
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${quiz.attempted
                                  ? "bg-slate-100 text-slate-500"
                                  : isUpcoming
                                    ? "bg-blue-100 text-blue-500"
                                    : isExpired
                                      ? "bg-red-100 text-red-500"
                                      : "bg-primary/15 text-primary"
                                }`}
                            >
                              {quiz.attempted ? (
                                <CheckCircle2 className="w-5 h-5" />
                              ) : (
                                <FileQuestion className="w-5 h-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {quiz.attempted ? (
                                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] h-4">
                                    Completed
                                  </Badge>
                                ) : isUpcoming ? (
                                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] h-4">
                                    Upcoming
                                  </Badge>
                                ) : isExpired ? (
                                  <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] h-4">
                                    Expired
                                  </Badge>
                                ) : (
                                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] h-4">
                                    Available
                                  </Badge>
                                )}
                              </div>
                              <p className="font-semibold text-base truncate">{quiz.title}</p>
                              <div className="flex flex-col gap-1 mt-1">
                                <div className="flex items-center gap-3">
                                  {quiz.attempted ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-primary">
                                        Score: {quiz.score ?? 0}/{quiz.totalPoints ?? 0}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] uppercase h-5 px-1.5 ${(quiz.percentage ?? 0) >= 60
                                            ? "border-green-500 text-green-600 bg-green-50"
                                            : "border-red-500 text-red-600 bg-red-50"
                                          }`}
                                      >
                                        {(quiz.percentage ?? 0) >= 60 ? "Pass" : "Fail"}
                                      </Badge>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {quiz.timeLimitMinutes ?? "No"} minutes
                                    </span>
                                  )}
                                </div>
                                
                                {(startDate || endDate) && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <Calendar className="w-3 h-3" />
                                    <span>
                                      {startDate ? startDate.toLocaleString() : ""}
                                      {startDate && endDate ? " - " : ""}
                                      {endDate ? endDate.toLocaleString() : ""}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 ml-4">
                            {quiz.attempted ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-1 hover:bg-primary/10"
                                onClick={() => setLocation(`/quiz/${quiz.id}/results/${quiz.submissionId}`)}
                              >
                                Results
                                <ArrowRight className="w-4 h-4 ml-1" />
                              </Button>
                            ) : isActive ? (
                              <Button
                                size="sm"
                                className="px-4 shadow-sm"
                                onClick={() => setLocation(`/quiz/${quiz.id}/take`)}
                              >
                                Start
                              </Button>
                            ) : (
                              <Button size="sm" disabled variant="secondary" className="px-4">
                                <Clock className="w-4 h-4 mr-1" />
                                {isUpcoming ? "Soon" : "Ended"}
                              </Button>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FileQuestion}
                title="No quizzes assigned"
                description="You'll see your quizzes here as soon as they are assigned."
              />
            )}
          </CardContent>
        </Card>

        {/* Pending Assignments */}
        <Card className="shadow-sm border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-500" />
              Pending Assignments
            </CardTitle>
            <CardDescription>Submit your work before the deadline</CardDescription>
          </CardHeader>
          <CardContent>
            {assignments && assignments.length > 0 ? (
              <div className="space-y-3">
                {assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-base truncate">{assignment.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Due: {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "No deadline"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => setLocation(`/assignment/${assignment.id}/submit`)}
                    >
                      Submit
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="No assignments"
                description="Everything is turned in! Great job."
              />
            )}
          </CardContent>
        </Card>

        {/* Lecture Notes Section */}
        <Card className="shadow-sm border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-500" />
              Lecture Notes
            </CardTitle>
            <CardDescription>Download course materials and summaries</CardDescription>
          </CardHeader>
          <CardContent>
            {lectures && lectures.length > 0 ? (
              <div className="space-y-3">
                {lectures.map((lecture) => (
                  <div
                    key={lecture.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{lecture.title}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">
                          {lecture.unit || "Course Material"}
                        </p>
                      </div>
                    </div>
                    {lecture.fileUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => window.open(`/api/objects/${lecture.fileUrl}`, "_blank")}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={BookOpen}
                title="No lecture notes"
                description="Your instructors haven't uploaded any notes yet."
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

  if (user?.role === "admin") {
    return <AdminDashboard />;
  }

  if (user?.role === "instructor") {
    return <InstructorDashboard />;
  }

  return <StudentDashboard />;
}
