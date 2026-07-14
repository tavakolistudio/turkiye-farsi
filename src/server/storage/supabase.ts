import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  type StorageAdapter,
  type SaveInput,
  type StoredObject,
  safeStoredFilename,
  datePartitionedKey,
} from "./adapter";

/**
 * Production storage adapter backed by Supabase Storage. Uploads with the
 * service-role key (server-only) to a public bucket and returns the public URL.
 * Enabled automatically when the Supabase env vars are present.
 */
export class SupabaseStorageAdapter implements StorageAdapter {
  readonly name = "supabase";
  private client: SupabaseClient;
  private bucket: string;

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET || "media";
    if (!url || !serviceKey) {
      throw new Error("Supabase storage requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }
    this.client = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
  }

  async save(input: SaveInput): Promise<StoredObject> {
    const filename = safeStoredFilename(input.originalFilename, input.mimeType);
    const key = datePartitionedKey(filename);

    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(key, input.buffer, { contentType: input.mimeType, upsert: false });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);

    const { data } = this.client.storage.from(this.bucket).getPublicUrl(key);
    return { storagePath: key, publicUrl: data.publicUrl };
  }

  async delete(storagePath: string): Promise<void> {
    await this.client.storage.from(this.bucket).remove([storagePath]);
  }
}
