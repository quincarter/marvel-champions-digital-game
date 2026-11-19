import { expect, test } from "@playwright/test";
import { focusRect, pressUntil, settle } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { POWER_MAN_CHI_INSTANCE } from "../src/store/dev-power-man-chi-game.js";
import { SHOT, boardText, boardUp, press, pressCard, startDevGame, waitForBoardText } from "./x-men-helpers.js";

/**
 * Issue #856: Power Man's (21012) "Discard any number of chi counters" asks how many on the red cost-choice bar. The
 * reporter's game (`store/dev-power-man-chi-game.ts`) is played forward to the turn he entered play; the card is opened,
 * its ability pressed, and the count answered by real pointer or touch input. The bar says what the number is for, and
 * the larger count is a paper button like the smaller one (it was Hero Red on the red bar, so it read as plain text).
 */

const POWER_MAN = POWER_MAN_CHI_INSTANCE;

// Read in the page, so the id is passed in rather than closed over.
const chi = (page: import("@playwright/test").Page): Promise<number> =>
  page.evaluate(async (id) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: { state: { game?: { instances: Record<string, { counters: Record<string, number> }> } } };
      };
    };
    return appSession().store.state.game!.instances[id]!.counters.chi ?? 0;
  }, POWER_MAN);

test.describe("Power Man's chi counters", () => {
  test("the ability asks how many chi counters to remove, and 2 removes both", async ({ page }, info) => {
    test.setTimeout(180_000);
    const phone = info.project.name === "phone";
    const shot = (name: string) =>
      SHOT ? page.screenshot({ path: `${SHOT}/power-man-chi-${info.project.name}-${name}.png` }) : null;
    await installWave6Helpers(page);
    await openApp(page);
    await startDevGame(page, "startPowerManChiDevGame");
    await boardUp(page);
    expect(await chi(page), "Power Man entered play with 2 chi counters").toBe(2);

    if (phone) {
      // The phone board shows one zone at a time: Power Man is on the "me" tab.
      const activeTab = (): Promise<string> =>
        page.evaluate(() =>
          (window as unknown as { __mcBoardDebug: { activeTab: () => string } }).__mcBoardDebug.activeTab(),
        );
      await pressUntil(
        page,
        async () => {
          const me = await waitForBoardText(page, /^me$/i, "the me tab");
          await press(page, phone, me.x, me.y);
        },
        async () => (await activeTab()) === "me",
        "the me tab opens",
      );
      await settle(page, { quietMs: 300, maxMs: 2000 });
      // His tile is last in the sideways play area row: scroll it on until the tile is on screen.
      const width = page.viewportSize()!.width;
      for (let i = 0; i < 12; i++) {
        const tile = await focusRect(page, `card:${POWER_MAN}`);
        if (tile && tile.x >= 0 && tile.x + tile.width <= width - 20) break;
        const row = await waitForBoardText(page, /^YOUR PLAY AREA$/i, "the play area");
        await page.mouse.move(width / 2, row.y + 120);
        await page.mouse.wheel(200, 0);
        await settle(page, { quietMs: 200, maxMs: 1000 });
      }
    }

    // The card opens Inspect; its ability button starts the use.
    const abilityButton = async () =>
      (await visibleTexts(page)).find((t) => t.scene === "InspectOverlay" && /REMOVE 2 CHI COUNTERS/i.test(t.text));
    await pressUntil(
      page,
      () => pressCard(page, phone, POWER_MAN),
      async () => (await abilityButton()) !== undefined,
      "Power Man's Inspect sheet with his ability",
    );
    const use = (await abilityButton())!;
    await press(page, phone, use.x, use.y);
    await waitForBoardText(page, /^Remove how many chi counters\?$/i, "the how-many question");
    await settle(page, { quietMs: 400, maxMs: 3000 });
    await shot("1-question");
    expect(await chi(page), "nothing is removed by asking").toBe(2);

    // The count buttons sit on the question's own row.
    const question = (await boardText(page, /^Remove how many chi counters\?$/i))!;
    const button = (await visibleTexts(page)).find(
      (t) => t.scene === "Board" && t.text === "2" && Math.abs(t.y - question.y) < 30 && t.x > question.x,
    );
    expect(button, "the bar offers 2").toBeDefined();
    await press(page, phone, button!.x, button!.y);
    await expect.poll(() => chi(page), { timeout: 30_000 }).toBe(0);
    await settle(page, { quietMs: 400, maxMs: 3000 });
    await shot("2-spent");
  });
});
