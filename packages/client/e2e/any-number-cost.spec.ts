import { expect, test, type Page } from "@playwright/test";
import { findText, handInstanceFor, pressUntil, settle, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, boardText, boardUp, facts, idsOf, payWith, playFromHand, press, startDevGame } from "./x-men-helpers.js";

/**
 * "Exhaust your hero and any number of X-MEN allies →" (Mutant Peacekeepers 34018; RRG 1.8 "Cost", p. 13: a cost's
 * choices are the player's) asks which allies on the decision sheet (issue #991), with what X comes to, and exhausts exactly those.
 * Before, the board sent the engine's example (the first ally) with no question. The dev game
 * (`store/dev-x-men-games.ts`) is a real game played forward to Phoenix in hero form with Cyclops and Marvel Girl in
 * play and Mutant Peacekeepers in hand; the choice itself is real pointer or touch input.
 */

const PEACEKEEPERS = "34018";
const CYCLOPS = "34003";
const MARVEL_GIRL = "34015";

const exhausted = (page: Page, id: string): Promise<boolean> =>
  page.evaluate(async (card) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game?: { instances: Record<string, { exhausted: boolean }> } } } };
    };
    return appSession().store.state.game!.instances[card]!.exhausted;
  }, id);

type SheetRect = { x: number; y: number; width: number; height: number };

/** The Board's own question on the decision sheet: the cards it offers. */
const sheetOptions = (page: Page): Promise<string[]> =>
  page.evaluate(
    () =>
      (
        window as unknown as { __mcBoardDebug?: { localChoiceOptions(): string[] } }
      ).__mcBoardDebug?.localChoiceOptions() ?? [],
  );

/** A control of the decision sheet by its focus key ("confirm", "option:<id>"), on screen. */
const sheetRect = (page: Page, key: string): Promise<SheetRect | null> =>
  page.evaluate((k) => {
    const all =
      (
        window as unknown as { __mcChoiceDebug?: { allRects(): [string, SheetRect | null][] } }
      ).__mcChoiceDebug?.allRects() ?? [];
    return all.find(([name]) => name === k)?.[1] ?? null;
  }, key);

/** Presses a card on the sheet. */
async function pickOption(page: Page, phone: boolean, id: string): Promise<void> {
  const r = (await sheetRect(page, `option:${id}`))!;
  expect(r, `a card for ${id} on the sheet`).toBeTruthy();
  await press(page, phone, r.x + r.width / 2, r.y + r.height / 2);
  await settle(page, { quietMs: 200, maxMs: 800 });
}

/** The live X the sheet's line shows ("X = 2 threat"), or null. */
async function xValue(page: Page): Promise<number | null> {
  const found = await findText(page, "X = ", "ChoiceOverlay");
  const m = found.map((t) => /X = (\d+)/.exec(t.text)).find((x) => x);
  return m ? Number(m[1]) : null;
}

test.describe("Mutant Peacekeepers asks which allies", () => {
  test("any number of X-MEN allies: pick, count, preview, confirm; only the picked ally is exhausted", async ({
    page,
  }, info) => {
    test.setTimeout(240_000);
    const phone = info.project.name === "phone";
    const shot = (name: string) =>
      SHOT ? page.screenshot({ path: `${SHOT}/any-number-${info.project.name}-${name}.png` }) : null;
    await installWave6Helpers(page);
    await openApp(page);
    await startDevGame(page, "startPeacekeepersDevGame");
    await boardUp(page);

    const card = (await handInstanceFor(page, PEACEKEEPERS))!;
    expect(card, "Mutant Peacekeepers is in Phoenix's hand").not.toBeNull();
    const [cyclops] = await idsOf(page, CYCLOPS, "play");
    const [marvelGirl] = await idsOf(page, MARVEL_GIRL, "play");
    expect(cyclops, "Cyclops is in play").toBeDefined();
    expect(marvelGirl, "Marvel Girl is in play").toBeDefined();
    await shot("0-before");

    await playFromHand(page, phone, card, async () => (await sheetOptions(page)).length >= 2);
    // The opening "round 1" band crosses the table once; let it clear so the question is what is on screen.
    await settle(page, { quietMs: 400, maxMs: 4000 });
    await shot("1-question");
    // The question is on the decision sheet (issue #991): both allies are card options, the title says what is asked,
    // and nothing is picked yet.
    expect([...(await sheetOptions(page))].sort()).toEqual([cyclops!, marvelGirl!].sort());
    expect((await findText(page, "Choose cards to exhaust", "ChoiceOverlay")).length).toBeGreaterThan(0);
    expect(await exhausted(page, cyclops!), "nothing is spent by asking").toBe(false);

    // Confirm is not available until something is picked: pressing it changes nothing.
    const early = (await sheetRect(page, "confirm"))!;
    expect(early, "the sheet offers Confirm").toBeTruthy();
    await press(page, phone, early.x + early.width / 2, early.y + early.height / 2);
    await settle(page, { quietMs: 200, maxMs: 800 });
    expect((await sheetOptions(page)).length, "still asking after Confirm with nothing picked").toBe(2);

    // Pick Marvel Girl (not the first ally the engine would have taken): a live X.
    await pickOption(page, phone, marvelGirl!);
    const one = await waitFor(async () => (await xValue(page)) ?? null, "a live X");
    await shot("2-one");
    // Pick Cyclops too: X grows. Then put Cyclops back.
    await pickOption(page, phone, cyclops!);
    const both = await waitFor(async () => {
      const x = await xValue(page);
      return x !== null && x > one ? x : null;
    }, "X with both");
    expect(both).toBeGreaterThan(one);
    await shot("3-two");
    await pickOption(page, phone, cyclops!);
    await waitFor(async () => ((await xValue(page)) === one ? true : null), "X back to one ally");

    // Confirm: payment (the card costs 1) is next; nothing has been spent yet.
    await pressUntil(
      page,
      async () => {
        const confirm = await sheetRect(page, "confirm");
        if (confirm) await press(page, phone, confirm.x + confirm.width / 2, confirm.y + confirm.height / 2);
      },
      async () => (await boardText(page, /^PAYING/i)) !== undefined,
      "payment opens after the picks are confirmed",
      { minWaitMs: 2000 },
    );
    expect(await exhausted(page, marvelGirl!), "nothing is spent until it is paid for").toBe(false);
    await shot("4-paying");

    // The card costs 1 and the hand is only itself: Phoenix's own "Psionic Bond" (a power counter for a resource) pays.
    const phoenix = await facts(page, (game) => game.players[0].identity.instanceId as string);
    await payWith(page, phone, [phoenix]);
    await expect.poll(() => exhausted(page, marvelGirl!), { timeout: 45_000 }).toBe(true);
    expect(await exhausted(page, cyclops!), "Cyclops was not picked, so he stays ready").toBe(false);
    await shot("5-played");
  });
});
