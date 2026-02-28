import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Key, CheckCircle, XCircle, Loader2, Eye, EyeOff, Trash2, Sparkles,
  Shield, Grid3X3, ChevronDown, ChevronUp, ExternalLink, Zap, Settings2,
} from "lucide-react";
import PatternLockGrid from "@/components/pattern-lock-grid";

// ─── Provider metadata ────────────────────────────────────────────────────────

type AiProvider = "gemini" | "openai" | "openrouter" | "grok" | "kimi" | "anthropic" | "custom";

interface ProviderMeta {
  label: string;
  description: string;
  docsUrl: string;
  placeholder: string;
  color: string;           // tailwind bg color class for the icon chip
  logo: string;            // emoji / text logo
}

const PROVIDERS: Record<AiProvider, ProviderMeta> = {
  gemini: {
    label: "Google Gemini",
    description: "Gemini 2.5 Flash / Pro via AI Studio",
    docsUrl: "https://aistudio.google.com/app/apikey",
    placeholder: "AIza...",
    color: "bg-blue-500/10 text-blue-600",
    logo: "✦",
  },
  openai: {
    label: "OpenAI",
    description: "GPT-4o, GPT-4 Turbo via OpenAI API",
    docsUrl: "https://platform.openai.com/api-keys",
    placeholder: "sk-...",
    color: "bg-emerald-500/10 text-emerald-600",
    logo: "⬡",
  },
  openrouter: {
    label: "OpenRouter",
    description: "200+ models — Claude, GPT-4, Llama, Mixtral and more",
    docsUrl: "https://openrouter.ai/keys",
    placeholder: "sk-or-...",
    color: "bg-purple-500/10 text-purple-600",
    logo: "⇄",
  },
  grok: {
    label: "Grok (xAI)",
    description: "Grok 3 / Grok 3 Mini by xAI",
    docsUrl: "https://console.x.ai/",
    placeholder: "xai-...",
    color: "bg-slate-500/10 text-slate-600",
    logo: "X",
  },
  kimi: {
    label: "Kimi K2 (Moonshot AI)",
    description: "Kimi K2 — 1 trillion parameter MoE model",
    docsUrl: "https://platform.moonshot.ai/",
    placeholder: "sk-...",
    color: "bg-cyan-500/10 text-cyan-600",
    logo: "月",
  },
  anthropic: {
    label: "Anthropic Claude",
    description: "Claude 3.5 Haiku / Sonnet via Anthropic API",
    docsUrl: "https://console.anthropic.com/keys",
    placeholder: "sk-ant-...",
    color: "bg-orange-500/10 text-orange-600",
    logo: "◈",
  },
  custom: {
    label: "Custom (OpenAI-compatible)",
    description: "Any local or cloud endpoint (Ollama, LM Studio, vLLM, Together AI…)",
    docsUrl: "https://platform.openai.com/docs/api-reference",
    placeholder: "API key (leave blank for local)",
    color: "bg-gray-500/10 text-gray-600",
    logo: "⚙",
  },
};

const ALL_PROVIDERS = Object.keys(PROVIDERS) as AiProvider[];

