import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  FileQuestion,
  Clock,
  Users,
  Calendar,
  MoreVertical,
  Play,
  Eye,
  Shield,
  Brain,
  Link,
  Copy,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Quiz } from "@shared/schema";

export default function QuizzesPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [publicLinkDialogOpen, setPublicLinkDialogOpen] = useState(false);
  const [selectedQuizForLink, setSelectedQuizForLink] = useState<Quiz | null>(null);
  const [publicLinkPermission, setPublicLinkPermission] = useState<"view" | "attempt">("attempt");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const { data: quizzes, isLoading } = useQuery<Quiz[]>({
    queryKey: ["/api/quizzes"],
  });

  const publishMutation = useMutation({
    mutationFn: async (quizId: string) => {
      return apiRequest("PATCH", `/api/quizzes/${quizId}/publish`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
      toast({ title: "Quiz published", description: "Students can now take this quiz." });
    },
  });

  const generatePublicLinkMutation = useMutation({
    mutationFn: async ({ quizId, permission }: { quizId: string; permission: "view" | "attempt" }) => {
      const res = await apiRequest("POST", `/api/quizzes/${quizId}/generate-public-link`, {
        permission,
        requiredFields: ["name", "email"],
      });
      return res.json();
    },
    onSuccess: (data) => {
      const publicUrl = `${window.location.origin}/public/quiz/${data.quiz.publicAccessToken}`;
      setGeneratedLink(publicUrl);
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
      toast({ title: "Public link generated!", description: "Share this link with anyone." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate public link", variant: "destructive" });
    },
  });

  const handleOpenPublicLinkDialog = (quiz: Quiz) => {
    setSelectedQuizForLink(quiz);
    setGeneratedLink(quiz.publicLinkEnabled ? `${window.location.origin}/public/quiz/${quiz.publicAccessToken}` : null);
    setPublicLinkPermission(quiz.publicLinkPermission || "attempt");
    setPublicLinkDialogOpen(true);
  };

  const handleGenerateLink = () => {
    if (selectedQuizForLink) {
      generatePublicLinkMutation.mutate({
        quizId: selectedQuizForLink.id,
        permission: publicLinkPermission,
      });
    }
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      toast({ title: "Copied!", description: "Link copied to clipboard" });
    }
  };

  const isInstructor = user?.role === "instructor" || user?.role === "admin";

  const filteredQuizzes = quizzes?.filter((quiz) => {
    if (activeTab === "all") return true;
    return quiz.status === activeTab;
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-10 w-36" />
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
          <h1 className="text-3xl font-bold">Quizzes</h1>
          <p className="text-muted-foreground mt-1">
            {isInstructor ? "Create and manage your quizzes" : "View and take your quizzes"}
          </p>
        </div>
        {isInstructor && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setLocation("/quizzes/new?mode=ai")} data-testid="button-ai-quiz">
              <Brain className="w-4 h-4 mr-2" />
              AI Generate
            </Button>
            <Button onClick={() => setLocation("/quizzes/new")} data-testid="button-create-quiz">
              <Plus className="w-4 h-4 mr-2" />
              Create Quiz
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">All Quizzes</TabsTrigger>
          <TabsTrigger value="draft" data-testid="tab-draft">Drafts</TabsTrigger>
          <TabsTrigger value="published" data-testid="tab-published">Published</TabsTrigger>
          <TabsTrigger value="closed" data-testid="tab-closed">Closed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredQuizzes && filteredQuizzes.length > 0 ? (
            <div className="space-y-4">
              {filteredQuizzes.map((quiz) => (
                <Card key={quiz.id} className="hover-elevate" data-testid={`quiz-card-${quiz.id}`}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge className={getStatusColor(quiz.status)}>
                          {quiz.status}
                        </Badge>
                        {quiz.proctored && (
                          <Badge variant="outline" className="gap-1">
                            <Shield className="w-3 h-3" />
                            Proctored
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl">{quiz.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {quiz.description || "No description"}
                      </CardDescription>
                    </div>
                    {isInstructor && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`quiz-menu-${quiz.id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setLocation(`/quizzes/new?edit=${quiz.id}`)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View / Edit Quiz
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {quiz.status === "draft" && (
                            <DropdownMenuItem onClick={() => publishMutation.mutate(quiz.id)}>
                              <Play className="w-4 h-4 mr-2" />
                              Publish Quiz
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleOpenPublicLinkDialog(quiz)}>
                            <Link className="w-4 h-4 mr-2" />
                            {quiz.publicLinkEnabled ? "Manage Public Link" : "Generate Public Link"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setLocation(`/quizzes/new?edit=${quiz.id}`)}>
                            View Submissions
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {!isInstructor && quiz.status === "published" && (
                      <Button onClick={() => setLocation(`/quiz/${quiz.id}/take`)} data-testid={`take-quiz-${quiz.id}`}>
                        <Play className="w-4 h-4 mr-2" />
                        Start Quiz
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : "No limit"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileQuestion className="w-4 h-4" />
                        <span>Questions</span>
                      </div>
                      {quiz.startDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(quiz.startDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FileQuestion className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">No quizzes found</h3>
                <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
                  {isInstructor
                    ? "Create your first quiz to start assessing your students."
                    : "No quizzes are available for you at the moment."}
                </p>
                {isInstructor && (
                  <div className="flex gap-3 mt-4">
                    <Button variant="outline" onClick={() => setLocation("/quizzes/new?mode=ai")}>
                      <Brain className="w-4 h-4 mr-2" />
                      Generate with AI
                    </Button>
                    <Button onClick={() => setLocation("/quizzes/new")}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Manually
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={publicLinkDialogOpen} onOpenChange={setPublicLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <Link className="w-5 h-5" />
                Public Quiz Link
              </div>
            </DialogTitle>
            <DialogDescription>
              Generate a shareable link for "{selectedQuizForLink?.title}". Anyone with this link can access the quiz.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Permission Level</Label>
              <Select value={publicLinkPermission} onValueChange={(value: "view" | "attempt") => setPublicLinkPermission(value)}>
                <SelectTrigger data-testid="select-permission">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View Only - Users can see questions and answers</SelectItem>
                  <SelectItem value="attempt">Attempt - Users can take the quiz and submit answers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {generatedLink && (
              <div className="space-y-2">
                <Label>Public Link</Label>
                <div className="flex gap-2">
                  <Input value={generatedLink} readOnly className="text-sm" data-testid="input-public-link" />
                  <Button variant="outline" size="icon" onClick={handleCopyLink} data-testid="button-copy-link">
                    <Copy className="w-4 h-4" />
                  </Button>
                  <a href={generatedLink} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="icon" data-testid="button-open-link">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </a>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this link with students. They'll need to provide their name and email to access.
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPublicLinkDialogOpen(false)}>
              Close
            </Button>
            <Button 
              onClick={handleGenerateLink} 
              disabled={generatePublicLinkMutation.isPending}
              data-testid="button-generate-link"
            >
              {generatePublicLinkMutation.isPending ? "Generating..." : generatedLink ? "Regenerate Link" : "Generate Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
