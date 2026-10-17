import { expect, test, type Page } from "@playwright/test";
import { settle, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, boardUp, press } from "./x-men-helpers.js";

/**
 * Issue #211: at the end-of-turn discard, the hand's last card could not be picked. A target picked on a sheet whose
 * move was then undone stayed picked: Undo rewinds the engine's choice counter, so the discard took the undone
 * decision's id, and the sheet (which knew a decision by its id alone) kept the villain as an invisible, counted pick.
 * The dev game (`store/dev-off-turn-game.ts`) stops on a hero's turn holding an event that asks for a target.
 */

const run = <T>(page: Page, source: string): Promise<T> =>
  page.evaluate(async (src) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: unknown } };
    const sheet = (window as unknown as { __mcGame: { scene: { getScene: (k: string) => unknown } } }).__mcGame.scene;
    return await new Function("store", "sheet", `return (async () => { ${src} })()`)(
      appSession().store,
      sheet.getScene("ChoiceOverlay"),
    );
  }, source) as Promise<T>;

async function tapOption(page: Page, phone: boolean, optionId: string): Promise<void> {
  const rect = await waitFor(
    () =>
      page.evaluate(
        (id) =>
          (
            window as unknown as {
              __mcChoiceDebug?: { optionRect: (id: string) => { x: number; y: number; width: number; height: number } };
            }
          ).__mcChoiceDebug?.optionRect(id) ?? null,
        optionId,
      ),
    `option ${optionId} on the sheet`,
    10000,
  );
  await press(page, phone, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await settle(page, { quietMs: 300, maxMs: 2000 });
}

interface SheetState {
  readonly selected: readonly string[];
}

test("a pick on an undone sheet does not carry over to the end-of-turn discard", async ({ page }, info) => {
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

  // Flip to hero form, then find the play that asks for a target (the villain or a minion, nothing in hand).
  const target = await run<{ before: number; choiceId: string; options: string[] } | null>(
    page,
    `
    const flip = store.state.legal.actions.legal.find((e) => e.action.kind === "changeForm");
    await store.dispatch(flip.example);
    const before = store.state.version;
    for (const entry of store.state.legal.actions.legal) {
      if (entry.action.kind !== "playCard") continue;
      await store.dispatch(entry.example);
      const c = store.state.game.pendingChoice;
      const hand = store.state.game.players[0].hand;
      if (c && c.prompt.kind === "chooseTarget" && c.options.every((o) => !hand.includes(o.optionId))) {
        return { before, choiceId: c.choiceId, options: c.options.map((o) => o.optionId) };
      }
      await store.rewindTo(before);
    }
    return null;
  `,
  );
  expect(target, "a play in the dev game asks for a target").not.toBeNull();
  await settle(page, { quietMs: 600, maxMs: 4000 });
  await tapOption(page, phone, target!.options[0]!);
  expect((await run<SheetState>(page, "return sheet.debugState();")).selected).toEqual([target!.options[0]]);

  // Undo the play (the same rewind as the action bar's Undo), with the target picked and never sent, then end the turn.
  await run(page, `await store.rewindTo(${target!.before}); return null;`);
  await settle(page, { quietMs: 600, maxMs: 4000 });
  const discard = await run<{ choiceId: string; maxSelections: number; options: string[] } | null>(
    page,
    `
    await store.dispatch({ type: "endTurn", playerId: store.state.game.players[0].playerId });
    for (let i = 0; i < 10; i++) {
      const c = store.state.game.pendingChoice;
      if (!c || c.prompt.kind === "discardDownToHandSize") break;
      await store.resolveChoice(c.options.slice(0, c.minSelections).map((o) => o.optionId));
    }
    const c = store.state.game.pendingChoice;
    return c?.prompt.kind === "discardDownToHandSize"
      ? { choiceId: c.choiceId, maxSelections: c.maxSelections, options: c.options.map((o) => o.optionId) }
      : null;
  `,
  );
  expect(discard, "the end-of-turn discard is open").not.toBeNull();
  // The bug's precondition: the discard took the undone decision's id.
  expect(discard!.choiceId).toBe(target!.choiceId);
  expect(discard!.maxSelections).toBe(discard!.options.length);
  await settle(page, { quietMs: 800, maxMs: 5000 });
  expect((await run<SheetState>(page, "return sheet.debugState();")).selected, "the discard starts empty").toEqual([]);

  // Every card in hand can be picked, the last one too.
  for (const id of discard!.options) await tapOption(page, phone, id);
  if (SHOT) await page.screenshot({ path: `${SHOT}/discard-stale-pick-${info.project.name}.png` });
  expect((await run<SheetState>(page, "return sheet.debugState();")).selected).toEqual(discard!.options);
});
