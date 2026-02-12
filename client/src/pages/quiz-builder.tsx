import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useUpload } from "@/hooks/use-upload";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  Brain,
  FileQuestion,
  Clock,
  Shield,
  GripVertical,
  Sparkles,
  Upload,
  CheckCircle2,
  X,
  AlertCircle,
  Loader2,
  Image,
  FileText,
  File,
  Eye,
} from "lucide-react";
import type { Course, Question, QuestionType, Lecture } from "@shared/schema";

const quizSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  instructions: z.string().optional(),
  courseId: z.string().min(1, "Please select a course"),
  timeLimitMinutes: z.number().min(0).optional(),
  passingScore: z.number().min(0).max(100).default(60),
  randomizeQuestions: z.boolean().default(true),
  randomizeOptions: z.boolean().default(true),
  showResults: z.boolean().default(true),
  proctored: z.boolean().default(false),
});

type QuizFormData = z.infer<typeof quizSchema>;

const questionTypes: { value: QuestionType; label: string }[] = [
  { value: "mcq", label: "Multiple Choice" },
  { value: "true_false", label: "True/False" },
  { value: "short_answer", label: "Short Answer" },
  { value: "essay", label: "Essay" },
  { value: "fill_blank", label: "Fill in the Blank" },
  { value: "matching", label: "Matching" },
];

interface QuestionInput {
  id: string;
  type: QuestionType;
  text: string;
  options: string[];
  correctAnswer: string;
  points: number;
  difficulty: string;
  imageUrl?: string;
}

