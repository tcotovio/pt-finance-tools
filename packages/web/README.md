# @pt-finance-tools/web

The PWA front end: a Portuguese net-wage calculator built on
[`@pt-finance-tools/engine`](../engine), which does all of the arithmetic.

- **No backend.** Every calculation runs in the browser; nothing is sent
  anywhere.
- **Progressive disclosure.** Gross salary, marital situation and dependents
  are on the surface; the meal allowance, duodécimos, IRS Jovem and region
  live behind the "O meu caso" panel.
- **Honest by construction.** The result always carries the provenance of the
  dataset it used, whether that dataset has been independently cross-checked,
  and the reminder that withholding is an advance on IRS rather than the
  final tax.

## Development

From the repository root (the engine is built first — the web app imports its
compiled output):

```sh
npm run dev      # engine build + vite dev server
npm run build    # production build of both packages
npm run lint
```

## Layout

```
src/
├─ components/   # UI only — no tax logic lives here
└─ lib/          # pure helpers: form state, parsing, formatting, breakdown
```

Anything that computes money belongs in the engine, not here.
