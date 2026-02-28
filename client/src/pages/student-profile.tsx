import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ChevronLeft,
  Trophy,
  TrendingDown,
  BookOpen,
  AlertTriangle,
  Download,
  CheckCircle2,
  Clock,
  Shield,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface PerformanceData {
  student: { id: string; name: string; email: string; role: string };
  enrolledCourses: Array<{ id: string; name: string; code: string }>;
  quizSubmissions: Array<{
    id: string;
    quizId: string;
    quizTitle: string;
    courseId: string;
    courseName: string;
    score: number | null;
    totalPoints: number | null;
    percentage: number | null;
    status: string;
    submittedAt: string | null;
    aiFeedback: string | null;
  }>;
  assignmentSubmissions: Array<{
    id: string;
    assignmentId: string;
    assignmentTitle: string;
    courseId: string;
    courseName: string;
    score: number | null;
    status: string;
    aiContentScore: number | null;
    submittedAt: string | null;
    gradedAt: string | null;
  }>;
  proctoringViolations: Array<{
    id: string;
    submissionId: string;
    type: string;
    description: string | null;
    severity: string;
    screenshotUrl: string | null;
    timestamp: string;
    reviewed: boolean;
  }>;
  stats: {
    totalQuizzesTaken: number;
    averageQuizScore: number;
    bestQuizScore: number;
    worstQuizScore: number;
    totalAssignmentsSubmitted: number;
    averageAssignmentScore: number;
    totalViolations: number;
  };
}

const VIOLATION_LABELS: Record<string, string> = {
  tab_switch: "Tab Switch",
  copy_paste: "Copy/Paste",
  multiple_faces: "Multiple Faces",
  no_face: "No Face",
  phone_detected: "Phone",
  unauthorized_person: "Unauthorized Person",
  looking_away: "Looking Away",
  suspicious_behavior: "Suspicious",
};

