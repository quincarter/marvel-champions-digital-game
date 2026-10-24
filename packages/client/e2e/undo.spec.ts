import { expect, test, type Page } from "@playwright/test";
import { focusRect, settle, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, boardUp, facts, press } from "./x-men-helpers.js";

/**
 * Undo (`view/undo.ts`): the action bar's Undo takes back the active hero's last move this turn, and stops at the
 * start of the turn and at anything that drew a card. The dev game (`store/dev-off-turn-game.ts`) stops on
 * Spider-Man's turn in round 2, with Deadpool next, holding Mulligan ("discard your hand, then draw up to your hand
 * size") — the user's own example of a move that can't be taken back.
 */

const store = <T>(page: Page, read: (s: any) => T): Promise<T> =>
  page.evaluate(async (source) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: unknown } };
    return new Function("s", `return (${source})(s)`)(appSession().store.state);
  }, read.toString()) as Promise<T>;

async function pressFocus(page: Page, phone: boolean, key: string): Promise<void> {
  const rect = await waitFor(() => focusRect(page, key), `the ${key} control`, 10000);
  await press(page, phone, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await settle(page, { quietMs: 400, maxMs: 4000 });
}

test("Undo takes back a hero's own move, and stops at the turn's start and at a new hand", async ({ page }, info) => {
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

  const spiderMan = await facts(page, (game) => game.players[0].playerId as string);
  const formOf = () => facts(page, (game) => game.players[0].identity.form as string);
  expect(await store(page, (s) => s.perspectiveId)).toBe(spiderMan);
  const start = await store(page, (s) => s.version as number);
  const startForm = await formOf();

  // Nothing done yet this turn: Undo is on the bar and does nothing.
  expect(await focusRect(page, "undo"), "Undo sits beside End turn").not.toBeNull();
  if (SHOT) await page.screenshot({ path: `${SHOT}/undo-${info.project.name}-1-nothing.png` });
  await pressFocus(page, phone, "undo");
  expect(await store(page, (s) => s.version)).toBe(start);

  // Change form, then take it back.
  await pressFocus(page, phone, "basic:changeForm");
  await waitFor(async () => ((await formOf()) !== startForm ? true : null), "Spider-Man changes form", 10000);
  if (SHOT) await page.screenshot({ path: `${SHOT}/undo-${info.project.name}-2-flipped.png` });
  await pressFocus(page, phone, "undo");
  await waitFor(async () => ((await formOf()) === startForm ? true : null), "Undo puts the form back", 10000);
  expect(await store(page, (s) => s.version)).toBe(start);
  if (SHOT) await page.screenshot({ path: `${SHOT}/undo-${info.project.name}-3-undone.png` });

  // Ctrl+Z is the same Undo.
  await pressFocus(page, phone, "basic:changeForm");
  await waitFor(async () => ((await formOf()) !== startForm ? true : null), "Spider-Man changes form again", 10000);
  await page.keyboard.press("Control+z");
  await waitFor(async () => ((await formOf()) === startForm ? true : null), "Ctrl+Z puts the form back", 10000);

  // Flip once more, then Deadpool plays Mulligan during Spider-Man's turn ("discard your hand, then draw up to your
  // hand size"): Undo never takes back another player's move, nor anything before a new hand was drawn.
  await pressFocus(page, phone, "basic:changeForm");
  await waitFor(
    async () => ((await formOf()) !== startForm ? true : null),
    "Spider-Man changes form a third time",
    10000,
  );
  const played = await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: {
          state: any;
          dispatch: (c: unknown) => Promise<boolean>;
          takeOffTurnSeat: (p: string) => Promise<boolean>;
        };
      };
    };
    const { store } = appSession();
    const deadpool = store.state.game.players[1];
    // The seat is refused while a command is in flight or the off-turn seats are still being worked out, so ask
    // until the store has settled after the form change.
    let seated = false;
    for (let tries = 0; tries < 50 && !seated; tries++) {
      seated = await store.takeOffTurnSeat(deadpool.playerId);
      if (!seated) await new Promise((r) => setTimeout(r, 100));
    }
    if (!seated) return "no off-turn seat";
    const mulligan = deadpool.hand.find((id: string) => store.state.game.instances[id]?.cardId === "44048");
    const entry = store.state.legal.actions.legal.find(
      (e: any) => e.action.kind === "playCard" && e.action.instanceId === mulligan,
    );
    if (!entry) return "no Mulligan play";
    let ok = await store.dispatch(entry.example);
    // Answer whatever the play asks with its first options.
    for (let guard = 0; ok && store.state.game.pendingChoice && guard < 10; guard++) {
      const choice = store.state.game.pendingChoice;
      ok = await store.dispatch({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: choice.options.slice(0, choice.minSelections).map((o: any) => o.optionId),
      });
    }
    return ok ? "played" : "refused";
  });
  expect(played, "Deadpool plays Mulligan off turn").toBe("played");
  await waitFor(
    async () => ((await store(page, (s) => s.perspectiveId)) === spiderMan ? true : null),
    "back on Spider-Man's turn",
    15000,
  );
  await settle(page, { quietMs: 600, maxMs: 6000 });
  const afterMulligan = await store(page, (s) => s.version as number);
  if (SHOT) await page.screenshot({ path: `${SHOT}/undo-${info.project.name}-4-after-mulligan.png` });
  await pressFocus(page, phone, "undo");
  await page.keyboard.press("Control+z");
  await settle(page, { quietMs: 400, maxMs: 3000 });
  expect(await store(page, (s) => s.version), "Undo can't take back Deadpool's new hand").toBe(afterMulligan);
  expect(await formOf(), "nor Spider-Man's flip from before it").not.toBe(startForm);
});
