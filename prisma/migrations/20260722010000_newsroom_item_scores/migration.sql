-- AlterTable
ALTER TABLE "ingested_news_items" ADD COLUMN     "aiScore" INTEGER,
ADD COLUMN     "finalScore" INTEGER,
ADD COLUMN     "ruleScore" INTEGER,
ADD COLUMN     "scoreBucket" TEXT,
ADD COLUMN     "scoreReasons" JSONB,
ADD COLUMN     "suggestedCategorySlug" TEXT,
ADD COLUMN     "trustScore" INTEGER,
ADD COLUMN     "verificationStatus" "NewsVerificationStatus";

-- CreateIndex
CREATE INDEX "ingested_news_items_finalScore_idx" ON "ingested_news_items"("finalScore");

