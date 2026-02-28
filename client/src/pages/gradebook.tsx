import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Trophy,
  TrendingDown,
  Users,
  Target,
  Download,
  BookOpen,
  BarChart3,
} from "lucide-react";
import type { Course } from "@shared/schema";

interface GradebookData {
  course: { id: string; name: string; code: string };
  quizzes: Array<{ id: string; title: string }>;
  assignments: Array<{ id: string; title: string; maxScore: number }>;
  students: Array<{
    student: { id: string; name: string; email: string };
    quizResults: Array<{ quizId: string; quizTitle: string; percentage: number | null; status: string }>;
    assignmentResults: Array<{ assignmentId: string; assignmentTitle: string; score: number | null; maxScore: number; status: string }>;
    overallAverage: number | null;
  }>;
  quizSummary: Array<{ quizId: string; title: string; best: number | null; worst: number | null; average: number | null; count: number }>;
  assignmentSummary: Array<{ assignmentId: string; title: string; best: number | null; worst: number | null; average: number | null; count: number }>;
}

function getCellColor(percentage: number | null): string {
  if (percentage === null) return "bg-muted/30 text-muted-foreground";
  if (percentage >= 80) return "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300";
  if (percentage >= 60) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300";
  return "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300";
}

function exportGradebookCSV(data: GradebookData, courseName: string) {
  const quizHeaders = data.quizzes.map(q => `"${q.title}"`);
  const assignmentHeaders = data.assignments.map(a => `"${a.title}"`);
  const headers = ["Student Name", "Email", ...quizHeaders, ...assignmentHeaders, "Overall Average"].join(",");

  const rows = data.students.map(s => {
    const quizScores = data.quizzes.map(q => {
      const result = s.quizResults.find(r => r.quizId === q.id);
      return result?.percentage !== null && result?.percentage !== undefined ? `${result.percentage}%` : "—";
    });
    const assignmentScores = data.assignments.map(a => {
      const result = s.assignmentResults.find(r => r.assignmentId === a.id);
      if (result?.score !== null && result?.score !== undefined && a.maxScore > 0) {
        return `${Math.round((result.score / a.maxScore) * 100)}%`;
      }
      return "—";
    });
    return [
      `"${s.student.name}"`,
      `"${s.student.email}"`,
      ...quizScores,
      ...assignmentScores,
      s.overallAverage !== null ? `${s.overallAverage}%` : "—",
    ].join(",");
  });

  const csv = [headers, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gradebook-${courseName.replace(/\s+/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function GradebookPage() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialCourseId = searchParams.get("courseId") ?? "all";
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId);

  const { data: courses } = useQuery<Course[]>({ queryKey: ["/api/courses"] });

  const { data: gradebook, isLoading } = useQuery<GradebookData>({
    queryKey: [`/api/courses/${selectedCourseId}/gradebook`],
    enabled: selectedCourseId !== "all",
  });

  const classAverage = gradebook
    ? (gradebook.students.filter(s => s.overallAverage !== null).reduce((sum, s) => sum + (s.overallAverage ?? 0), 0) /
       (gradebook.students.filter(s => s.overallAverage !== null).length || 1))
    : 0;
  const highestScore = gradebook
    ? Math.max(...gradebook.students.map(s => s.overallAverage ?? 0))
    : 0;
  const lowestScore = gradebook && gradebook.students.some(s => s.overallAverage !== null)
    ? Math.min(...gradebook.students.filter(s => s.overallAverage !== null).map(s => s.overallAverage as number))
    : 0;
  const passRate = gradebook
    ? Math.round((gradebook.students.filter(s => (s.overallAverage ?? 0) >= 60).length / (gradebook.students.length || 1)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-7 w-7" />
            Gradebook
          </h1>
          <p className="text-muted-foreground mt-1">Class-wide marks and performance overview</p>
        </div>
        {gradebook && (
          <Button
            variant="outline"
            onClick={() => exportGradebookCSV(gradebook, gradebook.course.name)}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Course Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Select a course..." />
              </SelectTrigger>
              <SelectContent>
                {courses?.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedCourseId === "all" && (
        <div className="text-center py-16 text-muted-foreground">
          <BarChart3 className="mx-auto h-12 w-12 mb-3" />
          <p className="text-lg font-medium">Select a course to view its gradebook</p>
        </div>
      )}

      {isLoading && selectedCourseId !== "all" && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {gradebook && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Class Average
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{Math.round(classAverage)}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" /> Highest Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">{highestScore}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" /> Lowest Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-500">{lowestScore}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" /> Pass Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">{passRate}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Assessment Summary */}
          {(gradebook.quizSummary.length > 0 || gradebook.assignmentSummary.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assessment Summary</CardTitle>
                <CardDescription>Best / Worst / Average scores per assessment</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium">Assessment</th>
                      <th className="text-center py-2 px-3 font-medium">Submissions</th>
                      <th className="text-center py-2 px-3 font-medium text-green-600">Best</th>
                      <th className="text-center py-2 px-3 font-medium text-red-500">Worst</th>
                      <th className="text-center py-2 px-3 font-medium">Average</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradebook.quizSummary.map(q => (
                      <tr key={q.quizId} className="border-b hover:bg-muted/30">
                        <td className="py-2 pr-4">
                          <span className="font-medium">{q.title}</span>
                          <Badge variant="secondary" className="ml-2 text-xs">Quiz</Badge>
                        </td>
                        <td className="py-2 px-3 text-center">{q.count}</td>
                        <td className="py-2 px-3 text-center text-green-600 font-medium">{q.best !== null ? `${q.best}%` : "—"}</td>
                        <td className="py-2 px-3 text-center text-red-500 font-medium">{q.worst !== null ? `${q.worst}%` : "—"}</td>
                        <td className="py-2 px-3 text-center font-medium">{q.average !== null ? `${q.average}%` : "—"}</td>
                      </tr>
                    ))}
                    {gradebook.assignmentSummary.map(a => (
                      <tr key={a.assignmentId} className="border-b hover:bg-muted/30">
                        <td className="py-2 pr-4">
                          <span className="font-medium">{a.title}</span>
                          <Badge variant="outline" className="ml-2 text-xs">Assignment</Badge>
                        </td>
                        <td className="py-2 px-3 text-center">{a.count}</td>
                        <td className="py-2 px-3 text-center text-green-600 font-medium">{a.best !== null ? `${a.best}%` : "—"}</td>
                        <td className="py-2 px-3 text-center text-red-500 font-medium">{a.worst !== null ? `${a.worst}%` : "—"}</td>
                        <td className="py-2 px-3 text-center font-medium">{a.average !== null ? `${a.average}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Full Gradebook Matrix */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Student Gradebook — {gradebook.course.name}
              </CardTitle>
              <CardDescription>
                Color: <span className="text-green-600 font-medium">Green ≥80%</span> ·{" "}
                <span className="text-yellow-600 font-medium">Yellow 60–79%</span> ·{" "}
                <span className="text-red-500 font-medium">Red &lt;60%</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {gradebook.students.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No enrolled students yet.</div>
              ) : (
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium sticky left-0 bg-card">Student</th>
                      {gradebook.quizzes.map(q => (
                        <th key={q.id} className="text-center py-2 px-2 font-medium max-w-[80px] text-xs" title={q.title}>
                          {q.title.length > 12 ? q.title.slice(0, 12) + "…" : q.title}
                          <div className="text-muted-foreground font-normal">Quiz</div>
                        </th>
                      ))}
                      {gradebook.assignments.map(a => (
                        <th key={a.id} className="text-center py-2 px-2 font-medium max-w-[80px] text-xs" title={a.title}>
                          {a.title.length > 12 ? a.title.slice(0, 12) + "…" : a.title}
                          <div className="text-muted-foreground font-normal">Assign.</div>
                        </th>
                      ))}
                      <th className="text-center py-2 px-3 font-medium">Overall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradebook.students
                      .sort((a, b) => (b.overallAverage ?? -1) - (a.overallAverage ?? -1))
                      .map((s, i) => (
                        <tr key={s.student.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => setLocation(`/students/${s.student.id}`)}>
                          <td className="py-2 pr-4 sticky left-0 bg-card">
                            <div className="font-medium">{s.student.name}</div>
                            <div className="text-xs text-muted-foreground">{s.student.email}</div>
                          </td>
                          {gradebook.quizzes.map(q => {
                            const result = s.quizResults.find(r => r.quizId === q.id);
                            const pct = result?.percentage ?? null;
                            return (
                              <td key={q.id} className="py-2 px-2 text-center">
                                <span className={`text-xs font-medium px-2 py-1 rounded-md ${getCellColor(pct)}`}>
                                  {pct !== null ? `${pct}%` : "—"}
                                </span>
                              </td>
                            );
                          })}
                          {gradebook.assignments.map(a => {
                            const result = s.assignmentResults.find(r => r.assignmentId === a.id);
                            const pct = result?.score !== null && result?.score !== undefined && a.maxScore > 0
                              ? Math.round((result.score / a.maxScore) * 100)
                              : null;
                            return (
                              <td key={a.id} className="py-2 px-2 text-center">
                                <span className={`text-xs font-medium px-2 py-1 rounded-md ${getCellColor(pct)}`}>
                                  {pct !== null ? `${pct}%` : "—"}
                                </span>
                              </td>
                            );
                          })}
                          <td className="py-2 px-3 text-center">
                            <span className={`text-sm font-bold px-2 py-1 rounded-md ${getCellColor(s.overallAverage)}`}>
                              {s.overallAverage !== null ? `${s.overallAverage}%` : "—"}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
