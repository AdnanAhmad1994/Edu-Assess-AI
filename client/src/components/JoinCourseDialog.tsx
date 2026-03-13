import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Loader2 } from "lucide-react";

export function JoinCourseDialog() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (courseCode: string) => {
      const res = await apiRequest("POST", "/api/enrollments/join", { code: courseCode });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      toast({
        title: "Success",
        description: "You have successfully joined the course",
      });
      setOpen(false);
      setCode("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join course. Please check the code and try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    mutation.mutate(code);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <PlusCircle className="h-4 w-4" />
          Join Class
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Join a Course</DialogTitle>
            <DialogDescription>
              Enter the unique course code provided by your instructor to enroll in a new class.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="code">Course Code</Label>
              <Input
                id="code"
                placeholder="e.g. CS101-ABC"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={mutation.isPending}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || !code.trim()}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                "Join Course"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
