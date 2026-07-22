"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import type { FormState } from "@/lib/forms";
import { reassignCategoryArticlesAction } from "./actions";

/**
 * "Transfer articles to another category" panel shown on the category edit page.
 * Only rendered when the category actually has attached articles. Moves both the
 * primary category and secondary (join) links — content is never deleted.
 */
export function TransferArticles({
  fromId,
  articleCount,
  targets,
}: {
  fromId: string;
  articleCount: number;
  targets: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    reassignCategoryArticlesAction,
    {},
  );

  if (articleCount === 0) {
    return (
      <Card className="max-w-xl space-y-1 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">انتقال مطالب</p>
        <p>هیچ مطلبی به این دسته‌بندی متصل نیست.</p>
      </Card>
    );
  }

  return (
    <Card className="max-w-xl space-y-3 p-4">
      <div>
        <p className="font-medium">انتقال مطالب به دسته‌ی دیگر</p>
        <p className="text-sm text-muted-foreground">
          {articleCount} مطلب به این دسته‌بندی متصل است. می‌توانید همه را به دسته‌ی دیگری منتقل کنید.
        </p>
      </div>

      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.ok && state.message && <Alert variant="success">{state.message}</Alert>}

      <form action={formAction} className="flex items-end gap-2">
        <input type="hidden" name="fromId" value={fromId} />
        <div className="flex-1">
          <Label htmlFor="toId">دسته‌ی مقصد</Label>
          <Select id="toId" name="toId" required defaultValue="">
            <option value="" disabled>
              — انتخاب دسته —
            </option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "در حال انتقال…" : "انتقال مطالب"}
        </Button>
      </form>
    </Card>
  );
}
