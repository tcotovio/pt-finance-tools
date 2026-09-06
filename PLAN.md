# Portuguese Financial Tools — Project Plan

A PWA offering two accurate, easy-to-use calculators for the Portuguese market:
a **net wage calculator** and a **loan (mortgage) calculator**. This document is
the living plan — update it as decisions change.

---

## 1. Goals & guiding principles

- **Accuracy you can prove**, not just claim — verified against official sources.
- **Cover real cases**, reached through progressive disclosure rather than a wall of fields.
- **Simple by default**: most users touch 2–3 inputs; edge cases live behind an "advanced / o meu caso" panel.
- **Maintainable across rule changes** — tax tables change every January (sometimes mid-year), and Banco de Portugal parameters change too (they changed on 1 Aug 2026). New rules must be a *data* change, not a code change.
- **Client-side only**: all calculation runs on-device. No user financial data leaves the browser — simpler privacy/GDPR story and a genuine selling point.

The core tension — *accurate for every case* vs *simple* — is resolved by
**progressive disclosure** plus a clean separation between the calculation core
and the UI.

---

## 2. Locked scope decisions

| Decision | Choice | Notes |
|---|---|---|
| Delivery | **PWA** (responsive + installable) | One codebase for web + mobile; native (Expo) deferred, cheap to add later. |
| Build order | **Wage-first** | Harder, more differentiating, and less "already solved" than the loan side. |
| Wage depth | **Withholding-only** | Monthly take-home (retenção na fonte). *Not* the full annual IRS settlement. |
| Employment type | **Categoria A first**, categoria B as its own tool | Recibos verdes share almost nothing with the salary engine — different retention, different contribution base, different periodicity. A third calculator, not a checkbox. See §11. |
| IRS Jovem | **In MVP**, at source | Operates at the monthly level, so it fits inside the withholding boundary as a modifier. |
| Loan side | **Consolidate + extend**, later phase | Mortgage and consumer credit, both with the reverse direction. Built from the statutes rather than from the pre-existing sims, which were never supplied. |
| Annual IRS settlement | **Out of scope** (for now) | Revisit only as a separate, clearly-labelled "annual estimate" mode. |

---

## 3. Architecture — the one bet everything hangs on

A single **framework-agnostic TypeScript calculation engine**: pure functions,
no DOM, no React. Both the current PWA and any future native app import it.

```
repo/
├─ packages/
│  ├─ engine/            # pure calc + versioned data (the accurate core)
│  │  ├─ src/
│  │  │  ├─ wage/        # withholding model + IRS Jovem modifier
│  │  │  ├─ loan/        # amortization + reverse (max-loan) solver
│  │  │  └─ types.ts     # shared input/output types
│  │  └─ data/           # versioned datasets keyed by effective date
│  └─ web/               # the PWA (React) — imports @engine
│     └─ src/
│        ├─ components/  # UI only — no tax logic
│        └─ lib/         # pure helpers: form state, parsing, formatting
└─ PLAN.md
```

Why this pays off on all four goals at once:
- **Accuracy** — one place to get right, one place to test.
- **Web + mobile** — no duplicated math drifting between platforms.
- **Maintainability** — a new tax year is a data PR, not a logic change.
- **Portfolio value** — a cleanly separated, heavily-tested domain core is exactly the kind of engineering substance worth showing publicly.

**Stack:** npm workspace monorepo · TypeScript ·
React + Vite + `vite-plugin-pwa` for the web app · Vitest for the engine + golden
tests. Static hosting (any CDN/static host) since there's no backend. npm chosen
over pnpm/yarn for simplicity — ships with Node, no extra tooling, and a
2-package monorepo doesn't need pnpm's stricter dependency isolation.

---

## 4. Wage engine (Phase 1 detail)

### Model
Monthly withholding via the marginal-rate model:

```
retencao = (bruto × taxa_marginal_max) − parcela_a_abater − (parcela_dependente × n_dependentes)
liquido  = bruto − retencao − seg_social            // seg_social = 11% (employee)
```

### Case matrix → resolves *which table* applies
- Marital status; one vs two income earners (titulares); sole-earner status
- Number of dependents
- Region: **Continente / Madeira / Açores** (different tables)
- Disability (holder and/or dependents) — *deferred to Phase 4*
- Pensioner vs worker; non-resident — *deferred*

Everything above is **categoria A** — trabalho dependente. Recibos verdes
(categoria B) are a different engine, not a case of this one; see §11.

### Non-salary components
- Isenção de horário de trabalho (IHT, CT art. 265.º): ordinary remuneration — taxed and contributed on like base salary. Modelled as its own input purely so the result can itemize it
- Meal allowance (subsídio de alimentação): exempt up to a limit; **cash vs card limits differ**
- Christmas/holiday subsidies: paid as duodécimos (monthly) vs lump sum — changes the monthly picture

### IRS Jovem (opt-in, at source) — a modifier, not a new engine
- Extra inputs: `irsJovem: boolean`, `irsJovemYear: 1..10`, `age`
- Exemption schedule (2026 regime, Art. 12.º-B CIRS): **100%** yr 1 · **75%** yrs 2–4 · **50%** yrs 5–7 · **25%** yrs 8–10
- Eligibility: ages 18–35, no degree requirement
- Cap: **55 × IAS** on exempt income → **€29,542.15** in 2026 (IAS €537.13); income above is taxed normally
- **At-source arithmetic (resolved, CIRS art. 99.º-F n.º 4).** The rate is the one the tables give for the **totality** of the income, exempt part included; it is then levied **only on the non-exempt part**. The exemption shrinks the base, not the rate — so a young earner keeps the progressivity of their real salary. Taxing the non-exempt part as if it were the whole salary (the intuitive but wrong reading) would give zero withholding in most cases.
- **Pro-rating the cap (despacho §5.g).** The annual 55 × IAS ceiling is divided by **14** — 12 salaries plus the two subsídios — giving 2 110,15 €/payment in 2026. A duodécimo carries the same share of the ceiling as it does of the subsidy.
- IAS 2026 = **537,13 €** (Portaria n.º 480-A/2025/1), so the annual ceiling is 29 542,15 €.

### Output shape (structured, so the UI can present honestly)
- gross, net, breakdown (IRS withholding, Seg. Social, exemptions applied)
- for IRS Jovem, also the counterfactual: what the month *would* have withheld without the exemption, and the resulting relief (salary + duodécimos). The UI shows the ordinary IRS as the deduction and credits the relief back on its own line, so the regime's worth is visible rather than implicit in a smaller number
- explicit `isWithholdingEstimate: true` + a machine-readable caveat that
  retenção is an advance, not the final tax (sharper for IRS Jovem earners who
  cross the annual cap).

---

## 5. Data & config strategy (the maintainability core)

Everything time-varying is a versioned dataset keyed by **effective date**, so
historical and current rules coexist and correctness is date-aware.

