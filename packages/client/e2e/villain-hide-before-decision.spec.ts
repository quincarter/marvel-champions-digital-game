import { expect, test, type Page } from "@playwright/test";
import { settle, waitFor } from "./helpers.js";
import { villainDebugRect } from "./overlay-helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp, startGame, type Rect } from "./wave6-helpers-b.js";

/**
 * HIDE pressed on the docked villain-phase rail while the replay is still showing earlier beats. The engine is already
 * parked on the player's next decision (here, who defends Klaw's attack), but the player has not seen it yet. That
 * decision must bring the rail back when the replay reaches it; it used to stay hidden behind the handle with no prompt,
 * which reads as an interrupt or a defense never offered.
 *
 * Ms. Marvel (Protection) against Klaw, seed 11 (as `preemptive-strike-second-boost.spec.ts`).
 */

const pendingKind = (page: Page): Promise<string | null> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game: any } } };
    };
    return (appSession().store.state.game?.pendingChoice?.prompt.kind as string | undefined) ?? null;
  });

const answer = (page: Page, ids: readonly string[]): Promise<unknown> =>
  page.evaluate(async (selected) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { resolveChoice: (ids: readonly string[]) => Promise<boolean> } };
    };
    return appSession().store.resolveChoice(selected);
  }, ids);

const dispatch = (page: Page, command: unknown): Promise<unknown> =>
  page.evaluate(async (c) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { dispatch: (c: unknown) => Promise<boolean> } };
    };
    return appSession().store.dispatch(c);
  }, command);

const center = (rect: Rect): [number, number] => [rect.x + rect.width / 2, rect.y + rect.height / 2];

test("a decision the replay has not reached yet brings a hidden villain-phase rail back", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() =>
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false, holdEncounterCards: false }),
    ),
  );
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "klaw", decks: ["msm-protection"], seed: 11 });
  while ((await pendingKind(page)) === "mulligan") await answer(page, []);
  await dispatch(page, { type: "changeForm", playerId: "p1" });
  await dispatch(page, { type: "endTurn", playerId: "p1" });
  if ((await pendingKind(page)) === "discardDownToHandSize") {
    const first = await page.evaluate(async () => {
      const { appSession } = (await import("/src/session.ts")) as unknown as {
        appSession: () => { store: { state: { game: any } } };
      };
      return appSession().store.state.game.pendingChoice.options[0].optionId as string;
    });
    await answer(page, [first]);
  }
  await settle(page);
  const start = await waitFor(() => villainDebugRect(page, "startRect"), "START VILLAIN PHASE", 30_000);
  await page.mouse.click(...center(start));

  // HIDE at once, while the replay is still on the opening beats and Klaw's attack waits unseen on the engine.
  const hide = await waitFor(() => villainDebugRect(page, "hideRect"), "the rail's HIDE", 10_000);
  expect(await pendingKind(page), "the engine is already parked on the defense").toBe("declareDefender");
  await page.mouse.click(...center(hide));
  await waitFor(() => villainDebugRect(page, "showRect"), "the hidden rail's handle", 5_000);

  // The replay reaches the defense: the rail comes back for it.
  await waitFor(
    async () => ((await villainDebugRect(page, "showRect")) === null ? true : null),
    "the rail back for the defense",
    20_000,
  );
  expect(await pendingKind(page)).toBe("declareDefender");
});
