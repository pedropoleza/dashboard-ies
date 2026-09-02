"use server";

import { getClient } from "@/lib/clients";
import { runSync } from "@/lib/sync";
import { revalidatePath } from "next/cache";

/** Sync a client's GHL data on demand (button + auto-sync). Runs server-side,
 *  so no secret is exposed to the browser. */
export async function syncClientAction(slug: string): Promise<{ ok: boolean; error?: string }> {
  const client = await getClient(slug);
  if (!client) return { ok: false, error: "unknown client" };
  try {
    await runSync(client);
    revalidatePath(`/${slug}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
