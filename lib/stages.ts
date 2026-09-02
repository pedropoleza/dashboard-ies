// Stage colors keyed by pipeline position (New Lead → Deal Closed).
// Disciplined cobalt sequence that deepens down the funnel; the won stage
// lands on a muted green. Enterprise-restrained, not a rainbow.
const STAGE_PALETTE = [
  "#a8bbf4", // 0 New Lead
  "#879ff0", // 1 Lead Replied
  "#6685ec", // 2 Follow-up
  "#476ee8", // 3 In Contact
  "#2f54eb", // 4 Appointment Booked
  "#2645c5", // 5 No-show (Reschedule)
  "#1e3aa3", // 6 Appointment Completed
  "#15803d", // 7 Deal Closed — won
];

export function stageColor(position: number): string {
  const i = Math.max(0, Math.min(STAGE_PALETTE.length - 1, position));
  return STAGE_PALETTE[i];
}

// Muted, harmonious categorical palette (enterprise, not bright primaries).
export const SOURCE_COLORS: Record<string, string> = {
  "Tráfego Pago": "#3056d3",
  "Landing Page": "#0e8aa0",
  Indicação: "#c1812f",
  "Contato Manual": "#6f5bd0",
  "Lista / Base": "#5b6675",
  "Walk-in": "#b8567f",
  "E-mail": "#2f9e8f",
  Outros: "#98a2b3",
  Desconhecido: "#cdd3dc",
};

export function sourceColor(category: string): string {
  return SOURCE_COLORS[category] ?? "#9aa39a";
}
