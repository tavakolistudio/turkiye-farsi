"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import type { FormState } from "@/lib/forms";
import { mergeClustersAction, splitClusterAction } from "../actions";

export interface ClusterRow {
  id: string;
  representativeTitle: string | null;
  sourceCount: number;
  itemCount: number;
  confidence: number;
  lastSeenAt: string;
}

/** Multi-select cluster list with a Merge action (primary = first selected). */
export function ClusterList({ clusters, canManage }: { clusters: ClusterRow[]; canManage: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<FormState | null>(null);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function merge() {
    if (selected.length < 2) return;
    const primaryId = selected[0];
    if (!confirm(`ادغام ${selected.length} خوشه در خوشه اول؟`)) return;
    start(async () => {
      const r = await mergeClustersAction(selected, primaryId);
      setMsg(r);
      if (r.ok) {
        setSelected([]);
        router.refresh();
      }
    });
  }

  if (clusters.length === 0) {
    return <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">خوشه‌ای وجود ندارد.</div>;
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex items-center gap-3">
          <Button size="sm" disabled={selected.length < 2 || pending} onClick={merge}>
            ادغام انتخاب‌شده‌ها ({selected.length})
          </Button>
          <span className="text-xs text-muted-foreground">اولین خوشهٔ انتخابی، خوشهٔ اصلی می‌شود.</span>
        </div>
      )}
      {msg?.ok && msg.message && <Alert variant="success">{msg.message}</Alert>}
      {msg?.error && <Alert variant="error">{msg.error}</Alert>}

      {clusters.map((c) => (
        <Card key={c.id} className="flex items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            {canManage && (
              <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} aria-label="انتخاب خوشه" />
            )}
            <div className="min-w-0">
              <p className="truncate font-medium">{c.representativeTitle ?? "بدون عنوان"}</p>
              <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
                <Badge tone="blue">{c.itemCount} آیتم</Badge>
                <Badge>{c.sourceCount} منبع</Badge>
                <span>اطمینان: {c.confidence.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <Link href={`/admin/newsroom/clusters/${c.id}`} className="text-sm text-primary underline">
            مشاهده / جداسازی
          </Link>
        </Card>
      ))}
    </div>
  );
}

export interface ClusterItemRow {
  id: string;
  title: string;
  sourceName: string;
}

/** Cluster detail: pick items to split into a new cluster. */
export function ClusterSplit({ clusterId, items, canManage }: { clusterId: string; items: ClusterItemRow[]; canManage: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<FormState | null>(null);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function split() {
    if (selected.length === 0 || selected.length === items.length) return;
    start(async () => {
      const r = await splitClusterAction(clusterId, selected);
      setMsg(r);
      if (r.ok) {
        setSelected([]);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {msg?.ok && msg.message && <Alert variant="success">{msg.message}</Alert>}
      {msg?.error && <Alert variant="error">{msg.error}</Alert>}
      {canManage && (
        <div className="flex items-center gap-3">
          <Button size="sm" disabled={selected.length === 0 || selected.length === items.length || pending} onClick={split}>
            جداسازی به خوشه جدید ({selected.length})
          </Button>
          <span className="text-xs text-muted-foreground">حداقل یک آیتم باید در خوشه بماند.</span>
        </div>
      )}
      <div className="space-y-2">
        {items.map((it) => (
          <Card key={it.id} className="flex items-center gap-3 p-3">
            {canManage && (
              <input type="checkbox" checked={selected.includes(it.id)} onChange={() => toggle(it.id)} aria-label="انتخاب آیتم" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{it.title}</p>
              <p className="text-xs text-muted-foreground">{it.sourceName}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
