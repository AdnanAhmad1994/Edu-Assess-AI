import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useUpload } from "@/hooks/use-upload";
import {
  Plus,
  FolderOpen,
  FileText,
  Video,
  Image,
  MoreVertical,
  Brain,
  Sparkles,
  Search,
  Upload,
  Eye,
  Download,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Lecture, Course } from "@shared/schema";

export default function LecturesPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadCourse, setUploadCourse] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [isGeneratingSummary, setIsGeneratingSummary] = useState<string | null>(null);

  const { data: lectures, isLoading } = useQuery<Lecture[]>({
    queryKey: ["/api/lectures", selectedCourse],
  });

  const { data: courses } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });

  const { getUploadParameters } = useUpload({
    onSuccess: (response) => {
      createLectureMutation.mutate({
        title: uploadTitle || "Untitled Lecture",
        courseId: uploadCourse,
        fileUrl: response.objectPath,
        fileType: "document",
      });
    },
  });

  const createLectureMutation = useMutation({
    mutationFn: async (data: { title: string; courseId: string; fileUrl: string; fileType: string }) => {
      return apiRequest("POST", "/api/lectures", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lectures"] });
      setIsUploadOpen(false);
      setUploadTitle("");
      toast({ title: "Lecture uploaded", description: "Your lecture has been uploaded successfully." });
    },
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async (lectureId: string) => {
      return apiRequest("POST", `/api/lectures/${lectureId}/generate-summary`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lectures"] });
      toast({ title: "Summary generated", description: "AI has generated a summary and key points for this lecture." });
    },
    onError: () => {
      toast({ title: "Generation failed", description: "Failed to generate summary.", variant: "destructive" });
    },
    onSettled: () => {
      setIsGeneratingSummary(null);
    },
  });

  const isInstructor = user?.role === "instructor" || user?.role === "admin";

  const filteredLectures = lectures?.filter((lecture) => {
    const matchesCourse = selectedCourse === "all" || lecture.courseId === selectedCourse;
    const matchesSearch =
      !searchQuery ||
      lecture.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lecture.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCourse && matchesSearch;
  });

  const getFileIcon = (fileType: string | null) => {
    switch (fileType) {
      case "video":
        return <Video className="w-5 h-5" />;
      case "image":
        return <Image className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1 max-w-sm" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lectures</h1>
          <p className="text-muted-foreground mt-1">
            {isInstructor ? "Upload and manage course materials" : "Access your course materials"}
          </p>
        </div>
        {isInstructor && (
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-upload-lecture">
                <Upload className="w-4 h-4 mr-2" />
                Upload Lecture
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Lecture Material</DialogTitle>
                <DialogDescription>
                  Upload a PDF, DOCX, or PPT file. AI will automatically generate a summary.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium">Course</label>
                  <Select value={uploadCourse} onValueChange={setUploadCourse}>
                    <SelectTrigger data-testid="select-upload-course">
                      <SelectValue placeholder="Select a course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses?.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.code} - {course.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Lecture title"
                    data-testid="input-lecture-title"
                  />
                </div>
                <ObjectUploader
                  maxFileSize={52428800}
                  onGetUploadParameters={getUploadParameters}
                  onComplete={() => {}}
                  buttonClassName="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Select File
                </ObjectUploader>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search lectures..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-lectures"
          />
        </div>
        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <SelectTrigger className="w-64" data-testid="select-filter-course">
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

      {filteredLectures && filteredLectures.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLectures.map((lecture) => (
            <Card key={lecture.id} className="hover-elevate" data-testid={`lecture-card-${lecture.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      {getFileIcon(lecture.fileType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{lecture.title}</CardTitle>
                      {lecture.unit && (
                        <Badge variant="secondary" className="mt-1">
                          {lecture.unit}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {isInstructor && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0" data-testid={`lecture-menu-${lecture.id}`}>
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setLocation(`/lectures/${lecture.id}`)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setIsGeneratingSummary(lecture.id);
                          generateSummaryMutation.mutate(lecture.id);
                        }}
                        disabled={isGeneratingSummary === lecture.id}
                      >
                        {isGeneratingSummary === lecture.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Brain className="w-4 h-4 mr-2" />
                        )}
                        Generate Summary
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLocation(`/quizzes/new?lecture=${lecture.id}`)}>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Quiz
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardHeader>
              <CardContent>
                <CardDescription className="line-clamp-2 mb-3">
                  {lecture.description || lecture.summary || "No description available"}
                </CardDescription>
                {lecture.keyPoints && (lecture.keyPoints as string[]).length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Key Points:</p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside">
                      {(lecture.keyPoints as string[]).slice(0, 3).map((point, i) => (
                        <li key={i} className="truncate">{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FolderOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No lectures found</h3>
            <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
              {isInstructor
                ? "Upload your first lecture to get started."
                : "No lectures are available for your courses yet."}
            </p>
            {isInstructor && (
              <Button className="mt-4" onClick={() => setIsUploadOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Lecture
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
