# @pt-finance-tools/sources

Dev-only tooling. It answers one question about the datasets the engine ships:

> Has any of this been superseded by its publisher, and can we fetch what
> replaced it?

Nothing here is bundled into the app.

## Why it exists

Every dataset in `packages/engine/src/data` carries provenance and a
cross-check status, and the test suite proves the numbers were transcribed
faithfully from the document they cite. None of that notices when the document
is replaced. A table can be impeccably transcribed, fully cross-checked, and a
year out of date — and the app would show it behind a "dados verificados"
badge, which is worse than showing nothing.

## The two halves

**A publication calendar**, which needs no network. Each source declares how
its publisher works: the ECB posts a month's Euribor average in the first days
of the next month, INE releases a quarter's wage statistics about six weeks
after it ends, the Orçamento do Estado's tax tables appear in the second half of
December for the year starting in January. From that and the vintage in the
bundle, "should something newer exist by now?" is answerable offline, which is
what makes it cheap enough to run every day.

**Probes**, for the publishers with a machine-readable feed. A probe turns the
calendar's prediction into the publisher's own answer, and for the two
ECB-backed datasets it also brings back the values — which is what lets
`refresh` write the new dataset rather than merely announce that someone should.

A probe that fails is reported as `probe-failed`, never as "current". "We could
not check" and "it is fine" are different things, and only one of them is safe
to be quiet about.

## Commands

```sh
npm run sources:check              # from the repo root; calendar only, offline
npm run sources:check -- --probe   # also ask the publishers that have a feed
npm run sources:refresh            # rewrite the ECB-backed datasets, if newer
npm run sources:refresh -- --dry-run
```

Useful flags: `--today=YYYY-MM-DD` (what the calendar will say on a given day —
try `--today=2027-01-05`), `--only=euribor,imt`, `--json=path`,
`--markdown=path`, `--warn-only`, `--fail-on=overdue,probe-failed`.

The exit code is deliberately narrow. `overdue` (superseded outright) and
`probe-failed` fail; `due` and `review-due` do not. A daily job that goes red
the morning a law becomes six months unread is a job everybody learns to ignore.

## What runs unattended

`.github/workflows/sources.yml`, daily:

1. checks every source, probing the feeds;
2. keeps one tracking issue current — edited in place, closed when there is
   nothing outstanding;
3. runs `refresh`, and when a dataset moved, runs the **whole test suite**
   before opening a pull request with it;
4. fails the run only if something was superseded outright or a probe broke.

## Adding a source

Add the dataset to the engine as usual, then add an entry to
`src/manifest.ts` — `manifest.test.ts` fails until you do, so the inventory
cannot quietly go incomplete. The vintage is read off the dataset itself rather
than restated here, so the manifest cannot drift from what is shipped.

## Adding a probe

Two sources have no machine check, and the manifest says why in `probeGap`:

- **BPstat (mortgage market)** — queried by numeric series id, and the ids
  behind the percentile series are not recorded anywhere in the repo. Pin them,
  write `probes/bpstat.ts` on the model of `probes/ecb.ts`, and it becomes a
  machine check.
- **INE (wage market)** — the figures live in a quarterly press-release
  destaque rather than under an indicator code we have pinned.

Until then the calendar still says when a new edition is due, which is most of
the value.

## Refresh, and why it does not paraphrase

The dataset modules are mostly prose: what the data is, why it is bundled, what
would make it wrong. A generator that emitted numbers alone would strip out
exactly what makes them trustworthy. So the prose lives in the templates in
`src/refresh/generate.ts`, and `generate.test.ts` regenerates the modules
currently in the repo and asserts the output matches them **byte for byte**.
Edit the prose in a dataset without editing the template and that test fails.

Refresh refuses rather than improvises: a rate outside a plausible band, a
Euribor month missing one of its three tenors, a payload the parser cannot
read — each is a refusal with a message and no write.