- IRS withholding tables — per year, per region. Each region publishes its own despacho: Continente via the AT (DR), Madeira via the Secretaria Regional das Finanças (JORAM), Açores via DR. Format varies and matters — the Açores 2026 tables are images, which defeats mechanical extraction entirely. No public API exists — the Autoridade Tributária publishes these as PDFs each year via despacho (e.g. 2026 tables via Despacho 236-A/2025). **Manually transcribe from the official PDF, then cross-check against an independent source** (e.g. Doutor Finanças' published tables or the Finanças simulator) before trusting the data. Revisit PDF-parsing automation only once the document's layout has proven stable across multiple years.
- IAS — per year (drives the IRS Jovem cap and more).
- IRS Jovem parameters — schedule, cap multiplier, at-source mechanism per despacho.
- Banco de Portugal macroprudential parameters — for the loan phase (see §7).
- Euribor — live feed (ECB Data Portal) with a browser cache and a bundled snapshot as last resort; never hardcoded. Monthly averages, because Instrução 23/2023 art. 1.º n.º 4 defines the index as the previous month's simple average of daily quotes — the ECB publishes exactly that series, and the equivalence is written down in the dataset rather than left implicit.

The engine selects the right dataset by date. **Adding a year = a data PR with no logic change.**

Knowing *when* that PR is needed is `packages/sources`' job, not a human's memory: every dataset above is registered there with the rhythm its publisher works on, and a daily workflow says which ones have been superseded (§9). Adding a dataset without registering it fails `manifest.test.ts`.

---

## 6. Accuracy strategy — how "accurate" is proven

A **golden-test suite** is the headline feature of the engine (and very
portfolio-friendly):

- 30–50 real scenarios, each with an expected output computed from an **official source** (Finanças' own simulator; a couple of bank mortgage simulators for the loan side).
- Assert the engine matches to the cent.
- Runs in CI on every change; **rerun on every tax-year / parameter update**.

This suite *is* the honest answer to "accurate for every case": accuracy that is
demonstrated and regression-protected, not asserted.

**Two axes, and they are not interchangeable:**

- **Axis A — transcription fidelity.** Are the numbers copied correctly? Checked by diffing the dataset against an independent mechanical extraction of the source PDF (fixture + test, runs in CI).
- **Axis B — model and mapping.** Does the engine *apply* the tables the way AT does — right table per category, right rounding, rules of §5 honoured? Only an end-to-end comparison against a third-party simulator catches this. Captured scenarios are checked in as a fixture, so the comparison is re-run in CI rather than being a one-off.

A test whose expected values are computed from the dataset it is testing proves
neither. Both axes must pass before a dataset is marked `verified: true`.

**A third state, because `false` was doing two jobs.** For some datasets Axis B
cannot exist at all — a published price list is not a computation, and agreement
with it is not corroboration of it. Reporting those as `false` said "we have not
got round to this" about something nobody could ever get round to, and, worse,
poisoned every aggregate they fed: `purchaseCosts` ANDed the Casa Pronta tariff
into its flag, so no amount of work on IMT or the selo could ever have lifted a
costed answer above "Dados por verificar". `Verification` is therefore
`boolean | "not-applicable"`, combined by one function (`allCrossChecked`)
rather than an `&&` chain rewritten at each call site. Non-applicable sources
drop out rather than voting — they can neither hold an answer down nor rescue
one — and only a literal `false` renders as a caveat. This does not hide
anything: it is what lets the badge name a real gap instead of a permanent one.

**When a peer disagrees, adjudicate.** Axis B sources are peers, not
authorities, and two of them have now been caught departing from the statute
(CalculaPT's IMT parcela, Doutor Finanças' Madeira upper brackets). A
divergence is resolved against the primary source or against a property the
statute forces — not by moving the engine to match. Where a tolerance is
granted to accommodate a peer's defect, it is pinned beside the reason and a
counter-example, so it cannot quietly become licence for this engine to drift.

**What `verified` claims, and what it cannot.** On the wage side the answer is
legally determined end to end, so the flag covers the whole output. On the loan
side it does not: a bank's answer is part statute and part commercial policy
(its spread, its bundling, its appetite, the 10 % of semester volume allowed to
exceed the DSTI ceiling). Only the statutory half is computed here, so only the
statutory half is verified — and the flag is documented in each dataset to say
exactly that. Verifying a number the engine never asserts would be a claim
about someone else's pricing, not about this code.

---

### 6.1 Resolved — withholding on duodécimos

Despacho §10 gave the principle but not the arithmetic, and probing a
third-party simulator produced inconsistent readings (11,20 % implied at a
1 500 € salary, 18,72 % at 2 500 €). The rule comes from the statute:

- **CIRS art. 99.º-C n.º 5** — the subsídios de férias e de Natal are *"sempre
  objeto de retenção autónoma, não podendo, para cálculo do imposto a reter,
  ser adicionados às remunerações dos meses em que são pagos"*. A duodécimo
  therefore never pushes the salary into a higher bracket, nor the reverse.
- **CIRS art. 99.º-C n.º 6** — when paid fractionally, each payment withholds
  *"a parte proporcional do imposto calculado nos termos do número anterior"*:
  compute the tax on the **whole** subsidy, then pro-rate it.

The engine implements exactly that. The subsidy gets its own bracket lookup,
its own parcela a abater and its own per-dependent deduction; the month
withholds `fraction/12` of the result. Duodécimos *are* remuneration for
Segurança Social, so they enter the 11 % base (confirmed empirically).

**Known divergence:** at 2 500 € the reference simulator returns 2 046,49 €
against the engine's 2 045,94 €, a 0,55 € gap — it appears to round the
subsidy's effective rate, where n.º 6 pro-rates the tax itself. The statute
wins; `wage/twelfths.test.ts` records the gap explicitly rather than hiding
it. Worth re-checking against the Finanças simulator if that ever becomes
reachable.

### 6.2 Resolved — trabalho suplementar

**n.º 8** halves the rate, and despacho 233-A/2026 §5.f says exactly which
rate: *"é aplicada a taxa efetiva mensal de retenção na fonte correspondente
a 50 % da que resultou, após a aplicação da taxa marginal máxima, da parcela
a abater e, se aplicável, da parcela adicional a abater por dependente, para
a remuneração mensal [...] referente ao mês"*. So the reference is the
**effective** rate — withholding ÷ remuneração, after both parcelas — not the
bracket's marginal rate, and it is the salary's rate: overtime never enters
the salary's own bracket lookup. It is contributory for Segurança Social.

Lei n.º 45-A/2024 removed the earlier "a partir da 101.ª hora" threshold, so
the halving applies from the first hour and no cumulative-hour counter is
needed — which is what kept this cheap.

Under IRS Jovem, despacho §5.g caps the year's *accumulated* monthly
exemptions at the annual limit ÷ 14, so overtime shares what is left of the
month's ceiling after the salary rather than carrying a slot of its own.

---

## 7. Loan engine (later phase)

Consolidate the existing React mortgage sim and consumer-loan sim into `@engine`.

- **Forward** (payment from house price): French amortization, `M = P·r·(1+r)ⁿ / ((1+r)ⁿ − 1)`, rate = Euribor(tenor) + spread. Largely done.
- **Reverse** (max loan from salary): solve for the amount where **stressed DSTI** hits the ceiling, then cross-check LTV and the age-based maturity cap.

Current BdP parameters (config, effective **1 Aug 2026** — Recomendação 1/2026, transcribed from the official PDF):
- DSTI ceiling **45%** (art. 6.º n.º 1); up to **10%** of a bank's semester volume may exceed it (n.º 2)
- LTV: **90%** own permanent residence · **80%** other purposes (art. 5.º), on the **lower** of price and appraisal value (art. 4.º)
- Maturity: **40 yrs** for borrowers ≤35 · **35 yrs** for >35 (art. 7.º); with two borrowers, the **older** one's age governs. The 2018 average-maturity recommendation was *eliminated*
- Income: annual ÷ 12 (art. 4.º n.º 5 a). For contracts ending past 70, a **20% reduction weighted by the share of the contract lived past 70** — not a flat 20%: a 40-year-old on a 35-year loan takes 20% × 5/35 ≈ 2,9%. Waived if already retired (al. b)

### 7.1 The rate shock lives in a different instrument

Recomendação art. 6.º n.º 2 does not state the shock — it defers to **Instrução n.º 23/2023** (BO 9/2023 2.º Supl.), which sets it by contract term: **+0,5 p.p.** (≤5 yrs) · **+1 p.p.** (>5 ≤10) · **+1,5 p.p.** (>10). Bounds are inclusive, so a 10-year contract takes 1 p.p. The 2018 predecessor used a flat 3 p.p., fixed when ECB rates were near zero; Instrução 23/2023 revoked it.

Two consequences the engine encodes:

- The shock is a **separate dated dataset** from the Recomendação, because the two are separate legal instruments on separate revision cycles. Either can be re-issued without touching the other.
- Only the **new** contract's instalment is stressed. Instalments on credit already held enter the DSTI numerator at face value ("as prestações do novo contrato devem assumir-se constantes e refletir impacto de um aumento da taxa de juro"). Stressing everything — the intuitive reading — understates capacity.

Art. 1.º n.º 4 also fixes what "the Euribor" means for this purpose: the **simple arithmetic mean of the daily quotes in the month before the assessment**. The live feed must therefore expose a monthly average, not a spot rate.

These are exactly the parameters that changed this month — which is why they live in dated config, not in code.

### 7.2 The taxes are a separate problem from the credit

Financing the house and buying it are two different calculations, and only the
first is what the Banco de Portugal governs. The purchase itself carries IMT
(CIMT art. 17.º), imposto do selo on the transaction and on the credit (TGIS
verbas 1.1 and 17.1), and the registration emoluments — on a 250 000 € purchase
roughly 11 000 €, which is the part a first-time buyer has least often budgeted
for.

Three consequences the engine encodes:

- **Three dated datasets, not one.** The IMT brackets re-index every January
  with the OE law; the selo rates have not moved since DL 48-A/2024 added art.
  7.º-A in 2024; the Casa Pronta tariff is emolumental, on its own cycle. One
  combined dataset would give two of the three a fictitious effective date.
- **The valuations disagree on purpose.** Recomendação art. 4.º puts the LTV on
  the *lower* of price and appraisal; CIMT art. 12.º puts the tax on the
  *greater* of price and VPT. Same property, opposite directions, and the two
  live in adjacent fields of the same input type.
- **Some rules only make sense as exemptions with reasons attached.** The 4 %
  selo on interest is not omitted from a mortgage — it is exempted by CIS art.
  7.º n.º 1 al. l), and the result carries the reason so the UI can explain a
  zero rather than print one.

### 7.3 The reverse-reverse direction, and why it needed a search

`maxLoan` inverts analytically because the annuity is linear in the principal.
Solving for the *price* does not, and the reason is the tax table: IMT's top
rows are taxas únicas charged on the whole value, so the cost function steps
upward at 660 982 € and 1 150 853 €, the young table's advantage ends at a
cliff, and crossing 450 000 € withdraws the state guarantee. Every one of those
jumps is upward — so `cashNeeded(price)` is monotone and a search is sound —
but they mean the equation `cashNeeded = savings` can have no solution at all.
The solver therefore bisects the *predicate* `cashNeeded ≤ savings`, which is
true-then-false whether or not a root exists, and composes `maxLoan` at each
candidate rather than duplicating any of it.

---

## 8. Roadmap

### Phase 0 — Scaffolding
- [x] Monorepo (npm workspaces — see §10) with `engine` + `web` packages
- [x] `engine` package skeleton, shared `types.ts`
- [x] Vitest + golden-test harness wired into CI
- [x] PWA shell (Vite + `vite-plugin-pwa`), installable, offline-capable — app icons are still the placeholder SVG

### Phase 1 — Net wage (withholding + IRS Jovem)  ← MVP
- [x] 2026 IRS tables (Continente) ingested as versioned data — Tabelas I/II/III from Despacho 233-A/2026, transcribed from the official PDF
- [x] Transcription cross-check (Axis A): all 36 brackets diffed against an independent mechanical extraction of the despacho PDF; the extraction is checked in as a fixture and re-diffed in CI (`continente-2026.source.test.ts`)
- [x] End-to-end cross-check (Axis B): 11 scenarios vs the Doutor Finanças 2026 simulator, all matching to the cent — every category, the R-dependent formula parcela, the §5.h 3+ dependents reduction and bracket boundaries (`wage/external-crosscheck.test.ts`). `CONTINENTE_2026.verified` is now `true`
- [x] Marginal-rate withholding (incl. R-dependent parcela a abater + 3+ dependents −1pp, §5.h) + Seg. Social 11%
- [x] Case matrix: marital / titulares / dependents (unmarried, married single-earner, married dual-earner)
- [x] Meal allowance (cash vs card) — per-day ceilings as versioned data (10,46 € card / 6,15 € cash for 2026); excess enters both the IRS withholding base and the Segurança Social base. 4 golden scenarios vs the simulator
- [x] Isenção de horário de trabalho — ordinary remuneration, so it enters both the IRS withholding base and the Segurança Social base. Whether the subsídios include it is contractual (CT art. 264.º/265.º is not decisive), so the UI asks rather than the engine assuming: the answer is expressed through the existing `subsidyAmount` input
- [x] Trabalho suplementar — autonomous withholding at half the month's effective rate (CIRS art. 99.º-C n.º 8 + despacho §5.f); see §6.2
- [x] Duodécimos toggle — subsídios de férias/Natal in twelfths, withheld autonomously per CIRS art. 99.º-C n.ºs 5–6; see §6.1
- [x] IRS Jovem modifier — schedule and 55 × IAS cap from CIRS art. 12.º-B, at-source mechanism from art. 99.º-F n.º 4, per-payment ceiling (÷14) from despacho §5.g. 7 golden scenarios vs the IRS Jovem simulator, incl. two where the cap bites
- [~] Golden tests vs official despacho formula (8 scenarios) — note these are circular by construction (expectations derive from the same transcribed numbers), which is why the Axis A/B cross-checks above exist
- [x] UI: vencimento + situação + dependentes on the surface, everything else behind the "O meu caso" `<details>` panel — subsídio de alimentação, duodécimos, IRS Jovem, região. Live calculation, no submit button; the pure helpers (parsing, form→`WageInput` mapping, breakdown lines) are unit-tested separately from the components
- [x] Employer cost (custo para a empresa) — everything paid out plus the employer's 23,75 % TSU on the same contribution base as the employee's 11 % (Código Contributivo art. 53.º). Direct cost only: seguro de acidentes de trabalho, medicina no trabalho and training have no statutory rate to apply, and the UI says so rather than inventing one
- [x] Part-to-whole chart of where the gross goes (líquido / IRS / Segurança Social) — a horizontal stacked bar, not a pie: three slices, long labels, and it holds up at phone width. Palette is the validated categorical slots 1–3, checked in both modes; identity never rests on colour alone (legend + the table below)
- [x] "Simulação, não é aconselhamento" + "retenção ≠ imposto final" notices, shown with every result alongside the dataset's provenance and its `verified` badge

### Phase 2 — Loan
- [x] BdP params in dated config — `BDP_2026` (Recomendação 1/2026) and `INTEREST_RATE_SHOCK_2023` (Instrução 23/2023) as two separately-versioned datasets, selected by **assessment date** (art. 11.º keys on the solvency assessment, not the signature). Assessments before 1 Aug 2026 throw rather than silently answering under the wrong regime — the 2018 Recomendação is not modelled
- [x] Transcription cross-check (Axis A): every limit diffed against verbatim provisions mechanically extracted from both official PDFs, checked in as fixtures and re-diffed in CI (`bdp-2026.source.test.ts`). The test pulls the number back out of the quoted article, so editing a limit without the law changing fails
- [x] Forward: French amortization — instalment, totals, and the full `mapa de amortização`. Anchored on published annuities (200 000 @ 6 %/30 y = 1 199,10) and on structural invariants, not on a re-run of its own formula
- [x] Reverse solver: max loan from salary — stressed DSTI, LTV on the lower of price/appraisal, maturity capped by the older borrower's age, and the weighted past-70 income reduction. Reports **which constraint binds** rather than only the minimum, since the remedy differs entirely (earn more / bigger deposit / longer term)
- [ ] Fold existing mortgage + consumer-loan sims into `@engine` — **blocked**: the sims live outside this repo and no path/URL has been supplied. The forward direction was written from the statute-level formula instead, so nothing downstream waits on it; folding them in is now a reconciliation exercise (diff their output against `amortize`) rather than a port
- [x] Euribor live feed + cached fallback — ECB Data Portal (`FM.M.U2.EUR.RT.MM.EURIBOR*.HSTA`), which publishes **monthly averages** directly, so no daily-quote averaging is needed. It sends `access-control-allow-origin: *`, so the fetch runs from the browser with no proxy and no backend — the privacy claim is untouched, since the request carries nothing about the user. Order of preference: cache for the right month → live fetch → snapshot compiled into the bundle; the UI names which one it used. Usability is decided by **month, not TTL** (`isCurrentFor`): a snapshot from the wrong month is wrong however fresh it is
- [x] Fixed vs variable rate — Instrução 23/2023 art. 1.º prescribes a shock for *taxa variável* (n.º 1) and *taxa mista* (n.º 2) only, and Recomendação art. 6.º n.º 2 defers to it entirely, so a fully fixed contract is tested at its own rate. Recorded as a reading in `LoanRateType`: the statutes define the shock by scope rather than stating the exemption outright
- [x] **Taxa mista** — art. 1.º n.º 2: the tested instalment is the **higher** of the shocked post-fixed one and the fixed-period one. Three details the wording settles and a naive reading drops: the shock band comes from the *contract's* duration rather than the fixed period's; the post-fixed leg is computed on the balance outstanding when the fixed period ends, over the remaining term, not on the original capital; and al. b) exists so a high fixed teaser followed by a cheap indexed rate cannot test as cheap. Both legs are linear in the principal, so the reverse solver still inverts analytically
  - **Why it mattered**: BdP's own statistics put taxa mista at **~85 % of new lending** in mid-2026 (variável ~13 %, fixa ~2 %). Leaving it out excluded most borrowers — a scoping decision that looked reasonable until the market data was checked
  - The engine now reports `stressedPayment` alongside `contractPayment`, because for mista the instalment paid and the instalment tested come from different legs and different balances, and the UI cannot reconstruct either from a single rate
