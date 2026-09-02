"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncClientAction } from "@/app/actions";

/** "Sincronizar" button + auto-sync on page load when data is stale. */
export function SyncControl({
  slug,
  lastSyncAt,
  autoStaleMinutes = 3,
}: {
  slug: string;
  lastSyncAt: string | null;
  autoStaleMinutes?: number;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const ranAuto = useRef(false);

  const sync = () =>
    start(async () => {
      await syncClientAction(slug);
      router.refresh();
    });

  // Auto-sync once on mount if the last sync is older than the threshold.
  useEffect(() => {
    if (ranAuto.current) return;
    ranAuto.current = true;
    const stale = !lastSyncAt || Date.now() - new Date(lastSyncAt).getTime() > autoStaleMinutes * 60_000;
    if (stale) sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      type="button"
      onClick={sync}
      disabled={pending}
      title="Sincronizar dados do GoHighLevel agora"
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-60"
    >
      <span className={`inline-block leading-none ${pending ? "animate-spin" : ""}`} aria-hidden>
        ↻
      </span>
      {pending ? "Sincronizando…" : "Sincronizar"}
    </button>
  );
}
