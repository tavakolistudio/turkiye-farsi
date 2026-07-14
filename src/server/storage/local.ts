import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import {
  type StorageAdapter,
  type SaveInput,
  type StoredObject,
  safeStoredFilename,
  datePartitionedKey,
} from "./adapter";

/**
 * Development storage adapter. Writes files under `public/uploads` so Next.js
 * serves them at `/uploads/...`. Not for production (serverless filesystems are
 * read-only) — the Supabase adapter is used there. Same interface either way.
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly name = "local";
  private readonly publicDir = path.join(process.cwd(), "public");

  async save(input: SaveInput): Promise<StoredObject> {
    const filename = safeStoredFilename(input.originalFilename, input.mimeType);
    const key = datePartitionedKey(filename); // uploads/YYYY/MM/<filename>
    const absPath = path.join(this.publicDir, key);

    // Guard: the resolved path must stay inside public/ (defence-in-depth).
    if (!absPath.startsWith(this.publicDir + path.sep)) {
      throw new Error("Resolved upload path escaped the storage root.");
    }

    await mkdir(path.dirname(absPath), { recursive: true });
    await writeFile(absPath, input.buffer);

    return { storagePath: key, publicUrl: `/${key}` };
  }

  async delete(storagePath: string): Promise<void> {
    const absPath = path.join(this.publicDir, storagePath);
    if (!absPath.startsWith(this.publicDir + path.sep)) return; // ignore unsafe paths
    await unlink(absPath).catch(() => {}); // best-effort
  }
}
