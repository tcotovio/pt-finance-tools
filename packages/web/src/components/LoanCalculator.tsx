// The loan calculator, in two directions.
//
// "Posso comprar esta casa?" is the original: a price goes in, the loan and
// the limits come out. "Qual é o meu limite?" is the same engine driven from
// the other end — savings go in and the price comes out — because that is the
// question most people actually arrive with, and making them guess a price and
// binary-search by hand was a bad way to answer it.
//
// Both modes need income. Beyond that they need different things, so the
// second surface field swaps rather than the form growing: a price in one, the
// entrada in the other. Everything else lives behind "O meu caso", shared.

import { useEffect, useMemo, useState } from "react";
import { euriborRate, EURIBOR_FALLBACK } from "@pt-finance-tools/engine";
import type { PurchaseCosts } from "@pt-finance-tools/engine";
import {
  computeMaxLoanSafely,
  computeMaxPriceSafely,
  type LoanOutcome,
  type MaxPriceOutcome,
} from "../lib/compute.js";
import {
  DEFAULT_LOAN_FORM,
  toMaxLoanInput,
  toMaxPriceInput,
  toPurchaseCostsInput,
  invalidFormMessage,
  validateLoanForm,
  type LoanForm,
  type LoanMode,
  type UpdateLoanForm,
} from "../lib/loan-form.js";
import { todayIso, parseAmount } from "../lib/format.js";
import { loadEuribor, type EuriborState } from "../lib/euribor-feed.js";
import { purchaseCostsForDate } from "@pt-finance-tools/engine";
import { LoanAdvancedPanel } from "./LoanAdvancedPanel.js";
import { LoanResultPanel } from "./LoanResultPanel.js";
import { PriceResultPanel } from "./PriceResultPanel.js";
import { ChoiceCards, TextField, type ChoiceCard } from "./fields.js";

/*
  The question is chosen before there is a form to fill in, not with a control
  inside one.

  As a segmented field among the other fields it read as a setting on a single
  form, which is what made the form look like it was asking two things at once.
  It is not a setting: it decides which fields exist, which number is the
  headline, and what the caption under it means. Putting it above the panel
  puts it where that authority is legible.

  The descriptions carry the actual choice. Nobody arrives knowing whether they
  want "o meu limite"; they arrive knowing whether they have a house in mind.
*/
const MODE_CARDS: readonly ChoiceCard[] = [
  {
    value: "price",
    label: "Tenho uma casa em vista",
    description: "Sei o preço, quero saber se consigo comprá-la",
  },
  {
    value: "capacity",
    label: "Ainda não tenho casa",
    description: "Sei o que tenho de parte, quero saber até quanto posso ir",
  },
];

