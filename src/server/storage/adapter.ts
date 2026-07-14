import "server-only";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { ApiError } from "@/lib/api/errors";

/** A stored object's location, returned by the storage provider. */
export interface StoredObject {
  storagePath: string; // provider key/path
  publicUrl: string;
}

export interface SaveInput {
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
}

/**
 * Storage provider contract. Implemented by the local (dev) adapter and the
 * Supabase Storage adapter. Swapping providers only touches this layer.
 */
export interface StorageAdapter {
  readonly name: string;
  save(input: SaveInput): Promise<StoredObject>;
  delete(storagePath: string): Promise<void>;
}

// ── Security constraints (shared by all adapters) ─────────────

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

/** Allowlist of accepted MIME types → canonical extension. */
export const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "application/pdf": "pdf",
};

/**
 * Validate an upload: enforce size limit and a strict MIME allowlist. SVG and
 * any executable/script types are rejected by omission (allowlist, not
 * blocklist), preventing stored-XSS and executable uploads.
 */
export function validateUpload(mimeType: string, size: number): void {
  if (size <= 0) throw new ApiError("BAD_REQUEST", "فایل خالی است.");
  if (size > MAX_UPLOAD_BYTES) {
    throw new ApiError(
      "PAYLOAD_TOO_LARGE",
      `حجم فایل بیش از حد مجاز است (حداکثر ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} مگابایت).`,
    );
  }
  if (!ALLOWED_MIME[mimeType]) {
    throw new ApiError(
      "UNSUPPORTED_MEDIA_TYPE",
      "نوع فایل مجاز نیست. تنها تصویر، ویدئو، صوت و PDF پذیرفته می‌شود.",
    );
  }
}

/**
 * Produce a safe, unique stored filename. Strips any directory components and
 * unsafe characters (prevents path traversal), keeps a slugged base for
 * readability, and prefixes a random token for uniqueness.
 */
export function safeStoredFilename(originalFilename: string, mimeType: string): string {
  const ext = ALLOWED_MIME[mimeType] ?? "bin";
  // Drop any path separators / directory parts.
  const base = path.basename(originalFilename).replace(/\.[^.]+$/, "");
  const cleanBase =
    base
      .toLowerCase()
      .replace(/[^a-z0-9؀-ۿ]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "file";
  const token = randomBytes(6).toString("hex");
  return `${token}-${cleanBase}.${ext}`;
}

/** Build a date-partitioned storage key: uploads/2026/07/<filename>. */
export function datePartitionedKey(filename: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `uploads/${yyyy}/${mm}/${filename}`;
}
