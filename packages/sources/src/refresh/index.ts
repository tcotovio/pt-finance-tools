// Pulling the ECB-backed datasets forward.
//
// Planning is separated from writing on purpose. `plan*` talks to the ECB and
// produces the exact bytes a new dataset module would contain; `applyPlan`
// writes them. So the risky half — a feed that answers strangely, a month that
// is only half published — is decided before anything on disk moves, and the
// tests can exercise the decision without a filesystem.
//
// Nothing here writes a dataset it could not fully read. A missing tenor, a
// rate outside a plausible band, a payload the parser rejects: each is a
// refusal with a message, never a partial write. The scheduled run reports the
// refusal, which is the outcome the project wants — a source that changed shape
// should stop the machine, not be improvised around.

import { unlinkSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEcbSeries } from "@pt-finance-tools/engine";
import { isoDate } from "../period.js";
import { dataDir, indexFiles, repoRoot } from "./paths.js";
import {
  constantName,
  moduleFile,
  renderConsumerModule,
  renderEuriborModule,
} from "./generate.js";
import { rewire, type Rename } from "./rewire.js";

/** What a refresh would do, decided before anything is written. */
export interface RefreshPlan {
  id: string;
  /** The edition being replaced, and the one replacing it. */
  from: string;
  to: string;
  /** Absolute paths — the module to write and the superseded one to remove. */
  newPath: string;
  oldPath: string;
  contents: string;
  rename: Rename;
}

export interface RefreshOptions {
  today?: string;
  fetchImpl?: typeof fetch;
  root?: string;
}

const BASE = "https://data-api.ecb.europa.eu/service/data";

/** Fetch one ECB observation, either the latest or a named month. */
async function observation(
  series: string,
  options: { month?: string; fetchImpl?: typeof fetch },
): Promise<{ month: string; rate: number }> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const range = options.month
    ? `startPeriod=${options.month}&endPeriod=${options.month}`
    : "lastNObservations=1";
  const url = `${BASE}/${series}?${range}&format=jsondata`;
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(20_000),
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`${url} answered ${response.status}.`);
  const parsed = parseEcbSeries(await response.json());
  if (!parsed) throw new Error(`${url} returned no readable observation.`);
  if (options.month && parsed.month !== options.month) {
    throw new Error(
      `Asked ${series} for ${options.month} and got ${parsed.month}; refusing to mix months.`,
    );
  }
  return parsed;
}

/**
 * A rate that could plausibly be a Euribor monthly average, as a fraction.
 *
 * The band is wide — Euribor has been negative within living memory and 5 %
 * within this decade — because its job is not to second-guess the market. It is
 * to catch the failure that would otherwise ship: a percentage that never got
 * divided by 100.
 */
function plausibleIndexRate(rate: number): boolean {
  return Number.isFinite(rate) && rate > -0.02 && rate < 0.15;
}

const EURIBOR_SERIES = {
  "3m": "FM/M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA",
  "6m": "FM/M.U2.EUR.RT.MM.EURIBOR6MD_.HSTA",
  "12m": "FM/M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA",
} as const;

const CONSUMER_SERIES = "MIR/M.PT.B.A2B.A.R.A.2250.EUR.N";

/**
 * The bundled Euribor fallback, if the ECB has a newer complete month.
 *
 * All three tenors have to be present for the same month. The app indexes to
 * whichever the user picks, so a snapshot carrying two of them would be a
 * fallback that fails for a third of readers precisely when the network is
 * already failing them.
 */
export async function planEuriborRefresh(
  shipped: string,
  options: RefreshOptions = {},
): Promise<RefreshPlan | null> {
  const latest = await observation(EURIBOR_SERIES["3m"], {
    fetchImpl: options.fetchImpl,
  });
  if (latest.month <= shipped) return null;

  const rates = { "3m": latest.rate, "6m": 0, "12m": 0 };
  for (const tenor of ["6m", "12m"] as const) {
    const found = await observation(EURIBOR_SERIES[tenor], {
      month: latest.month,
      fetchImpl: options.fetchImpl,
    });
    rates[tenor] = found.rate;
  }

  for (const [tenor, rate] of Object.entries(rates)) {
    if (!plausibleIndexRate(rate)) {
      throw new Error(
        `${latest.month} ${tenor} came back as ${rate}, which is not a plausible monthly average.`,
      );
    }
  }

  const root = options.root ?? repoRoot();
  return {
    id: "euribor",
    from: shipped,
    to: latest.month,
    newPath: join(dataDir(root), moduleFile("euribor", latest.month)),
    oldPath: join(dataDir(root), moduleFile("euribor", shipped)),
    contents: renderEuriborModule({
      month: latest.month,
      rates,
      retrievedAt: options.today ?? isoDate(new Date()),
    }),
    rename: {
      fromConstant: constantName("EURIBOR", shipped),
      toConstant: constantName("EURIBOR", latest.month),
      fromModule: `./${moduleFile("euribor", shipped).replace(/\.ts$/, ".js")}`,
      toModule: `./${moduleFile("euribor", latest.month).replace(/\.ts$/, ".js")}`,
    },
  };
}

/** The consumer-credit reference, if the ECB has a newer month. */
export async function planConsumerRefresh(
  shipped: string,
  options: RefreshOptions = {},
): Promise<RefreshPlan | null> {
  const latest = await observation(CONSUMER_SERIES, {
    fetchImpl: options.fetchImpl,
  });
  if (latest.month <= shipped) return null;

  // Consumer credit is quoted as a single fixed rate; anything outside this
  // band is a unit error or the wrong series, not a market move.
  if (!Number.isFinite(latest.rate) || latest.rate < 0.005 || latest.rate > 0.5) {
    throw new Error(
      `${latest.month} consumer rate came back as ${latest.rate}, which is not a plausible TAA.`,
    );
  }

  const root = options.root ?? repoRoot();
  return {
    id: "consumer-market",
    from: shipped,
    to: latest.month,
    newPath: join(dataDir(root), moduleFile("consumer-market", latest.month)),
    oldPath: join(dataDir(root), moduleFile("consumer-market", shipped)),
    contents: renderConsumerModule({
      month: latest.month,
      averageRate: latest.rate,
      retrievedAt: options.today ?? isoDate(new Date()),
    }),
    rename: {
      fromConstant: constantName("CONSUMER_MARKET", shipped),
      toConstant: constantName("CONSUMER_MARKET", latest.month),
      fromModule: `./${moduleFile("consumer-market", shipped).replace(/\.ts$/, ".js")}`,
      toModule: `./${moduleFile("consumer-market", latest.month).replace(/\.ts$/, ".js")}`,
    },
  };
}

/**
 * Carry out a plan: write the new module, rewire the two indexes, drop the
 * superseded one.
 *
 * The indexes are rewired before the old module is deleted, so a failure
 * halfway through leaves a repo that still builds.
 */
export function applyPlan(plan: RefreshPlan, root = repoRoot()): void {
  writeFileSync(plan.newPath, plan.contents, "utf8");

  const { data, engine } = indexFiles(root);
  for (const file of [data, engine]) {
    writeFileSync(file, rewire(readFileSync(file, "utf8"), plan.rename), "utf8");
  }

  if (plan.oldPath !== plan.newPath) unlinkSync(plan.oldPath);
}