- [x] **Axis B for the loan side** — 7 scenarios against the Crédivel simulator, an independent implementation that states it follows Recomendação 1/2026 *and publishes its own arithmetic* (Euribor 12M 2,798 % + 0,7 spread, stressed by 1,5 p.p.), which is what makes the rate constant on both sides. All 7 match **to the euro** across terms from 20 to 40 years — the 45 % ceiling, income as denominator, existing debt at face value with only the new instalment stressed, and the inversion of the annuity. `BDP_2026.verified` and `INTEREST_RATE_SHOCK_2023.verified` are now `true` (`loan/external-crosscheck.test.ts`)
  - **What `verified` claims here**: the legally determined computation, and nothing about commercial pricing — spread, bundling, credit policy, the 10 % exception allowance. The engine does not compute those, so it cannot verify them
  - **Two rules Axis B did not reach**: the LTV ceiling (the source takes no property price) and the past-70 income reduction, which it does not implement — it takes only an age *band*, which cannot express the weighting
  - **Known divergence, recorded not smoothed**: the two >35 scenarios come out 0,57 % below the source, exactly the weighted reduction of art. 4.º n.º 5 al. b) for a 36-year-old over 35 years. Undo the haircut and both sides agree to the euro; the same-age 30-year scenario matches exactly, isolating the reduction as the sole cause. The statute wins, as it did for the duodécimos gap in §6.1
