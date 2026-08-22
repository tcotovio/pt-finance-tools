// Shared input/output types for the calculation engine.
// Framework-agnostic: no DOM, no React, no bundler-specific imports.

/** Portuguese tax regions with distinct withholding tables. */
export type Region = "continente" | "madeira" | "acores";

/**
 * Which withholding table applies to a taxpayer. In the 2026+ formula model,
 * dependents are handled via a per-bracket deduction (not separate tables),
 * so the category alone selects the table.
 */
export type TaxpayerCategory =
  | "unmarried" // não casado
  | "married-single-earner" // casado, único titular
  | "married-dual-earner"; // casado, dois titulares

/** How the meal allowance is paid — the exemption ceiling differs by method. */
export type MealAllowanceMethod = "card" | "cash";

/** A month's meal allowance (subsídio de alimentação). */
export interface MealAllowance {
  /** Amount paid per working day, in euros. */
  dailyAmount: number;
  /** Number of days it is paid for this month. */
  days: number;
  method: MealAllowanceMethod;
}

/**
 * Per-day meal allowance exemption ceilings for a year. Above the ceiling the
 * excess is treated as ordinary remuneration: it enters both the IRS
 * withholding base and the Segurança Social base.
 */
export interface MealAllowanceLimits {
  year: number;
  /** ISO `YYYY-MM-DD` the limits take effect. */
  effectiveFrom: string;
  perDay: Record<MealAllowanceMethod, number>;
  /** Human-readable provenance. */
  source: string;
  /** Whether the values have been independently cross-checked. */
  verified: boolean;
}

/**
 * How much of each subsidy is paid monthly in duodécimos, as a fraction:
 * 1 = the whole subsidy spread over the year, 0.5 = half, 0 = paid as a lump
 * sum in its usual month (and so outside this monthly calculation).
 */
export interface TwelfthsOption {
  /** Subsídio de férias. */
  holiday: number;
  /** Subsídio de Natal. */
  christmas: number;
}

/**
 * IRS Jovem parameters for a year (CIRS art. 12.º-B), versioned like every
 * other time-varying input.
 */
export interface IrsJovemRegime {
  year: number;
  /** ISO `YYYY-MM-DD` the parameters take effect. */
  effectiveFrom: string;
  /** Indexante dos Apoios Sociais for the year. */
  ias: number;
  /** Annual exempt-income ceiling as a multiple of IAS (55 for 2026). */
  capMultiplier: number;
  /** Payments the annual ceiling is divided across at source (14). */
  paymentsPerYear: number;
  /** Exempt share by year of earning, index 0 = first year. */
  exemptionByYear: readonly number[];
  source: string;
  verified: boolean;
}

/** Opting into IRS Jovem for the month. */
export interface IrsJovemInput {
  /** Which year of earning this is, 1-based (1 … 10). */
  yearOfIncome: number;
}

/** Inputs to a monthly net-wage (withholding) calculation. */
export interface WageInput {
  /** Gross monthly remuneration in euros (remuneração mensal bruta). */
  grossMonthly: number;
  region: Region;
  category: TaxpayerCategory;
  /** Number of dependents (dependentes). */
  dependents: number;
  /**
   * Reference date (ISO `YYYY-MM-DD`) used to select the effective dataset.
   * Tax tables change at least yearly, so calculations are date-aware.
   */
  referenceDate: string;
  /**
   * Retribuição por isenção de horário de trabalho (IHT) for the month, in
   * euros — the specific pay owed under CT art. 265.º to a worker exempt
   * from a fixed schedule.
   *
   * Ordinary remuneration with no special tax treatment: it enters the IRS
   * withholding base and the Segurança Social base exactly like base salary.
   * It is a separate input only so the result can itemize it.
   */
  workScheduleExemption?: number;
  /**
   * Remuneração por trabalho suplementar paid this month, in euros. Withheld
   * autonomously at half the month's effective rate (CIRS art. 99.º-C n.º 8,
   * despacho 233-A/2026 §5.f) and contributory for Segurança Social.
   */
  overtime?: number;
  /**
   * Meal allowance for the month. Omit when the worker receives none — the
   * exempt portion changes neither the withholding nor the contribution.
   */
  mealAllowance?: MealAllowance;
  /**
   * Subsídios de férias / Natal received in duodécimos. Omit when both are
   * taken as lump sums.
   */
  twelfths?: TwelfthsOption;
  /**
   * The full value of one subsidy, if it differs from `grossMonthly`.
   * Defaults to `grossMonthly`, which is the ordinary case.
   */
  subsidyAmount?: number;
  /** IRS Jovem, when the worker has invoked it with the employer. */
  irsJovem?: IrsJovemInput;
}

