import { expect, test } from "@playwright/test";
import { focusRect, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, boardText, boardUp, facts, pressCard, press, waitForBoardText } from "./x-men-helpers.js";

/**
 * Issue #242: Wonder Man (03014, "As an additional cost for Wonder Man to attack, you must discard 1 card from your
 * hand") attacked and the first card in hand went to the discard pile without a question. Now the attack opens the
 * discard bar over the hand, and the card picked is the one discarded. The bar is a mode over the hand, not a sheet over
 * the table: the table stays drawn and its cards still open their hover popover while the pick is open. The dev game (`store/dev-in-play-cost-games.ts`)
 * has Wonder Man in play; a turn is played through so the hand holds a real choice.
 */
test("issue #242: Wonder Man's attack asks which card to discard", async ({ page }, info) => {
  test.skip(
    info.project.name === "phone",
    "the discard bar's hand picks are covered on the phone by Shield Toss's spec",
  );
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: {
          state: { legal?: { actions: { kind: string; legal?: { action: { kind: string }; example: unknown }[] } } };
          dispatch(command: unknown): Promise<void>;
          resolveChoice(ids: string[]): Promise<void>;
        };
      };
    };
    const { startStrengthInNumbersDevGame } = (await import(
      /* @vite-ignore */ "/src/store/dev-in-play-cost-games.ts"
    )) as unknown as { startStrengthInNumbersDevGame: (store: unknown) => Promise<void> };
    const { nextTurn } = (await import(/* @vite-ignore */ "/src/store/dev-game-steps.ts")) as unknown as {
      nextTurn: (store: unknown) => Promise<{ legal: { action: { kind: string }; example: unknown }[] } | null>;
    };
    const store = appSession().store;
    await startStrengthInNumbersDevGame(store);
    const turn = await nextTurn(store);
    const end = turn?.legal.find((entry) => entry.action.kind === "endTurn");
    if (end) await store.dispatch(end.example);
    await nextTurn(store);
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
  const hand = await facts(page, (g) => g.players[0].hand as string[]);
  expect(hand.length, "a hand to choose from").toBeGreaterThan(1);
  const discardBefore = await facts(page, (g) => g.players[0].discard.length as number);

  // Attack, then pick Wonder Man in "Who attacks?".
  const attack = await waitFor(() => focusRect(page, "basic:attack"), "the Attack control", 15_000);
  await press(page, false, attack.x + attack.width / 2, attack.y + attack.height / 2);
  const wonderMan = await waitForBoardText(page, /^wonder man/i, "Wonder Man in Who attacks?");
  await press(page, false, wonderMan.x, wonderMan.y);
  await waitForBoardText(page, /^DISCARDING 0 \(1\)/, "the discard bar over the hand");
  expect(await facts(page, (g) => g.players[0].discard.length), "nothing discarded before the pick").toBe(
    discardBefore,
  );

  // The table is still there to read: Wonder Man's tile opens its hover popover with the bar open.
  const wonderManId = (await facts(page, (g) =>
    Object.keys(g.instances).find(
      (id: string) => g.instances[id].cardId === "03014" && !g.players[0].hand.includes(id),
    ),
  )) as string;
  const tile = await page.evaluate(
    (id) =>
      (
        window as unknown as {
          __mcBoardDebug?: { hitRect(id: string): { x: number; y: number; width: number; height: number } | null };
        }
      ).__mcBoardDebug?.hitRect(id) ?? null,
    wonderManId,
  );
  expect(tile, "Wonder Man's tile on the table").not.toBeNull();
  await page.mouse.move(tile!.x + tile!.width / 2, tile!.y + tile!.height / 2);
  await page.mouse.move(tile!.x + tile!.width / 2 + 4, tile!.y + tile!.height / 2 + 4, { steps: 4 });
  await waitFor(
    async () =>
      (
        await page.evaluate(
          () =>
            (window as unknown as { __mcBoardDebug?: { hoverShown(): string | null } }).__mcBoardDebug?.hoverShown() ??
            null,
        )
      )?.includes(wonderManId)
        ? true
        : null,
    "Wonder Man's hover popover while picking",
    10_000,
  );
  await settle(page, { quietMs: 400, maxMs: 3000 });
  if (SHOT) await page.screenshot({ path: `${SHOT}/wonder-man-discard-table-hover.png` });
  await page.mouse.move(5, 5);

  // Pick the last hand card, not the first, and confirm.
  const last = hand[hand.length - 1]!;
  await pressCard(page, false, last);
  await waitForBoardText(page, /^DISCARDING 1 \(1\)/, "the pick counts");
  await settle(page, { quietMs: 400, maxMs: 3000 });
  if (SHOT) await page.screenshot({ path: `${SHOT}/wonder-man-discard-pick.png` });
  const confirm = await waitForBoardText(page, /^confirm$/i, "Confirm");
  await press(page, false, confirm.x, confirm.y);
  await waitFor(
    async () => ((await facts(page, (g) => g.players[0].discard as string[])).includes(last) ? true : null),
    "the picked card is discarded",
    15_000,
  );
  expect(await facts(page, (g) => g.players[0].hand as string[]), "the first card stays in hand").toContain(hand[0]);
  expect(await boardText(page, /^DISCARDING/)).toBeUndefined();
  expect(errors).toEqual([]);
});
