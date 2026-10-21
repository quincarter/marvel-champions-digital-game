import { expect, test } from "@playwright/test";
import { settle, trackPageErrors, waitFor } from "./helpers.js";
import { clickStop, installWave6Helpers, routeStops, waitForScene } from "./wave6-helpers-a.js";

/**
 * Fear No Evil picks its next issue on the Briefing (a `choice` graph), after the opener would have played, so the
 * owner never saw the issue's comic (2026-10-20). Picking an issue that has pages now plays them, then comes back to
 * the Briefing ready to open the issue.
 */
test("picking Art Museum Heist on the Fear No Evil Briefing plays its comic, then returns to Open issue", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "one size covers the route");
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=fne-briefing&unlock=all");
  await waitForScene(page, "CampaignBriefing", 30_000);
  // Answer each call with its first option (first playthrough; Art Museum Heist is the first open scenario; the
  // recommended villain) until the Briefing leaves for the opener.
  await waitFor(
    async () => {
      const stops = await routeStops(page);
      if (stops?.scene === "CampaignOpener") return true;
      if (stops?.stops.some((s) => s.key === "call-option:0")) {
        await clickStop(page, "call-option:0", "CampaignBriefing");
        await settle(page, { quietMs: 400, maxMs: 3000 });
      }
      return null;
    },
    "the issue's comic after the picks",
    60_000,
  );
  await clickStop(page, "skip", "CampaignOpener");
  await waitForScene(page, "CampaignBriefing", 15_000);
  await waitFor(
    async () => ((await routeStops(page, "CampaignBriefing"))?.stops.some((s) => s.key === "open") ? true : null),
    "Open issue on the Briefing",
    15_000,
  );
  expect(errors).toEqual([]);
});
