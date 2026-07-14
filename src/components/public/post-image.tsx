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
  return (
    <Image
      src={src}
      alt={label}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized
      className={`object-cover ${className}`}
    />
  );
}
