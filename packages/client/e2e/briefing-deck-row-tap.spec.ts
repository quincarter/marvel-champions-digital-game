import { expect, test } from "@playwright/test";
import { activeScenes, settle } from "./helpers.js";
import { installWave6Helpers, routeStops, trackErrors, waitForScene } from "./wave6-helpers-a.js";

/**
 * A press that starts outside a Briefing deck row and lifts over it must not open Deck edit: opening it can discard the
 * composed attempt. Only a tap on the row does (the no-tap-on-lift rule, issue #227; `onTap`).
 */
test("a touch that lifts on a Briefing deck row opens nothing; a tap opens the deck", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "touch only");
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?unlock=all&screen=campaign-briefing&campaign=trors");
  await waitForScene(page, "CampaignBriefing");
  await settle(page);
  const row = (await routeStops(page, "CampaignBriefing"))?.stops.find((stop) => stop.key === "deck-seat-1");
  expect(row, "the first deck row").toBeTruthy();
  const target = { x: row!.rect.x + row!.rect.width / 2, y: row!.rect.y + row!.rect.height / 2 };

  const cdp = await page.context().newCDPSession(page);
  const from = { x: target.x, y: Math.max(80, target.y - 120) };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= 10; i++) {
    const y = from.y + ((target.y - from.y) * i) / 10;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: target.x, y, id: 1 }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await settle(page);
  expect(await activeScenes(page)).not.toContain("CampaignDeckEdit");

  await page.touchscreen.tap(target.x, target.y);
  await waitForScene(page, "CampaignDeckEdit");
  expect(errors).toEqual([]);
});
