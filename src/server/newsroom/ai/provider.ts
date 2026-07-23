import type {
  AiClassification,
  AiDraft,
  AiImportance,
  AiSeo,
  AiSocial,
  AiTrust,
  AiUsage,
} from "./schemas";

/**
 * Provider-agnostic contract for AI editorial assistance. Implementations must:
 *  - treat all source text as untrusted (wrap it via prompt-safety helpers),
 *  - never expose the API key to the client,
 *  - validate their own output with the Zod schemas before returning,
 *  - and report token usage/cost so the budget guard can enforce a daily cap.
 *
 * The pipeline always has a rule-based fallback, so any method may throw and the
 * caller will degrade gracefully.
 */

/** Bounded, copyright-safe context handed to the AI (never raw HTML/full body). */
export interface AiItemContext {
  title: string;
  excerpt: string | null;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string | null;
  /** Existing categories the AI may choose from (it must not invent taxonomy). */
  availableCategories: { slug: string; name: string }[];
  availableTags: { slug: string; name: string }[];
}

export interface AiResult<T> {
  data: T;
  usage: AiUsage;
}

export interface AIEditorialProvider {
  readonly name: string;
  readonly model: string;
  /** Whether this provider can actually make calls (key present, not disabled). */
  readonly enabled: boolean;

  classifyNews(ctx: AiItemContext): Promise<AiResult<AiClassification>>;
  scoreImportance(ctx: AiItemContext): Promise<AiResult<AiImportance>>;
  evaluateTrust(ctx: AiItemContext & { sourceSummary: string }): Promise<AiResult<AiTrust>>;
  generatePersianDraft(ctx: AiItemContext): Promise<AiResult<AiDraft>>;
  generateSeoFields(ctx: { title: string; summary: string }): Promise<AiResult<AiSeo>>;
  generateEditorialFields(ctx: AiItemContext): Promise<AiResult<Pick<AiDraft, "whyItMatters" | "whoIsAffected" | "whatToDo">>>;
  generateSocialSuggestions(ctx: { title: string; summary: string }): Promise<AiResult<AiSocial>>;
}

export class AiDisabledError extends Error {
  constructor(message = "AI provider is disabled") {
    super(message);
    this.name = "AiDisabledError";
  }
}

export interface AiProviderEnv {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxTokens?: number;
  /** Master switch from NewsroomSettings.aiEnabled. */
  aiEnabled: boolean;
}

/**
 * Resolve the active provider. Order:
 *  1. AI disabled (settings or missing key) → DisabledAIProvider.
 *  2. Test env with MOCK flag → MockAIProvider.
 *  3. Otherwise → OpenAIProvider.
 * Imports are lazy so the OpenAI/Mock modules are only loaded when needed.
 */
export async function getAIProvider(env: AiProviderEnv): Promise<AIEditorialProvider> {
  if (!env.aiEnabled || !env.apiKey) {
    const { DisabledAIProvider } = await import("./disabled-provider");
    return new DisabledAIProvider();
  }
  if (process.env.NODE_ENV === "test" || process.env.NEWSROOM_AI_MOCK === "1") {
    const { MockAIProvider } = await import("./mock-provider");
    return new MockAIProvider();
  }
  const { OpenAIProvider } = await import("./openai-provider");
  return new OpenAIProvider({
    apiKey: env.apiKey,
    model: env.model ?? process.env.OPENAI_NEWSROOM_MODEL ?? "gpt-4o-mini",
    timeoutMs: env.timeoutMs ?? Number(process.env.OPENAI_NEWSROOM_TIMEOUT_MS ?? 20_000),
    maxTokens: env.maxTokens ?? Number(process.env.OPENAI_NEWSROOM_MAX_TOKENS ?? 1200),
  });
}

/** Build the provider env from process env + settings. Key never leaves server. */
export function aiEnvFromSettings(aiEnabled: boolean): AiProviderEnv {
  return {
    aiEnabled,
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_NEWSROOM_MODEL,
    timeoutMs: process.env.OPENAI_NEWSROOM_TIMEOUT_MS ? Number(process.env.OPENAI_NEWSROOM_TIMEOUT_MS) : undefined,
    maxTokens: process.env.OPENAI_NEWSROOM_MAX_TOKENS ? Number(process.env.OPENAI_NEWSROOM_MAX_TOKENS) : undefined,
  };
}
