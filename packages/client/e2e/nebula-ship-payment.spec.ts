import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { endRound, SHOTS, startOnBoard } from "./qa-wave10-recheck-helpers.js";
import { facts, idsOf, payWith, press, pressCard, waitForBoardText } from "./x-men-helpers.js";

/**
 * Issue #174: Nebula's Ship (16093) "Shoot the Thrusters!" — "Exhaust the Milano and spend up to 2 resources of any
 * type → remove 1 evasion counter from here for each resource spent." The engine read "up to 2" as 0 to 2, said the
 * action needed no payment, and the client sent it with nothing spent: the Milano exhausted and no counter came off.
 * "Up to" needs at least one (RRG 1.8 "Cost", p. 14), so the pay bar now opens. Phone first, then tablet, then desktop.
 */
const SIZES = [
  { name: "phone-390x844", width: 390, height: 844, touch: true },
  { name: "tablet-1024x768", width: 1024, height: 768, touch: true },
  { name: "desktop-1440x900", width: 1440, height: 900, touch: false },
] as const;

const SHIP = "16093";
const MILANO = "16142";

type Instances = Record<string, { counters?: Record<string, number>; exhausted?: boolean }>;
/** `facts` runs its reader in the page from source, so it cannot close over an id: read the instances, pick here. */
const instances = (page: Page): Promise<Instances> => facts(page, (game) => game.instances as Instances);
const evasion = async (page: Page, ship: string): Promise<number> =>
  (await instances(page))[ship]?.counters?.evasion ?? 0;

for (const size of SIZES) {
  test.describe(`Nebula's Ship at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch, isMobile: size.touch });

    test("Shoot the Thrusters! opens the pay bar and removes a counter per resource spent", async ({ page }) => {
      test.setTimeout(240_000);
      await installWave6Helpers(page);
      await openApp(page);
      await startOnBoard(page, {
        scenarioId: "nebula",
        difficulty: "standard",
        players: [{ starterDeckId: "groot-protection" }],
        seed: 2026,
      });
      // The ship gains its first evasion counter when the villain phase begins.
      await endRound(page);
      const [ship] = await idsOf(page, SHIP, "play");
      const [milano] = await idsOf(page, MILANO, "play");
      expect(ship, "Nebula's Ship is in play").toBeDefined();
      const before = await evasion(page, ship!);
      expect(before).toBeGreaterThan(0);

      // On a phone the environments sit on the ENEMIES tab, beside the villain.
      if (size.width < 768) {
        await clickText(page, "ENEMIES", { sceneKey: "Board", maxY: 100 });
        await settle(page);
      }
      await pressCard(page, size.touch, ship!);
      await waitFor(async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null), "Inspect");
      await settle(page, { quietMs: 300, maxMs: 1500 });
      const ability = (await visibleTexts(page)).find(
        // The ability's button, not the card text printed above it (which also names "Shoot the Thrusters!").
        (t) => t.scene === "InspectOverlay" && /^nebula's ship . spend up to 2 resources$/i.test(t.text),
      );
      expect(ability, "Inspect offers Shoot the Thrusters!").toBeDefined();
      await press(page, size.touch, ability!.x, ability!.y);
      await waitForBoardText(page, /^PAYING 0 \/ 1–2$/i, "the pay bar opens on a 1–2 range");
      await settle(page, { quietMs: 400, maxMs: 2000 });
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/nebula-ship-paybar-${size.name}.png` });

      const hand = await facts(page, (game) => game.players[0].hand as string[]);
      await payWith(page, size.touch, [hand[0]!]);
      await waitFor(
        async () => ((await evasion(page, ship!)) < before ? true : null),
        "an evasion counter comes off",
        15000,
      );
      expect((await instances(page))[milano!]?.exhausted).toBe(true);
      await settle(page);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/nebula-ship-paid-${size.name}.png` });
    });
  });
}
