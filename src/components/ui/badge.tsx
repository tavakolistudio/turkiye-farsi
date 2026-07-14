import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "muted",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "muted" | "green" | "red" | "blue" | "yellow";
}) {
  const tones: Record<string, string> = {
    muted: "bg-muted text-muted-foreground",
    green: "bg-green-600/15 text-green-700 dark:text-green-400",
    red: "bg-destructive/15 text-destructive",
    blue: "bg-primary/15 text-primary",
    yellow: "bg-warning/20 text-warning-foreground dark:text-warning",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
