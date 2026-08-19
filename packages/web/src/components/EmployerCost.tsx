// What the month costs the employer.
//
// Secondary to the worker's own number, so it collapses — but the total is
// in the summary, visible without opening anything.

import type { EmployerCost as EmployerCostData } from "../lib/breakdown.js";
import { formatEuro, formatRate } from "../lib/format.js";
import { LawReference } from "./LawReference.js";

interface EmployerCostProps {
  employer: EmployerCostData;
}

export function EmployerCost({ employer }: EmployerCostProps) {
  return (
    <details className="employer">
      <summary>
        <span className="employer-title">Custo para a empresa</span>
        <span className="employer-total num">{formatEuro(employer.total)}</span>
      </summary>

      <div className="employer-body">
        <dl className="lines">
          <div className="line">
            <dt>Remuneração paga</dt>
            <dd className="num">{formatEuro(employer.remuneration)}</dd>
          </div>
          <div className="line">
            <dt>
              Segurança Social — entidade empregadora
              <span className="line-note">
                <span>
                  {formatRate(employer.socialSecurityRate)} sobre a remuneração
                  sujeita a contribuições
                </span>
                <LawReference id="cc-53" />
              </span>
            </dt>
            <dd className="num">{formatEuro(employer.socialSecurity)}</dd>
          </div>
          <div className="line is-total">
            <dt>Custo total do mês</dt>
            <dd className="num">{formatEuro(employer.total)}</dd>
          </div>
        </dl>

        {employer.multipleOfNet > 0 ? (
          <p className="employer-ratio">
            A empresa gasta{" "}
            <strong className="num">
              {employer.multipleOfNet.toLocaleString("pt-PT", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              ×
            </strong>{" "}
            o valor que lhe chega à mão.
          </p>
        ) : null}

        <p className="employer-note">
          Custo direto. Não inclui o seguro de acidentes de trabalho
          (obrigatório, com taxa variável consoante a atividade), medicina no
          trabalho, formação nem outros encargos — nenhum deles tem uma taxa
          fixada por lei que se possa aplicar aqui.
        </p>
      </div>
    </details>
  );
}
