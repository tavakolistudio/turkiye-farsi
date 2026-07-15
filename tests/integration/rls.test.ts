import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";

/**
 * Guards the RLS hardening (migration 20260715000000): every Prisma-managed
 * public table must have Row Level Security enabled so the Supabase Data API
 * exposes nothing. The app (Prisma as the table owner) bypasses RLS, which is
 * why the rest of the suite still reads/writes normally.
 */

afterAll(async () => {
  await prisma.$disconnect();
});

describe("row level security", () => {
  it("is enabled on a representative set of tables", async () => {
    const rows = await prisma.$queryRaw<{ relname: string; rls: boolean }[]>`
      SELECT c.relname AS relname, c.relrowsecurity AS rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname IN ('articles', 'users', 'sessions', 'password_reset_tokens', 'audit_logs', 'static_pages', 'redirects')
      ORDER BY c.relname;
    `;
    expect(rows.length).toBeGreaterThanOrEqual(7);
    for (const r of rows) {
      expect(r.rls, `RLS should be enabled on public.${r.relname}`).toBe(true);
    }
  });

  it("leaves no Prisma-managed public table without RLS", async () => {
    const rows = await prisma.$queryRaw<{ relname: string }[]>`
      SELECT c.relname AS relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname <> '_prisma_migrations'
        AND c.relrowsecurity = false;
    `;
    expect(rows.map((r) => r.relname)).toEqual([]);
  });
});
