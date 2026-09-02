import { NextResponse } from "next/server";
import { supabaseDashboard } from "@/lib/supabase";
import { parseGhlTime } from "@/lib/time";

export const dynamic = "force-dynamic";

/** A call counts as "connected" when completed/answered with a non-zero duration. */
function isConnectedCall(statusLc: string, duration: number | null): boolean {
  return (statusLc === "completed" || statusLc === "answered") && (duration ?? 0) > 0;
}

// Event types we persist (per registered client). Everything else (messages,
// conversations, notes, tasks, locations, etc.) is acknowledged but not stored.
const KEEP = new Set(["call", "appointment", "opportunity", "contact", "user"]);

function authorized(req: Request): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true;
  const url = new URL(req.url);
  const qs = url.searchParams.get("key") ?? url.searchParams.get("secret");
  return qs === secret || req.headers.get("x-webhook-secret") === secret;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : Math.round(n);
}
function pick(o: Record<string, any> | null | undefined, ...keys: string[]): any {
  if (!o) return null;
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  return null;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  // Workflow webhooks nest fields under `customData`; native app events don't.
  const cd: Record<string, any> = body.customData && typeof body.customData === "object" ? body.customData : {};
  const nativeType: string | null = typeof body.type === "string" ? body.type : null;

  // Classify into a normalized event_type.
  function classify(): string {
    if (cd["call.status"] !== undefined || cd["call.direction"] !== undefined) return "call";
    if (cd["appointment.id"] !== undefined || cd["appointment.start_time"] !== undefined || cd["end_time"] !== undefined)
      return "appointment";
    if (nativeType) {
      if (nativeType.startsWith("Appointment")) return "appointment";
      if (nativeType.startsWith("Opportunity")) return "opportunity";
      if (nativeType.startsWith("Contact")) return "contact";
      if (nativeType.startsWith("User")) return "user";
    }
    return "ignore";
  }
  const eventType = classify();

  // Drop noise event types fast (still 200 so GHL doesn't retry).
  if (!KEEP.has(eventType)) {
    return NextResponse.json({ ok: true, ignored: nativeType ?? "unrecognized" });
  }

  // Resolve the client. Explicit ?client= wins; otherwise map by GHL location.
  const locationId = pick(body, "location_id", "locationId") ?? body.location?.id ?? null;
  const url = new URL(req.url);
  let clientSlug = url.searchParams.get("client");
  if (!clientSlug && locationId) {
    const { data } = await supabaseDashboard().from("clients").select("slug").eq("location_id", locationId).maybeSingle();
    clientSlug = data?.slug ?? null;
  }
  // Ignore events from locations that aren't a registered dashboard client.
  if (!clientSlug) {
    return NextResponse.json({ ok: true, ignored: "unregistered_location", location: locationId });
  }

  const contactId = pick(body, "contact_id", "contactId", "id");
  const contactName = pick(body, "full_name", "fullName", "contact_name", "name", "first_name");

  const row: Record<string, any> = {
    client: clientSlug,
    location_id: locationId,
    event_type: eventType,
    contact_id: contactId,
    contact_name: contactName,
    contact_phone: pick(body, "phone"),
    event_time: new Date().toISOString(),
    raw: body,
  };

  if (eventType === "call") {
    const duration = num(cd["call.duration"]);
    const status = String(pick(cd, "call.status") ?? "");
    row.user_id = pick(cd, "call.user_id");
    row.user_name = pick(cd, "call.user_name");
    row.contact_phone = pick(cd, "call.to") ?? row.contact_phone;
    row.direction = pick(cd, "call.direction");
    row.duration = duration;
    row.call_status = status || null;
    row.is_successful = isConnectedCall(status.toLowerCase(), duration);
    row.event_time = parseGhlTime(pick(cd, "call.start_time")) ?? row.event_time;
  } else if (eventType === "appointment") {
    const ap = nativeType ? body.appointment ?? body : null;
    const start = parseGhlTime(pick(cd, "appointment.start_time", "start_time") ?? ap?.startTime ?? ap?.start_time);
    row.appt_id = pick(cd, "appointment.id") ?? ap?.id ?? ap?.appointmentId ?? null;
    row.appt_status = pick(cd, "appointment.status", "status") ?? ap?.appointmentStatus ?? ap?.status ?? null;
    row.appt_start_time = start;
    row.appt_end_time = parseGhlTime(pick(cd, "appointment.end_time", "end_time") ?? ap?.endTime ?? ap?.end_time);
    row.user_id = pick(cd, "appointment.user_id", "user_id") ?? ap?.assignedUserId ?? ap?.userId ?? ap?.user?.id ?? null;
    row.user_name = pick(cd, "appointment.user_name", "user_name") ?? ap?.user?.name ?? null;
    row.event_time = start ?? row.event_time;
  }
  // opportunity / contact / user: stored with raw for now (real-time features later).

  try {
    const { error } = await supabaseDashboard().from("webhook_events").insert(row);
    if (error) throw new Error(error.message);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, client: clientSlug, type: eventType });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "ghl-webhook", accepts: "POST" });
}
