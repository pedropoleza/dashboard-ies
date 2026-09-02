import Link from "next/link";
import { clientHref } from "@/lib/url";
import { GERAL, type ClientConfig } from "@/lib/clients";

export function PipelineTabs({
  client,
  activeId,
  sp,
}: {
  client: ClientConfig;
  activeId: string | null; // null = Geral
  sp: Record<string, string | string[] | undefined>;
}) {
  if (client.pipelines.length < 2) return null;
  const tabs = [{ id: GERAL, label: "Geral" }, ...client.pipelines.map((p) => ({ id: p.id, label: p.label }))];

  return (
    <nav className="reveal -mb-px flex items-center gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => {
        const active = t.id === GERAL ? activeId === null : t.id === activeId;
        return (
          <Link
            key={t.id}
            href={clientHref(client.slug, sp, { pipeline: t.id })}
            scroll={false}
            prefetch={false}
            className="-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors"
            style={
              active
                ? { borderColor: "var(--color-ivy)", color: "var(--color-ink)" }
                : { borderColor: "transparent", color: "var(--color-ink-faint)" }
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
