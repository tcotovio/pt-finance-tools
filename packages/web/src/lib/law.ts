// The statutes the result cites, in plain Portuguese.
//
// Every rule the engine applies comes from somewhere, and the citation is
// only useful to someone who already knows the article. Each entry pairs the
// reference with what it actually says.
//
// On links: the Diário da República renders its consolidated codes
// client-side, and a wrong link is worse than none — so every URL here was
// checked by RENDERING the page, never by a status code. That distinction is
// not pedantry: dre.pt answers 200 for URLs that then route to "A página não
// se encontra disponível", so curl reports success on a dead link.
//
// The links point at the consolidated CODE, not the individual article: the
// article anchors are generated client-side and could not be verified the
// same way. The citation in `label` names the article; the link gets the
// reader to the right instrument. Entries with no verified URL carry none —
// the Código Contributivo is currently one of those.

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
    url: "https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2014-70048167",
  },
  "cc-53": {
    // No verified URL: the consolidated Código dos Regimes Contributivos was
    // not locatable at a URL that renders, and guessing one is exactly the
    // failure this comment block warns about.
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
    url: "https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2009-34546475",
  },
  "cirs-99c-5": {
    label: "art. 99.º-C n.º 5 do CIRS",
    title: "Os subsídios são retidos à parte",
    summary:
      "Os subsídios de férias e de Natal são sempre objeto de retenção autónoma: para calcular o imposto a reter não são somados à remuneração do mês em que são pagos. Um duodécimo nunca empurra o salário para um escalão mais alto — nem o contrário.",
    url: "https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2014-70048167",
  },
  "cirs-99c-8": {
    label: "art. 99.º-C n.º 8 do CIRS",
    title: "Trabalho suplementar: metade da taxa",
    summary:
      "A retenção sobre trabalho suplementar é autónoma e feita a metade da taxa efetiva do mês — desde a primeira hora, depois de a Lei n.º 45-A/2024 ter eliminado o limite das 100 horas. Não faz o salário subir de escalão, mas conta para a Segurança Social como qualquer remuneração.",
    url: "https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2014-70048167",
  },
  "cirs-99f-4": {
    label: "art. 99.º-F n.º 4 do CIRS",
    title: "Como o IRS Jovem entra na retenção",
    summary:
      "A taxa de retenção é a que corresponde à totalidade do rendimento, parte isenta incluída, mas aplica-se apenas à parte não isenta. A isenção reduz a base sobre que o imposto incide, não a taxa — quem ganha mais continua a ter a taxa do seu salário real.",
    url: "https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2014-70048167",
  },
  "bdp-1-2026": {
    label: "Recomendação n.º 1/2026 do Banco de Portugal",
    title: "Limites ao crédito à habitação",
    summary:
      "Aplica-se aos contratos cuja avaliação de solvabilidade ocorra a partir de 1 de agosto de 2026. A prestação, testada com uma subida da taxa de juro, não deve passar 45 % do rendimento; o empréstimo não deve exceder 90 % do imóvel na habitação própria e permanente (80 % nas restantes finalidades); e o prazo não deve exceder 40 anos até aos 35 anos de idade, ou 35 anos acima disso. São recomendações às instituições, não direitos do consumidor: cada banco aplica ainda os seus próprios critérios.",
    url: "https://www.bportugal.pt/sites/default/files/documents/2026-07/Recomendacao_Macroprudencial_n.1-2026.pdf",
  },
  "bdp-1-2026-consumo": {
    label: "Recomendação n.º 1/2026 do Banco de Portugal",
    title: "Prazos máximos no crédito ao consumo",
    summary:
      "No crédito ao consumo, o prazo recomendado não deve exceder 7 anos no crédito pessoal e 10 anos no crédito automóvel. O crédito pessoal destinado a educação, saúde ou transição energética pode ir até 10 anos, desde que a instituição comprove essa finalidade. A taxa de esforço máxima de 45 % aplica-se a todo o crédito, não só ao da habitação; o limite de financiamento sobre o imóvel (LTV) não se aplica aqui, porque não há imóvel dado em garantia.",
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
  // The tax entries below link to the Autoridade Tributária's own consolidated
  // code pages rather than to the Diário da República. Not a preference: DRE
  // renders its consolidated codes client-side, so those URLs return an empty
  // document to anything that is not a browser and could not be verified the
  // way this file requires. AT's pages are official, they serve the article
  // text server-side, and — unlike the DRE links elsewhere in this file — they
  // address the individual ARTICLE, which is what the citation names.
  "cimt-9": {
    label: "art. 9.º n.º 2 do CIMT",
    title: "IMT Jovem: isenção na primeira casa",
    summary:
      "Isenta de IMT a primeira aquisição de habitação própria e permanente por quem tenha 35 anos ou menos à data da escritura e não seja dependente para efeitos de IRS nesse ano, desde que o valor tributável não passe o topo do 1.º escalão da tabela dos jovens — 330 539 € em 2026. Acima desse valor não desaparece o benefício: passa a aplicar-se a tabela reduzida do art. 17.º n.º 1 al. b), que só tributa o excedente.",
    url: "https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cimt/Pages/cimt9.aspx",
  },
  "cimt-12": {
    label: "art. 12.º n.º 1 do CIMT",
    title: "Sobre que valor incide o IMT",
    summary:
      "«O IMT incidirá sobre o valor constante do acto ou do contrato ou sobre o valor patrimonial tributário dos imóveis, consoante o que for maior.» Repare que é o MAIOR dos dois — ao contrário do limite de financiamento do banco, que toma o MENOR entre o preço e a avaliação. Se o VPT do imóvel for superior ao preço que pagou, é sobre o VPT que paga imposto.",
    url: "https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cimt/Pages/cimt12.aspx",
  },
  "cimt-17": {
    label: "art. 17.º do CIMT",
    title: "As taxas do IMT",
    summary:
      "Fixa os escalões e as taxas. Habitação própria e permanente, jovens até aos 35 anos, e restante habitação têm tabelas próprias, com escalões 25 % mais altos nas Regiões Autónomas. Nos escalões de topo a taxa é única e incide sobre o valor todo, não apenas sobre o excedente — por isso, ao passar de 660 982 € para 660 983 €, o imposto sobe cerca de 544 €. Não é um erro de cálculo: é o que a tabela diz.",
    url: "https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cimt/Pages/cimt17.aspx",
  },
  "cis-tgis": {
    label: "verbas 1.1 e 17 da Tabela Geral do Imposto do Selo",
    title: "O imposto do selo na compra e no crédito",
    summary:
      "São dois selos diferentes e ambos se pagam na escritura: a verba 1.1 cobra 0,8 % sobre o mesmo valor em que incide o IMT, e a verba 17.1 cobra sobre o capital do empréstimo — 0,6 % em contratos de cinco anos ou mais, 0,5 % entre um e cinco anos. A verba 17.3.1 cobraria ainda 4 % sobre os juros, mas não se aplica ao crédito à habitação própria.",
    url: "https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/selo/Pages/ccod-selo-tabgiselo.aspx",
  },
  "cis-7-1-l": {
    label: "art. 7.º n.º 1 al. l) do CIS",
    title: "Os juros da casa não pagam selo",
    summary:
      "Isenta de imposto do selo «os juros cobrados por empréstimos para aquisição, construção, reconstrução ou melhoramento de habitação própria». É por isso que os 4 % da verba 17.3.1 não entram na conta do seu crédito — não é um esquecimento da simulação, é uma isenção. Num crédito que não seja para habitação própria, esses 4 % sobre os juros são devidos.",
    url: "https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/selo/Pages/selo7.aspx",
  },
  "cis-7a": {
    label: "art. 7.º-A do CIS",
    title: "A dedução do selo para jovens",
    summary:
      "Quem beneficia do IMT Jovem deduz também o imposto do selo da verba 1.1, até à sua concorrência, com o limite de 0,8 % aplicado ao topo do 1.º escalão da tabela dos jovens — 2 644,31 € em 2026. Abaixo desse escalão a dedução cobre o selo todo e paga zero; acima, é uma dedução com tecto, não uma isenção, e paga a diferença.",
    url: "https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/selo/Pages/selo7a.aspx",
  },
  "dl-48a-2024": {
    label: "Decreto-Lei n.º 48-A/2024, de 25 de julho",
    title: "Onde nasceu o IMT Jovem",
    summary:
      "Isenta de IMT e de imposto do selo a compra de habitação própria e permanente por jovens até aos 35 anos, alterando os dois códigos: aditou o n.º 2 do art. 9.º e a tabela da al. b) do n.º 1 do art. 17.º ao Código do IMT, e o art. 7.º-A ao Código do Imposto do Selo. As condições são cumulativas e o banco verifica-as — a simulação toma-as como declaração sua.",
    url: "https://files.diariodarepublica.pt/1s/2024/07/14301/0000200006.pdf",
  },
  "dl-48d-2024": {
    label: "Decreto-Lei n.º 48-D/2024, de 31 de julho",
    title: "A redução dos emolumentos do registo",
    summary:
      "Completa a isenção fiscal com uma isenção de emolumentos no registo da primeira aquisição e da hipoteca, para quem tenha até 35 anos e um imóvel que não passe o topo do 4.º escalão da tabela geral do IMT. Quando se usa o balcão único (Casa Pronta), a lei não isenta: reduz os emolumentos do procedimento em 450 € se for registado mais do que um facto — o caso de qualquer compra com crédito. Fica a pagar, não fica isento.",
    url: "https://files.diariodarepublica.pt/1s/2024/07/14701/0000700010.pdf",
  },
  "dl-44-2024": {
    label: "Decreto-Lei n.º 44/2024, de 10 de julho",
    title: "A garantia do Estado até aos 35 anos",
    summary:
      "Permite ao Estado ser fiador de parte do crédito, até 15 % do valor da transação, para viabilizar o financiamento a 100 % na primeira habitação própria e permanente de quem tenha entre 18 e 35 anos. Condições: rendimentos até ao 8.º escalão do IRS, não ser proprietário de outro imóvel habitacional, e não usar a garantia mais do que uma vez. Atenção ao que isto é e não é: a recomendação do Banco de Portugal continua a fixar o limite em 90 %, e financiar 100 % é um desvio que cada banco decide caso a caso — não é um direito.",
    url: "https://files.diariodarepublica.pt/1s/2024/07/13200/0000300004.pdf",
  },
  "portaria-236a-2024": {
    // No verified URL: the Portaria lives in a Suplemento whose PDF path could
    // not be located, and the DRE detail page renders client-side — the exact
    // failure this file's header warns about. Cited without a link rather than
    // guessed, like the Código Contributivo above.
    label: "Portaria n.º 236-A/2024/1, de 27 de setembro",
    title: "As condições da garantia do Estado",
    summary:
      "Regulamenta o Decreto-Lei n.º 44/2024: o valor da transação não pode exceder 450 000 €, a garantia não pode passar 15 % desse valor, e dura no máximo 10 anos a contar do contrato. A garantia não é dinheiro do Estado — é uma fiança: se conseguir pagar, o Estado nunca desembolsa nada.",
  },
  "casa-pronta": {
    label: "Casa Pronta — Regulamento Emolumentar dos Registos e Notariado",
    title: "Escritura e registos no balcão único",
    summary:
      "O balcão único faz a escritura e os registos num só ato, a preço fixo: 375 € quando há um só registo (uma compra sem crédito) e 700 € quando há mais do que um, que é o caso de qualquer compra com hipoteca, mais 50 € por cada prédio adicional. É um valor mínimo, não uma estimativa: a alternativa — notário e registos em separado — custa mais.",
    url: "https://justica.gov.pt/Servicos/Casa-Pronta",
  },
} as const satisfies Record<string, LawReference>;

export type LawReferenceId = keyof typeof LAW_REFERENCES;

export function lawReference(id: LawReferenceId): LawReference {
  return LAW_REFERENCES[id];
}
