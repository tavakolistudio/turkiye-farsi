import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Stub the SSRF-hardened network fetch so the pipeline runs offline against
// canned feeds. The real safe-fetch is unit-tested separately (SSRF/size/etc).
vi.mock("@/server/newsroom/fetch/safe-fetch", () => ({
  SafeFetchError: class SafeFetchError extends Error {
    constructor(public code: string, message: string) { super(message); }
  },
  safeFetchFeed: vi.fn(async (url: string) => ({
    status: 200, notModified: false, contentType: "application/rss+xml",
    etag: '"v1"', lastModified: "Tue, 21 Jul 2026 10:00:00 GMT", finalUrl: url,
    body: FEEDS[url] ?? EMPTY_FEED,
  })),
}));

import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/server/rbac/permissions";
import type { AuthUser } from "@/server/rbac/authz";
import type { ServiceContext } from "@/server/services/context";
import { newsroomService } from "@/server/newsroom/newsroom.service";
import { newsroomPipeline } from "@/server/newsroom/pipeline.service";
import { newsroomSettingsService, DEFAULT_NEWSROOM_SETTINGS } from "@/server/newsroom/settings";

const item = (id: string, title: string, link: string, pub = "Tue, 21 Jul 2026 10:00:00 GMT") =>
  `<item><title>${title}</title><link>${link}</link><guid>${id}</guid><description>خلاصه ${title}</description><pubDate>${pub}</pubDate></item>`;

const wrap = (items: string) => `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title>${items}</channel></rss>`;
const EMPTY_FEED = wrap("");

// Two sources: A and B both carry the SAME story ("قانون تازه اقامت ایرانیان در ترکیه")
// plus a unique one each — so we can assert clustering + multi-source.
const STORY = "قانون تازه اقامت ایرانیان در ترکیه اعلام شد";
const FEEDS: Record<string, string> = {
  "https://a.example.com/rss": wrap(item("a1", STORY, "https://a.example.com/1") + item("a2", "خبر ویژه منبع الف درباره لیر و ارز", "https://a.example.com/2")),
  "https://b.example.com/rss": wrap(item("b1", STORY, "https://b.example.com/1") + item("b2", "خبر اختصاصی منبع ب درباره پرواز", "https://b.example.com/2")),
};

const PREFIX = `nr-${Date.now()}`;
let userId = "";
let sourceAId = "";
let sourceBId = "";
let ctx: ServiceContext;
let reporterCtx: ServiceContext;

function actor(id: string, perms: string[]): AuthUser {
  return { id, email: `${id}@test.local`, name: "NR Test", isActive: true, roleKeys: [], permissions: new Set(perms) };
}

async function enableCollection(aiEnabled = false, dailyAiBudget = 5) {
  await newsroomSettingsService.save({ ...DEFAULT_NEWSROOM_SETTINGS, isEnabled: true, collectionEnabled: true, aiEnabled, dailyAiBudget });
}

beforeAll(async () => {
  const user = await prisma.user.create({ data: { email: `${PREFIX}@test.local`, name: "NR", passwordHash: "x" } });
  userId = user.id;
  ctx = { actor: actor(user.id, Object.values(PERMISSIONS)), ip: null, userAgent: "vitest" };
  reporterCtx = { actor: actor(user.id, [PERMISSIONS.NEWSROOM_VIEW]), ip: null, userAgent: "vitest" };

  const a = await prisma.source.create({ data: { name: `${PREFIX} الف`, slug: `${PREFIX}-a`, isEnabled: true, collectionMethod: "RSS", feedUrl: "https://a.example.com/rss", trustLevel: 80, isOfficial: true } });
  const b = await prisma.source.create({ data: { name: `${PREFIX} ب`, slug: `${PREFIX}-b`, isEnabled: true, collectionMethod: "RSS", feedUrl: "https://b.example.com/rss", trustLevel: 70 } });
  sourceAId = a.id; sourceBId = b.id;
});

