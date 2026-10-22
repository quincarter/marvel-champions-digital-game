import { expect, test, type Page } from "@playwright/test";
import { settle, waitFor } from "./helpers.js";
import { villainDebugRect } from "./overlay-helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { openApp, startGame, type Rect } from "./wave6-helpers-b.js";

/**
 * Issue #253: Klaw's attack is dealt two boost cards (his forced interrupt adds the second), so Preemptive Strike
 * (05014) is offered once per boost card turned faceup, each window in the same place with the same buttons. A player
 * who passed on the first card and pressed "Let it resolve" again a moment later answered the second card's window
 * before seeing it, and the 2-icon card resolved with no chance to play the event. A fresh window now ignores presses
 * for a moment (`INLINE_ARM_MS`) and names the boost card it is about.
 *
 * Ms. Marvel (Protection) against Klaw, seed 11: Preemptive Strike is in the opening hand, and the encounter deck starts
 * with Armored Guard (1 boost icon), then Sound Manipulation (2): the two boost cards of Klaw's first attack.
 */

const SHOTS = process.env.E2E_SHOTS ?? "";

interface Pending {
  readonly kind: string;
  readonly boostIcons: number | null;
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
          boostIcons: (c.prompt.event?.boostIcons as number | undefined) ?? null,
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

/** The active villain's damage: the villain is the only villain card in play. */
const villainDamage = (page: Page): Promise<number> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game: any } } };
    };
    const g = appSession().store.state.game;
    const id = g.activeVillainId ?? Object.keys(g.villains ?? {})[0];
    return (g.instances[id]?.damage as number | undefined) ?? -1;
  });

const center = (rect: Rect): [number, number] => [rect.x + rect.width / 2, rect.y + rect.height / 2];

const shot = async (page: Page, name: string): Promise<void> => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

/** Plays round 1 to the window on Klaw's first boost card: hand kept, Ms. Marvel in hero form, no defender. */
async function toFirstBoostWindow(page: Page): Promise<string> {
  // The game's default: the docked phase waits on START and answers the player's interrupt on its own panel.
  await page.addInitScript(() =>
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false, holdEncounterCards: false }),
    ),
  );
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "klaw", decks: ["msm-protection"], seed: 11 });
  while ((await pending(page))?.kind === "mulligan") await answer(page, []);
  const hand = await handOf(page);
  const strike = hand.find(([, code]) => code === "05014")?.[0];
  expect(strike, "Preemptive Strike is in the opening hand").toBeDefined();
  await dispatch(page, { type: "changeForm", playerId: "p1" });
  await dispatch(page, { type: "endTurn", playerId: "p1" });
  // Hand size 5 in hero form: discard something other than Preemptive Strike.
  if ((await pending(page))?.kind === "discardDownToHandSize") {
    await answer(page, [hand.find(([id]) => id !== strike)![0]]);
  }
  await settle(page);
  const start = await waitFor(() => villainDebugRect(page, "startRect"), "START VILLAIN PHASE", 30_000);
  await page.mouse.click(...center(start));
  await waitFor(async () => ((await pending(page))?.kind === "declareDefender" ? true : null), "Klaw's attack", 15_000);
  await answer(page, ["decline"]);
  await waitFor(
    async () => ((await pending(page))?.boostIcons === 1 ? true : null),
    "the first boost card's window",
    15_000,
  );
  return strike!;
}

test("pressing Let it resolve twice on Klaw's first boost card leaves the second card's window open", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const strike = await toFirstBoostWindow(page);
  const option = `${strike}:05014.preemptive-strike-interrupt`;
  expect((await pending(page))!.options).toEqual([option]);
  const resolve = await waitFor(() => villainDebugRect(page, "resolveRect"), "Let it resolve", 15_000);
  await settle(page);
  const firstTexts = (await visibleTexts(page)).map((t) => t.text.toUpperCase());
  expect(firstTexts.some((t) => t.includes("ARMORED GUARD TURNED UP (1 ICON)"))).toBe(true);
  await shot(page, "preemptive-strike-first-boost");

  // "Let it resolve", then the same spot again a moment later, where the second card's window has just opened.
  await page.mouse.click(...center(resolve));
  await page.waitForTimeout(300);
  await page.mouse.click(...center(resolve));
  await settle(page, { quietMs: 600, maxMs: 4000 });

  const second = await pending(page);
  expect(second?.kind, "the second boost card's window is still open").toBe("chooseTriggers");
  expect(second?.boostIcons, "and it is the 2-icon card's").toBe(2);
  expect(second?.options).toEqual([option]);
  const texts = (await visibleTexts(page)).map((t) => t.text.toUpperCase());
  expect(
    texts.some((t) => t.includes("SOUND MANIPULATION TURNED UP (2 ICONS)")),
    "the window names the boost card it is about",
  ).toBe(true);
  await shot(page, "preemptive-strike-second-boost");

  // Played on the second card: its 2 icons are cancelled, then 1 damage to Klaw for each.
  const before = await villainDamage(page);
  const use = await waitFor(() => villainDebugRect(page, "useRect"), "Play Preemptive Strike", 10_000);
  await page.mouse.click(...center(use));
  const pay = await waitFor(
    async () => {
      const p = await pending(page);
      return p?.kind === "payForCard" ? p : null;
    },
    "the payment",
    10_000,
  );
  await answer(page, [pay.options[0]!]);
  await settle(page, { quietMs: 600, maxMs: 4000 });
  expect(
    (await handOf(page)).some(([id]) => id === strike),
    "Preemptive Strike was played",
  ).toBe(false);
  expect(await villainDamage(page), "Klaw took 2 damage").toBe(before + 2);
});
