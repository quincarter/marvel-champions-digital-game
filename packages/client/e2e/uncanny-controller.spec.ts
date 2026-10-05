import { expect, test } from "@playwright/test";
import { focusRect, handInstanceFor, pressUntil, settle } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import {
  SHOT,
  boardText,
  boardTexts,
  boardUp,
  facts,
  playFromHand,
  press,
  startDevGame,
  waitForBoardText,
  payWith,
} from "./x-men-helpers.js";

/**
 * "Play under any player's control" asks whose play area (RRG 1.8 "Ownership and Control", p. 30; Storm's Uncanny X-Men
 * 36018). Storm beside Wolverine: `legalActions` lists the card once per seat, and the board must ask which, name each
 * seat by its hero, and send the one picked. The dev game (`store/dev-x-men-games.ts`) is a real game played forward to
 * Storm's turn with Uncanny X-Men in hand; the question and its answer are real pointer or touch input.
 */

const UNCANNY = "36018";
const WOLVERINE = "p2";

test.describe("Uncanny X-Men asks whose play area", () => {
  test("two heroes: the seats are offered, the one picked gets the card", async ({ page }, info) => {
    test.setTimeout(240_000);
    const phone = info.project.name === "phone";
    const shot = (name: string) =>
      SHOT ? page.screenshot({ path: `${SHOT}/uncanny-${info.project.name}-${name}.png` }) : null;
    await installWave6Helpers(page);
    await openApp(page);
    await startDevGame(page, "startUncannyDevGame");
    await boardUp(page);

    const id = (await handInstanceFor(page, UNCANNY))!;
    expect(id, "Uncanny X-Men is in Storm's hand").not.toBeNull();
    const inPlayUnder = async (): Promise<{ inPlay: boolean; controller: string | null }> =>
      page.evaluate(async (card) => {
        const { appSession } = (await import("/src/session.ts")) as unknown as {
          appSession: () => {
            store: {
              state: {
                game?: {
                  players: { hand: string[]; deck: string[]; discard: string[] }[];
                  instances: Record<string, { controllerId: string | null }>;
                };
              };
            };
          };
        };
        const game = appSession().store.state.game!;
        const away = game.players.some((p) => [...p.hand, ...p.deck, ...p.discard].includes(card));
        return { inPlay: !away, controller: game.instances[card]!.controllerId };
      }, id);
    await shot("0-before");

    await playFromHand(page, phone, id, async () => (await boardText(page, /^Whose play area\?$/i)) !== undefined);
    await waitForBoardText(page, /^Whose play area\?$/i, "the controller question");
    // The opening "round 1" band crosses the table once; let it clear so the question is what is on screen.
    await settle(page, { quietMs: 400, maxMs: 4000 });
    await shot("1-question");
    const all = await boardTexts(page);
    expect(all, "Storm's seat is offered").toContain("Storm");
    expect(all, "Wolverine's seat is offered").toContain("Wolverine");
    expect(all.some((t) => /^2 SEATS$/i.test(t))).toBe(true);
    expect((await inPlayUnder()).inPlay, "nothing was played by asking").toBe(false);

    // The second seat (not the asking one, and not what the engine's example would have taken): its identity tile.
    const wolverineIdentity = await facts(page, (game) => game.players[1].identity.instanceId as string);
    const tile = (await focusRect(page, `card:${wolverineIdentity}`))!;
    expect(tile, "Wolverine's tile is on the route").not.toBeNull();
    await pressUntil(
      page,
      () => press(page, phone, tile.x + tile.width / 2, tile.y + tile.height / 2),
      async () => (await boardText(page, /^PAYING/i)) !== undefined,
      "payment opens after the seat is picked",
    );
    expect((await inPlayUnder()).inPlay, "still not played until it is paid for").toBe(false);
    await shot("2-paying");

    // Pay with three other hand cards: the card enters Wolverine's play area.
    const hand = await facts(page, (game) => game.players[0].hand as string[]);
    const others = hand.filter((card) => card !== id).slice(0, 3);
    await payWith(page, phone, others);
    // The play lands once the engine has run the card: on a starved runner that is seconds, not the 5 s default.
    await expect.poll(async () => (await inPlayUnder()).inPlay, { timeout: 45_000 }).toBe(true);
    expect((await inPlayUnder()).controller, "Wolverine's control").toBe(WOLVERINE);
    await shot("3-played");
  });
});
