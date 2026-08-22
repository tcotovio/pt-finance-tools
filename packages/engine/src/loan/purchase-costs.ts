// What buying the house costs on top of the house — IMT, Imposto do Selo, and
// the registration emoluments.
//
// The calculator used to say "acresce o IMT, o imposto do selo e a escritura"
// and stop there, which put the second-largest number in the transaction
// outside the tool. On a 250 000 € purchase these run to five figures, and
// they are exactly the part a first-time buyer has not budgeted for.
//
// THREE VALUATIONS, PULLING DIFFERENT WAYS. A single property carries a price,
// a bank appraisal and a VPT, and the rules use them in opposite directions:
//
//   * LTV takes the LOWER of price and appraisal (Recomendação art. 4.º) —
//     the bank lends against the more conservative of the two;
//   * IMT, and with it verba 1.1 of the selo, take the GREATER of price and
//     VPT (CIMT art. 12.º) — the State taxes the less favourable of the two.
//
// Getting this backwards understates the tax on exactly the older stock where
// the VPT is most likely to exceed the price, so it is stated here rather than
// left to be inferred from the field names.
//
// WHAT IS NOT MODELLED, and is not silently zero: the bank's own charges —
// avaliação, comissão de dossier, formalização. No statute sets them and no
// feed publishes them, so they enter as a caller-supplied number that the FINE
// will state, the same treatment the spread already gets. Life and multi-risk
// insurance are not modelled either, and cannot be: they are priced per
// borrower.

import type {
  ImtBracket,
  ImtCharge,
  ImtTableId,
  ImtTables,
  PurchaseCosts,
  PurchaseCostsInput,
  RegistrationFees,
  SourceRef,
  StampDuty,
} from "../types.js";
import {
  getImtTables,
  getRegistrationFees,
  getStampDuty,
  imtTerritory,
} from "../data/index.js";
import { amortize } from "./amortization.js";

/**
 * Round a charge to the cent, upward.
 *
 * The opposite direction to the loan amounts, and for the same reason: a
 * ceiling rounded up is a ceiling overstated, and a cost rounded down is a
 * cost understated. Both errors flatter the borrower, so both are avoided.
 */
function ceilCents(value: number): number {
  if (value <= 0) return 0;
  return Math.ceil(value * 100 - 1e-6) / 100;
}

/** A row that must exist — an IMT table with a missing row is a broken dataset. */
function row(brackets: readonly ImtBracket[], index: number): ImtBracket {
  const bracket = brackets[index];
  if (!bracket) {
    throw new Error(`IMT table has no row ${index + 1}.`);
  }
  return bracket;
}

/** The bracket a taxable value falls in. */
function bracketFor(
  brackets: readonly ImtBracket[],
  value: number,
): ImtBracket {
  return (
    brackets.find((b) => b.upTo === null || value <= b.upTo) ??
    row(brackets, brackets.length - 1)
  );
}

/**
 * IMT on a taxable value.
 *
 * `valor × taxa − parcela a abater`, which is AT's practical restatement of
 * art. 17.º n.º 3 ("a primeira parte à taxa média, o excedente à taxa
 * marginal"). The taxa-única rows carry no parcela, so the same expression
 * covers them — and that is why the tax can jump upward when one begins.
 */
export function imtFor(
  taxableValue: number,
  table: readonly ImtBracket[],
): { amount: number; rate: number; deduct: number } {
  const bracket = bracketFor(table, taxableValue);
  const amount = Math.max(0, taxableValue * bracket.rate - bracket.deduct);
  return { amount: ceilCents(amount), rate: bracket.rate, deduct: bracket.deduct };
}

/**
 * Which of the three tables an acquisition falls under.
 *
 * The young table is the caller's assertion, and it is only *available* for
 * own permanent residence — art. 9.º n.º 2 and art. 17.º n.º 1 al. b) both
 * say "destinado exclusivamente a habitação própria e permanente", so a young
 * buyer of a second home gets al. c) like anybody else.
 */
function tableFor(input: PurchaseCostsInput): ImtTableId {
  if (input.purpose !== "own-permanent-residence") return "housing";
  return input.youngFirstHome
    ? "young-own-permanent-residence"
    : "own-permanent-residence";
}

/**
 * The ceiling on the art. 7.º-A deduction, read off the IMT tables rather than
 * copied.
 *
 * CIS art. 7.º-A defines it as verba 1.1 applied to "o limite superior do 1.º
 * escalão da tabela prevista na alínea b) do n.º 1 do artigo 17.º do Código do
 * IMT" — a cross-reference, not a number, so it re-indexes with the IMT
 * brackets every January without this file changing. Copying 330 539 in here
 * would create a second place to update and a silent divergence the January
 * after somebody forgets.
 */
function youngStampDutyCap(
  tables: ImtTables,
  territory: ReturnType<typeof imtTerritory>,
  stamp: StampDuty,
): number {
  const firstBracket = row(
    tables.tables[territory]["young-own-permanent-residence"],
    0,
  );
  return (firstBracket.upTo ?? 0) * stamp.transfer;
}

/**
 * The ceiling on the DL 48-D/2024 emolument exemption, likewise by reference:
 * "o valor máximo do 4.º escalão da tabela prevista na alínea a) do n.º 1 do
 * artigo 17.º do CIMT" — the fourth row of the general HPP table.
 */