function downloadReport(data: PerformanceData) {
  const lines = [
    `STUDENT PERFORMANCE REPORT`,
    `Generated: ${new Date().toLocaleString()}`,
    ``,
    `STUDENT INFORMATION`,
    `Name: ${data.student.name}`,
    `Email: ${data.student.email}`,
    ``,
    `SUMMARY`,
    `Courses Enrolled: ${data.enrolledCourses.length}`,
    `Quizzes Taken: ${data.stats.totalQuizzesTaken}`,
    `Average Quiz Score: ${data.stats.averageQuizScore}%`,
    `Best Quiz Score: ${data.stats.bestQuizScore}%`,
    `Worst Quiz Score: ${data.stats.worstQuizScore}%`,
    `Assignments Submitted: ${data.stats.totalAssignmentsSubmitted}`,
    `Average Assignment Score: ${data.stats.averageAssignmentScore}%`,
    `Total Proctoring Violations: ${data.stats.totalViolations}`,
    ``,
    `ENROLLED COURSES`,
    ...data.enrolledCourses.map(c => `  - ${c.name} (${c.code})`),
    ``,
    `QUIZ HISTORY`,
    ...data.quizSubmissions.map(s =>
      `  ${s.quizTitle} [${s.courseName}] — ${s.percentage !== null ? s.percentage + "%" : "—"} (${s.status}) — ${s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : "—"}`
    ),
    ``,
    `ASSIGNMENT HISTORY`,
    ...data.assignmentSubmissions.map(s =>
      `  ${s.assignmentTitle} [${s.courseName}] — Score: ${s.score !== null ? s.score : "—"} (${s.status}) — ${s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : "—"}`
    ),
    ``,
    `PROCTORING VIOLATIONS`,
    data.proctoringViolations.length === 0 ? "  None" : "",
    ...data.proctoringViolations.map(v =>
      `  [${new Date(v.timestamp).toLocaleString()}] ${VIOLATION_LABELS[v.type] ?? v.type} — ${v.description ?? ""} (${v.reviewed ? "Reviewed" : "Pending Review"})`
    ),
  ];

  const content = lines.join("\n");
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `report-${data.student.name.replace(/\s+/g, "-")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StudentProfilePage() {
  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const studentId = params.id ?? user?.id ?? "";
  const isOwnProfile = !params.id || params.id === user?.id;

  const { data, isLoading, error } = useQuery<PerformanceData>({
    queryKey: [params.id ? `/api/students/${params.id}/performance` : `/api/student/performance`],
    enabled: !!studentId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
            <p className="text-muted-foreground">Could not load student performance data.</p>
            <Button onClick={() => setLocation("/dashboard")}>Back to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { student, enrolledCourses, quizSubmissions, assignmentSubmissions, proctoringViolations, stats } = data;

  // Build chart data: quiz scores over time
  const trendData = quizSubmissions
    .filter(s => s.submittedAt && s.percentage !== null)
    .sort((a, b) => new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime())
    .map(s => ({
      date: new Date(s.submittedAt!).toLocaleDateString(),
      score: s.percentage,
      quiz: s.quizTitle,
    }));

  // Group by course
  const courseStats = enrolledCourses.map(course => {
    const courseQuizzes = quizSubmissions.filter(s => s.courseId === course.id && s.percentage !== null);
    const courseAssignments = assignmentSubmissions.filter(s => s.courseId === course.id);
    const avgQuiz = courseQuizzes.length > 0
      ? Math.round(courseQuizzes.reduce((sum, s) => sum + (s.percentage ?? 0), 0) / courseQuizzes.length)
      : null;
    return { course, quizCount: courseQuizzes.length, assignmentCount: courseAssignments.length, avgQuiz };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {!isOwnProfile && (
            <Button variant="ghost" size="sm" onClick={() => setLocation("/gradebook")}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold">{isOwnProfile ? "My Performance" : `${student.name}`}</h1>
            <p className="text-muted-foreground text-sm">{student.email}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => downloadReport(data)}>
          <Download className="h-4 w-4 mr-2" />
          Download Report
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Avg Quiz Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.averageQuizScore}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <Trophy className="h-3 w-3 text-yellow-500" /> Best Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{stats.bestQuizScore}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalAssignmentsSubmitted}</p>
            <p className="text-xs text-muted-foreground">submitted</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3 text-amber-500" /> Violations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${stats.totalViolations > 0 ? "text-amber-500" : "text-green-600"}`}>
              {stats.totalViolations}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Score Trend Chart */}
      {trendData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quiz Score Trend</CardTitle>
            <CardDescription>Performance over time across all quizzes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  formatter={(value: number, name: string) => [`${value}%`, "Score"]}
                />
                <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Course Breakdown */}
      {courseStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Course Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {courseStats.map(cs => (
              <div key={cs.course.id} className="p-3 rounded-lg border bg-muted/20">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{cs.course.name}</p>
                    <p className="text-xs text-muted-foreground">{cs.course.code}</p>
                  </div>
                  {cs.avgQuiz !== null && (
                    <Badge
                      className={cs.avgQuiz >= 80 ? "bg-green-500" : cs.avgQuiz >= 60 ? "bg-yellow-500" : "bg-red-500"}
                    >
                      {cs.avgQuiz}%
                    </Badge>
                  )}
                </div>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{cs.quizCount} quiz{cs.quizCount !== 1 ? "zes" : ""}</span>
                  <span>{cs.assignmentCount} assignment{cs.assignmentCount !== 1 ? "s" : ""}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quiz History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quiz History</CardTitle>
        </CardHeader>
        <CardContent>
          {quizSubmissions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No quiz submissions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Quiz</th>
                    <th className="text-left py-2 pr-4 font-medium">Course</th>
                    <th className="text-center py-2 pr-4 font-medium">Score</th>
                    <th className="text-center py-2 pr-4 font-medium">Status</th>
                    <th className="text-left py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {quizSubmissions.map(s => (
                    <tr
                      key={s.id}
                      className="border-b hover:bg-muted/30 cursor-pointer"
                      onClick={() => setLocation(`/quiz/${s.quizId}/results/${s.id}`)}
                    >
                      <td className="py-2 pr-4 font-medium">{s.quizTitle}</td>
                      <td className="py-2 pr-4 text-muted-foreground text-xs">{s.courseName}</td>
                      <td className="py-2 pr-4 text-center">
                        {s.percentage !== null ? (
                          <span className={`font-bold ${s.percentage >= 80 ? "text-green-600" : s.percentage >= 60 ? "text-yellow-600" : "text-red-500"}`}>
                            {s.percentage}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-center">
                        <Badge
                          variant={s.status === "graded" ? "default" : "secondary"}
                          className="text-xs capitalize"
                        >
                          {s.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-muted-foreground text-xs">
                        {s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignment History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assignment History</CardTitle>
        </CardHeader>
        <CardContent>
          {assignmentSubmissions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No assignment submissions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Assignment</th>
                    <th className="text-left py-2 pr-4 font-medium">Course</th>
                    <th className="text-center py-2 pr-4 font-medium">Score</th>
                    <th className="text-center py-2 pr-4 font-medium">AI Score</th>
                    <th className="text-center py-2 pr-4 font-medium">Status</th>
                    <th className="text-left py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {assignmentSubmissions.map(s => (
                    <tr key={s.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 pr-4 font-medium">{s.assignmentTitle}</td>
                      <td className="py-2 pr-4 text-muted-foreground text-xs">{s.courseName}</td>
                      <td className="py-2 pr-4 text-center font-medium">{s.score !== null ? s.score : "—"}</td>
                      <td className="py-2 pr-4 text-center">
                        {s.aiContentScore !== null ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            s.aiContentScore >= 70 ? "bg-red-100 text-red-700" :
                            s.aiContentScore >= 40 ? "bg-yellow-100 text-yellow-700" :
                            "bg-green-100 text-green-700"
                          }`}>
                            {s.aiContentScore}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-center">
                        <Badge variant={s.status === "graded" ? "default" : "secondary"} className="text-xs capitalize">
                          {s.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-muted-foreground text-xs">
                        {s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Violations (instructor or if student has violations) */}
      {(user?.role !== "student" || proctoringViolations.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-500" />
              Proctoring Violations
            </CardTitle>
            <CardDescription>
              {proctoringViolations.length === 0 ? "No violations recorded" : `${proctoringViolations.length} violation${proctoringViolations.length !== 1 ? "s" : ""}`}
            </CardDescription>
          </CardHeader>
          {proctoringViolations.length > 0 && (
            <CardContent className="space-y-2">
              {proctoringViolations.slice(0, 10).map(v => (
                <div key={v.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border">
                  <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${v.reviewed ? "text-muted-foreground" : "text-amber-500"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{VIOLATION_LABELS[v.type] ?? v.type}</span>
                      <Badge variant="outline" className="text-xs">{v.severity}</Badge>
                      {v.reviewed && <Badge className="bg-green-500 text-xs">Reviewed</Badge>}
                    </div>
                    {v.description && <p className="text-xs text-muted-foreground mt-0.5">{v.description}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(v.timestamp).toLocaleString()}</p>
                  </div>
                  {v.screenshotUrl && (
                    <img src={v.screenshotUrl} alt="Violation" className="h-12 w-16 rounded object-cover shrink-0" />
                  )}
                </div>
              ))}
              {proctoringViolations.length > 10 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{proctoringViolations.length - 10} more violations
                </p>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
