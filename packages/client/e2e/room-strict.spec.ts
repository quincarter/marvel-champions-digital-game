import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, focusRect, pressAt, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, screens, visibleTexts, waitForScene } from "./wave6-helpers-a.js";
import { declineMulligans, quietGuide } from "./wave6-helpers-b.js";

/**
 * Strict rules in a lobby room (issue #880): the host's game takes no Undo, no Back out and no Manual adjust. The dev
 * game `&roomstrict=1` starts the same game a Strict room's Start does (`SessionConfig.roomPlayMode: "strict"`).
 */

const formOf = (page: Page): Promise<string> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game: { players: { identity: { form: string } }[] } } } };
    };
    return appSession().store.state.game.players[0]!.identity.form;
  });

async function press(page: Page, key: string): Promise<void> {
  const rect = await waitFor(() => focusRect(page, key), `the ${key} control`, 15000);
  await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await settle(page, { quietMs: 400, maxMs: 4000 });
}

test("a strict room's game greys Undo with the reason and offers no Manual adjust", async ({ page }, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  await installWave6Helpers(page);
  await quietGuide(page);
  // Manual adjust is on in Settings: Strict rules still take it away.
  await page.addInitScript(() => localStorage.setItem("mc-settings", JSON.stringify({ allowManualAdjust: true })));
  await page.goto("/?screen=board&scenario=rhino&deck=drs-protection&seed=3&roomstrict=1");
  await waitForScene(page, "Board", 30000);
  await declineMulligans(page);
  await settle(page, { quietMs: 600, maxMs: 6000 });

  // A move, then Undo and Ctrl+Z: neither takes it back, and Undo says why.
  const start = await formOf(page);
  await press(page, "basic:changeForm");
  await waitFor(async () => ((await formOf(page)) !== start ? true : null), "the hero changes form", 10000);
  await press(page, "undo");
  await waitFor(
    async () => ((await visibleTexts(page)).some((t) => /Strict rules/i.test(t.text)) ? true : null),
    "Undo's reason",
    10000,
  );
  await page.keyboard.press("Control+z");
  await settle(page, { quietMs: 600, maxMs: 4000 });
  expect(await formOf(page), "the move stays").not.toBe(start);

  // Pause has no Manual adjust.
  for (let attempt = 0; attempt < 10 && !(await screens(page)).includes("PauseOverlay"); attempt++) {
    await clickText(page, "MENU", { sceneKey: "Board" }).catch(() => undefined);
    await page.waitForTimeout(1200);
  }
  await waitForScene(page, "PauseOverlay");
  expect(await activeScenes(page)).toContain("PauseOverlay");
  const texts = (await visibleTexts(page)).map((t) => t.text);
  expect(texts.some((text) => /manual adjust/i.test(text))).toBe(false);
  expect(phone || texts.length > 0).toBe(true);
});
