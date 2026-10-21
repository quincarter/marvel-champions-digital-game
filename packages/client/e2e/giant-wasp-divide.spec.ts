import { expect, test, type Page } from "@playwright/test";
import { focusRect, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, boardUp, facts, press, pressCard, startDevGame, waitForBoardText } from "./x-men-helpers.js";

/** The damage on a card in play, or null once it has left play. */
const damageOf = (page: Page, id: string): Promise<number | null> =>
  page.evaluate(async (instanceId) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game?: { instances: Record<string, { damage: number }> } } } };
    };
    return appSession().store.state.game?.instances[instanceId]?.damage ?? null;
  }, id);

/**
 * Issue #322: Wasp's Giant face lets her divide her basic attack among enemies (13001c), but Attack only ever asked for
 * one target. Now it opens the divide picker: each press on an enemy places one point of her ATK on it, and Confirm
 * makes the divided attack. The dev game (`store/dev-giant-wasp-game.ts`) has Giant Wasp facing two Hydra Mercenaries.
 */
test("issue #322: Giant Wasp divides her attack between two Hydra Mercenaries", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await openApp(page);
  await startDevGame(page, "startGiantWaspDevGame");
  await boardUp(page);
  const mercs = await facts(page, (g) =>
    (g.players[0].playArea as string[]).filter((id: string) => g.instances[id].cardId === "01101"),
  );
  expect(mercs.length, "two Mercenaries engaged").toBe(2);
  const [first, second] = mercs as [string, string];

  const attack = await waitFor(() => focusRect(page, "basic:attack"), "the Attack control", 15_000);
  await press(page, false, attack.x + attack.width / 2, attack.y + attack.height / 2);
  const title = await waitForBoardText(page, /^Divide \d+ damage$/, "the divide picker");
  const atk = Number(/\d+/.exec(title.text)![0]);
  expect(atk).toBeGreaterThanOrEqual(2);
  await waitForBoardText(page, new RegExp(`^${atk} DAMAGE · ${atk} LEFT$`), "nothing placed yet");

  // One point on the second Mercenary, then the rest on the first.
  await pressCard(page, false, second);
  for (let point = 1; point < atk; point++) await pressCard(page, false, first);
  await waitForBoardText(page, new RegExp(`^${atk} DAMAGE · 0 LEFT$`), "every point placed");
  await settle(page, { quietMs: 400, maxMs: 3000 });
  if (SHOT) await page.screenshot({ path: `${SHOT}/giant-wasp-divide-picker.png` });

  const confirm = await waitFor(() => focusRect(page, "confirm"), "Confirm", 10_000);
  await press(page, false, confirm.x + confirm.width / 2, confirm.y + confirm.height / 2);
  // Pass any interrupt window the attack opens (Rapid Growth in hand), as the player declining it would.
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: {
          state: {
            legal?: { actions: { kind: string; choice?: { minSelections: number; options: { optionId: string }[] } } };
          };
          resolveChoice(ids: string[]): Promise<void>;
        };
      };
    };
    const { store } = appSession();
    for (let guard = 0; guard < 10; guard++) {
      const actions = store.state.legal?.actions;
      if (actions?.kind !== "choice" || !actions.choice) return;
      await store.resolveChoice(
        actions.choice.options.slice(0, actions.choice.minSelections).map((option) => option.optionId),
      );
    }
  });
  await waitFor(
    async () => ((await damageOf(page, second)) === 1 ? true : null),
    "the second Mercenary took its point",
    15_000,
  );
  const firstDamage = await damageOf(page, first);
  // 3 HP: a share of 3 or more defeats it, and it leaves play.
  if (atk - 1 < 3) expect(firstDamage).toBe(atk - 1);
  await settle(page, { quietMs: 600, maxMs: 4000 });
  if (SHOT) await page.screenshot({ path: `${SHOT}/giant-wasp-divide-after.png` });
  expect(errors).toEqual([]);
});
