import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Award,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Target,
  Clock,
  Brain,
} from "lucide-react";
import type { Course } from "@shared/schema";

interface AnalyticsData {
  overview: {
    totalStudents: number;
    averageScore: number;
    passRate: number;
    totalSubmissions: number;
  };
  scoreDistribution: { range: string; count: number }[];
  performanceTrend: { date: string; average: number }[];
  topPerformers: { name: string; score: number; quizCount: number }[];
  lowPerformers: { name: string; score: number; quizCount: number }[];
  quizStats: { name: string; avgScore: number; submissions: number; passRate: number }[];
  violationStats: { type: string; count: number }[];
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

export default function AnalyticsPage() {
  const [selectedCourse, setSelectedCourse] = useState<string>("all");

  const { data: courses } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics", selectedCourse],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const mockAnalytics: AnalyticsData = {
    overview: {
      totalStudents: 156,
      averageScore: 78.5,
      passRate: 85.2,
      totalSubmissions: 423,
    },
    scoreDistribution: [
      { range: "0-20", count: 5 },
      { range: "21-40", count: 12 },
      { range: "41-60", count: 28 },
      { range: "61-80", count: 65 },
      { range: "81-100", count: 46 },
    ],
    performanceTrend: [
      { date: "Week 1", average: 72 },
      { date: "Week 2", average: 75 },
      { date: "Week 3", average: 78 },
      { date: "Week 4", average: 76 },
      { date: "Week 5", average: 82 },
      { date: "Week 6", average: 79 },
    ],
    topPerformers: [
      { name: "Alice Johnson", score: 98, quizCount: 8 },
      { name: "Bob Smith", score: 96, quizCount: 8 },
      { name: "Carol Williams", score: 95, quizCount: 7 },
      { name: "David Brown", score: 94, quizCount: 8 },
      { name: "Eva Martinez", score: 93, quizCount: 8 },
    ],
    lowPerformers: [
      { name: "Frank Lee", score: 42, quizCount: 5 },
      { name: "Grace Kim", score: 48, quizCount: 6 },
      { name: "Henry Zhang", score: 51, quizCount: 7 },
      { name: "Ivy Chen", score: 54, quizCount: 6 },
      { name: "Jack Wilson", score: 56, quizCount: 8 },
    ],
    quizStats: [
      { name: "Quiz 1: Basics", avgScore: 82, submissions: 45, passRate: 91 },
      { name: "Quiz 2: Intermediate", avgScore: 75, submissions: 44, passRate: 84 },
      { name: "Quiz 3: Advanced", avgScore: 68, submissions: 42, passRate: 76 },
      { name: "Midterm", avgScore: 73, submissions: 46, passRate: 82 },
    ],
    violationStats: [
      { type: "Tab Switch", count: 23 },
      { type: "Copy/Paste", count: 8 },
      { type: "Multiple Faces", count: 3 },
      { type: "No Face", count: 12 },
      { type: "Looking Away", count: 15 },
    ],
  };

  const data = analytics || mockAnalytics;

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Performance insights and student metrics
          </p>
        </div>
        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <SelectTrigger className="w-64" data-testid="select-course-filter">
            <SelectValue placeholder="All Courses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {courses?.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.code} - {course.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Students
            </CardTitle>
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.overview.totalStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all courses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Score
            </CardTitle>
            <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.overview.averageScore}%</div>
            <div className="flex items-center gap-1 mt-1 text-xs text-green-600 dark:text-green-400">
              <TrendingUp className="w-3 h-3" />
              +2.5% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pass Rate
            </CardTitle>
            <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Award className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.overview.passRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">Students passing threshold</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Submissions
            </CardTitle>
            <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.overview.totalSubmissions}</div>
            <p className="text-xs text-muted-foreground mt-1">Total quiz attempts</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Score Distribution</CardTitle>
            <CardDescription>How students performed across all assessments</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="range" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Trend</CardTitle>
            <CardDescription>Weekly average scores over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.performanceTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis domain={[0, 100]} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="average"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Top Performers
            </CardTitle>
            <CardDescription>Highest scoring students</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topPerformers.map((student, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/20"
                  data-testid={`top-performer-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-sm font-medium text-green-600 dark:text-green-400">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{student.name}</p>
                      <p className="text-xs text-muted-foreground">{student.quizCount} quizzes</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400">
                    {student.score}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Needs Attention
            </CardTitle>
            <CardDescription>Students who may need support</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.lowPerformers.map((student, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20"
                  data-testid={`low-performer-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-sm font-medium text-amber-600 dark:text-amber-400">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{student.name}</p>
                      <p className="text-xs text-muted-foreground">{student.quizCount} quizzes</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
                    {student.score}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-500" />
              Proctoring Insights
            </CardTitle>
            <CardDescription>Violation statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data.violationStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="type"
                >
                  {data.violationStats.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {data.violationStats.map((item, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  <div
                    className="w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  {item.type}: {item.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quiz Performance Breakdown</CardTitle>
          <CardDescription>Detailed statistics for each quiz</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Quiz Name</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Submissions</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Avg Score</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Pass Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.quizStats.map((quiz, index) => (
                  <tr key={index} className="border-b last:border-0" data-testid={`quiz-stat-${index}`}>
                    <td className="py-3 px-4 font-medium">{quiz.name}</td>
                    <td className="py-3 px-4 text-center">{quiz.submissions}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={quiz.avgScore >= 70 ? "default" : "secondary"}>
                        {quiz.avgScore}%
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge
                        variant="outline"
                        className={
                          quiz.passRate >= 80
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : quiz.passRate >= 60
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        }
                      >
                        {quiz.passRate}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