// ─── Pattern Lock Section (unchanged) ─────────────────────────────────────────

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
            <CardDescription>Set up a pattern as an alternative sign-in method.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
          <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">Your pattern is stored as a secure hash and can never be viewed.</p>
        </div>

        {patternLoading ? (
          <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm text-muted-foreground">Loading...</span></div>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Current Status</Label>
              <div className="flex items-center gap-3">
                {patternStatus?.enabled ? (
                  <Badge variant="default" className="gap-1" data-testid="badge-pattern-active"><CheckCircle className="w-3 h-3" />Pattern Set</Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1" data-testid="badge-pattern-not-set"><XCircle className="w-3 h-3" />Not Set</Badge>
                )}
              </div>
            </div>

            {step === "idle" && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button onClick={() => { setStep("draw"); setFirstPattern(null); setPatternError(false); }} data-testid="button-set-pattern">
                  <Grid3X3 className="w-4 h-4 mr-2" />{patternStatus?.enabled ? "Change Pattern" : "Set Pattern"}
                </Button>
                {patternStatus?.enabled && (
                  <Button variant="outline" onClick={() => removePatternMutation.mutate()} disabled={removePatternMutation.isPending} data-testid="button-remove-pattern">
                    {removePatternMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}Remove Pattern
                  </Button>
                )}
              </div>
            )}

            {step === "draw" && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm font-medium" data-testid="text-pattern-draw-prompt">Draw your pattern (connect at least 4 dots)</p>
                <PatternLockGrid onComplete={handleFirstPattern} />
                <Button variant="ghost" onClick={() => { setStep("idle"); setFirstPattern(null); }} data-testid="button-cancel-pattern">Cancel</Button>
              </div>
            )}

            {step === "confirm" && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm font-medium" data-testid="text-pattern-confirm-prompt">Draw the same pattern again to confirm</p>
                <PatternLockGrid onComplete={handleConfirmPattern} error={patternError} disabled={setPatternMutation.isPending} />
                {setPatternMutation.isPending && <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Saving...</span></div>}
                <Button variant="ghost" onClick={() => { setStep("draw"); setFirstPattern(null); }} data-testid="button-retry-pattern">Start Over</Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Provider Key Row Component ────────────────────────────────────────────────

interface ProviderKeyRowProps {
  provider: AiProvider;
  hasKey: boolean;
  maskedKey: string | null;
  isActive: boolean;
  extra?: { baseUrl?: string | null; model?: string | null };
  onActivate: () => void;
  onSave: (key: string, extra?: { baseUrl?: string; model?: string }) => void;
  onRemove: () => void;
  onTest: (key: string, extra?: { baseUrl?: string; model?: string }) => void;
  isSaving: boolean;
  isTesting: boolean;
  isRemoving: boolean;
}

function ProviderKeyRow({
  provider, hasKey, maskedKey, isActive, extra,
  onActivate, onSave, onRemove, onTest,
  isSaving, isTesting, isRemoving,
}: ProviderKeyRowProps) {
  const meta = PROVIDERS[provider];
  const [expanded, setExpanded] = useState(false);
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState(extra?.baseUrl || "");
  const [model, setModel] = useState(extra?.model || "");

  const handleSave = () => {
    if (provider === "custom") {
      onSave(key, { baseUrl, model });
    } else {
      onSave(key);
    }
    setKey("");
  };

  const handleTest = () => {
    const testKey = key || (hasKey ? "***SAVED***" : "");
    if (provider === "custom") {
      onTest(testKey, { baseUrl, model });
    } else {
      onTest(testKey);
    }
  };

  return (
    <div className={`border rounded-lg transition-colors ${isActive ? "border-primary bg-primary/5" : "border-border"}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 p-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold shrink-0 ${meta.color}`}>
          {meta.logo}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{meta.label}</span>
            {isActive && (
              <Badge variant="default" className="text-xs gap-1 h-5"><Zap className="w-2.5 h-2.5" />Active</Badge>
            )}
            {hasKey && !isActive && (
              <Badge variant="secondary" className="text-xs gap-1 h-5"><CheckCircle className="w-2.5 h-2.5" />Configured</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{meta.description}</p>
          {hasKey && maskedKey && (
            <p className="text-xs font-mono text-muted-foreground">{maskedKey}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isActive && (
            <Button variant="outline" size="sm" onClick={onActivate} className="text-xs h-7">
              Set Active
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{hasKey ? "Update API Key" : "Add API Key"}</Label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type={showKey ? "text" : "password"}
                placeholder={meta.placeholder}
                value={key}
                onChange={e => setKey(e.target.value)}
                className="pl-8 pr-8 font-mono text-sm"
              />
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-8"
                onClick={() => setShowKey(s => !s)}>
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>

          {/* Custom endpoint extra fields */}
          {provider === "custom" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Base URL</Label>
                <Input
                  placeholder="http://localhost:11434/v1"
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  className="text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Model Name</Label>
                <Input
                  placeholder="gpt-3.5-turbo / llama3 / mistral"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="text-sm"
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={handleTest}
              disabled={isTesting || (!key && !hasKey && provider !== "custom")}
              className="text-xs h-7">
              {isTesting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
              Test
            </Button>
            <Button size="sm" onClick={handleSave}
              disabled={isSaving || (!key && provider !== "custom")}
              className="text-xs h-7">
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Key className="w-3 h-3 mr-1" />}
              Save
            </Button>
            {hasKey && (
              <Button size="sm" variant="outline" onClick={onRemove}
                disabled={isRemoving} className="text-xs h-7">
                {isRemoving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
                Remove
              </Button>
            )}
            <a href={meta.docsUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 ml-auto">
              Get API Key <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main AI Providers Section ────────────────────────────────────────────────

interface ProvidersData {
  activeProvider: AiProvider;
  providers: Record<AiProvider, {
    hasKey: boolean;
    maskedKey: string | null;
    baseUrl?: string | null;
    model?: string | null;
  }>;
}

function AiProvidersSection() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<ProvidersData>({
    queryKey: ["/api/settings/ai-providers"],
  });

  const [pendingProvider, setPendingProvider] = useState<AiProvider | null>(null);
  const [savingProvider, setSavingProvider] = useState<AiProvider | null>(null);
  const [testingProvider, setTestingProvider] = useState<AiProvider | null>(null);
  const [removingProvider, setRemovingProvider] = useState<AiProvider | null>(null);

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, any>) => {
      const res = await apiRequest("PUT", "/api/settings/ai-providers", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/ai-providers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (_, body: any) => {
      toast({ title: "Save failed", description: "Could not save settings.", variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (body: Record<string, any>) => {
      const res = await apiRequest("POST", "/api/settings/test-ai-provider", body);
      return res.json();
    },
    onSuccess: (data: { valid: boolean; message: string; provider: string }) => {
      if (data.valid) {
        toast({ title: "Connection successful!", description: data.message });
      } else {
        toast({ title: "Connection failed", description: data.message, variant: "destructive" });
      }
      setTestingProvider(null);
    },
    onError: () => {
      toast({ title: "Test error", description: "Could not reach the API.", variant: "destructive" });
      setTestingProvider(null);
    },
  });

  const handleActivate = (provider: AiProvider) => {
    setPendingProvider(provider);
    updateMutation.mutate({ activeProvider: provider }, {
      onSuccess: () => {
        toast({ title: `${PROVIDERS[provider].label} is now active`, description: "All AI features will use this provider." });
        setPendingProvider(null);
      },
    });
  };

  const handleSave = (provider: AiProvider, key: string, extra?: { baseUrl?: string; model?: string }) => {
    setSavingProvider(provider);
    const fieldMap: Record<AiProvider, string> = {
      gemini: "geminiApiKey", openai: "openaiApiKey", openrouter: "openrouterApiKey",
      grok: "grokApiKey", kimi: "kimiApiKey", anthropic: "anthropicApiKey", custom: "customApiKey",
    };
    const body: Record<string, any> = { [fieldMap[provider]]: key };
    if (provider === "custom") {
      if (extra?.baseUrl !== undefined) body.customApiBaseUrl = extra.baseUrl;
      if (extra?.model !== undefined) body.customApiModel = extra.model;
    }
    updateMutation.mutate(body, {
      onSuccess: () => {
        toast({ title: "API key saved", description: `${PROVIDERS[provider].label} key saved securely.` });
        setSavingProvider(null);
      },
    });
  };

  const handleRemove = (provider: AiProvider) => {
    setRemovingProvider(provider);
    const fieldMap: Record<AiProvider, string> = {
      gemini: "geminiApiKey", openai: "openaiApiKey", openrouter: "openrouterApiKey",
      grok: "grokApiKey", kimi: "kimiApiKey", anthropic: "anthropicApiKey", custom: "customApiKey",
    };
    updateMutation.mutate({ [fieldMap[provider]]: null }, {
      onSuccess: () => {
        toast({ title: "Key removed", description: `${PROVIDERS[provider].label} key has been removed.` });
        setRemovingProvider(null);
      },
    });
  };

  const handleTest = (provider: AiProvider, key: string, extra?: { baseUrl?: string; model?: string }) => {
    setTestingProvider(provider);
    const fieldMap: Record<AiProvider, string> = {
      gemini: "geminiApiKey", openai: "openaiApiKey", openrouter: "openrouterApiKey",
      grok: "grokApiKey", kimi: "kimiApiKey", anthropic: "anthropicApiKey", custom: "customApiKey",
    };
    const body: Record<string, any> = {
      provider,
      apiKey: key === "***SAVED***" ? undefined : key,
      ...(extra?.baseUrl && { baseUrl: extra.baseUrl }),
      ...(extra?.model && { model: extra.model }),
    };
    testMutation.mutate(body);
  };

  if (isLoading) {
    return <div className="flex items-center gap-2 py-4"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm text-muted-foreground">Loading AI settings...</span></div>;
  }

  const activeProvider = data?.activeProvider || "gemini";
  const providers = data?.providers;

  return (
    <div className="space-y-3">
      {/* Active provider summary */}
      <div className="flex items-center gap-3 p-3 rounded-md bg-primary/5 border border-primary/20">
        <Zap className="w-4 h-4 text-primary shrink-0" />
        <div>
          <p className="text-sm font-medium">
            Active Provider: <span className="text-primary">{PROVIDERS[activeProvider]?.label || activeProvider}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            All AI features (quiz generation, grading, chatbot, proctoring) use this provider.
          </p>
        </div>
      </div>

      <Separator />

      {/* Provider rows */}
      <div className="space-y-2">
        {ALL_PROVIDERS.map(provider => {
          const pData = providers?.[provider];
          return (
            <ProviderKeyRow
              key={provider}
              provider={provider}
              hasKey={pData?.hasKey || false}
              maskedKey={pData?.maskedKey || null}
              isActive={activeProvider === provider}
              extra={{ baseUrl: pData?.baseUrl, model: pData?.model }}
              onActivate={() => handleActivate(provider)}
              onSave={(key, extra) => handleSave(provider, key, extra)}
              onRemove={() => handleRemove(provider)}
              onTest={(key, extra) => handleTest(provider, key, extra)}
              isSaving={savingProvider === provider && updateMutation.isPending}
              isTesting={testingProvider === provider && testMutation.isPending}
              isRemoving={removingProvider === provider && updateMutation.isPending}
            />
          );
        })}
      </div>

      <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50">
        <Shield className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          All API keys are stored securely server-side and never exposed to the browser.
          If no key is configured for the active provider, the platform default (Gemini) will be used as fallback.
        </p>
      </div>
    </div>
  );
}

// ─── Main Settings Page ────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth();

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
                <CardTitle className="flex items-center gap-2">
                  AI Provider Configuration
                  <Badge variant="secondary" className="text-xs">Admin</Badge>
                </CardTitle>
                <CardDescription>
                  Choose and configure your AI provider. Supports Gemini, OpenAI, Grok, Kimi K2, OpenRouter, Anthropic, and custom endpoints.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <AiProvidersSection />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
