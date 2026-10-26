import { expect, test, type Page } from "@playwright/test";
import { clickFocus, focusRect, pressKey, settle, waitFor } from "./helpers.js";
import { PAD, glyphCount, glyphIn, installPad, padHold, padRelease, padTap, padWake } from "./pad-e2e-helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import type { Rect } from "./wave6-helpers-b.js";

/**
 * Direct picks (`view/pick-assign.ts`, owner report 2026-10-24): while the table asks who attacks or which target, each
 * candidate wears the combo that picks it (hold RT, LT, RB or LB, then A / B / X / Y, sixteen in all with no paging;
 * the digits on a keyboard). The glyphs are checked in place, then the press is made and the engine's own state read back.
 */

test.use({ viewport: { width: 1920, height: 1080 } });

const FACE = ["A", "B", "X", "Y"];

interface PickView {
  ids: string[];
  offset: number;
}

const pickView = (page: Page): Promise<PickView | null> =>
  page.evaluate(
    () =>
      (window as unknown as { __mcBoardDebug?: { pickView(): PickView | null } }).__mcBoardDebug?.pickView() ?? null,
  );

/** A character's exhausted flag in the live game. */
const exhausted = (page: Page, id: string): Promise<boolean> =>
  page.evaluate(async (instanceId) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game?: { instances: Record<string, { exhausted: boolean }> } } } };
    };
    return appSession().store.state.game?.instances[instanceId]?.exhausted === true;
  }, id);

const focusedKey = (page: Page): Promise<string | null> =>
  page.evaluate(
    () =>
      (window as unknown as { __mcBoardDebug?: { focusedKey(): string | null } }).__mcBoardDebug?.focusedKey() ?? null,
  );

const version = (page: Page): Promise<number> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { version: number } } };
    };
    return appSession().store.state.version;
  });

async function openFixture(page: Page, query: string): Promise<void> {
  await installPad(page);
  await installWave6Helpers(page);
  await page.goto(`/?screen=board&${query}`);
  await waitFor(() => focusRect(page, "basic:attack"), "the action bar", 90_000);
  await settle(page, { quietMs: 600, maxMs: 6000 });
}

const rectOfSource = (page: Page, id: string): Promise<Rect | null> => focusRect(page, `source:${id}`);
const rectOfTile = (page: Page, id: string): Promise<Rect | null> => focusRect(page, `card:${id}`);

test("who attacks: each character wears RT + its button, and RT + B picks the second", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await openFixture(page, "fixture=attackers");
  await clickFocus(page, "basic:attack");
  const view = await waitFor(() => pickView(page), "the Who attacks bar", 15_000);
  expect(view.ids.length, "the hero and three allies can attack").toBe(4);
  await padWake(page);
  await settle(page, { quietMs: 300, maxMs: 2000 });

  // At rest every name wears the trigger and its button.
  for (const [slot, id] of view.ids.entries()) {
    const rect = (await rectOfSource(page, id))!;
    expect(rect, `a button for character ${slot}`).not.toBeNull();
    expect(await glyphIn(page, "Board", FACE[slot]!, rect), `${FACE[slot]} on character ${slot}`).toBe(true);
    expect(await glyphIn(page, "Board", "RT", rect), `RT on character ${slot}`).toBe(true);
  }
  await page.screenshot({ path: "../../artifacts/qa/pick-attackers-pad.png" });

  // Holding RT leaves the bare buttons.
  await padHold(page, PAD.rt);
  const second = (await rectOfSource(page, view.ids[1]!))!;
  expect(await glyphIn(page, "Board", "B", second)).toBe(true);
  expect(await glyphCount(page, "Board", "RT", second), "the trigger is held, not drawn again").toBe(0);
  await page.screenshot({ path: "../../artifacts/qa/pick-attackers-rt-held.png" });

  // RT + B picks the second character: it attacks, so it is spent, and the bar is gone.
  expect(await exhausted(page, view.ids[1]!)).toBe(false);
  await padTap(page, PAD.b);
  await padRelease(page, PAD.rt);
  await waitFor(async () => ((await pickView(page)) === null ? true : null), "the bar closed", 15_000);
  await waitFor(
    async () => ((await exhausted(page, view.ids[1]!)) ? true : null),
    "the second character attacked",
    15_000,
  );
  expect(await exhausted(page, view.ids[0]!), "the first character did not").toBe(false);
  expect(errors).toEqual([]);
});

