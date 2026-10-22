import { expect, test, type Page } from "@playwright/test";
import { settle, waitFor } from "./helpers.js";
import { villainDebugRect } from "./overlay-helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { openApp, startGame, type Rect } from "./wave6-helpers-b.js";

/**
 * Issue #348: Defiance (26018), "When a boost card on an enemy attacking you would be turned faceup, discard it
 * instead", was offered only once the boost card was faceup, next to Preemptive Strike's "is turned face up". It is now
 * offered while the card is still facedown (FFG ruling: Defiance discards it without turning it faceup), and the card
 * it discards is never turned up.
 *
 * Vision (Protection) against Rhino, seed 1: Defiance is in the opening hand, and Rhino attacks in the first villain
 * phase with one boost card.
 */

const SHOTS = process.env.E2E_SHOTS ?? "";

interface Pending {
  readonly kind: string;
  readonly event: string | null;
  readonly boost: string | null;
  readonly options: readonly string[];
}

const pending = (page: Page): Promise<Pending | null> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game: any } } };
    };
    const c = appSession().store.state.game?.pendingChoice;
    return c
      ? {
          kind: c.prompt.kind as string,
          event: (c.prompt.event?.kind as string | undefined) ?? null,
          boost: (c.prompt.event?.boostInstanceId as string | undefined) ?? null,
          options: c.options.map((o: { optionId: string }) => o.optionId),
        }
      : null;
  });

/** Answers the open choice through the store, as its sheet would. */
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

/** P1's hand as [instance, card code] pairs. */
const handOf = (page: Page): Promise<[string, string][]> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game: any } } };
    };
    const g = appSession().store.state.game;
    return g.players[0].hand.map((id: string) => [id, g.instances[id].cardId]);
  });

/** Where a card is now, and whether it is faceup. */
const cardState = (page: Page, id: string): Promise<{ faceup: boolean; inEncounterDiscard: boolean }> =>
  page.evaluate(async (instanceId) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game: any } } };
    };
    const g = appSession().store.state.game;
    const piles = Object.values(g.encounterDecks) as { discard: string[] }[];
    return {
      faceup: Boolean(g.instances[instanceId]?.faceup),
      inEncounterDiscard: piles.some((p) => p.discard.includes(instanceId)),
    };
  }, id);

const center = (rect: Rect): [number, number] => [rect.x + rect.width / 2, rect.y + rect.height / 2];

const shot = async (page: Page, name: string): Promise<void> => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

test("Defiance is offered while Rhino's boost card is still facedown, and the card it discards is never turned up", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.addInitScript(() =>
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false, holdEncounterCards: false }),
    ),
  );
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["vision-protection"], seed: 1 });
  while ((await pending(page))?.kind === "mulligan") await answer(page, []);
  const hand = await handOf(page);
  const defiance = hand.find(([, code]) => code === "26018")?.[0];
  expect(defiance, "Defiance is in the opening hand").toBeDefined();
  await dispatch(page, { type: "changeForm", playerId: "p1" });
  await dispatch(page, { type: "endTurn", playerId: "p1" });
  // Hand size in hero form: discard something other than Defiance.
  if ((await pending(page))?.kind === "discardDownToHandSize") {
    await answer(page, [hand.find(([id]) => id !== defiance)![0]]);
  }
  await settle(page);
  const start = await waitFor(() => villainDebugRect(page, "startRect"), "START VILLAIN PHASE", 30_000);
  await page.mouse.click(...center(start));
  // Vision in Mass form cannot defend, so Rhino's attack may ask for no defender: decline one if asked.
  const window = await waitFor(
    async () => {
      const p = await pending(page);
      if (p?.kind === "declareDefender") await answer(page, ["decline"]);
      return p?.event === "boostCardTurningFaceup" ? p : null;
    },
    "the facedown boost card's window",
    20_000,
  );
  const option = `${defiance}:26018.defiance-interrupt`;
  expect(window.options).toContain(option);
  expect((await cardState(page, window.boost!)).faceup, "the boost card is still facedown").toBe(false);
  await settle(page);
  const texts = (await visibleTexts(page)).map((t) => t.text.toUpperCase());
  expect(texts.some((t) => t.includes("BOOST CARD FACEDOWN"))).toBe(true);
  await shot(page, "defiance-facedown-boost");

  const use = await waitFor(() => villainDebugRect(page, "useRect"), "Play Defiance", 10_000);
  // A fresh interrupt window ignores presses for a moment (`INLINE_ARM_MS`, issue #253).
  await page.waitForTimeout(1000);
  await page.mouse.click(...center(use));
  const pay = await waitFor(
    async () => {
      const p = await pending(page);
      return p?.kind === "payForCard" ? p : p?.event === "boostCardTurningFaceup" ? null : true;
    },
    "Defiance played or paid for",
    10_000,
  );
  if (pay !== true) await answer(page, [pay.options[0]!]);
  await settle(page, { quietMs: 600, maxMs: 4000 });
  expect(
    (await handOf(page)).some(([id]) => id === defiance),
    "Defiance was played",
  ).toBe(false);
  expect(await cardState(page, window.boost!), "the boost card went to the discard facedown").toEqual({
    faceup: false,
    inEncounterDiscard: true,
  });
});
