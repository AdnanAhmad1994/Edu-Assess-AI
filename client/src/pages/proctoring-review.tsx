import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Shield,
  Clock,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface ProctoringViolation {
  id: string;
  submissionId: string;
  type: string;
  description: string | null;
  severity: string;
  screenshotUrl: string | null;
  timestamp: string;
  reviewed: boolean;
  reviewNote: string | null;
}

const VIOLATION_LABELS: Record<string, string> = {
  tab_switch: "Tab Switch",
  copy_paste: "Copy / Paste",
  multiple_faces: "Multiple Faces",
  no_face: "No Face",
  phone_detected: "Phone Detected",
  unauthorized_person: "Unauthorized Person",
  looking_away: "Looking Away",
  suspicious_behavior: "Suspicious Behavior",
};

const VIOLATION_COLORS: Record<string, string> = {
  tab_switch: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  copy_paste: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  multiple_faces: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  no_face: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  phone_detected: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  unauthorized_person: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  looking_away: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
  suspicious_behavior: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

function ViolationCard({ violation, onReview }: { violation: ProctoringViolation; onReview: (id: string, reviewed: boolean, note: string) => void }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(violation.reviewNote ?? "");

  return (
    <div className={`rounded-lg border p-4 space-y-3 transition-opacity ${violation.reviewed ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <AlertTriangle className={`h-5 w-5 mt-0.5 shrink-0 ${violation.reviewed ? "text-muted-foreground" : "text-amber-500"}`} />
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${VIOLATION_COLORS[violation.type] ?? VIOLATION_COLORS.suspicious_behavior}`}>
                {VIOLATION_LABELS[violation.type] ?? violation.type}
              </span>
              <Badge variant="outline" className="text-xs">{violation.severity}</Badge>
              {violation.reviewed && <Badge className="bg-green-500 text-xs">Reviewed</Badge>}
            </div>
            {violation.description && (
              <p className="text-sm text-muted-foreground">{violation.description}</p>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(violation.timestamp).toLocaleString()}
            </div>
            {violation.reviewNote && (
              <p className="text-xs text-muted-foreground italic border-l-2 pl-2">Note: {violation.reviewNote}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setNoteOpen(!noteOpen)}
          >
            {violation.reviewed ? <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" /> : <Eye className="h-3 w-3 mr-1" />}
            {violation.reviewed ? "Reviewed" : "Review"}
          </Button>
        </div>
      </div>

      {/* Screenshot */}
      {violation.screenshotUrl && (
        <div className="mt-2">
          <img
            src={violation.screenshotUrl}
            alt="Violation screenshot"
            className="rounded-lg max-h-40 object-cover border cursor-pointer hover:max-h-96 transition-all duration-300"
            title="Click to expand"
          />
        </div>
      )}

      {/* Review note form */}
      {noteOpen && (
        <div className="space-y-2 pt-2 border-t">
          <Textarea
            placeholder="Add a review note (optional)..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="text-sm min-h-[80px]"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => { onReview(violation.id, true, note); setNoteOpen(false); }}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Mark Reviewed
            </Button>
            {violation.reviewed && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { onReview(violation.id, false, note); setNoteOpen(false); }}
              >
                <EyeOff className="h-3 w-3 mr-1" />
                Unmark
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setNoteOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProctoringReviewPage() {
  const { id: quizId, submissionId } = useParams<{ id: string; submissionId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: violations, isLoading } = useQuery<ProctoringViolation[]>({
    queryKey: [`/api/proctoring/violations/${submissionId}`],
  });

  const { data: submissionData } = useQuery<any>({
    queryKey: [`/api/quiz-submissions/${submissionId}`],
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, reviewed, reviewNote }: { id: string; reviewed: boolean; reviewNote: string }) => {
      const res = await fetch(`/api/proctoring/violations/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewed, reviewNote }),
      });
      if (!res.ok) throw new Error("Failed to update violation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/proctoring/violations/${submissionId}`] });
      toast({ title: "Violation updated" });
    },
    onError: () => {
      toast({ title: "Failed to update violation", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  const reviewedCount = (violations ?? []).filter(v => v.reviewed).length;
  const totalCount = (violations ?? []).length;

  const typeBreakdown = (violations ?? []).reduce((acc, v) => {
    acc[v.type] = (acc[v.type] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation(`/quiz/${quizId}/submissions`)}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-amber-500" />
            Proctoring Review
          </h1>
          {submissionData?.quiz && (
            <p className="text-muted-foreground text-sm">{submissionData.quiz.title}</p>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{totalCount}</p>
            <p className="text-sm text-muted-foreground">Total Violations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-green-600">{reviewedCount}</p>
            <p className="text-sm text-muted-foreground">Reviewed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-amber-500">{totalCount - reviewedCount}</p>
            <p className="text-sm text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{Object.keys(typeBreakdown).length}</p>
            <p className="text-sm text-muted-foreground">Violation Types</p>
          </CardContent>
        </Card>
      </div>

      {/* Violation type breakdown */}
      {Object.keys(typeBreakdown).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Violation Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(typeBreakdown).map(([type, count]) => (
              <span key={type} className={`text-xs font-medium px-2 py-1 rounded-full ${VIOLATION_COLORS[type] ?? VIOLATION_COLORS.suspicious_behavior}`}>
                {VIOLATION_LABELS[type] ?? type}: {count}
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Violations timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Violation Timeline
          </CardTitle>
          <CardDescription>
            {totalCount === 0 ? "No violations recorded for this submission." : `${totalCount} violation${totalCount !== 1 ? "s" : ""} recorded`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {totalCount === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="mx-auto h-10 w-10 mb-2 text-green-500" />
              <p>No violations detected. Clean submission!</p>
            </div>
          ) : (
            (violations ?? []).map((v) => (
              <ViolationCard
                key={v.id}
                violation={v}
                onReview={(id, reviewed, note) => reviewMutation.mutate({ id, reviewed, reviewNote: note })}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Action buttons */}
      {totalCount > 0 && totalCount - reviewedCount > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              (violations ?? [])
                .filter(v => !v.reviewed)
                .forEach(v => reviewMutation.mutate({ id: v.id, reviewed: true, reviewNote: "" }));
            }}
            disabled={reviewMutation.isPending}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Mark All as Reviewed
          </Button>
        </div>
      )}
    </div>
  );
}
