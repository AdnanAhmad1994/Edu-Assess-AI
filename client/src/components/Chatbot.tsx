import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  MessageCircle,
  Send,
  X,
  Loader2,
  Bot,
  User,
  Link,
  CheckCircle,
  Sparkles,
  Copy,
  ExternalLink,
  Maximize2,
  Minimize2,
  BookOpen,
  FileQuestion,
  ClipboardList,
  BarChart3,
  Users,
  GraduationCap,
  Trash2,
  Eye,
  PlusCircle,
  Navigation,
} from "lucide-react";
import type { ChatCommand } from "@shared/schema";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  data?: any;
  timestamp: Date;
}

type PanelSize = "closed" | "compact" | "expanded";

const quickActionGroups = [
  {
    label: "Multi-Task",
    icon: Sparkles,
    actions: [
      { label: "Course + Quiz", command: "Create a course called 'Data Science' and then create a quiz on machine learning fundamentals" },
      { label: "Full setup", command: "Create a course called 'Web Dev', add a quiz on React.js, and create an assignment on building a todo app" },
    ],
  },
  {
    label: "Courses",
    icon: BookOpen,
    actions: [
      { label: "Create course", command: "Create a new course called 'Introduction to AI' with code AI101 for Spring 2026" },
      { label: "List courses", command: "List all my courses" },
    ],
  },
  {
    label: "Quizzes",
    icon: FileQuestion,
    actions: [
      { label: "AI Quiz", command: "Create a quiz on artificial intelligence with 5 questions" },
      { label: "List quizzes", command: "List all my quizzes" },
      { label: "Publish quiz", command: "Publish my latest quiz" },
      { label: "Public link", command: "Generate a public link for my quiz" },
    ],
  },
  {
    label: "Teaching",
    icon: GraduationCap,
    actions: [
      { label: "Create assignment", command: "Create a new assignment" },
      { label: "Create lecture", command: "Create a new lecture" },
    ],
  },
  {
    label: "Analytics",
    icon: BarChart3,
    actions: [
      { label: "Dashboard stats", command: "Show my dashboard analytics" },
      { label: "Quiz results", command: "Show quiz submission results" },
    ],
  },
];

