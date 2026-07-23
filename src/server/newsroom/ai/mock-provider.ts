import type { AIEditorialProvider, AiItemContext, AiResult } from "./provider";
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
 * Deterministic in-memory provider for tests. Produces schema-valid output
 * without any network call, so pipeline/integration tests can exercise the
 * AI-enabled path reproducibly. Never used in production (see getAIProvider).
 */
export class MockAIProvider implements AIEditorialProvider {
  readonly name = "mock";
  readonly model = "mock-1";
  readonly enabled = true;

  private usage(): AiUsage {
    return { provider: this.name, model: this.model, promptTokens: 10, completionTokens: 10, costUsd: 0 };
  }
  private wrap<T>(data: T): AiResult<T> {
    return { data, usage: this.usage() };
  }

  async classifyNews(ctx: AiItemContext): Promise<AiResult<AiClassification>> {
    const first = ctx.availableCategories[0]?.slug ?? null;
    return this.wrap({
      primaryCategorySlug: first,
      secondaryCategorySlugs: [],
      suggestedTagSlugs: [],
      affectedAudience: "ایرانیان مقیم ترکیه",
      geographicScope: "ترکیه",
      sensitivityLevel: "LOW",
    });
  }

  async scoreImportance(): Promise<AiResult<AiImportance>> {
    return this.wrap({ score: 65, reasons: ["mock: relevant"] });
  }

  async evaluateTrust(): Promise<AiResult<AiTrust>> {
    return this.wrap({ verificationStatus: "SINGLE_SOURCE", requiresHumanFactCheck: true, reasonCodes: ["mock"] });
  }

  async generatePersianDraft(ctx: AiItemContext): Promise<AiResult<AiDraft>> {
    return this.wrap({
      title: ctx.title,
      subtitle: null,
      summary: ctx.excerpt ?? ctx.title,
      body: ctx.excerpt ?? ctx.title,
      whyItMatters: null,
      whoIsAffected: null,
      whatToDo: null,
      isBreakingSuggestion: false,
    });
  }

  async generateSeoFields(ctx: { title: string; summary: string }): Promise<AiResult<AiSeo>> {
    return this.wrap({ metaTitle: ctx.title.slice(0, 60), metaDescription: ctx.summary.slice(0, 155) });
  }

  async generateEditorialFields(): Promise<AiResult<Pick<AiDraft, "whyItMatters" | "whoIsAffected" | "whatToDo">>> {
    return this.wrap({ whyItMatters: null, whoIsAffected: null, whatToDo: null });
  }

  async generateSocialSuggestions(): Promise<AiResult<AiSocial>> {
    return this.wrap({
      instagramCaption: null,
      telegramCaption: null,
      reelTitle: null,
      carouselTitle: null,
      pushTitle: null,
      pushBody: null,
    });
  }
}
