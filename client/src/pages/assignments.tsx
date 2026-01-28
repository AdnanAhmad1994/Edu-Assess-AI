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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Assignment, Course } from "@shared/schema";

const assignmentSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  instructions: z.string().optional(),
  courseId: z.string().min(1, "Please select a course"),
  maxScore: z.number().min(1).default(100),
  dueDate: z.string().optional(),
});

type AssignmentFormData = z.infer<typeof assignmentSchema>;

export default function AssignmentsPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const { data: assignments, isLoading } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments"],
  });

  const { data: courses } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (data: AssignmentFormData) => {
      return apiRequest("POST", "/api/assignments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      setIsCreateOpen(false);
      toast({ title: "Assignment created", description: "Your assignment has been created successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create assignment.", variant: "destructive" });
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
    },
  });

  const onSubmit = (data: AssignmentFormData) => {
    createAssignmentMutation.mutate(data);
  };

  const isInstructor = user?.role === "instructor" || user?.role === "admin";

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
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-assignment">
                <Plus className="w-4 h-4 mr-2" />
                New Assignment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Assignment</DialogTitle>
                <DialogDescription>
                  Create an assignment for students to submit their work.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createAssignmentMutation.isPending} data-testid="button-submit-assignment">
                      {createAssignmentMutation.isPending ? "Creating..." : "Create Assignment"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all-assignments">All</TabsTrigger>
          <TabsTrigger value="draft" data-testid="tab-draft-assignments">Drafts</TabsTrigger>
          <TabsTrigger value="published" data-testid="tab-published-assignments">Published</TabsTrigger>
          <TabsTrigger value="closed" data-testid="tab-closed-assignments">Closed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredAssignments && filteredAssignments.length > 0 ? (
            <div className="space-y-4">
              {filteredAssignments.map((assignment) => {
                const dueStatus = getDueDateStatus(assignment.dueDate);

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
                            <DropdownMenuItem onClick={() => setLocation(`/assignments/${assignment.id}`)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLocation(`/assignments/${assignment.id}/edit`)}>
                              Edit Assignment
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setLocation(`/assignments/${assignment.id}/submissions`)}>
                              View Submissions
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLocation(`/assignments/${assignment.id}/grade`)}>
                              <Brain className="w-4 h-4 mr-2" />
                              AI Grade All
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      {!isInstructor && assignment.status === "published" && (
                        <Button onClick={() => setLocation(`/assignment/${assignment.id}/submit`)} data-testid={`submit-assignment-${assignment.id}`}>
                          <FileText className="w-4 h-4 mr-2" />
                          Submit
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
