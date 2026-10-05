import { expect, test, type Page } from "@playwright/test";
import { handInstanceFor, pressUntil, settle } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import {
  SHOT,
  boardText,
  boardTexts,
  boardUp,
  facts,
  idsOf,
  payWith,
  playFromHand,
  press,
  pressCard,
  startDevGame,
  waitForBoardText,
} from "./x-men-helpers.js";

/**
 * "Exhaust your hero and any number of X-MEN allies →" (Mutant Peacekeepers 34018; RRG 1.8 "Cost", p. 13: a cost's
 * choices are the player's) asks which allies, with a running count and what X comes to, and exhausts exactly those.
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

/** Presses a tile until the count it should make shows (a press lost to a redraw under its own hover is repeated). */
const pickUntil = (page: Page, phone: boolean, id: string, count: RegExp): Promise<void> =>
  pressUntil(
    page,
    () => pressCard(page, phone, id),
    async () => (await boardText(page, count)) !== undefined,
    `the count ${count}`,
  );

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

    await playFromHand(
      page,
      phone,
      card,
      async () => (await boardText(page, /^Choose cards to exhaust$/i)) !== undefined,
    );
    await waitForBoardText(page, /^Choose cards to exhaust$/i, "the which-allies question");
    // The opening "round 1" band crosses the table once; let it clear so the question is what is on screen.
    await settle(page, { quietMs: 400, maxMs: 4000 });
    await shot("1-question");
    const texts = await boardTexts(page);
    expect(texts, "Cyclops is offered").toContain("Cyclops");
    expect(texts, "Marvel Girl is offered").toContain("Marvel Girl");
    expect(texts.some((t) => /^PICKED 0 \(any number\)$/i.test(t))).toBe(true);
    expect(await exhausted(page, cyclops!), "nothing is spent by asking").toBe(false);

    // Confirm is not available until something is picked: pressing it changes nothing.
    const early = (await boardText(page, /^confirm$/i))!;
    expect(early, "the panel offers Confirm").toBeDefined();
    await press(page, phone, early.x, early.y);
    await settle(page, { quietMs: 200, maxMs: 800 });
    expect(await boardText(page, /^PICKED 0/i), "still asking after Confirm with nothing picked").toBeDefined();

    // Pick Marvel Girl (not the first ally the engine would have taken): a count of 1 and a live X.
    await pickUntil(page, phone, marvelGirl!, /^PICKED 1 \(any number\)$/i);
    const one = await waitForBoardText(page, /^X = \d+ threat$/i, "a live X");
    await shot("2-one");
    // Pick Cyclops too: the count and X both grow. Then put Cyclops back.
    await pickUntil(page, phone, cyclops!, /^PICKED 2 \(any number\)$/i);
    const both = await waitForBoardText(page, /^X = \d+ threat$/i, "X with both");
    expect(Number(/\d+/.exec(both.text)![0])).toBeGreaterThan(Number(/\d+/.exec(one.text)![0]));
    await shot("3-two");
    await pickUntil(page, phone, cyclops!, /^PICKED 1 \(any number\)$/i);

    // Confirm: payment (the card costs 1) is next; nothing has been spent yet.
    const confirm = (await boardText(page, /^confirm$/i))!;
    await press(page, phone, confirm.x, confirm.y);
    await waitForBoardText(page, /^PAYING/i, "payment opens after the picks are confirmed");
    expect(await exhausted(page, marvelGirl!), "nothing is spent until it is paid for").toBe(false);
    await shot("4-paying");

    // The card costs 1 and the hand is only itself: Phoenix's own "Psionic Bond" (a power counter for a resource) pays.
    const phoenix = await facts(page, (game) => game.players[0].identity.instanceId as string);
    await payWith(page, phone, [phoenix]);
    await expect.poll(() => exhausted(page, marvelGirl!)).toBe(true);
    expect(await exhausted(page, cyclops!), "Cyclops was not picked, so he stays ready").toBe(false);
    await shot("5-played");
  });
});
