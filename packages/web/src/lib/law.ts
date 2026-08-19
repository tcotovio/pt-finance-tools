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
  "cirs-99c-8": {
    label: "art. 99.º-C n.º 8 do CIRS",
    title: "Trabalho suplementar: metade da taxa",
    summary:
      "A retenção sobre trabalho suplementar é autónoma e feita a metade da taxa efetiva do mês — desde a primeira hora, depois de a Lei n.º 45-A/2024 ter eliminado o limite das 100 horas. Não faz o salário subir de escalão, mas conta para a Segurança Social como qualquer remuneração.",
  },
  "cirs-99f-4": {
    label: "art. 99.º-F n.º 4 do CIRS",
    title: "Como o IRS Jovem entra na retenção",
    summary:
      "A taxa de retenção é a que corresponde à totalidade do rendimento, parte isenta incluída, mas aplica-se apenas à parte não isenta. A isenção reduz a base sobre que o imposto incide, não a taxa — quem ganha mais continua a ter a taxa do seu salário real.",
  },
  "bdp-1-2026": {
    label: "Recomendação n.º 1/2026 do Banco de Portugal",
    title: "Limites ao crédito à habitação",
    summary:
      "Aplica-se aos contratos cuja avaliação de solvabilidade ocorra a partir de 1 de agosto de 2026. A prestação, testada com uma subida da taxa de juro, não deve passar 45 % do rendimento; o empréstimo não deve exceder 90 % do imóvel na habitação própria e permanente (80 % nas restantes finalidades); e o prazo não deve exceder 40 anos até aos 35 anos de idade, ou 35 anos acima disso. São recomendações às instituições, não direitos do consumidor: cada banco aplica ainda os seus próprios critérios.",
    url: "https://www.bportugal.pt/sites/default/files/documents/2026-07/Recomendacao_Macroprudencial_n.1-2026.pdf",
  },
  "instrucao-23-2023": {
    label: "Instrução n.º 23/2023 do Banco de Portugal",
    title: "O choque de taxa de juro",
    summary:
      "A taxa de esforço não é calculada à taxa do contrato, mas a uma taxa agravada: mais 0,5 pontos percentuais em contratos até 5 anos, mais 1 ponto entre 5 e 10 anos, e mais 1,5 pontos acima de 10 anos. Só a prestação do novo crédito é agravada — as dos créditos que já tem contam pelo valor real.",
    url: "https://www.bportugal.pt/instrucao/232023",
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
