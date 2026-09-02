import Link from "next/link";
import { RANGE_OPTIONS } from "@/lib/dates";
import { clientHref } from "@/lib/url";
import { fmtRelative } from "@/lib/format";
import type { ClientConfig } from "@/lib/clients";
import { LiveRefresh } from "./LiveRefresh";
import { SyncControl } from "./SyncControl";

function Monogram({ code }: { code: string }) {
  return (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white"
      style={{ background: "var(--color-ivy)" }}
    >
      <span className="text-[0.78rem] font-bold tracking-tight">{code}</span>
    </span>
  );
}

export function Header({
  client,
  preset,
  fromValue,
  toValue,
  lastSyncAt,
  sp,
  activePipeline,
}: {
  client: ClientConfig;
  preset: string;
  fromValue?: string;
  toValue?: string;
  lastSyncAt: string | null;
  sp: Record<string, string | string[] | undefined>;
  activePipeline?: string | null;
}) {
  const code = client.code || client.slug.toUpperCase().slice(0, 3);
  return (
    <header className="reveal flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <Monogram code={code} />
        <div>
          <h1 className="text-lg font-semibold leading-none text-ink">{client.name}</h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-[0.8rem] text-ink-soft">
            <span>Performance Comercial</span>
            {client.city && (
              <>
                <span className="text-ink-faint">·</span>
                <span>{client.city}</span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <nav className="range-group">
          {RANGE_OPTIONS.map((o) => (
            <Link
              key={o.value}
              href={clientHref(client.slug, sp, { range: o.value, from: undefined, to: undefined })}
              scroll={false}
              prefetch={false}
              className="range-link"
              data-active={o.value === preset}
            >
              {o.label}
            </Link>
          ))}
        </nav>

        <form method="GET" action={`/${client.slug}`} className="flex items-center gap-1.5">
          {activePipeline && <input type="hidden" name="pipeline" value={activePipeline} />}
          <input
            type="date"
            name="from"
            defaultValue={fromValue}
            aria-label="De"
            className="rounded-md border border-line bg-card px-2 py-1 text-xs text-ink-soft [color-scheme:light]"
          />
          <span className="text-xs text-ink-faint">–</span>
          <input
            type="date"
            name="to"
            defaultValue={toValue}
            aria-label="Até"
            className="rounded-md border border-line bg-card px-2 py-1 text-xs text-ink-soft [color-scheme:light]"
          />
          <button
            type="submit"
            className="rounded-md border border-line bg-paper-2 px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:text-ink"
            data-active={preset === "custom"}
          >
            Aplicar
          </button>
        </form>

        <div className="flex items-center gap-1.5 text-xs text-ink-faint">
          <span className="live-dot" />
          <span>{fmtRelative(lastSyncAt)}</span>
        </div>
        <SyncControl slug={client.slug} lastSyncAt={lastSyncAt} />
      </div>
      <LiveRefresh />
    </header>
  );
}
