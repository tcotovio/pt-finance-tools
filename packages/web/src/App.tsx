import "./App.css";
import { WageCalculator } from "./components/WageCalculator.js";

export default function App() {
  return (
    <div className="app">
      <header className="site-header">
        <p className="eyebrow">Ferramentas financeiras · Portugal</p>
        <h1>Salário líquido 2026</h1>
        <p className="lede">
          Quanto recebe ao fim do mês, com as tabelas de retenção na fonte de
          2026 e as regras do subsídio de alimentação, dos duodécimos e do IRS
          Jovem.
        </p>
      </header>

      <main>
        <WageCalculator />
      </main>

      <footer className="site-footer">
        <p>
          O cálculo corre inteiramente no seu dispositivo — nenhum dado sai do
          navegador.
        </p>
        <p>
          Simulação da retenção na fonte mensal, não do acerto anual de IRS.
          Não constitui aconselhamento financeiro.
        </p>
      </footer>
    </div>
  );
}
