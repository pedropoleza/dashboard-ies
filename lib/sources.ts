export type Attribution = {
  utmSessionSource?: string | null;
  adSource?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
};

export const SOURCE_CATEGORIES = [
  "Tráfego Pago",
  "Landing Page",
  "Indicação",
  "Contato Manual",
  "Lista / Base",
  "Walk-in",
  "E-mail",
  "Outros",
  "Desconhecido",
] as const;

export type SourceCategory = (typeof SOURCE_CATEGORIES)[number];

/**
 * Normalize GHL's messy free-text `source` (+ UTM attribution) into a stable
 * category. `agentFirstNames` lets us catch "manual contact" rows whose source
 * is just an SDR's first name (e.g. "Tais", "lead simone", "Contato Mila").
 *
 * Rule order matters — earlier rules win. Tuned against the IES account's
 * real source values; adjust freely as new patterns appear.
 */
export function normalizeSource(
  raw: string | null | undefined,
  attr: Attribution | undefined,
  agentFirstNames: Set<string>,
): SourceCategory {
  const s = (raw ?? "").toLowerCase().trim();
  const ad = (attr?.adSource ?? "").toLowerCase();
  const uss = (attr?.utmSessionSource ?? "").toLowerCase();
  const us = (attr?.utmSource ?? "").toLowerCase();
  const um = (attr?.utmMedium ?? "").toLowerCase();

  const paidUtm =
    uss.includes("paid") ||
    ad.includes("facebook") ||
    ad.includes("instagram") ||
    ad.includes("meta") ||
    (!!us && (um.includes("cpc") || um.includes("ppc") || um.includes("paid")));

  if (!s || s === "(none)") {
    return paidUtm || ad || us ? "Tráfego Pago" : "Desconhecido";
  }

  // Walk-in / presencial
  if (/walk\s*-?\s*in|presencial/.test(s)) return "Walk-in";

  // Landing page submissions ("LP/PT", "LP/ES/F1", "Landing Page PT")
  if (/^lp[\s/\-]/.test(s) || /landing\s*page/.test(s)) return "Landing Page";

  // Imported lists / bulk (Zenvia, mailing lists)
  if (/\b(lista|base|zenvia|mailing)\b/.test(s)) return "Lista / Base";

  // Referral / indicação (incl. affiliate "link <name>" and typos like "rferida")
  if (/(^|\b)(ref|rfer|indica|indicac|indication)/.test(s) || /\blink\b/.test(s)) return "Indicação";

  // Paid traffic via free text OR UTM attribution
  const paidText = /(meta|facebook|\bfb\b|instagram|\big\b|tiktok|google ad|\bads?\b|paid|formul)/.test(s);
  if (paidText || paidUtm) return "Tráfego Pago";

  // E-mail
  if (/e-?mail/.test(s)) return "E-mail";

  // Manual outreach by an SDR
  if (/^(contato|lead)\b/.test(s)) return "Contato Manual";
  const firstWord = s.split(/\s+/)[0];
  if (firstWord && agentFirstNames.has(firstWord)) return "Contato Manual";

  return "Outros";
}