/**
 * Parcela a abater (the amount subtracted after applying the marginal rate).
 *
 * In the official tables this is a fixed euro amount for most brackets, but
 * for the lowest brackets it is a formula of the monthly income R, written in
 * the despacho as e.g. `12,50 % × 2,60 × (1 273,85 − R)` — i.e.
 * `marginalRate × multiplier × (base − R)`.
 */
export type Deduction =
  | { kind: "fixed"; amount: number }
  | {
      kind: "formula";
      /** The constant factor the marginal rate is multiplied by (e.g. 2.60). */
      multiplier: number;
      /** The income base the formula subtracts R from (e.g. 1273.85). */
      base: number;
    };

/**
 * One row of the withholding table: for monthly income up to `upTo`, apply
 * `marginalRate` to the income and subtract the deductions.
 *
 * retenção = income × marginalRate − parcelaAbater − dependentDeduction × dependents
 *
 * (with a −1 percentage-point adjustment to `marginalRate` for 3+ dependents;
 * see the withholding calculation and despacho 233-A/2026 §5.h).
 */
export interface WithholdingBracket {
  /** Upper bound (inclusive) of monthly income in euros; `null` = top bracket. */
  upTo: number | null;
  /** Taxa marginal máxima, as a fraction (e.g. 0.241 for 24.10%). */
  marginalRate: number;
  /** Parcela a abater: fixed euros or an R-dependent formula. */
  deduction: Deduction;
  /** Parcela adicional a abater por dependente for this bracket, in euros. */
  dependentDeduction: number;
}

/** A withholding table for one taxpayer category. */
export interface WithholdingTable {
  category: TaxpayerCategory;
  /** Ordered by ascending `upTo`, top (`null`) bracket last. */
  brackets: WithholdingBracket[];
}

/**
 * A complete, versioned withholding dataset for one region and effective
 * period. Adding a new tax year is a new dataset — a data change, not a
 * logic change.
 */
export interface WithholdingDataset {
  year: number;
  region: Region;
  /** ISO `YYYY-MM-DD` the dataset takes effect. */
  effectiveFrom: string;
  /** Human-readable provenance: despacho reference + source URL. */
  source: string;
   /**
   * True only once the numbers have been transcribed from the official
   * source AND independently cross-checked (e.g. against a public simulator).
   * The flag is propagated to {@link WageResult.datasetVerified} so the UI can
   * caveat results computed from data that has not yet been double-checked —
   * it does NOT cause the engine to refuse the calculation.
   */
  verified: boolean;
  tables: WithholdingTable[];
}

