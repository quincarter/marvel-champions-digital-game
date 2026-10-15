import { expect, test, type Page } from "@playwright/test";
import { focusRect, settle, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { boardUp, press } from "./x-men-helpers.js";

/**
 * Undo across a reload (owner report, 2026-10-14: "I was in round 2 for rhino, exited, went back in, played 2 cards,
 * and Undo took me all the way back to Round 1"). A real Rhino game is played into round 2 against the browser's
 * own storage, the page is reloaded, the game is resumed from that storage, two moves are made and Undo is pressed
 * until it is refused. The game must still be in round 2, and never behind the point it resumed at.
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

test("Undo after a reload stops at the turn the game resumed into, never an earlier round", async ({ page }, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  await installWave6Helpers(page);
  await openApp(page);

  // Play a real Rhino game into round 2 through the store (saved to the browser's storage as it goes).
  const round = await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: any };
    };
    const { store } = appSession();
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 2026,
    });
    const toTurn = async () => {
      for (let guard = 0; guard < 80; guard++) {
        const legal = store.state.legal.actions;
        if (legal.kind === "turn") return;
        const choice = legal.choice;
        await store.dispatch({
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: choice.options.slice(0, choice.minSelections).map((o: any) => o.optionId),
        });
      }
    };
    await toTurn();
    const end = store.state.legal.actions.legal.find((a: any) => a.action.kind === "endTurn");
    await store.dispatch(end.example);
    await toTurn();
    return store.state.game.round as number;
  });
  expect(round).toBe(2);
  await settle(page, { quietMs: 500, maxMs: 3000 });

  // Leave and come back: a fresh page, the game resumed from storage, on the Board.
  await page.reload();
  await waitFor(
    async () => (await page.evaluate(() => Boolean((window as any).__mcGame?.scene))) || null,
    "the app boots again",
    30000,
  );
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: any } };
    const { store } = appSession();
    const latest = await store.latestSave();
    await store.resume(latest.id);
    const scenes = (window as any).__mcGame.scene;
    for (const s of scenes.getScenes(true)) scenes.stop(s.sys.settings.key);
    scenes.start("Board");
  });
  await boardUp(page);
  const resumedVersion = await store(page, (s) => s.version as number);
  expect(await store(page, (s) => s.game.round)).toBe(2);

  // Two moves of this turn, then Undo until it is refused.
  await pressFocus(page, phone, "basic:changeForm");
  // The second move is a basic power the engine offers, dispatched as the player (a form change is once a turn).
  const second = await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: any } };
    const { store } = appSession();
    const legal = store.state.legal.actions.legal;
    const entry = ["basicRecover", "basicThwart", "basicAttack"]
      .map((kind) => legal.find((a: any) => a.action.kind === kind))
      .find(Boolean);
    return entry ? await store.dispatch(entry.example) : "no basic power";
  });
  expect(second, "a second move is made").toBe(true);
  await settle(page, { quietMs: 400, maxMs: 4000 });
  expect(await store(page, (s) => s.version as number)).toBe(resumedVersion + 2);
  for (let presses = 0; presses < 5; presses++) {
    await pressFocus(page, phone, "undo");
    expect(await store(page, (s) => s.game.round), "still round 2").toBe(2);
    expect(await store(page, (s) => s.version as number)).toBeGreaterThanOrEqual(resumedVersion);
  }
  expect(await store(page, (s) => s.version as number), "Undo stops where the game resumed").toBe(resumedVersion);
});