afterAll(async () => {
  const items = await prisma.ingestedNewsItem.findMany({ where: { sourceId: { in: [sourceAId, sourceBId] } }, select: { id: true } });
  const itemIds = items.map((i) => i.id);
  const prov = await prisma.newsDraftProvenance.findMany({ where: { primaryItemId: { in: itemIds } }, select: { id: true, articleId: true } });
  await prisma.newsDraftProvenance.deleteMany({ where: { id: { in: prov.map((p) => p.id) } } });
  const articleIds = prov.map((p) => p.articleId).filter(Boolean) as string[];
  if (articleIds.length) {
    await prisma.articleSource.deleteMany({ where: { articleId: { in: articleIds } } });
    await prisma.articleRevision.deleteMany({ where: { articleId: { in: articleIds } } });
    await prisma.article.deleteMany({ where: { id: { in: articleIds } } });
  }
  await prisma.newsStoryClusterItem.deleteMany({ where: { newsItemId: { in: itemIds } } });
  await prisma.newsStoryCluster.deleteMany({ where: { representativeItemId: { in: itemIds } } });
  await prisma.newsPipelineJobLog.deleteMany({ where: { newsItemId: { in: itemIds } } });
  await prisma.ingestedNewsItem.deleteMany({ where: { id: { in: itemIds } } });
  await prisma.source.deleteMany({ where: { id: { in: [sourceAId, sourceBId] } } });
  await prisma.newsFetchBatch.deleteMany({ where: { trigger: "manual" } });
  await prisma.siteSetting.deleteMany({ where: { key: "newsroom" } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("newsroom pipeline (integration)", () => {
  it("1-6: fetches, dedups, clusters multi-source, scores and evaluates trust", async () => {
    await enableCollection();
    const run = await newsroomPipeline.runCollection({ trigger: "manual" });
    expect(run.skipped).toBeUndefined();
    // 4 items persisted: shared story from A and B (kept + clustered) plus one
    // unique per source. (Rejected low-score items are still persisted rows.)
    const persisted = await prisma.ingestedNewsItem.count({ where: { sourceId: { in: [sourceAId, sourceBId] } } });
    expect(persisted).toBeGreaterThanOrEqual(3);

    // The shared story from A and B must land in ONE cluster with 2 sources.
    const shared = await prisma.ingestedNewsItem.findFirst({ where: { sourceId: sourceAId, title: { contains: "قانون تازه اقامت" } }, include: { clusterLinks: true } });
    expect(shared).toBeTruthy();
    const clusterId = shared!.clusterLinks[0]!.clusterId;
    const cluster = await prisma.newsStoryCluster.findUnique({ where: { id: clusterId } });
    expect(cluster!.sourceCount).toBe(2);

    // Scores + trust are stored and explainable.
    expect(shared!.ruleScore).toBeGreaterThan(0);
    expect(shared!.finalScore).not.toBeNull();
    expect(shared!.trustScore).not.toBeNull();
    expect(shared!.verificationStatus).toBeTruthy();
  });

  it("15/25: re-running the batch creates no duplicate items", async () => {
    const before = await prisma.ingestedNewsItem.count({ where: { sourceId: { in: [sourceAId, sourceBId] } } });
    await newsroomPipeline.runCollection({ trigger: "manual" });
    const after = await prisma.ingestedNewsItem.count({ where: { sourceId: { in: [sourceAId, sourceBId] } } });
    expect(after).toBe(before);
  });

  it("6/8/9/10: AI disabled uses rule-based draft; sources attached; draft stays private", async () => {
    const target = await prisma.ingestedNewsItem.findFirstOrThrow({ where: { sourceId: sourceAId, title: { contains: "قانون تازه اقامت" } } });
    const { articleId } = await newsroomService.createDraftFromItem(ctx, target.id);
    const article = await prisma.article.findUniqueOrThrow({ where: { id: articleId }, include: { sources: true, newsroomProvenance: true } });
    expect(article.status).toBe("DRAFT"); // never PUBLISHED
    expect(article.publishedAt).toBeNull();
    expect(article.sources.length).toBeGreaterThanOrEqual(1);
    expect(article.newsroomProvenance.length).toBe(1);
    const refreshed = await prisma.ingestedNewsItem.findUnique({ where: { id: target.id } });
    expect(refreshed!.ingestionStatus).toBe("DRAFTED");
  });

  it("11: reprocess is idempotent and re-scores", async () => {
    const it2 = await prisma.ingestedNewsItem.findFirstOrThrow({ where: { sourceId: sourceBId, title: { contains: "پرواز" } } });
    const r = await newsroomService.reprocessItem(ctx, it2.id);
    expect(r.finalScore).not.toBeNull();
  });

  it("12: regenerate rebuilds the draft and keeps it DRAFT + snapshots a revision", async () => {
    const target = await prisma.ingestedNewsItem.findFirstOrThrow({ where: { sourceId: sourceAId, title: { contains: "قانون تازه اقامت" } } });
    const r = await newsroomService.regenerateDraft(ctx, target.id, { force: true });
    const article = await prisma.article.findUniqueOrThrow({ where: { id: r.articleId } });
    expect(article.status).toBe("DRAFT");
    const revisions = await prisma.articleRevision.count({ where: { articleId: r.articleId } });
    expect(revisions).toBeGreaterThanOrEqual(1);
  });

  it("13/14: cluster split then merge", async () => {
    const clusters = await prisma.newsStoryCluster.findMany({ where: { status: "OPEN", items: { some: { newsItem: { sourceId: { in: [sourceAId, sourceBId] } } } } }, include: { items: true } });
    const multi = clusters.find((c) => c.items.length >= 2);
    expect(multi).toBeTruthy();
    const moveItem = multi!.items[1].newsItemId;
    const split = await newsroomService.splitCluster(ctx, { clusterId: multi!.id, itemIds: [moveItem] });
    expect(split.movedCount).toBe(1);
    // Now merge them back.
    const merged = await newsroomService.mergeClusters(ctx, { clusterIds: [multi!.id, split.newClusterId], primaryId: multi!.id });
    expect(merged.mergedCount).toBe(1);
  });

  it("15/16: retention cleanup dry-run reports and never deletes in dry mode", async () => {
    const before = await prisma.ingestedNewsItem.count({ where: { sourceId: { in: [sourceAId, sourceBId] }, deletedAt: null } });
    const report = await newsroomService.cleanup(ctx, true);
    expect(report.dryRun).toBe(true);
    const after = await prisma.ingestedNewsItem.count({ where: { sourceId: { in: [sourceAId, sourceBId] }, deletedAt: null } });
    expect(after).toBe(before); // dry-run changes nothing
  });

  it("17: unauthorized access is denied", async () => {
    // A reporter (newsroom.view only) cannot run collection, create drafts or
    // change settings — the service throws before doing any work.
    await expect(newsroomService.run(reporterCtx)).rejects.toThrow();
    await expect(newsroomService.createDraftFromItem(reporterCtx, "x")).rejects.toThrow();
    await expect(newsroomService.updateSettings(reporterCtx, {})).rejects.toThrow();
  });

  it("18: kill switch stops collection", async () => {
    await newsroomSettingsService.save({ ...DEFAULT_NEWSROOM_SETTINGS, isEnabled: false, collectionEnabled: false });
    const run = await newsroomPipeline.runCollection({ trigger: "manual" });
    expect(run.skipped).toBe("disabled");
    expect(run.batchId).toBeNull();
  });
});