/** Structured, itemized result so the UI can present the breakdown honestly. */
export interface WageResult {
  /** Base monthly remuneration, as given on the input. */
  grossMonthly: number;
  /**
   * Meal allowance split into its exempt and taxable parts. Absent when the
   * input carried no allowance.
   */
  mealAllowance?: {
    /** Total paid this month (dailyAmount × days). */
    paid: number;
    /** The part within the per-day ceiling: no IRS, no Segurança Social. */
    exempt: number;
    /** The part above the ceiling: taxed and contributed on as salary. */
    taxable: number;
    /** Ceiling per day applied, from the versioned dataset. */
    dailyLimit: number;
  };
  /** Retribuição por isenção de horário paid this month, if any. */
  workScheduleExemption?: number;
  /**
   * The amount the *salary* withholding is computed on: `grossMonthly` plus
   * any isenção de horário and any taxable meal allowance. Duodécimos are
   * deliberately excluded — CIRS art. 99.º-C n.º 5 withholds them
   * autonomously.
   */
  taxableBase: number;
  /**
   * IRS Jovem as applied this month. Absent when not opted into.
   *
   * Note `exempt` reduces the withholding base only — Segurança Social is
   * contributed on the full remuneration regardless.
   */
  irsJovem?: {
    /** Exempt share for the year of earning (1 = 100 %). */
    fraction: number;
    /** Exempt euros on the salary, after the per-payment ceiling. */
    exempt: number;
    /** The ceiling that applied to the salary payment. */
    cap: number;
    /** True when the ceiling bit, i.e. the exemption was reduced by it. */
    capped: boolean;
    /** Rate levied on the non-exempt part — from the FULL remuneration. */
    effectiveRate: number;
    /**
     * IRS that would have been withheld this month had the exemption not
     * applied — salary plus any duodécimos, at the same table rates.
     */
    withholdingWithoutExemption: number;
    /**
     * What the regime is worth this month: `withholdingWithoutExemption`
     * less the {@link WageResult.irsWithholding} actually retained.
     */
    relief: number;
  };
  /**
   * Duodécimos paid and withheld this month. Absent when the input carried
   * no `twelfths`.
   */
  twelfths?: {
    /** Amount paid this month across both subsidies. */
    paid: number;
    /** IRS withheld on it, computed autonomously. */
    withholding: number;
    /** Withholding due on one whole subsidy, before pro-rating. */
    withholdingOnFullSubsidy: number;
    /** The full-subsidy value used. */
    subsidyAmount: number;
    /**
     * The part of this month's duodécimo exempted by IRS Jovem, which has
     * its own share of the per-payment ceiling. Absent without IRS Jovem.
     */
    exempt?: number;
  };
  /**
   * Trabalho suplementar paid and withheld this month. Absent when none was
   * paid.
   */
  overtime?: {
    /** Amount paid this month. */
    paid: number;
    /** The rate levied: half the month's effective rate. */
    rate: number;
    /** IRS withheld on it, computed autonomously. */
    withholding: number;
    /** The part exempted by IRS Jovem, if any. */
    exempt?: number;
  };
  /**
   * Total IRS retenção na fonte withheld this month — salary, duodécimos and
   * trabalho suplementar, each computed separately and summed only here.
   */
  irsWithholding: number;
  /** Employee Social Security contribution (Segurança Social). */
  socialSecurity: number;
  /**
   * Take-home: base gross + meal allowance paid − withholding − social
   * security. The exempt part of the allowance is money in hand, so it is
   * included here even though it is not taxed.
   */
  netMonthly: number;
  /**
   * What the month costs the employer: everything paid to the worker plus
   * the employer's Segurança Social contribution (TSU patronal).
   *
   * Direct cost only. It deliberately excludes the mandatory seguro de
   * acidentes de trabalho, occupational health, training levies and any
   * other overhead — none of those has a statutory rate the engine could
   * apply without inventing one.
   */
  employerCost: {
    /** Everything paid to the worker this month, exempt parts included. */
    remuneration: number;
    /** Employer contribution, on the same base as the employee's. */
    socialSecurity: number;
    /** The rate applied, as a fraction (0.2375). */
    socialSecurityRate: number;
    /** `remuneration + socialSecurity`. */
    total: number;
  };
  breakdown: {
    marginalRate: number;
    deduction: number;
    dependentDeduction: number;
    socialSecurityRate: number;
  };
  /** Whether the dataset used has been independently cross-checked. */
  datasetVerified: boolean;
  /** Provenance of the dataset used (despacho reference + source URL). */
  datasetSource: string;
  /**
   * Withholding is an advance on the annual IRS settlement, not the final
   * tax. Always true for this engine (withholding-only scope).
   */
  isWithholdingEstimate: true;
}

// ---------------------------------------------------------------------------
// Loan (Phase 2)
// ---------------------------------------------------------------------------

/**
 * What a consumer credit is for, which selects its maturity ceiling
 * (Recomendação art. 7.º n.ºs 3–4).
 */
export type ConsumerCreditKind = "personal" | "auto" | "personal-earmarked";

/** Purpose of the credit, which selects the LTV ceiling (Recomendação art. 5.º). */
export type LoanPurpose =
  | "own-permanent-residence" // habitação própria e permanente
  | "other";

/**
 * Banco de Portugal macroprudential limits for new credit contracts, versioned
 * by the date the solvency assessment takes place — which is what the
 * Recomendação keys on, not the date the contract is signed.
 */
export interface MacroprudentialParameters {
  year: number;
  /** ISO `YYYY-MM-DD` the parameters take effect. */
  effectiveFrom: string;
  /** DSTI ceiling as a fraction (0.45 for 2026). */
  dstiLimit: number;
  /** Share of a semester's lending that may exceed the ceiling (0.10). */
  dstiExceptionShare: number;
  /** LTV ceiling by purpose, as a fraction. */
  ltvLimit: Record<LoanPurpose, number>;
  /** Maturity ceilings in years, by the oldest borrower's age. */
  maturity: {
    /** Age at or below which the longer ceiling applies (35). */
    ageThreshold: number;
    yearsAtOrBelowThreshold: number;
    yearsAboveThreshold: number;
  };
  /** Maturity ceilings in years for crédito ao consumo, by what it is for. */
  consumerMaturityYears: Record<ConsumerCreditKind, number>;
  /** The income haircut for contracts running past retirement age. */
  incomeReduction: {
    /** Age past which it applies (70). */
    age: number;
    /** Fraction of income removed, before weighting (0.20). */
    fraction: number;
  };
  source: string;
  verified: boolean;
}

