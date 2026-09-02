import { NextResponse } from "next/server";
import { runSync } from "@/lib/sync";
import { getActiveClients, getClient } from "@/lib/clients";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // unset → allow (dev)
  const auth = req.headers.get("authorization");
  const qs = new URL(req.url).searchParams.get("secret");
  return auth === `Bearer ${secret}` || qs === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const only = new URL(req.url).searchParams.get("client");
  const clients = only
    ? [await getClient(only)].filter((c): c is NonNullable<typeof c> => !!c)
    : await getActiveClients();

  const results: any[] = [];
  for (const client of clients) {
    try {
      results.push(await runSync(client));
    } catch (e) {
      results.push({ client: client.slug, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ ok: true, synced: results.length, results });
}
