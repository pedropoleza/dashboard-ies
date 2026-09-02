"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Silently re-fetches server data on an interval so the panel stays live. */
export function LiveRefresh({ intervalMs = 120000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
