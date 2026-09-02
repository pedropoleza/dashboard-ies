import { redirect } from "next/navigation";

// Multi-client base: the root sends visitors to the default client dashboard.
// Each client is served at /<slug> (e.g. /ies) — that's the URL embedded in GHL.
export default function Home() {
  redirect(`/${process.env.DEFAULT_CLIENT ?? "ies"}`);
}
