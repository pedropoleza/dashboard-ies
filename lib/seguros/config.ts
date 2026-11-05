// ─── Perfil "seguros": o mapa da conta ──────────────────────────────────────
//
// Este arquivo traduz o que a cliente pediu para onde o dado realmente vive no
// GHL. Ele mora no código, e não na tabela `clients`, de propósito: são ids de
// estágio que, se mudarem em silêncio, quebram número. No código eles são
// revisáveis, versionados e conferidos pelo script de reconciliação.
//
// Um segundo cliente do mesmo ramo entra aqui como uma nova entrada.

export type PapelDePipeline = "prospects" | "policies" | "recruiting" | "agency";

export type ConfigSeguros = {
  /** pipeline do GHL por papel */
  pipelines: Record<PapelDePipeline, string>;
  /** calendários que contam como reunião de prospecção e de recrutamento */
  calendarios: { prospect: string[]; recruiting: string[] };
  /** estágios que carregam significado de negócio */
  estagios: {
    /** virou cliente dentro do funil de prospecção */
    clienteAtivo: string;
    /** saiu do funil por desinteresse (não é perda de negócio, é descarte) */
    naoInteressado: string[];
    /** candidato virou agente */
    registrado: string;
    /** agente parado */
    agenteInativo: string;
  };
  /** campos personalizados da oportunidade, preenchidos pelo sync do Five Rings */
  campos: {
    /** quando a apólice foi emitida (Issued Date) */
    emissaoApolice: string;
    /** Inforce, Lapsed, Declined, Not Taken, Incomplete */
    statusApolice: string;
    /** Active ou Inactive */
    statusAgente: string;
    /** data real em que o agente começou */
    inicioAgente: string;
  };
  /** status de apólice que nunca chegou a ser emitida, em minúsculas. Lapsed não entra:
   *  ela foi emitida e caiu depois, e o número pedido é o de emissões. */
  apoliceNaoEmitida: string[];
  /** a escada de carreira, na ordem, com o id do estágio */
  carreira: { id: string; nome: string; curto: string }[];
  /**
   * De tag para origem. A conta não usa `source` (4 de 125 leads preenchidos),
   * e as tags misturam três eixos: origem, temperatura (frio/morno/quente) e
   * classificação (prospect-seguro, active client). Só o que está aqui vira
   * origem; o resto cai em "sem origem" e aparece como tal, em vez de virar
   * atribuição inventada.
   */
  origemPorTag: Record<string, string>;
};

const ELIANE: ConfigSeguros = {
  pipelines: {
    prospects: "pNdcs7yI8ftr4fCEA1yF",
    policies: "iRtCRZQww1qV6m3nAezT",
    recruiting: "IsCc4xeHMFcfhLfpiBeV",
    agency: "RJhGPwWjWrPf21IOSwNo",
  },
  calendarios: {
    // 1.1 Primeiro Encontro · 1.2 Segundo Encontro · 2 Alinhamento com Cliente
    prospect: ["BI0DyGHUfTIByH3TirhI", "bL298R9zmYRZorrFRjmy", "jojd5qDLsUp1LMtTQztB"],
    // 3 Recrutamento
    recruiting: ["Yfw0rx02wYryDR7ZHZha"],
  },
  estagios: {
    clienteAtivo: "ad73e1b2-a1fe-41f2-9b87-758e05b5e8c2",
    naoInteressado: [
      "6b636b85-c6c3-4911-b4a5-63b61cd4a314", // Prospects
      "3653c947-2d43-4c40-b02e-4c50385ce605", // Recruiting
    ],
    registrado: "69da0f27-1c5c-4950-a1aa-b0cc18371bfe",
    agenteInativo: "142c54b9-63da-41c5-848f-98a2a9039e59",
  },
  campos: {
    emissaoApolice: "y4Z12LjPJqNvaiHBYqKd",
    statusApolice: "EAHat0M6jDhbPIagbsEe",
    statusAgente: "K9mXgAp2vQG4sN9w9M7L",
    inicioAgente: "jmnofrbsvrpztZqVRTZW",
  },
  apoliceNaoEmitida: ["declined", "not taken", "incomplete"],
  carreira: [
    { id: "c7810e12-aaeb-48c7-a553-f828a4117914", nome: "Proposed Agent", curto: "Proposto" },
    { id: "578472a9-aafc-4615-bb24-b5c1c717915d", nome: "Studying", curto: "Estudando" },
    { id: "d74cd8a8-21e6-466b-bc80-e0db47fd8cf9", nome: "Agent (45%)", curto: "Agent" },
    { id: "5566f64d-19f3-4403-bc5b-766090696a89", nome: "District Leader (50%)", curto: "District" },
    { id: "cac7a19a-0725-4f02-81d4-8a2bbc91399e", nome: "Division Leader (55%)", curto: "Division" },
    { id: "5fb11b8e-3874-433f-a762-26f162f8c84b", nome: "Regional Leader (60%)", curto: "Regional" },
    { id: "0f194f17-9275-429a-addc-87bef35c5b97", nome: "Agency Vice President (65%)", curto: "Agency VP" },
    { id: "c4266c3f-4b4a-4d72-ad27-81f6bb3ffb01", nome: "Regional Vice President (70%)", curto: "Regional VP" },
    { id: "66d08bab-fa96-4f8b-950b-46bc48552cff", nome: "National Vice President (80%)", curto: "National VP" },
    { id: "7338216e-0cec-4a94-ae1f-f4c8c42b7a86", nome: "Senior Vice President (85%)", curto: "Senior VP" },
    { id: "d71fd195-6662-4c6d-b485-748c2570783a", nome: "Executive Vice President (90%)", curto: "Executive VP" },
  ],
  origemPorTag: {
    "indicação": "Indicação",
    "indicacao": "Indicação",
    "evento": "Evento",
    "instagram": "Instagram",
    "facebook": "Facebook",
    "metaads": "Meta Ads",
    "meta ads": "Meta Ads",
    "campanha trafego": "Meta Ads",
    // a campanha do Instagram de outubro chega por clique no anúncio para o WhatsApp
    "ctwa-lead": "Meta Ads",
    "anuncio": "Meta Ads",
    "anuncio-facebook": "Meta Ads",
    "b2b": "B2B",
    "parceria": "Parceria",
    "personal contact": "Contato pessoal",
    "pessoal": "Contato pessoal",
    "direct agent": "Agente direto",
    "indirect agent": "Agente indireto",
    "contato desconhecido": "Desconhecido",
  },
};

const PERFIS: Record<string, ConfigSeguros> = { eliane: ELIANE };

export function configSeguros(slug: string): ConfigSeguros | null {
  return PERFIS[slug] ?? null;
}
