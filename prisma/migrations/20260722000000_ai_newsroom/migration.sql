-- CreateEnum
CREATE TYPE "CollectionMethod" AS ENUM ('RSS', 'ATOM', 'JSON_FEED', 'OFFICIAL_API', 'MANUAL', 'WEB_PAGE_ALLOWED');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('FETCHED', 'NORMALIZED', 'DUPLICATE', 'CLUSTERED', 'SCORED', 'DRAFTED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "NewsBatchStatus" AS ENUM ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "NewsPipelineStage" AS ENUM ('FETCH', 'NORMALIZE', 'DEDUPLICATE', 'CLUSTER', 'SCORE', 'CLASSIFY', 'TRUST', 'DRAFT', 'NOTIFY');

-- CreateEnum
CREATE TYPE "NewsJobStatus" AS ENUM ('STARTED', 'SUCCESS', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "NewsClusterStatus" AS ENUM ('OPEN', 'MERGED', 'CLOSED');

-- CreateEnum
CREATE TYPE "NewsVerificationStatus" AS ENUM ('UNVERIFIED', 'SINGLE_SOURCE', 'MULTI_SOURCE', 'OFFICIAL_CONFIRMED', 'CONFLICTING', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'NEWSROOM_URGENT';
ALTER TYPE "NotificationType" ADD VALUE 'NEWSROOM_DRAFT_READY';
ALTER TYPE "NotificationType" ADD VALUE 'NEWSROOM_SOURCE_CONFLICT';
ALTER TYPE "NotificationType" ADD VALUE 'NEWSROOM_SOURCE_FAILING';
ALTER TYPE "NotificationType" ADD VALUE 'NEWSROOM_BUDGET_WARNING';
ALTER TYPE "NotificationType" ADD VALUE 'NEWSROOM_PIPELINE_FAILURE';

-- AlterTable
ALTER TABLE "sources" ADD COLUMN     "allowFullTextFetch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "collectionMethod" "CollectionMethod" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "feedUrl" TEXT,
ADD COLUMN     "fetchIntervalMinutes" INTEGER NOT NULL DEFAULT 1440,
ADD COLUMN     "isEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastFetchedAt" TIMESTAMP(3),
ADD COLUMN     "lastSuccessfulFetchAt" TIMESTAMP(3),
ADD COLUMN     "maxExcerptLength" INTEGER NOT NULL DEFAULT 400,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "robotsReviewedAt" TIMESTAMP(3),
ADD COLUMN     "termsReviewedAt" TIMESTAMP(3),
ADD COLUMN     "trustLevel" INTEGER NOT NULL DEFAULT 50;

-- CreateTable
CREATE TABLE "ingested_news_items" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "canonicalUrl" TEXT,
    "title" TEXT NOT NULL,
    "originalLanguage" TEXT,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "authorName" TEXT,
    "excerpt" TEXT,
    "rawMetadataJson" JSONB,
    "contentHash" TEXT,
    "titleHash" TEXT,
    "normalizedTitle" TEXT,
    "normalizedText" TEXT,
    "fetchBatchId" TEXT,
    "ingestionStatus" "IngestionStatus" NOT NULL DEFAULT 'FETCHED',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingested_news_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_fetch_batches" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "NewsBatchStatus" NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL DEFAULT 'cron',
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "draftedCount" INTEGER NOT NULL DEFAULT 0,
    "aiCallCount" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "errorSummary" TEXT,

    CONSTRAINT "news_fetch_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_pipeline_job_logs" (
    "id" TEXT NOT NULL,
    "batchId" TEXT,
    "newsItemId" TEXT,
    "stage" "NewsPipelineStage" NOT NULL,
    "status" "NewsJobStatus" NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessageSafe" TEXT,
    "metadataJson" JSONB,

    CONSTRAINT "news_pipeline_job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_story_clusters" (
    "id" TEXT NOT NULL,
    "clusterKey" TEXT NOT NULL,
    "representativeItemId" TEXT,
    "normalizedTopic" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceCount" INTEGER NOT NULL DEFAULT 1,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "NewsClusterStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_story_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_story_cluster_items" (
    "clusterId" TEXT NOT NULL,
    "newsItemId" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_story_cluster_items_pkey" PRIMARY KEY ("clusterId","newsItemId")
);

-- CreateTable
CREATE TABLE "news_draft_provenance" (
    "id" TEXT NOT NULL,
    "articleId" TEXT,
    "ingestionBatchId" TEXT,
    "storyClusterId" TEXT,
    "primaryItemId" TEXT,
    "generatedByAI" BOOLEAN NOT NULL DEFAULT false,
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "aiPromptVersion" TEXT,
    "aiGeneratedAt" TIMESTAMP(3),
    "ruleScore" INTEGER,
    "aiScore" INTEGER,
    "finalScore" INTEGER,
    "trustScore" INTEGER,
    "verificationStatus" "NewsVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "scoreReasons" JSONB,
    "generationCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "requiresHumanReview" BOOLEAN NOT NULL DEFAULT true,
    "lastHumanReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_draft_provenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ingested_news_items_canonicalUrl_idx" ON "ingested_news_items"("canonicalUrl");

-- CreateIndex
CREATE INDEX "ingested_news_items_contentHash_idx" ON "ingested_news_items"("contentHash");

-- CreateIndex
CREATE INDEX "ingested_news_items_titleHash_idx" ON "ingested_news_items"("titleHash");

-- CreateIndex
CREATE INDEX "ingested_news_items_publishedAt_idx" ON "ingested_news_items"("publishedAt");

-- CreateIndex
CREATE INDEX "ingested_news_items_ingestionStatus_idx" ON "ingested_news_items"("ingestionStatus");

-- CreateIndex
CREATE INDEX "ingested_news_items_createdAt_idx" ON "ingested_news_items"("createdAt");

-- CreateIndex
CREATE INDEX "ingested_news_items_fetchBatchId_idx" ON "ingested_news_items"("fetchBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "ingested_news_items_sourceId_externalId_key" ON "ingested_news_items"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "news_fetch_batches_status_idx" ON "news_fetch_batches"("status");

-- CreateIndex
CREATE INDEX "news_fetch_batches_startedAt_idx" ON "news_fetch_batches"("startedAt");

-- CreateIndex
CREATE INDEX "news_pipeline_job_logs_batchId_idx" ON "news_pipeline_job_logs"("batchId");

-- CreateIndex
CREATE INDEX "news_pipeline_job_logs_newsItemId_idx" ON "news_pipeline_job_logs"("newsItemId");

-- CreateIndex
CREATE INDEX "news_pipeline_job_logs_stage_status_idx" ON "news_pipeline_job_logs"("stage", "status");

-- CreateIndex
CREATE INDEX "news_pipeline_job_logs_startedAt_idx" ON "news_pipeline_job_logs"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "news_story_clusters_clusterKey_key" ON "news_story_clusters"("clusterKey");

-- CreateIndex
CREATE INDEX "news_story_clusters_status_idx" ON "news_story_clusters"("status");

-- CreateIndex
CREATE INDEX "news_story_clusters_lastSeenAt_idx" ON "news_story_clusters"("lastSeenAt");

-- CreateIndex
CREATE INDEX "news_story_cluster_items_newsItemId_idx" ON "news_story_cluster_items"("newsItemId");

-- CreateIndex
CREATE UNIQUE INDEX "news_draft_provenance_articleId_key" ON "news_draft_provenance"("articleId");

-- CreateIndex
CREATE INDEX "news_draft_provenance_storyClusterId_idx" ON "news_draft_provenance"("storyClusterId");

-- CreateIndex
CREATE INDEX "news_draft_provenance_finalScore_idx" ON "news_draft_provenance"("finalScore");

-- CreateIndex
CREATE INDEX "news_draft_provenance_trustScore_idx" ON "news_draft_provenance"("trustScore");

-- CreateIndex
CREATE INDEX "news_draft_provenance_createdAt_idx" ON "news_draft_provenance"("createdAt");

-- CreateIndex
CREATE INDEX "sources_isEnabled_idx" ON "sources"("isEnabled");

-- CreateIndex
CREATE INDEX "sources_lastFetchedAt_idx" ON "sources"("lastFetchedAt");

-- AddForeignKey
ALTER TABLE "ingested_news_items" ADD CONSTRAINT "ingested_news_items_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingested_news_items" ADD CONSTRAINT "ingested_news_items_fetchBatchId_fkey" FOREIGN KEY ("fetchBatchId") REFERENCES "news_fetch_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_pipeline_job_logs" ADD CONSTRAINT "news_pipeline_job_logs_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "news_fetch_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_pipeline_job_logs" ADD CONSTRAINT "news_pipeline_job_logs_newsItemId_fkey" FOREIGN KEY ("newsItemId") REFERENCES "ingested_news_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_story_clusters" ADD CONSTRAINT "news_story_clusters_representativeItemId_fkey" FOREIGN KEY ("representativeItemId") REFERENCES "ingested_news_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_story_cluster_items" ADD CONSTRAINT "news_story_cluster_items_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "news_story_clusters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_story_cluster_items" ADD CONSTRAINT "news_story_cluster_items_newsItemId_fkey" FOREIGN KEY ("newsItemId") REFERENCES "ingested_news_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_draft_provenance" ADD CONSTRAINT "news_draft_provenance_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_draft_provenance" ADD CONSTRAINT "news_draft_provenance_storyClusterId_fkey" FOREIGN KEY ("storyClusterId") REFERENCES "news_story_clusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_draft_provenance" ADD CONSTRAINT "news_draft_provenance_primaryItemId_fkey" FOREIGN KEY ("primaryItemId") REFERENCES "ingested_news_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable Row Level Security on the new tables (deny-by-default for the public
-- PostgREST anon/authenticated roles). Prisma connects as the table owner and
-- bypasses RLS, so server access is unchanged. No policies are added on purpose.
-- See prisma/migrations/20260715000000_enable_rls for the rationale.
ALTER TABLE public.ingested_news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_fetch_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_pipeline_job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_story_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_story_cluster_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_draft_provenance ENABLE ROW LEVEL SECURITY;

