// The statutes the result cites, in plain Portuguese.
//
// Every rule the engine applies comes from somewhere, and the citation is
// only useful to someone who already knows the article. Each entry pairs the
// reference with what it actually says.
//
// On links: the Diário da República renders its consolidated codes
// client-side, so per-article URLs cannot be verified from here — and a link
// pointing at the wrong article is worse than none. Only sources whose URL is
// already verified in the repo carry one; the rest explain themselves.

export interface LawReference {
  /** As cited inline, e.g. "art. 99.º-C n.º 5 do CIRS". */
  label: string;
  /** Short heading for the explanation. */
  title: string;
  /** What the article says, in plain Portuguese. */
  summary: string;
  /** Official source, when there is a verified one to point at. */
  url?: string;
}

export const LAW_REFERENCES = {
  "cirs-12b": {
    label: "art. 12.º-B do CIRS",
    title: "IRS Jovem",
    summary:
      "Isenta parte dos rendimentos do trabalho nos primeiros 10 anos de rendimentos: 100 % no 1.º ano, 75 % do 2.º ao 4.º, 50 % do 5.º ao 7.º e 25 % do 8.º ao 10.º, até um limite anual de 55 × IAS.",
  },
  "cc-53": {
    label: "art. 53.º do Código Contributivo",
    title: "Taxa contributiva global",
    summary:
      "A taxa contributiva do regime geral dos trabalhadores por conta de outrem é de 34,75 %: 23,75 % a cargo da entidade empregadora e 11 % a cargo do trabalhador. Ambas incidem sobre a mesma base — a remuneração sujeita a contribuições.",
  },
  "ct-265": {
    label: "art. 265.º do Código do Trabalho",
    title: "Retribuição por isenção de horário",
    summary:
      "Quem trabalha em regime de isenção de horário tem direito a uma retribuição específica, fixada no instrumento de regulamentação coletiva ou, na falta dele, não inferior a uma hora de trabalho suplementar por dia (duas horas por semana, no regime com observância do período normal de trabalho). Para IRS e Segurança Social conta como remuneração normal.",
  },
  "cirs-99c-5": {
    label: "art. 99.º-C n.º 5 do CIRS",
    title: "Os subsídios são retidos à parte",
    summary:
      "Os subsídios de férias e de Natal são sempre objeto de retenção autónoma: para calcular o imposto a reter não são somados à remuneração do mês em que são pagos. Um duodécimo nunca empurra o salário para um escalão mais alto — nem o contrário.",
  },
  "cirs-99f-4": {
    label: "art. 99.º-F n.º 4 do CIRS",
    title: "Como o IRS Jovem entra na retenção",
    summary:
      "A taxa de retenção é a que corresponde à totalidade do rendimento, parte isenta incluída, mas aplica-se apenas à parte não isenta. A isenção reduz a base sobre que o imposto incide, não a taxa — quem ganha mais continua a ter a taxa do seu salário real.",
  },
  "despacho-233a-2026": {
    label: "Despacho n.º 233-A/2026",
    title: "Tabelas de retenção para 2026",
    summary:
      "Fixa as tabelas de retenção na fonte de 2026 e as regras de aplicação, incluindo o limite de isenção do IRS Jovem por pagamento: o teto anual dividido por 14 (12 salários e os dois subsídios).",
    // The same PDF the Continente 2026 dataset was transcribed from, and
    // whose transcription is re-diffed in CI.
    url: "https://files.diariodarepublica.pt/2s/2026/01/003000001/0000200010.pdf",
  },
} as const satisfies Record<string, LawReference>;

export type LawReferenceId = keyof typeof LAW_REFERENCES;

export function lawReference(id: LawReferenceId): LawReference {
  return LAW_REFERENCES[id];
}
