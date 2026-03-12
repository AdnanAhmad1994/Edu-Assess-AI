import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  ClipboardList,
  Calendar,
  MoreVertical,
  Eye,
  Brain,
  CheckCircle2,
  Clock,
  FileText,
  AlertCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import type { Assignment, Course } from "@shared/schema";

const assignmentSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  instructions: z.string().optional(),
  courseId: z.string().min(1, "Please select a course"),
  maxScore: z.number().min(1).default(100),
  dueDate: z.string().optional(),
  allowLateSubmission: z.boolean().default(false),
  latePenaltyPercent: z.number().min(0).max(100).default(10),
});

type AssignmentFormData = z.infer<typeof assignmentSchema>;

export default function AssignmentsPage() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const { user } = useAuth();
  const isInstructor = user?.role === "instructor" || user?.role === "admin";
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(searchParams.get("action") === "create");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Assignment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const { data: assignments, isLoading } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments"],
  });

  const { data: mySubmissions } = useQuery<any[]>({
    queryKey: ["/api/assignments/my-submissions"],
    enabled: !isInstructor,
  });

  const { data: courses } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (data: AssignmentFormData) => {
      const res = await apiRequest("POST", "/api/assignments", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: "Assignment created", description: "Your assignment has been created successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create assignment.", variant: "destructive" });
    },
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AssignmentFormData & { status: string }> }) => {
      const res = await apiRequest("PUT", `/api/assignments/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      setIsEditOpen(false);
      setEditTarget(null);
      form.reset();
      toast({ title: "Assignment updated", description: "Your assignment has been updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update assignment.", variant: "destructive" });
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/assignments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      setDeleteTarget(null);
      toast({ title: "Assignment deleted", description: "Your assignment has been deleted successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete assignment.", variant: "destructive" });
    },
  });

  const form = useForm<AssignmentFormData>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      title: "",
      description: "",
      instructions: "",
      courseId: "",
      maxScore: 100,
      dueDate: "",
      allowLateSubmission: false,
      latePenaltyPercent: 10,
    },
  });

  const onSubmit = (data: AssignmentFormData) => {
    if (editTarget) {
      updateAssignmentMutation.mutate({ id: editTarget.id, data });
    } else {
      createAssignmentMutation.mutate(data);
    }
  };

  const openEditDialog = (assignment: Assignment) => {
    setEditTarget(assignment);
    form.reset({
      title: assignment.title,
      description: assignment.description || "",
      instructions: assignment.instructions || "",
      courseId: assignment.courseId,
      maxScore: assignment.maxScore,
      dueDate: assignment.dueDate ? new Date(assignment.dueDate).toISOString().slice(0, 16) : "",
      allowLateSubmission: assignment.allowLateSubmission ?? false,
      latePenaltyPercent: assignment.latePenaltyPercent ?? 10,
    });
    setIsEditOpen(true);
  };

  const openCreateDialog = () => {
    setEditTarget(null);
    form.reset({
      title: "",
      description: "",
      instructions: "",
      courseId: "",
      maxScore: 100,
      dueDate: "",
      allowLateSubmission: false,
      latePenaltyPercent: 10,
    });
    setIsCreateOpen(true);
  };

  const filteredAssignments = assignments?.filter((a) => {
    if (activeTab === "all") return true;
    return a.status === activeTab;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "draft":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "closed":
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
      default:
        return "";
    }
  };

  const getDueDateStatus = (dueDate: Date | null) => {
    if (!dueDate) return null;
    const now = new Date();
    const due = new Date(dueDate);
    const diff = due.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return { label: "Overdue", color: "text-red-500" };
    if (days === 0) return { label: "Due today", color: "text-amber-500" };
    if (days <= 3) return { label: `Due in ${days} days`, color: "text-amber-500" };
    return { label: `Due in ${days} days`, color: "text-muted-foreground" };
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-10 w-80" />
        <div className="grid gap-4">
          {[1, 2, 3, 4].map((i) => (
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
          <h1 className="text-3xl font-bold">Assignments</h1>
          <p className="text-muted-foreground mt-1">
            {isInstructor ? "Create and manage your assignments" : "View and submit your assignments"}
          </p>
        </div>
        {isInstructor && (
          <>
          <Dialog open={isCreateOpen || isEditOpen} onOpenChange={(open) => {
            if (!open) {
              setIsCreateOpen(false);
              setIsEditOpen(false);
              setEditTarget(null);
            }
          }}>
            {!isEditOpen && (
              <Button data-testid="button-create-assignment" onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                New Assignment
              </Button>
            )}
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editTarget ? "Edit Assignment" : "Create New Assignment"}</DialogTitle>
                <DialogDescription>
                  {editTarget ? "Update the assignment details below." : "Create an assignment for students to submit their work."}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assignment Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Research Paper - Topic Analysis" data-testid="input-assignment-title" {...field} />
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
                              <SelectTrigger data-testid="select-assignment-course">
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
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="A brief description of the assignment..." data-testid="input-assignment-description" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="instructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Detailed Instructions</FormLabel>
                        <FormControl>
                          <Textarea className="min-h-[100px]" placeholder="Detailed step-by-step instructions for the students..." data-testid="input-assignment-instructions" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="maxScore"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Score</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              data-testid="input-max-score"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 100)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" data-testid="input-due-date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 items-center bg-muted/30 p-4 rounded-lg">
                    <FormField
                      control={form.control}
                      name="allowLateSubmission"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background">
                          <div className="space-y-0.5">
                            <FormLabel>Allow Late Submission</FormLabel>
                            <CardDescription>
                              Can students submit after due date?
                            </CardDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {form.watch("allowLateSubmission") && (
                      <FormField
                        control={form.control}
                        name="latePenaltyPercent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Late Penalty (%)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                data-testid="input-late-penalty"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => {
                      setIsCreateOpen(false);
                      setIsEditOpen(false);
                    }}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createAssignmentMutation.isPending || updateAssignmentMutation.isPending} data-testid="button-submit-assignment">
                      {createAssignmentMutation.isPending || updateAssignmentMutation.isPending ? "Saving..." : editTarget ? "Update Assignment" : "Create Assignment"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the assignment "{deleteTarget?.title}" and remove all associated submissions and data.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteTarget && deleteAssignmentMutation.mutate(deleteTarget.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteAssignmentMutation.isPending ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          </>
        )}
      </div>

      {isInstructor && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all-assignments">All</TabsTrigger>
            <TabsTrigger value="draft" data-testid="tab-draft-assignments">Drafts</TabsTrigger>
            <TabsTrigger value="published" data-testid="tab-published-assignments">Published</TabsTrigger>
            <TabsTrigger value="closed" data-testid="tab-closed-assignments">Closed</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className={isInstructor ? "mt-6" : ""}>
        {filteredAssignments && filteredAssignments.length > 0 ? (
          <div className="space-y-4">
            {filteredAssignments.map((assignment) => {
              const dueStatus = getDueDateStatus(assignment.dueDate);
              const hasSubmitted = mySubmissions?.some(s => s.assignmentId === assignment.id);

                return (
                  <Card key={assignment.id} className="hover-elevate" data-testid={`assignment-card-${assignment.id}`}>
                    <CardHeader className="flex flex-row items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Badge className={getStatusColor(assignment.status)}>
                            {assignment.status}
                          </Badge>
                          <Badge variant="outline">{assignment.maxScore} points</Badge>
                        </div>
                        <CardTitle className="text-xl">{assignment.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {assignment.description || "No description"}
                        </CardDescription>
                      </div>
                      {isInstructor && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`assignment-menu-${assignment.id}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(assignment)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit Assignment
                            </DropdownMenuItem>
                            {assignment.status === "draft" && (
                              <DropdownMenuItem
                                onClick={() => updateAssignmentMutation.mutate({ id: assignment.id, data: { status: "published" } })}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Publish Assignment
                              </DropdownMenuItem>
                            )}
                            {assignment.status === "published" && (
                              <DropdownMenuItem
                                onClick={() => updateAssignmentMutation.mutate({ id: assignment.id, data: { status: "closed" } })}
                              >
                                <AlertCircle className="w-4 h-4 mr-2" />
                                Close Assignment
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setLocation(`/assignments/${assignment.id}/submissions`)}>
                               <ClipboardList className="w-4 h-4 mr-2" />
                              View Submissions
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLocation(`/assignments/${assignment.id}/grade`)}>
                              <Brain className="w-4 h-4 mr-2" />
                              AI Grade All
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:bg-destructive/10"
                              onClick={() => setDeleteTarget(assignment)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Assignment
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      {!isInstructor && assignment.status === "published" && (
                        <Button
                          onClick={() => setLocation(`/assignment/${assignment.id}/submit`)}
                          data-testid={`submit-assignment-${assignment.id}`}
                          disabled={hasSubmitted}
                          variant={hasSubmitted ? "secondary" : "default"}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          {hasSubmitted ? "Submitted" : "Submit"}
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        {assignment.dueDate && (
                          <div className={`flex items-center gap-2 ${dueStatus?.color}`}>
                            <Calendar className="w-4 h-4" />
                            <span>{dueStatus?.label}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <ClipboardList className="w-4 h-4" />
                          <span>Submissions</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <ClipboardList className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">No assignments found</h3>
                <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
                  {isInstructor
                    ? "Create your first assignment to start collecting student work."
                    : "No assignments are available for you at the moment."}
                </p>
                {isInstructor && (
                  <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Assignment
                  </Button>
                )}
              </CardContent>
            </Card>
        )}
      </div>
    </div>
  );
}
