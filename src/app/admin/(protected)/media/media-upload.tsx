"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { uploadMediaAction } from "./actions";
import type { FormState } from "@/lib/forms";

export function MediaUpload() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(uploadMediaAction, {});

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.ok, router]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border p-4">
      <input
        type="file"
        name="file"
        required
        accept="image/*,video/mp4,video/webm,audio/mpeg,application/pdf"
        className="text-sm file:me-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "در حال بارگذاری…" : "بارگذاری"}
      </Button>
      {state.error && <Alert variant="error" className="w-full">{state.error}</Alert>}
      <p className="w-full text-xs text-muted-foreground">
        تصویر، ویدئو (mp4/webm)، صوت (mp3) یا PDF — حداکثر ۲۵ مگابایت.
      </p>
    </form>
  );
}
