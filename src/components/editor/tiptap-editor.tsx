"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { editorialExtensions } from "./editorial-extensions";
import { safeContentUrl } from "@/lib/editorial/content";

type JsonDoc = Record<string, unknown>;

const buttonClass = "rounded border border-border bg-card px-2 py-1 text-xs hover:bg-accent";

function askSafeUrl(label: string) {
  const value = window.prompt(label)?.trim();
  if (!value) return null;
  const safe = safeContentUrl(value);
  if (!safe) window.alert("نشانی باید محلی یا با http/https باشد.");
  return safe ?? null;
}

export function TiptapEditor({ value, onChange }: { value: unknown; onChange: (value: JsonDoc) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } }),
      Image.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder: "متن فارسی مطلب را اینجا بنویسید…" }),
      Table.configure({ resizable: true }), TableRow, TableHeader, TableCell,
      ...editorialExtensions,
    ],
    content: value || { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: { attributes: { class: "tiptap min-h-72 p-4 outline-none", dir: "rtl", lang: "fa" } },
    onUpdate: ({ editor: instance }) => onChange(instance.getJSON() as JsonDoc),
  });

  useEffect(() => () => editor?.destroy(), [editor]);
  if (!editor) return <div className="min-h-72 animate-pulse rounded-lg border bg-muted" />;

  const addBox = (type: string, title: string) => editor.chain().focus().insertContent({ type, attrs: { title }, content: [{ type: "paragraph" }] }).run();
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card" dir="rtl">
      <div className="flex flex-wrap gap-1 border-b border-border bg-muted/40 p-2" role="toolbar" aria-label="ابزار ویرایش متن">
        <button type="button" className={buttonClass} onClick={() => editor.chain().focus().toggleBold().run()}>ضخیم</button>
        <button type="button" className={buttonClass} onClick={() => editor.chain().focus().toggleItalic().run()}>کج</button>
        <button type="button" className={buttonClass} onClick={() => editor.chain().focus().toggleStrike().run()}>خط‌خورده</button>
        <button type="button" className={buttonClass} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>تیتر ۲</button>
        <button type="button" className={buttonClass} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>تیتر ۳</button>
        <button type="button" className={buttonClass} onClick={() => editor.chain().focus().toggleBulletList().run()}>فهرست</button>
        <button type="button" className={buttonClass} onClick={() => editor.chain().focus().toggleOrderedList().run()}>فهرست شماره‌ای</button>
        <button type="button" className={buttonClass} onClick={() => editor.chain().focus().toggleBlockquote().run()}>نقل‌قول</button>
        <button type="button" className={buttonClass} onClick={() => { const href = askSafeUrl("نشانی لینک"); if (href) editor.chain().focus().extendMarkRange("link").setLink({ href }).run(); }}>لینک</button>
        <button type="button" className={buttonClass} onClick={() => { const src = askSafeUrl("نشانی تصویر"); if (src) editor.chain().focus().setImage({ src }).run(); }}>تصویر</button>
        <button type="button" className={buttonClass} onClick={() => { const src = askSafeUrl("نشانی تصویر گالری"); if (src) editor.chain().focus().insertContent({ type: "gallery", attrs: { images: [{ src, alt: "", caption: "" }] } }).run(); }}>گالری</button>
        <button type="button" className={buttonClass} onClick={() => { const src = askSafeUrl("نشانی ویدئو"); if (src) editor.chain().focus().insertContent({ type: "video", attrs: { src, title: "" } }).run(); }}>ویدئو</button>
        <button type="button" className={buttonClass} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>جدول</button>
        <button type="button" className={buttonClass} onClick={() => addBox("callout", "نکته")}>Callout</button>
        <button type="button" className={buttonClass} onClick={() => addBox("warning", "هشدار")}>هشدار</button>
        <button type="button" className={buttonClass} onClick={() => addBox("infoBox", "اطلاعات")}>Info Box</button>
        <button type="button" className={buttonClass} onClick={() => addBox("sourceBox", "منبع")}>Source Box</button>
        <button type="button" className={buttonClass} onClick={() => addBox("faq", "پرسش متداول")}>FAQ</button>
        <button type="button" className={buttonClass} onClick={() => { const id = window.prompt("شناسه مطلب مرتبط")?.trim(); if (id) editor.chain().focus().insertContent({ type: "relatedArticle", attrs: { articleId: id, title: "" } }).run(); }}>مطلب مرتبط</button>
        <button type="button" className={buttonClass} onClick={() => editor.chain().focus().insertContent({ type: "advertisement", attrs: { placement: "IN_ARTICLE" } }).run()}>تبلیغ</button>
        <button type="button" className={buttonClass} onClick={() => { const url = askSafeUrl("نشانی فایل"); if (url) editor.chain().focus().insertContent({ type: "fileAttachment", attrs: { url, name: "فایل پیوست", mimeType: "application/octet-stream" } }).run(); }}>پیوست</button>
        <button type="button" className={buttonClass} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>بازگشت</button>
        <button type="button" className={buttonClass} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>تکرار</button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