/** One band of the DSTI stress test's rate shock, by contract term. */
export interface InterestRateShockBand {
  /** Inclusive upper bound of the term in years; `null` = open-ended. */
  upToYears: number | null;
  /** Shock in absolute rate terms (0.015 = 1,5 p.p.). */
  shock: number;
}

/**
 * The interest-rate shock applied to the DSTI numerator — a separate legal
 * instrument from the Recomendação, so it is versioned separately.
 */
export interface InterestRateShock {
  effectiveFrom: string;
  /** Ordered ascending by `upToYears`, open-ended band last. */
  bands: readonly InterestRateShockBand[];
  /** Months the indexante is averaged over before the assessment (1). */
  indexAveragingMonths: number;
  source: string;
  verified: boolean;
}

/** One period of a French amortization schedule. */
export interface AmortizationPeriod {
  /** 1-based period number. */
  period: number;
  /** Constant instalment. */
  payment: number;
  /** Interest part of this instalment. */
  interest: number;
  /** Capital part of this instalment. */
  principal: number;
  /** Outstanding capital after this instalment. */
  balance: number;
}

/** A loan's forward calculation: what it costs to borrow a given amount. */
export interface AmortizationResult {
  /** Amount borrowed. */
  principal: number;
  /** Monthly instalment (prestação). */
  monthlyPayment: number;
  /** Annual nominal rate used, as a fraction. */
  annualRate: number;
  /** Term in months. */
  months: number;
  /** Sum of every instalment. */
  totalPaid: number;
  /** `totalPaid − principal`. */
  totalInterest: number;
}

/** A borrower's situation, as the DSTI and maturity rules see it. */
export interface BorrowerProfile {
  /**
   * Monthly income for the DSTI denominator. Art. 4.º n.º 5 al. a) takes the
   * annual income divided by 12 — so a 14-payment Portuguese salary should be
   * annualized *including* the subsídios before being divided, not simply the
   * monthly net.
   */
  monthlyIncome: number;
  /**
   * Age of the borrower with the earliest date of birth, i.e. the oldest —
   * art. 4.º n.º 5 al. b) and art. 7.º n.º 2 both key on that one.
   */
  age: number;
  /**
   * Monthly instalments on credit already held. Art. 6.º n.º 2 counts these
   * at face value: only the *new* contract's instalment is stressed.
   */
  existingMonthlyDebt?: number;
  /**
   * Whether the borrower is already retired at the time of assessment, which
   * waives the past-70 income reduction (art. 4.º n.º 5 al. b), final part).
   */
  retired?: boolean;
}

/** Inputs to the reverse solver: how much can this borrower borrow? */
export interface MaxLoanInput {
  borrower: BorrowerProfile;
  purpose: LoanPurpose;
  /** Purchase price of the property. */
  propertyPrice: number;
  /**
   * Appraisal value, when it differs. Art. 4.º takes the *lower* of the two
   * for the LTV denominator; defaults to `propertyPrice`.
   */
  appraisalValue?: number;
  /** Contract annual nominal rate (indexante + spread), as a fraction. */
  annualRate: number;
  /**
   * Whether the contract's rate can move. Defaults to `"variable"`, which is
   * the overwhelmingly common Portuguese mortgage and the conservative
   * assumption — see {@link LoanRateType} for why it changes the answer.
   */
  rateType?: LoanRateType;
  /**
   * The fixed leg of a taxa mista contract. Required when `rateType` is
   * `"mixed"`; ignored otherwise. `annualRate` then means the rate that
   * applies *after* the fixed period — indexante + spread.
   */
  mixedTerms?: { fixedPeriodYears: number; fixedRate: number };
  /** Requested term in years, before the age-based ceiling is applied. */
  termYears: number;
  /** ISO `YYYY-MM-DD` of the solvency assessment — selects the parameters. */
  assessmentDate: string;
}

