import { useState } from "react";
import "./App.css";
import { WageCalculator } from "./components/WageCalculator.js";
import { LoanCalculator } from "./components/LoanCalculator.js";
import { ConsumerCalculator } from "./components/ConsumerCalculator.js";

type Tool = "wage" | "loan" | "consumer";

const TOOLS = {
  wage: {
    tab: "Salário líquido",
    title: "Salário líquido 2026",
    lede: "Quanto recebe ao fim do mês, com as tabelas de retenção na fonte de 2026 e as regras do subsídio de alimentação, dos duodécimos e do IRS Jovem.",
  },
  loan: {
    tab: "Crédito habitação",
    title: "Quanto posso pedir",
    lede: "O máximo que pode financiar, com os limites do Banco de Portugal em vigor desde 1 de agosto de 2026 — taxa de esforço, valor do imóvel e prazo por idade.",
  },
  consumer: {
    tab: "Crédito ao consumo",
    title: "Crédito pessoal e automóvel",
    lede: "Quanto pode pedir num crédito pessoal ou automóvel, com a taxa de esforço e os prazos máximos por finalidade que o Banco de Portugal recomenda desde 1 de agosto de 2026.",
  },
} as const satisfies Record<Tool, { tab: string; title: string; lede: string }>;

export default function App() {
  const [tool, setTool] = useState<Tool>("wage");
  const active = TOOLS[tool];

  return (
    <div className="app">
      <header className="site-header">
        <p className="eyebrow">Ferramentas financeiras · Portugal</p>
        <h1>{active.title}</h1>
        <p className="lede">{active.lede}</p>
      </header>

      {/*
        A tablist rather than routes: two tools, no deep links to preserve
        yet, and switching keeps each form's state alive in its own component.
      */}
      <nav className="tools" aria-label="Ferramentas">
        <div className="tool-tabs" role="tablist">
          {(Object.keys(TOOLS) as Tool[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={tool === key}
              aria-controls={`panel-${key}`}
              className={`tool-tab${tool === key ? " is-active" : ""}`}
              onClick={() => setTool(key)}
            >
              {TOOLS[key].tab}
            </button>
          ))}
        </div>
      </nav>

      <main
        id={`panel-${tool}`}
        role="tabpanel"
        aria-labelledby={`tab-${tool}`}
        tabIndex={-1}
      >
        {tool === "wage" ? (
          <WageCalculator />
        ) : tool === "loan" ? (
          <LoanCalculator />
        ) : (
          <ConsumerCalculator />
        )}
      </main>

      <footer className="site-footer">
        <p>
          O cálculo corre inteiramente no seu dispositivo — nenhum dado sai do
          navegador.
        </p>
        <p>
          Simulações, não aconselhamento financeiro. A retenção na fonte não é
          o imposto final, e os limites ao crédito são recomendações às
          instituições, não direitos do consumidor.
        </p>
      </footer>
    </div>
  );
}