- [x] Loan UI — rendimento + preço + idade + prazo on the surface, taxa/finalidade/outros créditos/avaliação behind "O meu caso". The result names **which limit binds** and what moves it, since being capped by income and by the property's value call for opposite responses. Shows the deposit implied, the real effort rate (kept distinct from the supervisory DSTI, which sits on 45 % by construction), and the two ceilings as a shared-scale comparison. Loan amounts are floored to the euro — a ceiling rounded up is a ceiling overstated
- [x] Default spread and indexante — **resolved, and calibrated against the data the app now shows**. Spread **0,7 %**: still an assumption, but a published one — it is the "spread base" in the Crédivel simulator's own stated methodology, the same independent implementation Axis B uses. Indexante **Euribor 6M**, because 49 % of new variable contracts follow it against 33 % on 12M.
  - **Why they changed.** Once BdP's distribution of real rates went on screen, the old defaults (1,0 % over 12M) became visibly incoherent: the untouched form composed to roughly the **90th percentile**, so the tool flagged its own starting point as dearer than 90 % of the market. At 0,7 % over 6M it lands between the median (3,19 %) and p75 (3,43 %) — mildly conservative, which is the right direction for a capacity tool, without the contradiction. A test pins the property so a future default cannot silently drift back outside the published range
- [x] Default spread — **originally a labelled placeholder plus sourced context**, because it cannot be derived. The context is now Banco de Portugal's own BPstat (domain 186), restricted to **variable-rate** new business: p10 2,65 % · median 3,19 % · p90 3,66 % for June 2026. Bank-reported to BdP, which is the authoritative channel — unlike the Axis B simulators
  - **Why still not derived.** Restricting to variable contracts removes the product-mix problem that made the first attempt (ECB MIR, all products) unsound, but not the signature lag: a June contract carries the Euribor fixing from when it was agreed, which in a rising market is below June's. The implied margin therefore still reads ~0,4 pp against real retail spreads nearer 1 pp. `euribor.test.ts` pins the non-derivation so nobody later "fixes" it by wiring the subtraction in
  - The UI now says what can be said honestly — "half of variable-rate contracts came in below 3,19 %" — beside the user's own composed rate, and leaves the judgement to them
  - The reference is a **bundled dated dataset**, not a live fetch: it is context, not an input, so unlike the Euribor index it has no legal currency requirement. Refresh with the tax-year datasets
- [~] **Preçários — investigated, not built.** Aviso 8/2009 makes them mandatory and they are collected on clientebancario.bportugal.pt, including a *folheto de taxas de juro* per institution. But: **169 institutions**, one PDF each, history to 2017, served through an HTML filter form with no API or bulk index — and the spreads inside are representative examples conditional on bundling (one published example: Euribor 12M + 2,6 % unbundled). That is a large, brittle pipeline for a number that stays a conditional range. BPstat already answers the same question market-wide from the same banks' reporting, in JSON. Revisit only if per-institution detail becomes the point, and then for the ~20 retail banks rather than all 169

### Phase 2.1 — Consumer credit
- [x] **Crédito ao consumo** — the other half of Recomendação 1/2026, and the half PLAN.md §2 had declared in scope since the loan phase began. Same DSTI machinery, two differences straight from the statute: **no LTV** (nothing is secured, so art. 5.º simply does not apply and income is the only ceiling), and **maturity set by purpose rather than age** — 7 yrs crédito pessoal, 10 yrs automóvel, 10 yrs for personal credit earmarked for education, health or the energy transition (art. 7.º n.ºs 3–4). The n.º 4 exception is conditional on the institution verifying the purpose, which the engine cannot do, so the UI presents it as the caller's assertion rather than an entitlement
  - The past-70 income reduction **does** apply: it is a rule about the DSTI denominator, which is shared, not a housing rule
  - These terms finally exercise the **≤5 yr and 5–10 yr shock bands** that no mortgage ever reaches — until now those two bands were covered by Axis A only, since no mortgage simulator can exercise them
  - The default rate is **sourced, not invented**: the ECB's average annualised rate on new Portuguese consumer credit (8,81 %, June 2026). Unlike the mortgage spread this quantity is directly observable — consumer credit is agreed as a single fixed rate, so the published average is exactly what the form needs, with no derivation to go wrong
  - Axis A extended to the new ceilings, diffed against the same extracted PDF

