import { expect, test } from "@playwright/test";
import { activeScenes, clickText, focusRect, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { facts, pressCard, press, waitForBoardText } from "./x-men-helpers.js";

/**
 * Upgraded Drones (`core` 01142) attaches to the Ultron Drones environment, and the environment's tile drew no
 * attachments, so its "Hero Action: Spend [energy] [mental] [physical] resources → discard this card" could not be
 * reached from the table (issue #462). Its strip on the tile opens the card, the card offers the action, and paying
 * for it discards Upgraded Drones.
 */

test.use({ viewport: { width: 1536, height: 890 } });

const DRONES = "01142";

test("Upgraded Drones' discard action is reachable from the Ultron Drones tile and discards it", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=board&fixture=upgraded-drones");
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "the board is up", 120_000);
  await settle(page, { quietMs: 600, maxMs: 5000 });

  const drones = await facts(
    page,
    (game) =>
      Object.values(game.instances as Record<string, { instanceId: string; cardId: string; attachedTo: unknown }>).find(
        (card) => card.cardId === "01142" && card.attachedTo !== null,
      )?.instanceId ?? null,
  );
  expect(drones, "the fixture attached Upgraded Drones").not.toBeNull();
  expect(await focusRect(page, `card:${drones}`), "a strip for it on the environment tile").not.toBeNull();

  await pressCard(page, false, drones!);
  await waitFor(async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null), "Inspect", 10_000);
  await settle(page, { quietMs: 300, maxMs: 1500 });
  await clickText(page, "Spend 1 energy", { sceneKey: "InspectOverlay" });
  await waitForBoardText(page, /^PAYING/i, "the payment step opens");
  await settle(page, { quietMs: 300, maxMs: 1500 });

  // Pay with what the engine's own example pays with: one card for each resource the action asks for.
  const fromHand = await page.evaluate(async (code) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { legal?: { actions: any }; game?: any } } };
    };
    const { legal, game } = appSession().store.state;
    const entry = legal?.actions.legal?.find(
      (e: any) => e.action.kind === "useAbility" && game.instances[e.action.instanceId]?.cardId === code,
    );
    return (entry?.example.payment ?? []).map((p: { fromHand?: string }) => p.fromHand ?? null) as (string | null)[];
  }, DRONES);
  expect(fromHand.length, "the example pays for the action").toBeGreaterThan(0);
  expect(fromHand, "every payment is a hand card").not.toContain(null);
  for (const id of fromHand) await pressCard(page, false, id!);
  const pay = await waitForBoardText(page, /^pay$/i, "Pay");
  await press(page, false, pay.x, pay.y);
  await settle(page, { quietMs: 500, maxMs: 4000 });
  // The example overpays (Genius and Strength each give two resources), so the guide asks first.
  if ((await activeScenes(page)).includes("HoldOnOverlay")) {
    await clickText(page, "Confirm payment", { sceneKey: "HoldOnOverlay" });
    await settle(page, { quietMs: 500, maxMs: 4000 });
  }

  const discard = await facts(page, (game) =>
    Object.values(game.encounterDecks as Record<string, { discard: string[] }>).flatMap((deck) => deck.discard),
  );
  expect(discard, "Upgraded Drones is in the encounter discard").toContain(drones);
  expect(errors).toEqual([]);
});
