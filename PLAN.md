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
| IRS Jovem | **In MVP**, at source | Operates at the monthly level, so it fits inside the withholding boundary as a modifier. |
| Loan side | **Consolidate + extend**, later phase | Reuse the existing React mortgage sim + consumer-loan sim; add the reverse direction. |
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
- Disability (holder and/or dependents) — *deferred to Phase 3*
- Pensioner vs worker; non-resident — *deferred*

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

- IRS withholding tables — per year, per region. No public API exists — the Autoridade Tributária publishes these as PDFs each year via despacho (e.g. 2026 tables via Despacho 236-A/2025). **Manually transcribe from the official PDF, then cross-check against an independent source** (e.g. Doutor Finanças' published tables or the Finanças simulator) before trusting the data. Revisit PDF-parsing automation only once the document's layout has proven stable across multiple years.
- IAS — per year (drives the IRS Jovem cap and more).
- IRS Jovem parameters — schedule, cap multiplier, at-source mechanism per despacho.
- Banco de Portugal macroprudential parameters — for the loan phase (see §7).
- Euribor — live feed with cached fallback (loan phase); never hardcoded.

The engine selects the right dataset by date. **Adding a year = a data PR with no logic change.**

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

Related, and not yet built: **n.º 8** sets withholding on *trabalho
suplementar* at 50 % of the rate applying to that month's remuneração —
the same "separate remuneração" shape, a candidate for the next pass.

---

## 7. Loan engine (later phase)

Consolidate the existing React mortgage sim and consumer-loan sim into `@engine`.

- **Forward** (payment from house price): French amortization, `M = P·r·(1+r)ⁿ / ((1+r)ⁿ − 1)`, rate = Euribor(tenor) + spread. Largely done.
- **Reverse** (max loan from salary): solve for the amount where **stressed DSTI** hits the ceiling, then cross-check LTV and the age-based maturity cap.

Current BdP parameters (config, effective **1 Aug 2026** — Recomendação 1/2026):
- DSTI ceiling **45%** (up to 10% of a bank's semester volume may exceed it)
- Stress test: interest-rate shock + income reduction after age 70 applied to DSTI
- LTV: **90%** own permanent residence · **80%** other purposes
- Maturity: **40 yrs** for borrowers ≤35 · **35 yrs** for >35

These are exactly the parameters that changed this month — which is why they live in dated config, not in code.

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
- [x] Duodécimos toggle — subsídios de férias/Natal in twelfths, withheld autonomously per CIRS art. 99.º-C n.ºs 5–6; see §6.1
- [x] IRS Jovem modifier — schedule and 55 × IAS cap from CIRS art. 12.º-B, at-source mechanism from art. 99.º-F n.º 4, per-payment ceiling (÷14) from despacho §5.g. 7 golden scenarios vs the IRS Jovem simulator, incl. two where the cap bites
- [~] Golden tests vs official despacho formula (8 scenarios) — note these are circular by construction (expectations derive from the same transcribed numbers), which is why the Axis A/B cross-checks above exist
- [x] UI: vencimento + situação + dependentes on the surface, everything else behind the "O meu caso" `<details>` panel — subsídio de alimentação, duodécimos, IRS Jovem, região. Live calculation, no submit button; the pure helpers (parsing, form→`WageInput` mapping, breakdown lines) are unit-tested separately from the components
- [x] Employer cost (custo para a empresa) — everything paid out plus the employer's 23,75 % TSU on the same contribution base as the employee's 11 % (Código Contributivo art. 53.º). Direct cost only: seguro de acidentes de trabalho, medicina no trabalho and training have no statutory rate to apply, and the UI says so rather than inventing one
- [x] Part-to-whole chart of where the gross goes (líquido / IRS / Segurança Social) — a horizontal stacked bar, not a pie: three slices, long labels, and it holds up at phone width. Palette is the validated categorical slots 1–3, checked in both modes; identity never rests on colour alone (legend + the table below)
- [x] "Simulação, não é aconselhamento" + "retenção ≠ imposto final" notices, shown with every result alongside the dataset's provenance and its `verified` badge

### Phase 2 — Loan
- [ ] Fold existing mortgage + consumer-loan sims into `@engine`
- [ ] Euribor live feed + cached fallback
- [ ] Reverse solver: max loan from salary (stressed DSTI, LTV, maturity-by-age)
- [ ] BdP params in dated config
- [ ] Golden tests vs bank simulators

### Phase 3 — Long tail (opt-in scope)
- [ ] Disability tables
- [ ] Açores / Madeira parity
- [ ] (Maybe) separate "annual IRS estimate" mode
- [ ] EN localization

---

## 9. Cross-cutting concerns

- **Disclaimer** from day one: outputs are simulations, not financial advice.
- **Maintenance cadence**: January (new IRS tables + IAS), ad-hoc mid-year despachos, BdP recommendation updates. Track these as recurring calendar items.
- **i18n**: PT primary; EN a nice-to-have (also useful for expats).
- **Privacy**: 100% client-side calculation — no financial data transmitted.

---

## 10. Open decisions

1. Static hosting target.
2. Default spread assumptions for the loan calculator's out-of-the-box estimate.
3. Whether an annual-settlement mode ever enters scope (currently: no).

**Resolved:**
- IRS withholding-table sourcing — no public API exists, so tables are manually transcribed from the official PDF and cross-checked against an independent source (see §5).
- Stack — npm workspaces (not pnpm), React + Vite + `vite-plugin-pwa` + Vitest (see §3).