### Phase 2.2 — The cost of buying, and the other direction
- [x] **Purchase taxes and costs** — the panel used to say "acresce o IMT, o imposto do selo e a escritura" and stop, which left the second-largest number in the transaction outside the tool. Now computed from **three separate dated datasets**, kept apart because they are three instruments on three revision cycles: `IMT_2026` (CIMT art. 17.º as re-indexed by the OE 2026, all six tables), `STAMP_DUTY_2024` (TGIS verbas 1.1 and 17, plus CIS art. 7.º-A) and `REGISTRATION_FEES_2024` (Casa Pronta, emolumental rather than fiscal). Bundling them would have stamped a fictitious effective date on two of the three and re-asserted `verified` over them on the strength of an IMT-only check
  - **Three valuations, and two of them pull in opposite directions.** LTV takes the *lower* of price and appraisal (Recomendação art. 4.º); IMT and the verba 1.1 selo take the *greater* of price and VPT (CIMT art. 12.º). Getting this backwards understates the tax on exactly the older stock where the VPT most often exceeds the price, so both fields carry the warning in their doc comments
  - **The taxa-única bands jump upward, and that is the statute rather than a bug.** The top IMT rows are average-rate bands charged on the whole value: at 660 982 € the Continente HPP table goes from 39 115,21 € to 39 658,92 €, so one euro more house costs 543,71 € more tax. Pinned by a test that anyone "fixing" it later would have to delete first
- [x] **IMT Jovem, modelled as what it actually is.** Not merely a softer rate table: CIMT art. 9.º n.º 2 is a full exemption up to the top of the 1.º escalão, art. 17.º n.º 1 al. b) a reduced table above it, and **CIS art. 7.º-A a dedução à coleta of the verba 1.1 selo**, capped at 0,8 % × that same bracket (2 644,31 € in 2026). Omitting the art. 7.º-A deduction — the easy mistake, since the popular guides describe the whole thing as one exemption — would have invented about 2 400 € of tax on a 300 000 € purchase
  - Both ceilings are read **by reference** off `IMT_2026` rather than copied, because that is how the statutes define them. They re-index every January without the selo or registration datasets changing
  - **The benefit ends at a cliff, not a taper.** Above 660 982 € the young table and the general one are the same table, so the advantage is worth 13 223 € at that value and nothing a euro later
  - **The registration relief is a REDUCTION, not the isenção it is universally called.** RERN art. 28.º n.º 37 does exempt the registos, but n.º 40 says that through the procedimento especial — which is what Casa Pronta is — the procedure's emoluments are instead reduced by 450 € where more than one facto is registered. A qualifying buyer with a mortgage pays 250 €, not zero. Found by reading DL 48-D/2024 itself; every secondary source consulted said "isento"
- [x] **Imposto do selo on interest is zero here, and that is a derivation rather than an omission.** CIS art. 7.º n.º 1 al. l) exempts the juros of credit for habitação própria, so verba 17.3.1's 4 % never applies to the mortgage this tool computes. Carried in the dataset anyway, and charged for `purpose: "other"`, because the engine has to be able to say *why* a line is zero — and because the exemption also reaches a second own home, which the engine cannot tell from a rental, so the UI says so rather than assuming
- [x] **"Custo total mínimo do crédito" — deliberately NOT labelled MTIC.** The review comment asked for the MTIC, and the honest version of it carries a different label. The MTIC is a regulated disclosure with a fixed composition (montante total do crédito + custo total do crédito), and the custo total includes the commissions and the life and multi-risk policies this app cannot know. A figure labelled MTIC that sits systematically *below* the bank's MTIC reads as the bank overcharging. So the number ships under a label it can defend, itemised, with the MTIC named only to say what the gap consists of. The method does match — the FINE assumes today's rate holds for the whole term, which is what `amortize` already does; only the scope does not
- [x] **The reverse direction — `maxPropertyPrice`.** Savings in, price out, because "what is my ceiling?" was the question the tool could not be asked and the one most people arrive with. It **composes** `maxLoan` once per candidate price rather than restating it, so taxa mista, the past-70 haircut, the maturity cap and the shock bands all stay in one place
  - **Bisect the predicate, not the root.** `cashNeeded(price)` is strictly increasing but *discontinuous*: the IMT taxa-única bands step up, the young table's cliff steps up, and crossing 450 000 € withdraws the state guarantee and drops the loan by 45 000 €. Every jump is upward — the flat bands are average-rate bands, so the marginal rate never falls in the way that would break monotonicity — but they do mean `cashNeeded = savings` can have no solution at all. Root-finding is the wrong tool; the monotone predicate `cashNeeded ≤ savings` is not. A property test sweeps every known edge and asserts the function never falls, because a downward step would make the search return a silently wrong answer rather than fail
  - **No closed-form per-bracket solve**, though one is possible: it would copy the bracket table into the solver, against the "a new rule is a data change, not a code change" bet the whole engine rests on
  - The answer is floored to the euro and then stepped down until genuinely affordable, which is what lands a notched case exactly on 450 000 € rather than a cent past the edge of a jump
- [x] **Garantia pessoal do Estado (DL 44/2024 + Portaria 236-A/2024/1), modelled as a deviation rather than a carve-out.** Recomendação art. 5.º caps LTV at 90 % flat, with no proviso for a guaranteed loan — the extracted fixture text says so. Lending at 100 % is a departure that the institution justifies contract by contract. So `ltvLimit: 1.0` is **never** written into `BDP_2026`; it lives in its own dataset, `MaxLoanResult.ltv.source` says which of the two produced the ceiling, and the UI tells the user this exceeds what the Banco de Portugal recommends and is the bank's call
  - **Eligibility is asserted, never derived**, and one condition makes that unavoidable: the income test is *rendimento coletável anual* against the 8.º escalão do IRS, and there is no honest mapping from the monthly income this form holds. The two conditions the engine *can* check — age ≤ 35 and the 450 000 € transaction ceiling — it enforces, overriding the assertion rather than trusting it
  - **The first dataset with an end date.** The regime lapses in December 2026, which the newest-`effectiveFrom` lookup used everywhere else cannot express — it would go on returning an expired regime forever. That forced `effectiveOn` in `data/index.ts`, replacing five copied filter/sort/throw blocks with one that understands `effectiveTo`
  - `verified: false`, on Axis A alone — the transcription has not been diffed against the instrument. Axis B cannot exist for a quantity that is a *departure* from the rule, since there is no independent implementation of it to reproduce, so when the Axis A fixture lands this becomes `"not-applicable"` rather than `true`. Until then any answer leaning on it is reported as unverified
  - Checked while establishing that: **DL n.º 24/2025** amends DL 44/2024 to extend the guarantee to sociedades financeiras. It widens who may lend and touches none of the parameters modelled here
- [x] **Axis A for the IMT tables** — all 36 rows of all six tables re-diffed in CI against a mechanical `pdf2json` extraction of the official ofício circulado, with each row's numbers also pulled back out of the verbatim Portuguese line they were read from
  - A parsing trap worth recording: the thousands separator is a space, so a loose `\d[\d ]*` reads "792 414 8%" as the single number 7 924 148 and the row silently stops being checked. The pattern has to know that a group following a space is exactly three digits
