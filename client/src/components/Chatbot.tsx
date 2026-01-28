import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  AlertCircle,
  Sparkles,
  Copy,
  ExternalLink
} from "lucide-react";
import type { ChatCommand } from "@shared/schema";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  data?: any;
  timestamp: Date;
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm your EduAssess AI assistant. I can help you:\n\n• Create quizzes and courses\n• Generate public quiz links\n• View your analytics\n• List your quizzes and courses\n\nTry saying: \"Create a quiz called Midterm Exam\" or \"Generate a public link for my quiz\"",
      timestamp: new Date(),
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: history } = useQuery<ChatCommand[]>({
    queryKey: ["/api/chat/history"],
    enabled: isOpen,
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
      setMessages(prev => [...prev, response]);
      queryClient.invalidateQueries({ queryKey: ["/api/chat/history"] });
      
      if (responseData.publicUrl) {
        toast({
          title: "Public Link Generated!",
          description: "Click to copy the link",
        });
      }
    },
    onError: () => {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "Sorry, I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!input.trim() || sendMutation.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    sendMutation.mutate(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Link copied to clipboard",
    });
  };

  const quickActions = [
    { label: "List my quizzes", command: "List all my quizzes" },
    { label: "Create a quiz", command: "Create a new quiz" },
    { label: "View analytics", command: "Show my analytics" },
  ];

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
        data-testid="button-open-chatbot"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-96 h-[500px] flex flex-col shadow-xl z-50 border-2" data-testid="chatbot-panel">
      <CardHeader className="pb-3 border-b shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-full">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">AI Assistant</CardTitle>
              <p className="text-xs text-muted-foreground">Powered by Gemini</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsOpen(false)}
            data-testid="button-close-chatbot"
          >
            <X className="h-4 w-4" />
          </Button>
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
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                
                {message.data?.publicUrl && (
                  <div className="mt-2 p-2 bg-background/50 rounded border">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Link className="h-3 w-3" />
                      Public Link:
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                        {message.data.publicUrl}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => copyToClipboard(message.data.publicUrl)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <a
                        href={message.data.publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    </div>
                  </div>
                )}

                {message.data?.quiz && !message.data.publicUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {message.data.quiz.title}
                    </Badge>
                  </div>
                )}

                {message.data?.course && (
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {message.data.course.name}
                    </Badge>
                  </div>
                )}

                {message.data?.stats && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-background/50 p-2 rounded">
                      <div className="font-medium">{message.data.stats.totalCourses}</div>
                      <div className="text-muted-foreground">Courses</div>
                    </div>
                    <div className="bg-background/50 p-2 rounded">
                      <div className="font-medium">{message.data.stats.totalQuizzes}</div>
                      <div className="text-muted-foreground">Quizzes</div>
                    </div>
                    <div className="bg-background/50 p-2 rounded">
                      <div className="font-medium">{message.data.stats.totalStudents}</div>
                      <div className="text-muted-foreground">Students</div>
                    </div>
                    <div className="bg-background/50 p-2 rounded">
                      <div className="font-medium">{message.data.stats.pendingGrading}</div>
                      <div className="text-muted-foreground">Pending</div>
                    </div>
                  </div>
                )}

                {message.data?.quizzes && message.data.quizzes.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {message.data.quizzes.slice(0, 5).map((quiz: any) => (
                      <div key={quiz.id} className="flex items-center gap-2 text-xs bg-background/50 p-2 rounded">
                        <Badge variant={quiz.status === "published" ? "default" : "secondary"} className="text-xs">
                          {quiz.status}
                        </Badge>
                        <span className="truncate">{quiz.title}</span>
                      </div>
                    ))}
                    {message.data.quizzes.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        +{message.data.quizzes.length - 5} more...
                      </p>
                    )}
                  </div>
                )}

                {message.data?.courses && message.data.courses.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {message.data.courses.map((course: any) => (
                      <div key={course.id} className="text-xs bg-background/50 p-2 rounded">
                        <span className="font-medium">{course.name}</span>
                        <span className="text-muted-foreground ml-2">({course.code})</span>
                      </div>
                    ))}
                  </div>
                )}
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
                <span>Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t shrink-0 space-y-3">
        <div className="flex flex-wrap gap-1">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                setInput(action.command);
                inputRef.current?.focus();
              }}
              disabled={sendMutation.isPending}
            >
              {action.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            disabled={sendMutation.isPending}
            data-testid="input-chat-message"
          />
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || sendMutation.isPending}
            size="icon"
            data-testid="button-send-message"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}