/**
 * Whether the contract's rate can move over its life.
 *
 * This is not cosmetic: it decides whether the DSTI stress test applies at
 * all. Instrução 23/2023 art. 1.º prescribes a shock for contracts "a taxa de
 * juro variável" (n.º 1) and "a taxa de juro mista" (n.º 2) — it says nothing
 * about a rate fixed for the whole term, because there is no indexante that
 * could rise. Recomendação art. 6.º n.º 2 in turn defers the shock entirely
 * to that Instrução, so for a fully fixed contract there is no prescribed
 * shock to apply and the DSTI is tested at the contract rate.
 *
 * Recorded as a reading, with its limits: the statutes define the shock by
 * scope rather than saying "no shock for fixed rates" in as many words. The
 * inference is that a rule written for a rising indexante cannot bind a
 * contract that has none.
 *
 * `"mixed"` (taxa mista) follows art. 1.º n.º 2: the tested instalment is the
 * HIGHER of the shocked post-fixed one and the fixed-period one. It is the
 * dominant Portuguese product — about 85 % of new lending in mid-2026, per
 * Banco de Portugal's own statistics — so leaving it out excluded most
 * borrowers.
 */
export type LoanRateType = "variable" | "fixed" | "mixed";

/** Which rule capped the loan. */
export type BindingConstraint = "dsti" | "ltv";

/** The reverse solver's answer, with every limit shown rather than just the min. */
export interface MaxLoanResult {
  /** The lowest of the ceilings below — what the borrower can actually get. */
  maxLoan: number;
  /** Which rule produced it. */
  bindingConstraint: BindingConstraint;
  /** Term actually used, after the age-based maturity ceiling. */
  termYears: number;
  /** True when `termYears` is shorter than the term requested. */
  termCappedByAge: boolean;
  dsti: {
    /** Ceiling applied (0.45). */
    limit: number;
    /** Income after the past-70 reduction, if any. */
    adjustedIncome: number;
    /** The reduction applied, as a fraction of income (0 when none). */
    incomeReduction: number;
    /** Monthly instalment budget left for the new loan, after existing debt. */
    paymentBudget: number;
    /** Rate the budget was converted at: contract rate + shock. */
    stressedRate: number;
    /** Shock added, in absolute rate terms; 0 for a fixed-rate contract. */
    shock: number;
    /** The rate type the shock decision was made on. */
    rateType: LoanRateType;
    /**
     * For taxa mista, which leg of art. 1.º n.º 2 governed: the shocked
     * post-fixed instalment, or the fixed-period one when it is dearer.
     */
    mixedBasis?: "post-fixed" | "fixed-period";
    /** Loan the budget supports at the stressed rate. */
    maxLoan: number;
  };
  ltv: {
    limit: number;
    /** min(price, appraisal) — the denominator art. 4.º prescribes. */
    propertyValue: number;
    maxLoan: number;
  };
  /**
   * The instalment actually payable on `maxLoan` — what the borrower starts
   * paying, as opposed to the stressed figure used to test them. For taxa
   * mista this is the fixed-period instalment, not the indexed one.
   */
  contractPayment: number;
  /**
   * The instalment the DSTI test was run on at `maxLoan`. Equal to
   * `contractPayment` only for a fixed rate; for mista it is whichever leg of
   * art. 1.º n.º 2 governed. Reported so the UI never has to reconstruct it
   * from a rate, which is impossible to do correctly for mista.
   */
  stressedPayment: number;
  /** Provenance of the parameter sets used. */
  sources: {
    macroprudential: string;
    shock: string;
  };
  /** Whether both parameter sets have been independently cross-checked. */
  parametersVerified: boolean;
}

/** Euribor tenors Portuguese mortgages index to. */
export type EuriborTenor = "3m" | "6m" | "12m";

/**
 * A month's Euribor averages, one per tenor.
 *
 * Monthly rather than spot by law, not by convenience: Instrução 23/2023
 * art. 1.º n.º 4 requires "a média aritmética simples das cotações diárias no
 * mês anterior ao da realização da avaliação da solvabilidade".
 */
export interface EuriborSnapshot {
  /** The month the averages are for, as `YYYY-MM`. */
  month: string;
  /** Average rate per tenor, as a fraction (0.024253913 = 2,4253913 %). */
  rates: Record<EuriborTenor, number>;
  source: string;
  /** ISO date the values were retrieved, for staleness reporting. */
  retrievedAt: string;
}

