import Image from "next/image";

/**
 * Responsive article image. Uses next/image for correct sizing/lazy-loading,
 * but `unoptimized` so a missing local upload (dev placeholder paths) or a
 * remote Storage URL renders without needing optimizer/remote-pattern config
 * and never fails server rendering. Falls back to a neutral placeholder when
 * there is no image, and always requires meaningful alt text.
 */
export function PostImage({
  src,
  alt,
  sizes = "100vw",
  priority = false,
  className = "",
}: {
  src?: string | null;
  alt?: string | null;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const label = alt?.trim() || "تصویر خبر";
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-muted text-muted-foreground ${className}`}
        role="img"
        aria-label={label}
      >
        <span className="text-xs">بدون تصویر</span>
      </div>
    );
  }
  const unoptimized = !isOptimizable(src);
  return (
    <Image
      src={src}
      alt={label}
      fill
      sizes={sizes}
      loading={priority ? "eager" : undefined}
      fetchPriority={priority ? "high" : undefined}
      unoptimized={unoptimized}
      className={`object-cover ${className}`}
    />
  );
}

function isOptimizable(src: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  const storage = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!storage) return false;
  try {
    const sourceUrl = new URL(src);
    const storageUrl = new URL(storage);
    return sourceUrl.protocol === "https:" && sourceUrl.origin === storageUrl.origin && sourceUrl.pathname.startsWith("/storage/v1/object/public/");
  } catch {
    return false;
  }
}
