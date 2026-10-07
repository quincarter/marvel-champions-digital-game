import { expect, test, type Page } from "@playwright/test";
import { clickText, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, boardUp, facts, payWith, playFromHand, press } from "./x-men-helpers.js";

/**
 * A waiting seat may play an Action event or trigger an Action ability during another player's turn (RRG 1.8 "Player
 * Turn", pp. 34-35; owner ruling 2026-10-05). The dev game (`store/dev-off-turn-game.ts`) stops on Spider-Man's turn
 * in round 2 with Deadpool holding Mulligan. The board offers an "Act" button on Deadpool's row; it shows his hand
 * under an "off turn" bar, with no basic powers, and the play goes out as Deadpool's own command.
 */

const texts = async (page: Page): Promise<string[]> =>
  (await visibleTexts(page)).filter((t) => t.scene === "Board").map((t) => t.text);

test("an off-turn seat plays its Action event from the board during another player's turn", async ({ page }, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: unknown } };
    const { startOffTurnDevGame } = (await import(/* @vite-ignore */ "/src/store/dev-off-turn-game.ts")) as unknown as {
      startOffTurnDevGame: (store: unknown) => Promise<void>;
    };
    await startOffTurnDevGame(appSession().store);
    const scenes = (
      window as unknown as {
        __mcGame: {
          scene: {
            getScenes: (a: boolean) => { sys: { settings: { key: string } } }[];
            stop: (k: string) => void;
            start: (k: string) => void;
          };
        };
      }
    ).__mcGame.scene;
    for (const s of scenes.getScenes(true)) scenes.stop(s.sys.settings.key);
    scenes.start("Board");
  });
  await boardUp(page);

  const store = <T>(read: (s: any) => T): Promise<T> =>
    page.evaluate(async (source) => {
      const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: unknown } };
      return new Function("s", `return (${source})(s)`)(appSession().store.state);
    }, read.toString()) as Promise<T>;

  const p1 = await facts(page, (game) => game.players[0].playerId as string);
  const p2 = await facts(page, (game) => game.players[1].playerId as string);
  expect(await store((s) => s.perspectiveId), "the board starts on the active seat").toBe(p1);
  await waitFor(
    async () => ((await store((s) => s.offTurnSeats.length)) > 0 ? true : null),
    "the off-turn offer",
    15000,
  );
  expect(await store((s) => s.offTurnSeats)).toEqual([p2]);

  // The Team tab holds the other seat's row on a phone.
  if (phone) await clickText(page, "Team", { sceneKey: "Board", maxY: 100 });
  const act = await waitFor(
    async () => (await visibleTexts(page)).find((t) => t.scene === "Board" && /^act$/i.test(t.text)) ?? null,
    "the Act button on the other seat's row",
    10000,
  );
  if (SHOT) await page.screenshot({ path: `${SHOT}/off-turn-${info.project.name}-offer.png` });
  await press(page, phone, act.x, act.y);
  await waitFor(
    async () => ((await store((s) => s.offTurnSeat)) === p2 ? true : null),
    "the board takes Deadpool's seat",
  );
  await settle(page, { quietMs: 400, maxMs: 3000 });
  expect(await store((s) => s.legal.actions.kind)).toBe("notYourTurn");
  expect(
    (await texts(page)).some((t) => /off turn/i.test(t)),
    "the bar says whose turn it is not",
  ).toBe(true);
  expect(
    (await texts(page)).some((t) => /^end turn$/i.test(t)),
    "no End turn for the waiting seat",
  ).toBe(false);
  if (SHOT) await page.screenshot({ path: `${SHOT}/off-turn-${info.project.name}-seat.png` });

  const card = await facts(
    page,
    (game) => game.players[1].hand.find((id: string) => game.instances[id].cardId === "44048") as string,
  );
  const hand = await facts(page, (game) => game.players[1].hand.slice() as string[]);
  const filler = hand.filter((id) => id !== card).slice(0, 3);
  const payOpen = async (): Promise<boolean> => (await texts(page)).some((t) => /^pay$/i.test(t));
  await playFromHand(page, phone, card, payOpen);
  await payWith(page, phone, filler);
  await waitFor(
    async () => ((await store((s) => s.commandTrail.at(-1).command.type)) === "playCard" ? true : null),
    "the play goes out",
    15000,
  );
  const last = await store((s) => s.commandTrail.at(-1).command);
  expect(last.playerId, "the command is Deadpool's").toBe(p2);
  expect(last.cardInstanceId, "it plays Mulligan").toBe(card);
  expect(await store((s) => s.perspectiveId), "the board is back on the active seat").toBe(p1);
  expect(await store((s) => s.offTurnSeat)).toBeNull();
});