/**
 * A published distribution, as the percentiles BdP actually reports.
 *
 * Some series omit quartiles, so p25/p75 are optional rather than faked — a
 * missing percentile is missing, not interpolated into existence.
 */
export interface Percentiles {
  p10: number;
  p25?: number;
  median: number;
  p75?: number;
  p90: number;
}

/**
 * The mortgage market as Banco de Portugal's statistics describe it — context
 * shown beside the user's own numbers, never an input to a calculation.
 *
 * No spread is derived from it: see the dataset for why "observed rate minus
 * Euribor" does not survive contact with the product mix or the signature lag.
 */
export interface MortgageMarket {
  /** The month the figures are for, as `YYYY-MM`. */
  month: string;
  /** Annualised agreed rate on new business, by rate type, as fractions. */
  newBusinessRate: {
    variable: Percentiles;
    fixed: Percentiles;
    /** Taxa mista has no published rate percentiles — only a share. */
    mixed?: Percentiles;
  };
  /** Monthly instalment on the outstanding stock, in euros. */
  instalmentStock: Percentiles;
  /** Share of new lending by rate type, as fractions. */
  shareOfNewLending: {
    mixed: number;
    variable: number;
    fixed: number;
  };
  /** Share of new variable-rate lending by index, as fractions. */
  indexShareOfNewBusiness: Record<EuriborTenor | "other", number>;
  source: string;
  retrievedAt: string;
}

/** Inputs to the consumer-credit solver. */
export interface ConsumerLoanInput {
  borrower: BorrowerProfile;
  /** What the credit is for — it decides the maturity ceiling. */
  kind: ConsumerCreditKind;
  /** Contract annual nominal rate, as a fraction. */
  annualRate: number;
  /** Requested term in years, before the ceiling for its kind is applied. */
  termYears: number;
  /**
   * Whether the rate can move. Consumer credit is commonly fixed, and a fixed
   * contract takes no shock — see {@link LoanRateType}. Defaults to
   * `"variable"`, the conservative assumption.
   */
  rateType?: LoanRateType;
  /** ISO `YYYY-MM-DD` of the solvency assessment — selects the parameters. */
  assessmentDate: string;
}

/**
 * The consumer-credit answer.
 *
 * Simpler than the mortgage one by construction: there is no property, so no
 * LTV, so nothing to bind except the DSTI. What replaces it is the maturity
 * ceiling, which is set by what the money is for rather than by who is
 * borrowing it.
 */
export interface ConsumerLoanResult {
  /** The largest loan the DSTI ceiling allows. */
  maxLoan: number;
  kind: ConsumerCreditKind;
  /** Term actually used, after the ceiling for this kind. */
  termYears: number;
  /** True when the requested term was longer than the kind allows. */
  termCappedByKind: boolean;
  /** The ceiling that applied, in years. */
  maturityCeiling: number;
  dsti: {
    limit: number;
    adjustedIncome: number;
    incomeReduction: number;
    paymentBudget: number;
    stressedRate: number;
    shock: number;
    rateType: LoanRateType;
  };
  /** The instalment payable at the contract rate on `maxLoan`. */
  contractPayment: number;
  /** The instalment the DSTI test was run on. */
  stressedPayment: number;
  /** Total interest over the life of the loan, at the contract rate. */
  totalInterest: number;
  sources: {
    macroprudential: string;
    shock: string;
  };
  parametersVerified: boolean;
}

/**
 * The consumer-credit market, as bank reporting describes it.
 *
 * A single average rate rather than a distribution: BdP publishes percentiles
 * for mortgages, not for consumer credit. Context and a sensible default, not
 * an input to any limit.
 */
export interface ConsumerCreditMarket {
  month: string;
  /** Annualised agreed rate on new consumer credit, as a fraction. */
  averageRate: number;
  source: string;
  retrievedAt: string;
}

/**
 * Average pay in Portugal, as INE's quarterly release reports it.
 *
 * A mean, not a median — INE does not publish a quarterly distribution — and
 * three means at that, because "average pay" is ambiguous. The calculator
 * compares against `baseMean`, since base salary is what its own form asks
 * for; see the dataset for why the total would mislead.
 */
export interface WageMarket {
  /** The quarter the figures are for, as `YYYY-QN`. */
  period: string;
  /** Mean base salary, in euros. */
  baseMean: number;
  /** Mean regular remuneration (base plus monthly supplements). */
  regularMean: number;
  /** Mean total remuneration, subsídios and overtime included. */
  totalMean: number;
  source: string;
  retrievedAt: string;
}