- [x] **Axis B for the IMT tables — done, `IMT_2026.verified` is now `true`.** 29 scenarios in `loan/imt-crosscheck.test.ts`, replayed from two independent simulators. The AT candidate pencilled in here is gone: `imoveis.portaldasfinancas.gov.pt/simuladorimt/` answers "Aplicação Inexistente" (checked 2026-08-30), so Axis B is peers rather than an authority
  - The **Ordem dos Notários'** simulator agrees to the cent across the general Continente table, the taxa-única jump at 660 982 € included. **CalculaPT** covers what that one does not expose cleanly — the young table, rústicos, outros, and the Regiões Autónomas separately — and agrees exactly on those. It also confirms Açores and Madeira return identical figures, which is the assumption behind collapsing them into one territory
  - **A disagreement, adjudicated rather than deferred to.** CalculaPT is off by up to 0,09 € wherever a parcela a abater applies, using 10 458,04 where the ofício and this engine use 10 457,96. Art. 17.º n.º 3's "taxa média / taxa marginal" construction forces the tax to be *continuous* at each boundary, and only this engine's parcelas are: worst discontinuity across all six tables is 7e-12 €, against a 0,08 € step from theirs. The per-source tolerance is pinned next to that property and an explicit counter-example, so it cannot quietly become licence to drift
  - Capture note: the notaries' simulator lags one update behind its own inputs, so readings were accepted only where the panel's selo line matched 0,8 % of that same reading's price. That check rejected one value
- [ ] **Axis B for verba 17.1 and 17.3.1 of the selo — still open, and now the only thing holding the loan badge red.** Verba 1.1 and the art. 7.º-A dedução were cross-checked alongside the IMT (a young buyer's selo fully absorbed at 250 000 €, the cap binding at 400 000 €), but neither simulator lends money, so nothing has checked the 0,6 % on the credit or the 4 % on interest. `STAMP_DUTY_2024` therefore stays `false`
- [x] **Result panel restructured — answer first, working behind disclosures.** The column had grown to headline → two ceiling bars → a full line chart → the market comparison → a table of lines → three caveats → sources, and the taxes made it longer still. Now the answer, the one sentence that explains it, the cash the buyer has to produce and every caveat stay open; the market comparison, the ceilings and the costs go behind three `<details>` built on the existing "O meu caso" pattern
  - The market comparison was the specific complaint, and the diagnosis was concrete: fifth in the column, under a chart, headed by `h3.group-title` — the weakest heading token in the system, shared with form sub-group labels — and with **no `.market-comparison` rule in `App.css` at all**, so it had no card, border or spacing of its own. It now owns a disclosure whose summary *is* its heading
  - `.notices` never collapses. §9's "a caveat behind a disclosure is not a caveat" is a rule rather than a judgement call, and the same goes for the conditional callouts about the particular answer on screen
  - `ConsumerResultPanel` deliberately left flat: its own header explains it is short because there is no LTV and only one ceiling, and adding disclosure to a panel with nothing to hide is churn
- [x] **One bug the tests missed and the browser caught.** In capacity mode the binding constraint was first attributed to the DSTI whenever the DSTI capped the loan — and the panel then told a borrower "uma entrada maior não altera este limite" while their loan was frozen by income and every extra euro of savings went straight into price. The forward direction's attribution does not transfer: there the loan is the answer, here the price is, and the price stops where the cash does whatever capped the loan. `MaxPriceResult` now reports `cash`, with `loanResult.bindingConstraint` underneath it, and the remedy names which lever actually moves

### Phase 3 — Recibos verdes (categoria B)
- [x] **Say the scope out loud, before building anything.** The omission was
  silent, which is the worst state for an app whose whole posture is naming what
  it does not know. The wage form's own field now says "trabalho dependente —
  não serve para recibos verdes", and the always-open `.notices` block says why:
  the tables, the 11 % and the subsídios are all categoria A
- [x] **The loan side already answers independents correctly — only the wording
  was wrong.** DSTI reads `borrower.monthlyIncome` and the Recomendação draws no
  distinction by employment type, so the arithmetic needed nothing. But both
  income hints said "com 14 meses, use o anual a dividir por 12", which quietly
  addresses only salaried users; they now say *annual ÷ 12 whatever the source*,
  which is what art. 4.º n.º 5 al. a) actually prescribes. `LoanNotices` also
  records the part that is **credit policy, not regulation** — two to three years
  of declared income, and a haircut of the bank's own choosing
- [x] **The calculator itself** — a third tool, "Recibos verdes", answering
  *what is left of this invoice this month* rather than pretending to be a net
  wage. Four dated datasets, an engine module composed from a per-invoice half
  (retention) and a per-period half (contributions), and a form whose surface is
  two fields. The rules, the corrections the statutes forced and the gaps are in
  §11
  - **Form shape resolved** (§10 open decision 2): monthly on the surface, the
    three quarter months behind "O meu caso". Steady income makes the two
    mathematically identical — a third of three equal months is the month — so
    the default is exact for most users rather than merely close, and a test
    pins that property because the whole form shape rests on it
  - **The ISS's four worked examples reproduce to the cent**, accumulation
    remanescente and 12 × IAS cap included. Not full Axis B, and §11.4 says why
- [x] **Axis B** — three independent public simulators reproduced to the cent
  across six scenarios, alongside the ISS's own four worked examples.
  `CIRS_RETENTION_2026` and `SELF_EMPLOYED_CONTRIBUTIONS_2018` are now
  `verified: true`; `CIVA_EXEMPTION_2026` is not, and the answer's flag is
  conditional on whether it entered the arithmetic. §11.4 lists what Axis B
  reached and what it did not
  - **Segurança Social Direta is not reachable** — it sits behind a NISS login,
    so it cannot be driven. A permanent constraint, not a pending task
- [x] **Regiões Autónomas IVA rates** — the flat 23 % was simply wrong outside
  the Continente. Now 23 / 22 / 16 by region (CIVA art. 18.º n.ºs 1 and 3), with
  the region asked only when IVA is actually charged. It moves the invoice total
  and never the take-home, and a test pins that so the control cannot be read as
  a tax break
- [x] **Propriedade intelectual** — see §11.5

### Phase 4 — Long tail (opt-in scope)
- [ ] Disability tables
- [x] **Madeira** — Despacho n.º 19/2026 (JORAM II Série n.º 13, Supl. 4) transcribed and selectable. Its despacho carries the same alínea h) (−1pp for 3+ dependents) and the same IRS Jovem ÷14 rule as the Continente's, so no logic changed; only the rates differ (exemption to 980 €, lower rates throughout). Both axes pass and the dataset ships `verified: true`
  - **"Axis B has no source" was wrong, and had simply never been rechecked.** Doutor Finanças — the source the Continente tables were already cleared against — has always taken a `location` field with `madeira` as a value. It agrees to the cent across both formula brackets, the fixed-parcela brackets, all three categories, the per-dependent deduction and the alínea h) reduction
  - **With a stated limit.** Above 3 203 € that simulator stops implementing this despacho: it uses 27,27 % and 27,78 % where the despacho prints 23,70 % and 30,28 %, a 5,02 € gap in the monthly net at 4 000 €. Both tables are internally continuous, so continuity could not break the tie — they are two different, self-consistent tables. Settled by re-fetching the JORAM PDF and re-extracting it with `pdf2json` independently of the original extraction: page 4 prints `Até | 6 585,00 | 30,28% | 521,72`. The engine follows the despacho; the crosscheck covers only the range where the peer implements the same statute, and the rows above it rest on Axis A, now done twice
  - The despacho genuinely drops the rate from 30,28 % to 28,02 % at the next row. That reads as a typo and is not — the parcela moves with it so the tax stays continuous. Both the drop and the disputed row are pinned as tests, so "correcting" the engine toward the simulator fails loudly
- [ ] **Açores — blocked on the source format.** Despacho n.º 1179/2026 (DR II Série n.º 23) publishes its tables as **images**, not text: the table pages carry only the captions as text runs, and the PDF holds 11 image objects. The `pdf2json` route used for the Continente and Madeira cannot extract a single bracket. Options, none free: OCR the images (needs an independent second source anyway, since OCR of numeric tables is exactly where transcription errors hide), transcribe visually from a rendered page and cross-check against another publisher's transcription, or wait for a machine-readable republication
- [ ] (Maybe) separate "annual IRS estimate" mode
- [ ] EN localization

