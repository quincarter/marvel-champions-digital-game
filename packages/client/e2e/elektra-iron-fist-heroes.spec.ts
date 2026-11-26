import { expect, test } from "@playwright/test";
import { settle, waitFor } from "./helpers.js";
import { clickStop, hasStop, installWave6Helpers, trackErrors, visibleTexts } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Elektra and Iron Fist were released with their precons, but their packs were missing from the client pool, so neither
 * hero showed on Take your seats. This spec checks that both heroes are on the roster (found through the hero search,
 * which the shelf answers with a tile keyed by the precon's deck id) and that each precon starts a board that shows the
 * hero's Alter-Ego, with no page errors.
 */

const HEROES = [
  { name: "Elektra", alterEgo: "Elektra Natchios", starterDeckId: "elektra-aggression" },
  { name: "Iron Fist", alterEgo: "Danny Rand", starterDeckId: "iron-fist-protection" },
] as const;

const squash = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, "");

test("Elektra and Iron Fist are on the Take your seats roster", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await openApp(page, "screen=seats&unlock=all", { landing: "Seats" });
  await settle(page);

  // On a narrow screen the search sits behind its toggle.
  await waitFor(
    async () =>
      (await hasStop(page, "hero-search", "Seats")) || (await hasStop(page, "hero-search-toggle", "Seats"))
        ? true
        : null,
    "the hero search",
    15_000,
  );
  if (!(await hasStop(page, "hero-search", "Seats"))) await clickStop(page, "hero-search-toggle", "Seats");

  for (const hero of HEROES) {
    // Press the field first (the rig reports touch), then replace whatever the last search left.
    await clickStop(page, "hero-search", "Seats");
    await settle(page);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(hero.name);
    await waitFor(
      async () =>
        (await hasStop(page, `hero:precon:${hero.starterDeckId}`, "Seats")) ||
        (await hasStop(page, `hero-rec:precon:${hero.starterDeckId}`, "Seats"))
          ? true
          : null,
      `a roster tile for ${hero.name} (precon:${hero.starterDeckId})`,
      30_000,
    );
  }
  expect(errors, "no page errors on the roster").toEqual([]);
});

for (const hero of HEROES) {
  test(`${hero.name}'s precon starts a board showing ${hero.alterEgo}`, async ({ page }) => {
    test.setTimeout(180_000);
    const errors = trackErrors(page);
    await installWave6Helpers(page);
    await openApp(page, `screen=board&deck=${hero.starterDeckId}&seed=3&unlock=all`, { landing: "Board" });
    await settle(page);
    const want = squash(hero.alterEgo);
    await waitFor(
      async () =>
        (await visibleTexts(page)).some((t) => t.scene === "Board" && squash(t.text).includes(want)) ? true : null,
      `${hero.alterEgo} on the Board`,
      30_000,
    );
    expect(errors, "no page errors on the board").toEqual([]);
  });
}