test("who attacks: the digits pick on a keyboard and the names wear them", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await openFixture(page, "fixture=attackers");
  await clickFocus(page, "basic:attack");
  const view = await waitFor(() => pickView(page), "the Who attacks bar", 15_000);
  // A key press that does nothing else makes it a keyboard screen.
  await pressKey(page, "Shift");
  await settle(page, { quietMs: 300, maxMs: 2000 });
  for (const [slot, id] of view.ids.entries()) {
    const rect = (await rectOfSource(page, id))!;
    expect(await glyphIn(page, "Board", String(slot + 1), rect), `the key ${slot + 1} on character ${slot}`).toBe(true);
  }
  await page.screenshot({ path: "../../artifacts/qa/pick-attackers-keys.png" });
  await pressKey(page, "3");
  await waitFor(async () => ((await pickView(page)) === null ? true : null), "the bar closed", 15_000);
  await waitFor(
    async () => ((await exhausted(page, view.ids[2]!)) ? true : null),
    "the third character attacked",
    15_000,
  );
  expect(errors).toEqual([]);
});

test("which target: every tile has its own combo, the fifth is LT + A, and nothing pages", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await openFixture(page, "fixture=drones&seats=4");
  await clickFocus(page, "basic:attack");
  const view = await waitFor(() => pickView(page), "the target tiles", 15_000);
  expect(view.ids.length, "the villain and four drones").toBeGreaterThanOrEqual(5);
  await padWake(page);
  await settle(page, { quietMs: 300, maxMs: 2000 });

  // The first four wear RT + A / B / X / Y and the fifth wears LT + A: all on one page, with no "more" hint.
  for (const [slot, id] of view.ids.slice(0, 4).entries()) {
    const rect = (await rectOfTile(page, id))!;
    expect(rect, `a tile for target ${slot}`).not.toBeNull();
    expect(await glyphIn(page, "Board", FACE[slot]!, rect), `${FACE[slot]} on target ${slot}`).toBe(true);
    expect(await glyphIn(page, "Board", "RT", rect), `RT on target ${slot}`).toBe(true);
  }
  const fifth = (await rectOfTile(page, view.ids[4]!))!;
  expect(await glyphIn(page, "Board", "LT", fifth), "LT on the fifth target").toBe(true);
  expect(await glyphIn(page, "Board", "A", fifth), "A on the fifth target").toBe(true);
  await page.screenshot({ path: "../../artifacts/qa/pick-targets-combos.png" });

  // A bumper held with a face button that has no target (RB + A is the ninth) picks nothing and does not jump zones.
  const before = await version(page);
  const focusBefore = await focusedKey(page);
  await padHold(page, PAD.rb);
  await padTap(page, PAD.a);
  await padRelease(page, PAD.rb);
  expect((await pickView(page))?.ids.length, "the panel is still open").toBe(view.ids.length);
  expect(await version(page), "nothing reached the engine").toBe(before);
  expect(await focusedKey(page), "the bumper did not also jump zones").toBe(focusBefore);

  // A quick RB tap alone keeps its zone jump, on release.
  await padTap(page, PAD.rb);
  expect(await focusedKey(page), "a lone RB tap moved focus").not.toBe(focusBefore);

  // LT + A picks the fifth target outright: the attack goes out and the panel closes.
  await padHold(page, PAD.lt);
  expect(await glyphIn(page, "Board", "A", fifth), "the bare button once LT is held").toBe(true);
  await padTap(page, PAD.a);
  await padRelease(page, PAD.lt);
  await waitFor(async () => ((await pickView(page)) === null ? true : null), "the panel closed", 15_000);
  expect(await version(page), "the attack reached the engine").toBeGreaterThan(before);
  expect(errors).toEqual([]);
});