---

## 9. Cross-cutting concerns

- **Disclaimer** from day one: outputs are simulations, not financial advice.
- **Every result lists its own sources.** A "Fontes" panel names each dataset the answer actually leaned on — withholding tables, meal-allowance ceilings, IRS Jovem parameters, the BdP limits, the shock, the Euribor month, the market statistics — with what each was used for, whether it is cross-checked, and a link. The verified badge sits on the summary, visible whether the panel is open or shut: a caveat behind a disclosure is not a caveat.
  - **Links are verified by rendering, never by status code.** `diariodarepublica.pt` answers **200** for consolidated-code URLs that then route client-side to "A página não se encontra disponível" — so `curl` reports success on a dead link. Every URL in the app was opened in a browser and read. The consolidated CIRS and Código do Trabalho check out; the Código dos Regimes Contributivos could not be located at a URL that renders, so `cc-53` deliberately carries no link.
  - Links point at the consolidated **code**, not the article: DRE's per-article anchors are generated client-side and could not be verified the same way. The citation names the article; the link gets the reader to the right instrument.
- **Maintenance cadence — automated, not a calendar reminder.** `packages/sources` holds an inventory of every dataset the engine ships, and `.github/workflows/sources.yml` runs it daily. Two halves: a **publication calendar** that needs no network (the ECB posts a month's average in the first days of the next month; INE releases a quarter about six weeks after it ends; the OE tax tables appear in the second half of December), and **probes** that ask the publishers with a machine-readable feed. The calendar alone catches the failure that actually happens — nobody looked, for months, and nobody noticed.
  - **Daily, not annual.** January is the cadence of the tax tables and of nothing else: the Euribor snapshot and the market statistics move monthly, so a January sweep would ship an eight-month-old index through the summer. The tax side is still caught early, because the annual window opens on **15 December** rather than on 1 January — the despacho appears while there is still time to transcribe it before it takes effect.
  - **The ECB-backed datasets refresh themselves.** The Euribor fallback and the consumer-credit rate are fetched, validated and written by the workflow, which then runs the whole suite before opening a PR. Everything else is a PDF a person reads, so the output there is a tracking issue naming what to look at and when it was last looked at.
  - **What fails the run is deliberately narrow**: a source superseded outright, or a probe that could not run. A "this law has not been re-read in six months" prompt lives in the issue — a job that is red every morning is a job nobody reads.
  - **Refusals beat improvisation**: a rate outside a plausible band, a Euribor month missing one of its three tenors, an unreadable payload — each stops the refresh with a message rather than writing a dataset nobody checked.
- **i18n**: PT primary; EN a nice-to-have (also useful for expats).
- **Charts and comparisons**, in two kinds, and the distinction is the point:
  - **Derived** — computed from datasets already shipped, so they cost nothing to keep true: the wage rate curve and the loan limit curve.
  - **Sourced** — Banco de Portugal statistics shown beside the user's own number: where their instalment sits against the stock of existing loans, and their rate against new business of the same rate type. These are dated datasets with provenance lines and a refresh cadence, like any tax table.
  - **Wage side, resolved as a single reference line rather than a distribution.** INE publishes a quarterly *mean*, not a distribution, so there is no range to place anyone within and no percentile to claim. The comparison uses the **base** salary mean (1 342 €, Q2 2026) against the calculator's own base-salary input; using the headline total (1 835 €) would compare base against base-plus-extras and flatter every reader, and the total is seasonal besides. The UI also says it is a mean, not a median, because "below average" reads as "below the middle" and here those differ.
    - **Why not deciles.** Eurostat's SES has real D1/median/D9 for Portugal and is CORS-accessible — but it is quadrennial and stops at **2022**. Against 2026 salaries it would misplace every user in the same direction. Revisit when the 2026 wave publishes, or via GEP/MTSSS Quadros de Pessoal (annual, 2024 available, but PDF-only and by remuneration class rather than clean deciles). A standalone market **dashboard** is deliberately *not* planned: every chart so far explains the user's own number, and a data-publication surface is a different product with a recurring editorial burden.
- **Charts**: two derived so far, both from data already in the bundle — the wage rate curve (bracket rate vs what is actually withheld) and the loan limit curve (income ceiling vs property ceiling, and where they cross). Deriving rather than sourcing is deliberate: an external statistic on screen inherits the same provenance discipline as a tax table, and three charts of borrowed data would be three more things to refresh every January.
  - Palette: categorical slots 1–3 shared across every chart, validated for both modes. Slot 3 sits below 3:1 against the light surface, so any chart using it must carry a legend **and** a table view — that relief is required, not a nicety.
  - The tokens live with the other design tokens, not inside a component. They were scoped to `.split-chart` for a while, which silently broke every later consumer: the constraint bars rendered with no fill and the curves with no stroke.
- **Privacy**: 100% client-side calculation — no financial data transmitted.
- **Staleness is a correctness bug here, not a nuisance.** The app precaches its own shell, so a returning visitor would otherwise run the *previous* build for a whole visit — showing last year's tables behind a "Dados verificados" badge on the very January the tables change. The app therefore reloads as soon as a new service worker activates (`lib/sw-update.ts`).
  - The obvious hook, `controllerchange`, does **not** work for this: `clients.claim()` only fires it for clients not already controlled by the registration, so an in-place update is silent for exactly the returning visitors who need it. The registration's `updatefound` → `statechange`/`activated` sequence is the signal that fires. Verified against real builds served by a real worker, not reasoned about.

---

## 10. Open decisions

1. Whether an annual-settlement mode ever enters scope (currently: no) — note §11 pulls on this from a new direction, since the categoria B retention is a much weaker proxy for the final tax than the categoria A one.

**Resolved:**
- Default spread — not derivable, so: labelled placeholder (1,0 %) plus the live ECB average as context. See Phase 2.
- Static hosting target — GitHub Pages, deployed from `master` by `.github/workflows/deploy.yml`.
- IRS withholding-table sourcing — no public API exists, so tables are manually transcribed from the official PDF and cross-checked against an independent source (see §5).
- Stack — npm workspaces (not pnpm), React + Vite + `vite-plugin-pwa` + Vitest (see §3).
- Recibos verdes — **in scope, as a third calculator**, not as a flag on `WageInput`. Built; see §11.
- Categoria B form shape — monthly on the surface, the quarter behind "O meu caso". The two coincide exactly for steady income, so the simple default is also the correct one in the common case. See §11.2.

---

## 11. Recibos verdes (categoria B) — scoping

The wage engine is categoria A end to end and always has been: `TaxpayerCategory`
selects a withholding *table*, `segsocial.ts` pins 11 % / 23,75 % as the general
regime for *dependent* workers, and subsídio de alimentação, duodécimos, IHT and
trabalho suplementar are all creatures of a contrato de trabalho. Someone on
recibos verdes typing their monthly invoice into "Vencimento" gets a confidently
wrong number, which is why Phase 3 made the boundary visible before anything
else.

### 11.1 Why it is a second engine, not a modifier

IRS Jovem could be a modifier because it changes one term of an arithmetic the
engine already performs. Categoria B changes every term:

| | Categoria A | Categoria B |
|---|---|---|
| IRS retention | marginal-rate tables by category + dependents, R-dependent parcela | flat rate on the invoice value (CIRS art. 101.º), chosen by *activity type*, with an outright **dispensa** below an annual threshold (art. 101.º-B) |
| Contribution rate | 11 % employee / 23,75 % employer | 21,4 % trabalhador independente (25,2 % ENI/EIRL), on the worker alone |
| Contribution base | the month's remuneration | a **rendimento relevante**: a percentage of turnover, not turnover |
| Periodicity | monthly, on what was earned | **quarterly, on the previous quarter** — the contribution owed this month is a function of income already past |
| Subsídios, alimentação, duodécimos | central to the model | do not exist |
| IVA | irrelevant | frequently the largest line on the invoice, and never the worker's money |

Nothing but the IRS Jovem schedule survives the move. Folding this into
`WageInput` would give the engine a shape where half the fields are meaningless
depending on the value of another field — precisely the thing the current design
avoids by keeping `MacroprudentialParameters` and `StateGuarantee` apart.

### 11.2 The two structural problems

**The contribution base is lagged, and a monthly snapshot cannot express it.**
The Código Contributivo puts the monthly base at a third of the *previous
quarter's* relevant income, so the honest answer to "what do I pay this month"
depends on three months the form does not hold. Two ways out, and the choice is
a product decision rather than a technical one: take a quarter's income as the
input and derive the month, or take a month and state "assuming steady income"
as an explicit, visible assumption the way `stateGuarantee` states its asserted
conditions. The first is more correct; the second is the one people can fill in.

**Withholding-only is a much weaker promise here.** For categoria A, retenção
approximates the final tax closely enough that §2's scope decision costs the
user little. Under the regime simplificado it does not: the coefficient of CIRS
art. 31.º decides the taxable share, so a flat retention rate bears almost no
relation to what is owed — and the annual settlement is out of scope by §2. A
categoria B tool that stops at retenção is honest but thin.

The framing that survives this is **not "net wage" but "what is left of this
invoice this month"**: invoice − IVA − retenção − contribuição. That is a
monthly question with a monthly answer, it stays inside the withholding
boundary, and it is the number people actually want when they issue a recibo.
It should be labelled as such and never as a salary equivalent.

### 11.3 The datasets, and what reading the statutes changed

Four dated datasets, because these are four instruments on four cycles:
`CIRS_RETENTION_2026` (arts. 101.º/101.º-B), `CIVA_EXEMPTION_2026` (art. 53.º),
`SELF_EMPLOYED_CONTRIBUTIONS_2018` (Código Contributivo) and `IAS_2026`.

Four things the sources corrected, each of which had been written down here
from memory and each of which was wrong:

- **The professional rate is 23 %, not 25 %.** The OE 2024 lowered it. Every
  secondary source consulted while scoping still said 25 %, and 25 % *is* still
  in art. 101.º — as the **categoria F** rate of al. e). A wrong figure that
  survives a spot-check because the number appears in the right statute is the
  hardest kind to catch, so `retention.test.ts` pins it against exactly that
  confusion.
