import { expect, test } from "@playwright/test";
import {
  activeScenes,
  clickText,
  findText,
  installPageHelpers,
  pressEndTurn,
  settle,
  trackPageErrors,
  waitFor,
} from "./helpers.js";
import { communityPackIds, serveCatalog, stageCatalog } from "./pack-catalog-helpers.js";
import { clickStop, hasStop, seatDeckThroughTile, waitForScene } from "./wave6-helpers-a.js";
import { dealToFirstTurn, quietGuide } from "./wave6-helpers-b.js";

/**
 * A community pack, installed from the Mod Store and played: the player's own path from the store to the table. The
 * catalog and every pack file are built from `content-packs/community/<id>` with the SDK and served through
 * `page.route`, so nothing reaches R2. Each pack's precon is the only seat ("Play 1 hero"); the setup screen must
 * show the table, "Deal it out" must reach the Board, and a turn must end, with no page error and no `[mc]` error
 * logged. (Regression: the setup screen's preview asked the base game's scenario builder for a pack's precon, threw
 * "no playable starter deck", and the screen after "Play 1 hero" stayed blank.)
 */
for (const packId of communityPackIds()) {
  test(`install ${packId} from the Mod Store, seat its precon alone and play`, async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    // Only this pack is built and listed (the SDK build takes a while, and each test runs in its own worker).
    const staged = await stageCatalog(baseURL!, [packId]);
    test.info().annotations.push({ type: "staged", description: staged.dir });
    const errors = trackPageErrors(page);
    const logged: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && message.text().startsWith("[mc]")) logged.push(message.text());
    });
    await serveCatalog(page, staged);
    await installPageHelpers(page);
    await quietGuide(page);

    // The store: the pack's page, Install, and wait for the install to finish (Remove appears).
    await page.goto(`/?screen=mod-store&pack=${packId}`);
    await waitForScene(page, "ModStore");
    await clickText(page, "INSTALL (", { sceneKey: "ModStore", timeoutMs: 30_000 });
    await waitFor(
      async () => ((await findText(page, "REMOVE")).length > 0 ? true : null),
      `${packId} installs`,
      90_000,
    );
    await settle(page);

    // Back to the title (Escape steps out a screen at a time), then a new game.
    for (let i = 0; i < 10 && !(await activeScenes(page)).includes("Title"); i++) {
      await page.keyboard.press("Escape");
      await settle(page);
      await page.waitForTimeout(500);
    }
    await waitForScene(page, "Title");
    await settle(page);
    await clickText(page, "NEW GAME", { sceneKey: "Title" });
    await waitForScene(page, "ScenarioSelect");
    await waitFor(async () => (await hasStop(page, "next", "ScenarioSelect")) || null, "scenario list", 15_000);
    await clickStop(page, "scenario:rhino", "ScenarioSelect");
    await settle(page);
    await clickStop(page, "next", "ScenarioSelect");
    await waitForScene(page, "Seats");
    await waitFor(
      async () =>
        (await hasStop(page, "hero-search", "Seats")) || (await hasStop(page, "hero-search-toggle", "Seats"))
          ? true
          : null,
      "hero search",
      10_000,
    );
    // On a phone the hero search sits behind the magnifier.
    if (!(await hasStop(page, "hero-search", "Seats"))) await clickStop(page, "hero-search-toggle", "Seats");
    await seatDeckThroughTile(page, `precon:${packId}-aggression`, { search: staged.heroName[packId]! });
    await settle(page);
    await clickStop(page, "play", "Seats");

    // The table: the setup screen drew (it did not throw), and dealing reaches the Board.
    await waitForScene(page, "Setup");
    await settle(page);
    await clickText(page, "Deal it out", { sceneKey: "Setup" });
    await dealToFirstTurn(page);
    expect(await activeScenes(page)).toContain("Board");
    await pressEndTurn(page);
    await settle(page);
    expect(await activeScenes(page)).toContain("Board");
    expect(logged).toEqual([]);
    expect(errors).toEqual([]);
    staged.dispose();
  });
}