export default function QuizBuilderPage() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const isAIMode = searchParams.includes("mode=ai");
  const { toast } = useToast();

  const [questions, setQuestions] = useState<QuestionInput[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState(isAIMode ? "ai" : "manual");
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [quizAttachment, setQuizAttachment] = useState<{ url: string; name: string; type: string } | null>(null);

  const { data: courses } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });

  const selectedCourseId = useSearch().includes("courseId=")
    ? new URLSearchParams(useSearch()).get("courseId")
    : null;

  const { data: lectures } = useQuery<Lecture[]>({
    queryKey: ["/api/lectures"],
  });

  const form = useForm<QuizFormData>({
    resolver: zodResolver(quizSchema),
    defaultValues: {
      title: "",
      description: "",
      instructions: "",
      courseId: selectedCourseId || "",
      timeLimitMinutes: 30,
      passingScore: 60,
      randomizeQuestions: true,
      randomizeOptions: true,
      showResults: true,
      proctored: false,
    },
  });

  const createQuizMutation = useMutation({
    mutationFn: async (data: QuizFormData & { questions: QuestionInput[]; attachmentUrl?: string; attachmentType?: string; attachmentName?: string }) => {
      return apiRequest("POST", "/api/quizzes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
      toast({ title: "Quiz created", description: "Your quiz has been created successfully." });
      setLocation("/quizzes");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create quiz.", variant: "destructive" });
    },
  });

  const generateQuestionsMutation = useMutation({
    mutationFn: async (data: { content: string; courseId: string; numQuestions: number; difficulty: string }) => {
      const res = await apiRequest("POST", "/api/ai/generate-questions", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.questions) {
        const newQuestions: QuestionInput[] = data.questions.map((q: any, index: number) => ({
          id: `ai-${Date.now()}-${index}`,
          type: q.type || "mcq",
          text: q.text,
          options: q.options || [],
          correctAnswer: q.correctAnswer || "",
          points: q.points || 1,
          difficulty: q.difficulty || "medium",
        }));
        setQuestions((prev) => [...prev, ...newQuestions]);
        toast({ title: "Questions generated", description: `Added ${newQuestions.length} AI-generated questions.` });
      }
    },
    onError: () => {
      toast({ title: "Generation failed", description: "Failed to generate questions.", variant: "destructive" });
    },
  });

  const generateFromFileMutation = useMutation({
    mutationFn: async (data: { fileUrl: string; fileName: string; fileType: string; numQuestions: number; difficulty: string; courseId: string }) => {
      const res = await apiRequest("POST", "/api/ai/generate-questions-from-file", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.questions) {
        const newQuestions: QuestionInput[] = data.questions.map((q: any, index: number) => ({
          id: `file-ai-${Date.now()}-${index}`,
          type: q.type || "mcq",
          text: q.text,
          options: q.options || [],
          correctAnswer: q.correctAnswer || "",
          points: q.points || 1,
          difficulty: q.difficulty || "medium",
        }));
        setQuestions((prev) => [...prev, ...newQuestions]);
        toast({ title: "Questions generated from file", description: `Added ${newQuestions.length} AI-generated questions from your uploaded file.` });
      }
    },
    onError: () => {
      toast({ title: "Generation failed", description: "Failed to generate questions from file.", variant: "destructive" });
    },
  });

  const addQuestion = () => {
    const newQuestion: QuestionInput = {
      id: `manual-${Date.now()}`,
      type: "mcq",
      text: "",
      options: ["", "", "", ""],
      correctAnswer: "",
      points: 1,
      difficulty: "medium",
    };
    setQuestions((prev) => [...prev, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<QuestionInput>) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
  };

  const removeQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleGenerateQuestions = () => {
    const courseId = form.getValues("courseId");
    if (!courseId) {
      toast({ title: "Select a course", description: "Please select a course first.", variant: "destructive" });
      return;
    }
    if (!aiPrompt.trim()) {
      toast({ title: "Enter content", description: "Please provide content or topic for question generation.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    generateQuestionsMutation.mutate(
      { content: aiPrompt, courseId, numQuestions: 5, difficulty: "mixed" },
      { onSettled: () => setIsGenerating(false) }
    );
  };

  const handleFileUpload = async (file: File, purpose: "question-image" | "generate" | "attachment") => {
    setIsUploadingFile(true);
    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      const fileInfo = { url: objectPath, name: file.name, type: file.type };

      if (purpose === "generate") {
        setUploadedFile(fileInfo);
      } else if (purpose === "attachment") {
        setQuizAttachment(fileInfo);
      }

      return fileInfo;
    } catch (error) {
      toast({ title: "Upload failed", description: "Failed to upload file.", variant: "destructive" });
      return null;
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleGenerateFromFile = () => {
    const courseId = form.getValues("courseId");
    if (!courseId) {
      toast({ title: "Select a course", description: "Please select a course first.", variant: "destructive" });
      return;
    }
    if (!uploadedFile) {
      toast({ title: "Upload a file", description: "Please upload a document or image first.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    generateFromFileMutation.mutate(
      {
        fileUrl: uploadedFile.url,
        fileName: uploadedFile.name,
        fileType: uploadedFile.type,
        numQuestions: 5,
        difficulty: "mixed",
        courseId,
      },
      { onSettled: () => setIsGenerating(false) }
    );
  };

  const handleGenerateFromLecture = (lecture: Lecture) => {
    const courseId = form.getValues("courseId");
    if (!courseId) {
      toast({ title: "Select a course", description: "Please select a course first.", variant: "destructive" });
      return;
    }
    if (!lecture.fileUrl) {
      toast({ title: "No file", description: "This lecture doesn't have an attached file.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    generateFromFileMutation.mutate(
      {
        fileUrl: lecture.fileUrl,
        fileName: lecture.title,
        fileType: lecture.fileType || "application/pdf",
        numQuestions: 5,
        difficulty: "mixed",
        courseId,
      },
      { onSettled: () => setIsGenerating(false) }
    );
  };

  const onSubmit = (data: QuizFormData) => {
    if (questions.length === 0) {
      toast({ title: "Add questions", description: "Please add at least one question.", variant: "destructive" });
      return;
    }
    createQuizMutation.mutate({
      ...data,
      questions,
      ...(quizAttachment ? {
        attachmentUrl: quizAttachment.url,
        attachmentType: quizAttachment.type,
        attachmentName: quizAttachment.name,
      } : {}),
    });
  };

  const courseLectures = lectures?.filter((l) => l.courseId === form.watch("courseId") && l.fileUrl) || [];

  return (
    <div className="space-y-6 fade-in max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Create Quiz</h1>
          <p className="text-muted-foreground mt-1">
            Build a new quiz manually, generate with AI, or upload files
          </p>
        </div>
        <Button variant="outline" onClick={() => setLocation("/quizzes")}>
          Cancel
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quiz Details</CardTitle>
              <CardDescription>Basic information about your quiz</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quiz Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Midterm Exam - Chapter 1-5" data-testid="input-quiz-title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="courseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-course">
                          <SelectValue placeholder="Select a course" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {courses?.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.code} - {course.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="A brief description of the quiz..." data-testid="input-quiz-description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="timeLimitMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time Limit (minutes)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="30"
                          data-testid="input-time-limit"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>Set to 0 for no limit</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="passingScore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Passing Score (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          data-testid="input-passing-score"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Quiz Attachment (Optional)</label>
                <p className="text-xs text-muted-foreground">Attach a document or image that students can view while taking the quiz</p>
                {quizAttachment ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    {quizAttachment.type.startsWith("image/") ? (
                      <Image className="w-5 h-5 text-muted-foreground shrink-0" />
                    ) : (
                      <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm truncate flex-1">{quizAttachment.name}</span>
                    {quizAttachment.type.startsWith("image/") && (
                      <img src={quizAttachment.url} alt="Preview" className="w-16 h-16 object-cover rounded" />
                    )}
                    <Button type="button" variant="ghost" size="icon" onClick={() => setQuizAttachment(null)} data-testid="button-remove-quiz-attachment">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <FileUploadButton
                    onUpload={(file) => handleFileUpload(file, "attachment")}
                    isUploading={isUploadingFile}
                    accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.txt"
                    label="Attach File"
                    testId="button-attach-quiz-file"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quiz Settings</CardTitle>
              <CardDescription>Configure quiz behavior and proctoring</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="randomizeQuestions"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-2 rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Randomize Questions</FormLabel>
                        <FormDescription>Shuffle question order for each student</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-randomize-questions" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="randomizeOptions"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-2 rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Randomize Options</FormLabel>
                        <FormDescription>Shuffle MCQ answer options</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-randomize-options" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="showResults"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-2 rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Show Results</FormLabel>
                        <FormDescription>Allow students to see their score</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-show-results" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="proctored"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-2 rounded-lg border p-3 border-primary/30 bg-primary/5">
                      <div className="space-y-0.5">
                        <FormLabel className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-primary" />
                          Enable Proctoring
                        </FormLabel>
                        <FormDescription>AI-powered anti-cheating monitoring</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-proctored" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileQuestion className="w-5 h-5" />
                Questions
                <Badge variant="secondary">{questions.length}</Badge>
              </CardTitle>
              <CardDescription>Add questions manually, generate with AI, or upload files for AI analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="manual" data-testid="tab-manual-questions">
                    <Plus className="w-4 h-4 mr-2" />
                    Manual
                  </TabsTrigger>
                  <TabsTrigger value="ai" data-testid="tab-ai-questions">
                    <Brain className="w-4 h-4 mr-2" />
                    AI Generate
                  </TabsTrigger>
                  <TabsTrigger value="file" data-testid="tab-file-questions">
                    <Upload className="w-4 h-4 mr-2" />
                    From File
                  </TabsTrigger>
                  {courseLectures.length > 0 && (
                    <TabsTrigger value="lecture" data-testid="tab-lecture-questions">
                      <FileText className="w-4 h-4 mr-2" />
                      From Lecture
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="ai" className="space-y-4">
                  <div className="rounded-lg border border-dashed border-primary/50 bg-primary/5 p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                        <Sparkles className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">AI Question Generator</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Paste your lecture content, notes, or describe a topic. Gemini will generate relevant questions automatically.
                        </p>
                        <Textarea
                          placeholder="Paste lecture content, notes, or describe the topic you want questions about..."
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          className="min-h-[120px] mb-4"
                          data-testid="textarea-ai-prompt"
                        />
                        <Button
                          type="button"
                          onClick={handleGenerateQuestions}
                          disabled={isGenerating || !aiPrompt.trim()}
                          data-testid="button-generate-questions"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Brain className="w-4 h-4 mr-2" />
                              Generate Questions
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="file" className="space-y-4">
                  <div className="rounded-lg border border-dashed border-primary/50 bg-primary/5 p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                        <Upload className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">Generate from File</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Upload a PDF, document, or image. AI will analyze its content and generate relevant quiz questions.
                        </p>

                        {uploadedFile ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                              {uploadedFile.type.startsWith("image/") ? (
                                <div className="shrink-0">
                                  <img src={uploadedFile.url} alt="Uploaded" className="w-20 h-20 object-cover rounded-lg" />
                                </div>
                              ) : (
                                <FileText className="w-10 h-10 text-primary shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
                                <p className="text-xs text-muted-foreground">{uploadedFile.type}</p>
                              </div>
                              <Button type="button" variant="ghost" size="icon" onClick={() => setUploadedFile(null)} data-testid="button-remove-uploaded-file">
                                <X className="w-4 h-4" />
                              </Button>
                            </div>

                            <Button
                              type="button"
                              onClick={handleGenerateFromFile}
                              disabled={isGenerating}
                              data-testid="button-generate-from-file"
                            >
                              {isGenerating ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Analyzing & Generating...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4 mr-2" />
                                  Generate Questions from File
                                </>
                              )}
                            </Button>
                          </div>
                        ) : (
                          <FileUploadButton
                            onUpload={(file) => handleFileUpload(file, "generate")}
                            isUploading={isUploadingFile}
                            accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.txt"
                            label="Upload File or Image"
                            testId="button-upload-file-for-generation"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {courseLectures.length > 0 && (
                  <TabsContent value="lecture" className="space-y-4">
                    <div className="rounded-lg border border-dashed border-primary/50 bg-primary/5 p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                          <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold mb-1">Generate from Lecture</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Select an existing lecture file from this course. AI will analyze it and generate quiz questions.
                          </p>

                          <div className="space-y-2">
                            {courseLectures.map((lecture) => (
                              <div
                                key={lecture.id}
                                className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-background"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{lecture.title}</p>
                                    <p className="text-xs text-muted-foreground">{lecture.fileType || "Document"}</p>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleGenerateFromLecture(lecture)}
                                  disabled={isGenerating}
                                  data-testid={`button-generate-from-lecture-${lecture.id}`}
                                >
                                  {isGenerating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Sparkles className="w-4 h-4 mr-1" />
                                      Generate
                                    </>
                                  )}
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                )}

                <TabsContent value="manual">
                  <Button type="button" variant="outline" onClick={addQuestion} className="w-full" data-testid="button-add-question">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Question
                  </Button>
                </TabsContent>
              </Tabs>

              {questions.length > 0 && (
                <div className="mt-6 space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Added Questions</h4>
                  {questions.map((question, index) => (
                    <QuestionEditor
                      key={question.id}
                      index={index}
                      question={question}
                      onUpdate={(updates) => updateQuestion(question.id, updates)}
                      onRemove={() => removeQuestion(question.id)}
                      onImageUpload={handleFileUpload}
                      isUploading={isUploadingFile}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setLocation("/quizzes")}>
              Cancel
            </Button>
            <Button type="submit" disabled={createQuizMutation.isPending || questions.length === 0} data-testid="button-create-quiz-submit">
              {createQuizMutation.isPending ? "Creating..." : "Create Quiz"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

function FileUploadButton({
  onUpload,
  isUploading,
  accept,
  label,
  testId,
}: {
  onUpload: (file: File) => Promise<any>;
  isUploading: boolean;
  accept: string;
  label: string;
  testId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onUpload(file);
            e.target.value = "";
          }
        }}
        data-testid={`${testId}-input`}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="gap-2"
        data-testid={testId}
      >
        {isUploading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            {label}
          </>
        )}
      </Button>
    </>
  );
}

function QuestionEditor({
  index,
  question,
  onUpdate,
  onRemove,
  onImageUpload,
  isUploading,
}: {
  index: number;
  question: QuestionInput;
  onUpdate: (updates: Partial<QuestionInput>) => void;
  onRemove: () => void;
  onImageUpload: (file: File, purpose: "question-image" | "generate" | "attachment") => Promise<any>;
  isUploading: boolean;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    const result = await onImageUpload(file, "question-image");
    if (result) {
      onUpdate({ imageUrl: result.url });
    }
  };

  return (
    <Card className="relative" data-testid={`question-editor-${index}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
              {index + 1}
            </div>
            <Select value={question.type} onValueChange={(value: QuestionType) => onUpdate({ type: value })}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {questionTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={question.difficulty} onValueChange={(value) => onUpdate({ difficulty: value })}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={question.points}
              onChange={(e) => onUpdate({ points: parseInt(e.target.value) || 1 })}
              className="w-20"
              placeholder="Points"
            />
            <Button type="button" variant="ghost" size="icon" onClick={onRemove} data-testid={`remove-question-${index}`}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Enter your question..."
          value={question.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          className="min-h-[80px]"
          data-testid={`question-text-${index}`}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium flex items-center gap-2">
              <Image className="w-4 h-4" />
              Question Image (Optional)
            </label>
          </div>
          {question.imageUrl ? (
            <div className="relative inline-block">
              <img
                src={question.imageUrl}
                alt="Question attachment"
                className="max-w-xs max-h-48 rounded-lg border object-contain"
                data-testid={`question-image-preview-${index}`}
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-1 right-1"
                onClick={() => onUpdate({ imageUrl: undefined })}
                data-testid={`remove-question-image-${index}`}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImageUpload(file);
                    e.target.value = "";
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => imageInputRef.current?.click()}
                disabled={isUploading}
                className="gap-2"
                data-testid={`upload-question-image-${index}`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Image className="w-3 h-3" />
                    Add Image
                  </>
                )}
              </Button>
            </>
          )}
        </div>

        {(question.type === "mcq" || question.type === "matching") && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Answer Options</label>
            {question.options.map((option, optIndex) => (
              <div key={optIndex} className="flex items-center gap-2">
                <Input
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...question.options];
                    newOptions[optIndex] = e.target.value;
                    onUpdate({ options: newOptions });
                  }}
                  placeholder={`Option ${optIndex + 1}`}
                  className={question.correctAnswer === option ? "border-green-500" : ""}
                />
                <Button
                  type="button"
                  variant={question.correctAnswer === option ? "default" : "outline"}
                  size="icon"
                  onClick={() => onUpdate({ correctAnswer: option })}
                  title="Mark as correct answer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onUpdate({ options: [...question.options, ""] })}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Option
            </Button>
          </div>
        )}

        {question.type === "true_false" && (
          <div className="flex gap-4">
            <Button
              type="button"
              variant={question.correctAnswer === "true" ? "default" : "outline"}
              onClick={() => onUpdate({ correctAnswer: "true" })}
            >
              True
            </Button>
            <Button
              type="button"
              variant={question.correctAnswer === "false" ? "default" : "outline"}
              onClick={() => onUpdate({ correctAnswer: "false" })}
            >
              False
            </Button>
          </div>
        )}

        {(question.type === "short_answer" || question.type === "fill_blank") && (
          <Input
            placeholder="Expected answer..."
            value={question.correctAnswer}
            onChange={(e) => onUpdate({ correctAnswer: e.target.value })}
          />
        )}

        {question.type === "essay" && (
          <p className="text-sm text-muted-foreground">
            Essay questions will be graded by AI with detailed feedback.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