- **The coefficient split is three-way, not two.** 70 % services · 20 % goods ·
  **20 % hotelaria, restauração e bebidas**. Hospitality is a prestação de
  serviços that takes the goods coefficient, so the intuitive services/goods
  split charges a restaurant 3,5 times what it owes.
- **The dispensa threshold is a reference, not a number.** Art. 101.º-B n.º 1
  al. a) points at the CIVA art. 53.º ceiling rather than restating it, so the
  15 000 € lives in the CIVA dataset and the CIRS one carries a flag. There is
  also a newer al. d) — no retention below 25 € of tax, per DL 49/2025 — which
  is per *invoice*, so it bites at a different invoice value for each rate.
- **The 20 € floor is on the contribution, not the base.** Reading it as a base
  floor understates it about fivefold, and the ISS's own worked example settles
  it.

Two rules that would not have been guessed: propriedade intelectual is
*excluded* from rendimento relevante unless the worker opts in, and a worker
who also holds a salaried job contributes only on the part above 4 × IAS.

**IRS Jovem has no input here, and that is a finding rather than an omission.**
The regime reaches categoria B income, but not at source — art. 99.º-F's
machinery is the categoria A withholding tables, and a young independent claims
art. 12.º-B in the annual Modelo 3. The relief arrives as a refund at
settlement, which is outside the withholding boundary this engine keeps.

### 11.4 What `verified` says, and what it still cannot

`CIRS_RETENTION_2026`, `SELF_EMPLOYED_CONTRIBUTIONS_2018` and `IAS_2026` are
`verified: true`. `CIVA_EXEMPTION_2026` is not, and the answer's own flag is
**conditional on whether that dataset entered the arithmetic** — under the
art. 53.º exemption no rate from it is applied, so it neither passes nor fails,
the same standing the market statistics already have on the loan side. Charge
IVA and the badge honestly drops to "Dados por verificar".

**Axis A** covers all four: every parameter sits beside the verbatim sentence it
was read from, from AT's own publication of the CIRS and CIVA and from the ISS
Guia Prático n.º 1009.

**Axis B took two layers, because neither alone would carry it:**

- The ISS's **four worked examples**, reproduced to the cent. They are the only
  source that exercises the 12 × IAS ceiling, the 20 € floor and the 4 × IAS
  accumulation remanescente, and they settled the order — the ceiling applies
  *after* the remanescente is subtracted. But they share a document with the
  parameters they exercise, so they cannot be the whole of it.
- **Three independent public simulators**, agreeing to the cent with this engine
  and with each other across six scenarios: the 23 % rate, the 21,4 % rate, the
  70 % coefficient, the 1/3 monthly base, the first-year deferral, and IVA as a
  pass-through. One of them reasons about the whole quarter rather than the
  month, which is what makes the 1/3 visibly exercised rather than assumed.
  - **Provenance is weaker than the wage and loan sides', and that is recorded
    rather than glossed.** Doutor Finanças and Crédivel are an established
    publisher and a licensed intermediary; these are smaller calculator sites.
    What makes them usable is mutual independence — three implementations
    converging on the same figures is evidence a single one would not be.
  - **Segurança Social Direta was the obvious candidate and is not reachable**:
    it is behind a NISS login, so it cannot be driven. That is a permanent
    constraint, not a to-do.

**What Axis B does not reach**, and so rests on the statute alone: the 11,5 %
and 16,5 % retention rates, the 25 € minimum of art. 101.º-B n.º 1 al. d), the
annual dispensa, the goods and hospitality coefficients, and both Regiões
Autónomas IVA rates. Every external source models the professional rate on
Continente services and nothing else. The three-way coefficient split is pinned
by a test against the two-way misreading, but a test of our own reading is not
independent confirmation of it.

Still deliberately not built:

- **Contabilidade organizada** — a different base entirely (duodécimo do lucro
  tributável, floored at 1,5 × IAS, fixed in October for the following year).
- **The entidade contratante's own contribution** — paid by the client, never
  touches the worker's take-home, so it belongs to an "employer cost" view.
- **The ±25 % declaration option**, quarterly IVA, and deductible expenses.

### 11.5 Propriedade intelectual, and why it is not a fourth coefficient

Now offered, and modelled as what the Código Contributivo makes it: income
**outside** rendimento relevante, with an opt-in that restores the ordinary
treatment. The guia prático lists it among the income "não considerados para
efeitos de determinação do rendimento relevante" and then, a paragraph later,
among the income that "podem ser considerados [...] caso o Trabalhador
Independente opte pela sua consideração".

So the engine skips the base rather than applying a coefficient of zero. The two
are arithmetically identical and conceptually opposite, and the difference
becomes visible the moment the worker opts in — at which point the coefficient
is the ordinary 70 %, not a rate of its own. The dataset therefore records 0,7
and the exclusion lives in `relevantIncome`, so nobody later reads the dataset
as "the law says 0 %".

Two consequences worth stating:

- **The 20 € floor still applies.** Excluded income leaves an open activity with
  no relevant income, which is the "inexistência de rendimentos" case, so the
  month owes the minimum rather than nothing. The panel says which of the two
  produced the figure.
- **Opting in costs money, and the UI says so plainly** — the income then counts
  towards the contributory career and the benefits resting on it. A calculator
  that only ever showed the cheaper answer would be hiding a choice rather than
  reporting one.
