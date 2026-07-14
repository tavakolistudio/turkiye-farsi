"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Item = { id: string; message: string; isRead: boolean; createdAt: string; article: { id: string; title: string } | null; actor: { name: string } | null };

export function NotificationList({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState(initial);
  async function mark(id: string) {
    const response = await fetch("/api/v1/admin/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    if (response.ok) setItems((current) => current.map((item) => item.id === id ? { ...item, isRead: true } : item));
  }
  return <div className="space-y-2">{items.map((item) => <div key={item.id} className={`rounded-lg border p-4 ${item.isRead ? "opacity-70" : "bg-card"}`}><div className="flex items-start justify-between gap-3"><div><p>{item.message}</p>{item.article && <Link className="text-sm text-primary" href={`/admin/articles/${item.article.id}/edit`}>{item.article.title}</Link>}<p className="text-xs text-muted-foreground">{item.actor?.name ?? "سیستم"} — {new Date(item.createdAt).toLocaleString("fa-IR")}</p></div>{!item.isRead && <Button size="sm" variant="outline" onClick={() => void mark(item.id)}>خواندم</Button>}</div></div>)}</div>;
}
