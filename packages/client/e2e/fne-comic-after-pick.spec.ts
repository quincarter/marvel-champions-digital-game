import { expect, test, type Page } from "@playwright/test";
import { settle, trackPageErrors, waitFor } from "./helpers.js";
import { clickStop, installWave6Helpers, openSaga, routeStops, screens, waitForScene } from "./wave6-helpers-a.js";

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

const saveCount = (page: Page): Promise<number> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { listSaves: () => Promise<unknown[]> } };
    };
    return (await appSession().store.listSaves()).length;
  });

/** Answers every Briefing call with its first option (skipping a mid-Briefing comic) until Open issue shows. */
async function briefToOpen(page: Page): Promise<void> {
  await waitFor(
    async () => {
      const stops = await routeStops(page);
      if (stops?.scene === "CampaignOpener") {
        await clickStop(page, "skip", "CampaignOpener");
        await settle(page, { quietMs: 400, maxMs: 3000 });
        return null;
      }
      if (stops?.scene !== "CampaignBriefing") return null;
      if (stops.stops.some((s) => s.key === "open")) return true;
      if (stops.stops.some((s) => s.key === "call-option:0")) {
        await clickStop(page, "call-option:0", "CampaignBriefing");
        await settle(page, { quietMs: 400, maxMs: 3000 });
      }
      return null;
    },
    "Open issue on the Briefing",
    60_000,
  );
}

test("a Fear No Evil issue left on the table picks up again from the campaign after a refresh", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "one size covers the route");
  test.setTimeout(180_000);
  const errors = trackPageErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=fne-briefing&unlock=all");
  await waitForScene(page, "CampaignBriefing", 30_000);
  await briefToOpen(page);
  await clickStop(page, "open", "CampaignBriefing");
  await waitFor(async () => ((await screens(page)).includes("SetupDeal") ? true : null), "the table", 30_000);
  const saves = await saveCount(page);

  // A refresh, then back through the campaign: Saga, Cover's Read issue, the comic, the Briefing.
  await page.goto("/?unlock=all");
  await openSaga(page);
  await clickStop(page, "vol-10", "CampaignSaga");
  await settle(page);
  await clickStop(page, "cta", "CampaignSaga");
  await waitForScene(page, "CampaignCover", 20_000);
  await settle(page);
  await clickStop(page, "cta", "CampaignCover");
  await briefToOpen(page);
  await clickStop(page, "open", "CampaignBriefing");
  await waitFor(
    async () => {
      const s = await screens(page);
      return s.includes("SetupDeal") || s.includes("Board") ? true : null;
    },
    "the same table again",
    30_000,
  );
  expect(await saveCount(page), "the game in progress was resumed, not dealt again").toBe(saves);
  expect(errors).toEqual([]);
});
