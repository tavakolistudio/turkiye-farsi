import "server-only";
import { prisma } from "@/lib/db";
import { bodyJsonText } from "@/lib/editorial/content";
import { ApiError } from "@/lib/api/errors";

export interface PublishChecklist {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

type PublishableArticle = {
  title: string;
  summary: string | null;
  bodyJson: unknown;
  primaryCategoryId: string | null;
  featuredImageId: string | null;
  metaDescription: string | null;
  sourceStatus: string;
  sources?: unknown[];
};

export const publishValidationService = {
  validate(article: PublishableArticle): PublishChecklist {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (article.title.trim().length < 3) errors.push("عنوان معتبر وارد نشده است.");
    if (bodyJsonText(article.bodyJson).length < 20) errors.push("متن مطلب برای انتشار کافی نیست.");
    if (!article.primaryCategoryId) errors.push("دسته‌بندی اصلی انتخاب نشده است.");
    if (article.sourceStatus === "MISSING" || article.sources?.length === 0) errors.push("حداقل یک منبع لازم است.");
    if (!article.summary?.trim()) warnings.push("خلاصهٔ مطلب خالی است.");
    if (!article.featuredImageId) warnings.push("تصویر شاخص انتخاب نشده است.");
    if (!article.metaDescription?.trim()) warnings.push("توضیحات متا خالی است.");
    return { valid: errors.length === 0, errors, warnings };
  },

  async forArticle(articleId: string) {
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: { sources: { select: { id: true } } },
    });
    if (!article) throw ApiError.notFound("مطلب یافت نشد.");
    return this.validate(article);
  },

  assert(checklist: PublishChecklist) {
    if (!checklist.valid) {
      throw new ApiError("PUBLISH_VALIDATION_FAILED", "چک‌لیست انتشار کامل نیست.", checklist);
    }
  },
};