export function LoanCalculator() {
  // Fixed for the session, like the wage side: the parameters are keyed by
  // the assessment date, and re-reading the clock per render would make the
  // result silently non-deterministic.
  const assessmentDate = useMemo(() => todayIso(), []);
  const [form, setForm] = useState<LoanForm>(DEFAULT_LOAN_FORM);

  // The bundled snapshot renders immediately; the live one replaces it when
  // it arrives. The calculator is never blocked on the network — a spinner
  // over the whole result would be a worse answer than a slightly stale one,
  // and the panel says which source it used either way.
  const [euribor, setEuribor] = useState<EuriborState>(() => ({
    snapshot: EURIBOR_FALLBACK,
    origin: "bundled",
    current: false,
  }));

  useEffect(() => {
    let cancelled = false;
    loadEuribor(assessmentDate).then((state) => {
      if (!cancelled) setEuribor(state);
    });
    return () => {
      cancelled = true;
    };
  }, [assessmentDate]);

  const indexRate = euriborRate(euribor.snapshot, form.tenor);

  const update: UpdateLoanForm = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const errors = useMemo(() => validateLoanForm(form), [form]);
  const valid = Object.keys(errors).length === 0;

  // Lifted for the same reason as on the wage side: the limit curve resamples
  // this input across contract terms.
  const input = useMemo(
    () => toMaxLoanInput(form, assessmentDate, indexRate),
    [assessmentDate, form, indexRate],
  );

  const outcome = useMemo<LoanOutcome | null>(() => {
    if (form.mode !== "price" || !input) return null;
    if (!valid) return { ok: false, message: invalidFormMessage(errors) };
    return computeMaxLoanSafely(input);
  }, [form.mode, input, valid]);

  const priceInput = useMemo(
    () => toMaxPriceInput(form, assessmentDate, indexRate),
    [assessmentDate, form, indexRate],
  );

  const priceOutcome = useMemo<MaxPriceOutcome | null>(() => {
    if (form.mode !== "capacity" || !priceInput) return null;
    if (!valid) return { ok: false, message: invalidFormMessage(errors) };
    return computeMaxPriceSafely(priceInput);
  }, [form.mode, priceInput, valid]);

  // In price mode the costs are a second call, because the price is known and
  // the loan has just been solved. In capacity mode the solver already did it
  // — the costs are part of what it optimised against, so taking them from the
  // result rather than recomputing keeps the two from disagreeing at the cent.
  const costs = useMemo<PurchaseCosts | null>(() => {
    if (form.mode !== "price" || !outcome?.ok || !input) return null;
    const costInput = toPurchaseCostsInput(
      form,
      input.propertyPrice,
      Math.floor(outcome.result.maxLoan),
      outcome.result.termYears,
      input.annualRate,
      assessmentDate,
    );
    if (!costInput) return null;
    try {
      return purchaseCostsForDate(costInput);
    } catch {
      return null;
    }
  }, [assessmentDate, form, input, outcome]);

  return (
    <>
      <ChoiceCards
        name="loan-mode"
        legend="O que quer saber"
        value={form.mode}
        options={MODE_CARDS}
        onChange={(value) => update("mode", value as LoanMode)}
      />

      <div className="calculator">
        <form className="panel form" onSubmit={(event) => event.preventDefault()}>
          <h2 className="visually-hidden">Os seus dados</h2>

          <TextField
            id="loan-income"
            large
            label="Rendimento mensal do agregado"
            suffix="€"
            placeholder="2 000,00"
            value={form.income}
            error={errors.income}
            hint="Líquido, somando quem vai ao crédito. Use sempre o rendimento anual a dividir por 12 — é o que o Banco de Portugal manda usar, tenha 14 meses ou passe recibos verdes."
            onChange={(value) => update("income", value)}
          />

          {form.mode === "price" ? (
            <TextField
              id="loan-price"
              large
              label="Preço do imóvel"
              suffix="€"
              placeholder="250 000,00"
              value={form.propertyPrice}
              error={errors.propertyPrice}
              onChange={(value) => update("propertyPrice", value)}
            />
          ) : (
            <TextField
              id="loan-savings"
              large
              /*
                Not "Entrada disponível": the field is not the entrada, and a
                label that says it is forces the hint to spend its first
                sentence taking it back.
              */
              label="O que tem de parte"
              suffix="€"
              placeholder="40 000,00"
              value={form.savings}
              error={errors.savings}
              hint="Tudo o que pode pôr nesta compra: a entrada, o IMT, o imposto do selo e a escritura saem todos daqui."
              onChange={(value) => update("savings", value)}
            />
          )}

          <div className="field-row">
            <TextField
              id="loan-age"
              label="Idade"
              inputMode="numeric"
              suffix="anos"
              value={form.age}
              error={errors.age}
              hint="Do mutuário mais velho."
              onChange={(value) => update("age", value)}
            />
            <TextField
              id="loan-term"
              label="Prazo"
              inputMode="numeric"
              suffix="anos"
              value={form.termYears}
              error={errors.termYears}
              onChange={(value) => update("termYears", value)}
            />
          </div>

          <LoanAdvancedPanel
            form={form}
            errors={errors}
            update={update}
            euribor={euribor}
            indexRate={indexRate}
          />
        </form>

        {form.mode === "price" ? (
          <LoanResultPanel
            outcome={outcome}
            input={input}
            euribor={euribor.snapshot}
            propertyPrice={parseAmount(form.propertyPrice) ?? 0}
            monthlyIncome={parseAmount(form.income) ?? 0}
            existingMonthlyDebt={parseAmount(form.existingDebt) ?? 0}
            savings={parseAmount(form.savings) ?? 0}
            costs={costs}
          />
        ) : (
          <PriceResultPanel
            outcome={priceOutcome}
            assessmentDate={assessmentDate}
            euribor={euribor.snapshot}
            monthlyIncome={parseAmount(form.income) ?? 0}
            existingMonthlyDebt={parseAmount(form.existingDebt) ?? 0}
            savings={parseAmount(form.savings) ?? 0}
            priceInput={priceInput}
          />
        )}
      </div>
    </>
  );
}


