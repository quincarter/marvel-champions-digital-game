#!/usr/bin/env node
/**
 * Whether GitHub's download counts have changed since the landing site was last deployed: the scheduled run of
 * landing-deploy.yml (twice a day) asks this first, and skips the rebuild and deploy when they haven't.
 *
 * It counts the releases the way the landing build does (`packages/client/src/site/stats/`) and compares the result
 * with the counts the live site published (`/stats/downloads.json`). A live site without that file, or one that can't
 * be read, counts as changed, so a deploy goes ahead; GitHub being out of reach counts as unchanged, since a rebuild
 * then would only show the page without its numbers.
 *
 * Prints `changed=true` or `changed=false`, and writes the same line to `$GITHUB_OUTPUT` when it is set.
 *
 *   node scripts/download-stats-changed.mjs [--site https://champions-digital-game.com/]
 *
 * Needs Node 22.18 or newer, which runs the TypeScript modules it imports as they are.
 */
import { appendFileSync } from "node:fs";
import {
  sameCounts,
  STATS_JSON_PATH,
  STATS_SINCE,
  summarizeDownloads,
} from "../packages/client/src/site/stats/download-stats.ts";
import { fetchAllReleases } from "../packages/client/src/site/stats/github-releases.ts";
import { LANDING_URL } from "../packages/client/src/site/site-urls.ts";

const at = process.argv.indexOf("--site");
const site = at === -1 ? LANDING_URL : process.argv[at + 1];

function report(changed, why) {
  console.log(why);
  console.log(`changed=${changed}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
}

let fresh;
try {
  fresh = summarizeDownloads(await fetchAllReleases(process.env.GITHUB_TOKEN), STATS_SINCE, new Date().toISOString());
} catch (error) {
  report(false, `GitHub's releases were out of reach (${String(error)}); leaving the live site as it is.`);
  process.exit(0);
}

let live = null;
try {
  const response = await fetch(new URL(STATS_JSON_PATH, site), { signal: AbortSignal.timeout(15_000) });
  if (response.ok) live = await response.json();
  else console.log(`The live counts answered HTTP ${response.status}.`);
} catch (error) {
  console.log(`The live counts were out of reach (${String(error)}).`);
}

if (live === null) report(true, "No live counts to compare with; deploying.");
else if (sameCounts(fresh, live)) report(false, `No new downloads since ${live.countedAt}; nothing to deploy.`);
else report(true, `${fresh.installers} installer downloads now, ${live.installers} live; deploying.`);
