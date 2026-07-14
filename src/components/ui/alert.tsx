import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "rounded-md border px-4 py-3 text-sm",
  {
    variants: {
      variant: {
        info: "border-border bg-muted text-foreground",
        success:
          "border-green-600/30 bg-green-600/10 text-green-800 dark:text-green-300",
        error:
          "border-destructive/30 bg-destructive/10 text-destructive dark:text-red-300",
        warning:
          "border-warning/40 bg-warning/15 text-warning-foreground dark:text-warning",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
  );
}