function youngRegistrationCeiling(
  tables: ImtTables,
  territory: ReturnType<typeof imtTerritory>,
): number {
  return row(tables.tables[territory]["own-permanent-residence"], 3).upTo ?? 0;
}

/** Which verba 17.1 row a contract of `termYears` falls under. */
function creditVerba(
  termYears: number,
  stamp: StampDuty,
): { rate: number; verba: "17.1.1" | "17.1.2" | "17.1.3" } {
  if (termYears >= 5) {
    return { rate: stamp.credit.fiveYearsOrMore, verba: "17.1.3" };
  }
  if (termYears >= 1) {
    return { rate: stamp.credit.oneYearOrMore, verba: "17.1.2" };
  }
  return {
    rate: stamp.credit.underOneYearPerMonth * Math.ceil(termYears * 12),
    verba: "17.1.1",
  };
}

/** Purchase costs, against explicitly supplied datasets. */
export function purchaseCosts(
  input: PurchaseCostsInput,
  tables: ImtTables,
  stamp: StampDuty,
  fees: RegistrationFees,
): PurchaseCosts {
  if (input.price <= 0) {
    throw new Error("Purchase costs need a positive price.");
  }

  // CIMT art. 12.º — the greater of the two, which is the opposite of the LTV
  // rule and the single easiest thing to get backwards here.
  const taxableValue = Math.max(input.price, input.vpt ?? 0);
  const territory = imtTerritory(input.region);
  const tableId = tableFor(input);
  const table = tables.tables[territory][tableId];

  const { amount, rate, deduct } = imtFor(taxableValue, table);
  const imt: ImtCharge = {
    amount,
    table: tableId,
    territory,
    rate,
    deduct,
    exempt: tableId === "young-own-permanent-residence" && rate === 0,
  };

  // Verba 1.1, then the art. 7.º-A dedução à coleta. Note this is a deduction
  // from the tax, capped, and NOT a second exemption: a young buyer above the
  // first bracket still pays selo on what the cap does not reach.
  const grossTransfer = ceilCents(taxableValue * stamp.transfer);
  const cap = input.youngFirstHome
    ? ceilCents(youngStampDutyCap(tables, territory, stamp))
    : 0;
  const youngDeduction =
    input.youngFirstHome && tableId === "young-own-permanent-residence"
      ? Math.min(grossTransfer, cap)
      : 0;

  const credit = creditVerba(input.termYears, stamp);
  const stampDutyCredit = {
    amount: ceilCents(Math.max(0, input.loanAmount) * credit.rate),
    rate: credit.rate,
    verba: credit.verba,
  };

  // Verba 17.3.1. Zero for own housing under art. 7.º n.º 1 al. l) — a rule,
  // not an omission, so the reason travels with the number.
  const ownHousing = input.purpose === "own-permanent-residence";
  const months = Math.round(input.termYears * 12);
  const totalInterest =
    input.loanAmount > 0 && months > 0
      ? amortize(input.loanAmount, input.annualRate, months).totalInterest
      : 0;
  const stampDutyInterest = ownHousing
    ? {
        amount: 0,
        exempt: true,
        reason:
          "Os juros de crédito para habitação própria estão isentos de imposto do selo (art. 7.º n.º 1 al. l) do CIS).",
      }
    : {
        amount: ceilCents(totalInterest * stamp.interest),
        exempt: false,
        reason:
          "A verba 17.3.1 incide sobre os juros. A isenção do art. 7.º n.º 1 al. l) do CIS abrange a habitação própria, ainda que não permanente — se o imóvel for para sua habitação e não para arrendamento ou investimento, este valor não é devido.",
      };

  // Always the multiple-act tariff: every case this calculator computes is a
  // purchase WITH a mortgage, so the hipoteca is registered alongside the
  // acquisition and there is more than one facto.
  const registrationReduced =
    input.youngFirstHome === true &&
    ownHousing &&
    taxableValue <= youngRegistrationCeiling(tables, territory);
  const youngReduction = registrationReduced ? fees.youngReduction.multipleActs : 0;
  const registration = {
    amount: Math.max(0, fees.multipleActs - youngReduction),
    gross: fees.multipleActs,
    youngReduction,
  };

  const bankFees = Math.max(0, input.bankFees ?? 0);

  const source: SourceRef[] = [
    { key: "imt", citation: tables.source, verified: tables.verified },
    { key: "stamp-duty", citation: stamp.source, verified: stamp.verified },
    { key: "registration", citation: fees.source, verified: fees.verified },
  ];

  return {
    taxableValue,
    imt,
    stampDutyTransfer: {
      amount: ceilCents(grossTransfer - youngDeduction),
      gross: grossTransfer,
      youngDeduction,
      youngDeductionCap: cap,
    },
    stampDutyCredit,
    stampDutyInterest,
    registration,
    bankFees,
    upfrontTotal: ceilCents(
      imt.amount +
        (grossTransfer - youngDeduction) +
        stampDutyCredit.amount +
        registration.amount +
        bankFees,
    ),
    source,
    verified: tables.verified && stamp.verified && fees.verified,
  };
}

/** Purchase costs, resolving every dataset from `assessmentDate`. */
export function purchaseCostsForDate(
  input: PurchaseCostsInput,
): PurchaseCosts {
  return purchaseCosts(
    input,
    getImtTables(input.assessmentDate),
    getStampDuty(input.assessmentDate),
    getRegistrationFees(input.assessmentDate),
  );
}
