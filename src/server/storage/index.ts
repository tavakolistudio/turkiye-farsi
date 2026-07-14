import "server-only";
import type { StorageAdapter } from "./adapter";
import { LocalStorageAdapter } from "./local";
import { SupabaseStorageAdapter } from "./supabase";

let cached: StorageAdapter | null = null;

/**
 * Return the active storage adapter. Uses Supabase Storage when configured,
 * otherwise the local (dev) adapter. Cached per process.
 */
export function getStorageAdapter(): StorageAdapter {
  if (cached) return cached;
  const hasSupabase =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached = hasSupabase ? new SupabaseStorageAdapter() : new LocalStorageAdapter();
  return cached;
}

export * from "./adapter";