export default function Chatbot() {
  const [panelSize, setPanelSize] = useState<PanelSize>("closed");
  const [input, setInput] = useState("");
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm your EduAssess Co-pilot. I can handle multiple tasks at once, just like a real assistant!\n\n" +
        "- Create courses, quizzes with AI questions, assignments, lectures\n" +
        "- Publish quizzes, generate public links\n" +
        "- View analytics, submissions, enrollments\n" +
        "- Navigate to any page\n\n" +
        "Try: \"Create a course called AI and then create a quiz on neural networks\"",
      timestamp: new Date(),
    },
  ]);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const expandedInputRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const { data: history } = useQuery<ChatCommand[]>({
    queryKey: ["/api/chat/history"],
    enabled: panelSize !== "closed",
  });

  const sendMutation = useMutation({
    mutationFn: async (command: string) => {
      const res = await apiRequest("POST", "/api/chat/command", { command });
      return res.json();
    },
    onSuccess: (data) => {
      const responseData = { ...data.result?.data };
      if (responseData.quiz?.publicAccessToken) {
        responseData.publicUrl = `${window.location.origin}/public/quiz/${responseData.quiz.publicAccessToken}`;
      }

      const response: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: data.result?.message || data.aiResponse || "Command processed.",
        data: responseData,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, response]);
      setShowQuickActions(false);

      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lectures"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/history"] });

      if (responseData.navigateTo) {
        setLocation(responseData.navigateTo);
      }

      if (responseData.publicUrl) {
        toast({ title: "Public Link Generated!", description: "Link is ready to share" });
      }
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Sorry, something went wrong. Please try again or rephrase your request.",
          timestamp: new Date(),
        },
      ]);
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (panelSize === "compact" && inputRef.current) {
      inputRef.current.focus();
    } else if (panelSize === "expanded" && expandedInputRef.current) {
      expandedInputRef.current.focus();
    }
  }, [panelSize]);

  const handleSend = () => {
    if (!input.trim() || sendMutation.isPending) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    sendMutation.mutate(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (command: string) => {
    setInput("");
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: command,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    sendMutation.mutate(command);
    setShowQuickActions(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Link copied to clipboard" });
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Chat cleared. How can I help you?",
        timestamp: new Date(),
      },
    ]);
    setShowQuickActions(true);
  };

  if (panelSize === "closed") {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        <Button
          onClick={() => setPanelSize("compact")}
          className="h-14 w-14 rounded-full shadow-lg"
          size="icon"
          data-testid="button-open-chatbot"
        >
          <Sparkles className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  const isExpanded = panelSize === "expanded";
  const panelClasses = isExpanded
    ? "fixed bottom-0 right-0 w-full sm:w-[520px] h-full sm:h-[calc(100vh-1rem)] sm:bottom-2 sm:right-2 flex flex-col shadow-2xl z-50 border-2 sm:rounded-lg"
    : "fixed bottom-6 right-6 w-[380px] h-[520px] flex flex-col shadow-xl z-50 border-2";

  const renderMessageData = (data: any) => {
    if (!data) return null;

    return (
      <>
        {data.publicUrl && (
          <div className="mt-2 p-2 bg-background/50 rounded border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Link className="h-3 w-3" />
              Public Link:
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                {data.publicUrl}
              </code>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyToClipboard(data.publicUrl)}>
                <Copy className="h-3 w-3" />
              </Button>
              <a href={data.publicUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            </div>
          </div>
        )}

        {data.quiz && !data.publicUrl && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              {data.quiz.title}
            </Badge>
            {data.quiz.status && (
              <Badge variant="outline" className="text-xs">{data.quiz.status}</Badge>
            )}
            {data.questionsGenerated && (
              <Badge variant="default" className="text-xs">
                {data.questionsGenerated} AI questions
              </Badge>
            )}
          </div>
        )}

        {data.course && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              {data.course.name}
            </Badge>
            {data.course.code && (
              <Badge variant="outline" className="text-xs">{data.course.code}</Badge>
            )}
          </div>
        )}

        {data.assignment && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              {data.assignment.title}
            </Badge>
          </div>
        )}

        {data.lecture && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              {data.lecture.title}
            </Badge>
          </div>
        )}

        {data.stats && (
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {Object.entries(data.stats).map(([key, value]) => (
              <div key={key} className="bg-background/50 p-2 rounded">
                <div className="font-medium">{String(value)}</div>
                <div className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").replace("total ", "")}</div>
              </div>
            ))}
          </div>
        )}

        {data.quizzes && data.quizzes.length > 0 && (
          <div className="mt-2 space-y-1">
            {data.quizzes.slice(0, 5).map((quiz: any) => (
              <div key={quiz.id} className="flex items-center gap-2 text-xs bg-background/50 p-2 rounded">
                <Badge variant={quiz.status === "published" ? "default" : "secondary"} className="text-xs shrink-0">
                  {quiz.status}
                </Badge>
                <span className="truncate">{quiz.title}</span>
              </div>
            ))}
            {data.quizzes.length > 5 && (
              <p className="text-xs text-muted-foreground">+{data.quizzes.length - 5} more...</p>
            )}
          </div>
        )}

        {data.courses && data.courses.length > 0 && (
          <div className="mt-2 space-y-1">
            {data.courses.map((course: any) => (
              <div key={course.id} className="text-xs bg-background/50 p-2 rounded flex items-center gap-2">
                <span className="font-medium">{course.name}</span>
                <Badge variant="outline" className="text-xs shrink-0">{course.code}</Badge>
              </div>
            ))}
          </div>
        )}

        {data.assignments && data.assignments.length > 0 && (
          <div className="mt-2 space-y-1">
            {data.assignments.slice(0, 5).map((a: any) => (
              <div key={a.id} className="text-xs bg-background/50 p-2 rounded">
                <span className="font-medium">{a.title}</span>
              </div>
            ))}
            {data.assignments.length > 5 && (
              <p className="text-xs text-muted-foreground">+{data.assignments.length - 5} more...</p>
            )}
          </div>
        )}

        {data.lectures && data.lectures.length > 0 && (
          <div className="mt-2 space-y-1">
            {data.lectures.slice(0, 5).map((l: any) => (
              <div key={l.id} className="text-xs bg-background/50 p-2 rounded">
                <span className="font-medium">{l.title}</span>
              </div>
            ))}
            {data.lectures.length > 5 && (
              <p className="text-xs text-muted-foreground">+{data.lectures.length - 5} more...</p>
            )}
          </div>
        )}

        {data.enrollments && data.enrollments.length > 0 && (
          <div className="mt-2 space-y-1">
            {data.enrollments.slice(0, 5).map((e: any, idx: number) => (
              <div key={idx} className="text-xs bg-background/50 p-2 rounded">
                <span className="font-medium">{e.studentName || e.studentId}</span>
              </div>
            ))}
            {data.enrollments.length > 5 && (
              <p className="text-xs text-muted-foreground">+{data.enrollments.length - 5} more...</p>
            )}
          </div>
        )}

        {data.submissions && data.submissions.length > 0 && (
          <div className="mt-2 space-y-1">
            {data.submissions.slice(0, 5).map((s: any) => (
              <div key={s.id} className="flex items-center gap-2 text-xs bg-background/50 p-2 rounded">
                <Badge variant={s.status === "graded" ? "default" : "secondary"} className="text-xs shrink-0">
                  {s.status}
                </Badge>
                <span className="truncate">Score: {s.score ?? "N/A"}</span>
              </div>
            ))}
          </div>
        )}

        {data.navigateTo && (
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              <Navigation className="h-3 w-3 mr-1" />
              Navigated to {data.navigateTo}
            </Badge>
          </div>
        )}

        {data.deleted && (
          <div className="mt-2">
            <Badge variant="destructive" className="text-xs">
              <Trash2 className="h-3 w-3 mr-1" />
              Deleted successfully
            </Badge>
          </div>
        )}
      </>
    );
  };

  return (
    <Card className={panelClasses} data-testid="chatbot-panel">
      <CardHeader className="pb-2 border-b shrink-0 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-full">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm">EduAssess Co-pilot</CardTitle>
              <p className="text-xs text-muted-foreground">Your AI assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={clearChat}
              title="Clear chat"
              data-testid="button-clear-chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPanelSize(isExpanded ? "compact" : "expanded")}
              title={isExpanded ? "Minimize" : "Expand"}
              data-testid="button-toggle-expand"
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPanelSize("closed")}
              data-testid="button-close-chatbot"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <div className="shrink-0 p-1.5 bg-primary/10 rounded-full h-fit">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  isExpanded ? "max-w-[85%]" : "max-w-[80%]"
                } ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                {renderMessageData(message.data)}
              </div>
              {message.role === "user" && (
                <div className="shrink-0 p-1.5 bg-primary rounded-full h-fit">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}

          {sendMutation.isPending && (
            <div className="flex gap-2 justify-start">
              <div className="shrink-0 p-1.5 bg-primary/10 rounded-full h-fit">
                <Bot className="h-4 w-4 text-primary animate-pulse" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Working on it...</span>
              </div>
            </div>
          )}

          {showQuickActions && messages.length <= 1 && (
            <div className="space-y-3 mt-2">
              <p className="text-xs text-muted-foreground font-medium">Quick actions:</p>
              {quickActionGroups.map((group) => (
                <div key={group.label}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <group.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">{group.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {group.actions.map((action) => (
                      <Button
                        key={action.label}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => handleQuickAction(action.command)}
                        disabled={sendMutation.isPending}
                        data-testid={`quick-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t shrink-0 space-y-2">
        {!showQuickActions && messages.length > 2 && (
          <div className="flex flex-wrap gap-1">
            <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setShowQuickActions(true)}>
              <PlusCircle className="h-3 w-3 mr-1" />
              Show suggestions
            </Button>
          </div>
        )}
        {isExpanded ? (
          <div className="flex gap-2">
            <Textarea
              ref={expandedInputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell me what to do... e.g., 'Create a quiz for my AI course'"
              disabled={sendMutation.isPending}
              className="resize-none text-sm min-h-[44px] max-h-[120px]"
              rows={2}
              data-testid="input-chat-message"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || sendMutation.isPending}
              size="icon"
              className="shrink-0 self-end"
              data-testid="button-send-message"
            >
              {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell me what to do..."
              disabled={sendMutation.isPending}
              data-testid="input-chat-message"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || sendMutation.isPending}
              size="icon"
              data-testid="button-send-message"
            >
              {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
