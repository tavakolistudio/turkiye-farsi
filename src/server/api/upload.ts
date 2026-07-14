import "server-only";
import { ApiError } from "@/lib/api/errors";
import type { UploadInput } from "@/server/services/media.service";

/** Extract a single uploaded file from multipart form-data into an UploadInput. */
export async function readUpload(req: Request): Promise<UploadInput> {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ApiError("BAD_REQUEST", "فایلی ارسال نشده است.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const folderId = form.get("folderId");
  return {
    buffer,
    originalFilename: file.name || "upload",
    mimeType: file.type || "application/octet-stream",
    size: buffer.length,
    folderId: typeof folderId === "string" && folderId ? folderId : undefined,
  };
}
