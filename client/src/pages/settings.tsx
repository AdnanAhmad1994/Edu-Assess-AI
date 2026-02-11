import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Key, CheckCircle, XCircle, Loader2, Eye, EyeOff, Trash2, Sparkles, Shield, Grid3X3 } from "lucide-react";
import PatternLockGrid from "@/components/pattern-lock-grid";

function PatternLockSection() {
  const { toast } = useToast();
  const [step, setStep] = useState<"idle" | "draw" | "confirm">("idle");
  const [firstPattern, setFirstPattern] = useState<number[] | null>(null);
  const [patternError, setPatternError] = useState(false);

  const { data: patternStatus, isLoading: patternLoading } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/settings/pattern"],
  });

  const setPatternMutation = useMutation({
    mutationFn: async (pattern: number[]) => {
      const res = await apiRequest("PUT", "/api/settings/pattern", { pattern });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/pattern"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setStep("idle");
      setFirstPattern(null);
      toast({ title: "Pattern lock set", description: "You can now use your pattern to sign in." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to set pattern lock.", variant: "destructive" });
    },
  });

  const removePatternMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/settings/pattern");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/pattern"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Pattern lock removed", description: "Pattern login has been disabled." });
    },
  });

  const handleFirstPattern = useCallback((pattern: number[]) => {
    if (pattern.length < 4) return;
    setFirstPattern(pattern);
    setStep("confirm");
    setPatternError(false);
  }, []);

  const handleConfirmPattern = useCallback((pattern: number[]) => {
    if (!firstPattern) return;
    if (JSON.stringify(pattern) === JSON.stringify(firstPattern)) {
      setPatternMutation.mutate(pattern);
    } else {
      setPatternError(true);
      toast({ title: "Patterns don't match", description: "Please try again.", variant: "destructive" });
      setTimeout(() => {
        setPatternError(false);
        setStep("draw");
        setFirstPattern(null);
      }, 1000);
    }
  }, [firstPattern, setPatternMutation, toast]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Grid3X3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle>Pattern Lock</CardTitle>
            <CardDescription>
              Set up a pattern as an alternative way to sign in, just like on a phone.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
          <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            Your pattern is stored securely as a hash and can never be viewed.
          </p>
        </div>

        {patternLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Current Status</Label>
              <div className="flex items-center gap-3">
                {patternStatus?.enabled ? (
                  <Badge variant="default" className="gap-1" data-testid="badge-pattern-active">
                    <CheckCircle className="w-3 h-3" />
                    Pattern Set
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1" data-testid="badge-pattern-not-set">
                    <XCircle className="w-3 h-3" />
                    Not Set
                  </Badge>
                )}
              </div>
            </div>

            {step === "idle" && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() => { setStep("draw"); setFirstPattern(null); setPatternError(false); }}
                  data-testid="button-set-pattern"
                >
                  <Grid3X3 className="w-4 h-4 mr-2" />
                  {patternStatus?.enabled ? "Change Pattern" : "Set Pattern"}
                </Button>
                {patternStatus?.enabled && (
                  <Button
                    variant="outline"
                    onClick={() => removePatternMutation.mutate()}
                    disabled={removePatternMutation.isPending}
                    data-testid="button-remove-pattern"
                  >
                    {removePatternMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    Remove Pattern
                  </Button>
                )}
              </div>
            )}

            {step === "draw" && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm font-medium" data-testid="text-pattern-draw-prompt">
                  Draw your pattern (connect at least 4 dots)
                </p>
                <PatternLockGrid onComplete={handleFirstPattern} />
                <Button
                  variant="ghost"
                  onClick={() => { setStep("idle"); setFirstPattern(null); }}
                  data-testid="button-cancel-pattern"
                >
                  Cancel
                </Button>
              </div>
            )}

            {step === "confirm" && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm font-medium" data-testid="text-pattern-confirm-prompt">
                  Draw the same pattern again to confirm
                </p>
                <PatternLockGrid
                  onComplete={handleConfirmPattern}
                  error={patternError}
                  disabled={setPatternMutation.isPending}
                />
                {setPatternMutation.isPending && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Saving...</span>
                  </div>
                )}
                <Button
                  variant="ghost"
                  onClick={() => { setStep("draw"); setFirstPattern(null); }}
                  data-testid="button-retry-pattern"
                >
                  Start Over
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const { data: keyStatus, isLoading } = useQuery<{ hasKey: boolean; maskedKey: string | null }>({
    queryKey: ["/api/settings/gemini-key"],
    enabled: user?.role !== "student",
  });

  const saveMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest("PUT", "/api/settings/gemini-key", { apiKey: key });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/gemini-key"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setApiKey("");
      toast({ title: "API key saved", description: "Your Gemini API key has been saved securely." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save API key.", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/settings/gemini-key", { apiKey: null });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/gemini-key"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "API key removed", description: "Your Gemini API key has been removed. The platform default will be used." });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest("POST", "/api/settings/test-gemini-key", { apiKey: key });
      return res.json();
    },
    onSuccess: (data: { valid: boolean; message: string }) => {
      if (data.valid) {
        toast({ title: "Key is valid", description: "Your Gemini API key is working correctly." });
      } else {
        toast({ title: "Key is invalid", description: data.message, variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Test failed", description: "Could not verify the API key.", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!apiKey.trim()) return;
    saveMutation.mutate(apiKey.trim());
  };

  const handleTest = () => {
    if (!apiKey.trim()) return;
    testMutation.mutate(apiKey.trim());
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold" data-testid="text-settings-title">Settings</h1>

      <PatternLockSection />

      {user?.role !== "student" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Gemini AI Configuration</CardTitle>
                <CardDescription>
                  Configure your own Google Gemini API key for AI-powered features like quiz generation, grading, and the co-pilot.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
              <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">
                Your API key is stored securely and never shared. If no key is set, the platform default key is used.
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Current Status</Label>
                  <div className="flex items-center gap-3">
                    {keyStatus?.hasKey ? (
                      <>
                        <Badge variant="default" className="gap-1" data-testid="badge-key-active">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </Badge>
                        <span className="text-sm text-muted-foreground font-mono" data-testid="text-masked-key">
                          {keyStatus.maskedKey}
                        </span>
                      </>
                    ) : (
                      <Badge variant="secondary" className="gap-1" data-testid="badge-key-not-set">
                        <XCircle className="w-3 h-3" />
                        Not Set (Using Platform Default)
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="gemini-key" className="text-sm font-medium">
                    {keyStatus?.hasKey ? "Update API Key" : "Add API Key"}
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="gemini-key"
                        type={showKey ? "text" : "password"}
                        placeholder="AIza..."
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="pl-9 pr-9 font-mono"
                        data-testid="input-gemini-key"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowKey(!showKey)}
                        data-testid="button-toggle-key-visibility"
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      onClick={handleTest}
                      variant="outline"
                      disabled={!apiKey.trim() || testMutation.isPending}
                      data-testid="button-test-key"
                    >
                      {testMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Test Key
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={!apiKey.trim() || saveMutation.isPending}
                      data-testid="button-save-key"
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Key className="w-4 h-4 mr-2" />
                      )}
                      Save Key
                    </Button>
                    {keyStatus?.hasKey && (
                      <Button
                        variant="outline"
                        onClick={() => removeMutation.mutate()}
                        disabled={removeMutation.isPending}
                        data-testid="button-remove-key"
                      >
                        {removeMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-2" />
                        )}
                        Remove Key
                      </Button>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <h3 className="text-sm font-medium">How to get a Gemini API key</h3>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Visit <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline" data-testid="link-get-key">Google AI Studio</a></li>
                    <li>Sign in with your Google account</li>
                    <li>Click "Create API key"</li>
                    <li>Copy the key and paste it above</li>
                  </ol>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
