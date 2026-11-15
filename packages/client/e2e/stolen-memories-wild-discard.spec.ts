import { expect, test } from "@playwright/test";
import { activeScenes, clickText, pressAt, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors, visibleTexts } from "./wave6-helpers-a.js";
import { hook, openApp } from "./wave6-helpers-b.js";
import { SHOT, boardText, boardUp, facts, press, pressCard, startDevGame, waitForBoardText } from "./x-men-helpers.js";

/**
 * Issue #717 (reported on Discord by Funguykawhi): Kang's Stolen Memories (11019, "Alter-Ego Action: Discard a [mental]
 * resource from your hand → discard this obligation"). The discard bar offered the whole hand, so Black Panther could
 * pick Wakanda Forever! (a printed wild) and Confirm then stayed disabled. A wild is not a [mental] resource when it is
 * discarded rather than spent (FFG ruling 186, September 2024), so the bar now offers only the printed [mental] cards:
 * pressing the wild picks nothing, and a [mental] card confirms. The dev game (`store/dev-stolen-memories-game.ts`)
 * stops on Black Panther's alter-ego turn with the obligation in play.
 */
test("issue #717: Stolen Memories' discard offers only [mental] cards, never a wild", async ({ page }, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await openApp(page);
  await startDevGame(page, "startStolenMemoriesDevGame");
  await boardUp(page);
  // Round one's villain phase is still on the table: start the player phase.
  const cont = (await visibleTexts(page)).find(
    (t) => t.scene === "VillainPhaseOverlay" && /^(continue|start player phase( ▸)?)$/i.test(t.text.trim()),
  );
  if (cont) await press(page, phone, cont.x, cont.y);
  await settle(page, { quietMs: 600, maxMs: 3000 });

  const ids = await facts(page, (g) => {
    const me = g.players[0];
    const find = (list: string[], code: string) => list.find((id: string) => g.instances[id].cardId === code);
    return {
      obligation: find(me.playArea, "11019") as string,
      wild: find(me.hand, "01043d") as string,
      mansion: find(me.hand, "01091") as string,
    };
  });
  expect(ids.obligation, "Stolen Memories in play").toBeTruthy();
  expect(ids.wild, "Wakanda Forever! in hand").toBeTruthy();
  expect(ids.mansion, "Avengers Mansion in hand").toBeTruthy();

  // Open the obligation and use its Alter-Ego Action.
  const rect = await hook<{ x: number; y: number; width: number; height: number }>(
    page,
    "__mcBoardDebug",
    "hitRect",
    ids.obligation,
  );
  expect(rect, "the obligation is drawn in the play area").not.toBeNull();
  await pressAt(page, rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
  await waitFor(
    async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null),
    "Inspect opens",
    6000,
  );
  await settle(page);
  if (SHOT) await page.screenshot({ path: `${SHOT}/stolen-memories-inspect-${info.project.name}.png` });
  await clickText(page, "DISCARD 1 CARD", { sceneKey: "InspectOverlay" });
  await waitForBoardText(page, /^DISCARDING 0 \(1\)/, "the discard bar over the hand");

  // The wild is not offered: pressing it picks nothing.
  await pressCard(page, phone, ids.wild);
  expect(await boardText(page, /^DISCARDING 0 \(1\)/), "the wild is not picked").toBeDefined();

  // A printed [mental] card is, and Confirm discards it and the obligation.
  await pressCard(page, phone, ids.mansion);
  await waitForBoardText(page, /^DISCARDING 1 \(1\)/, "the [mental] card counts");
  await settle(page, { quietMs: 400, maxMs: 3000 });
  if (SHOT) {
    // The PR's screen sizes, the bar open with the [mental] card picked; then back to the project's own size.
    const own = page.viewportSize()!;
    const sizes = {
      se: [375, 667],
      pixel: [412, 924],
      "820x1180": [820, 1180],
      "1180x820": [1180, 820],
      desktop: [1440, 980],
    };
    for (const [name, [width, height]] of Object.entries(sizes)) {
      await page.setViewportSize({ width: width!, height: height! });
      await settle(page, { quietMs: 600, maxMs: 4000 });
      await page.screenshot({ path: `${SHOT}/stolen-memories-pick-${info.project.name}-${name}.png` });
    }
    await page.setViewportSize(own);
    await settle(page, { quietMs: 600, maxMs: 4000 });
  }
  const confirm = await waitForBoardText(page, /^confirm$/i, "Confirm");
  await press(page, phone, confirm.x, confirm.y);
  const zones = () =>
    facts(page, (g) => ({ playArea: g.players[0].playArea as string[], discard: g.players[0].discard as string[] }));
  await waitFor(
    async () => {
      const { playArea, discard } = await zones();
      return !playArea.includes(ids.obligation) && discard.includes(ids.mansion) ? true : null;
    },
    "Stolen Memories is discarded, paid for with Avengers Mansion",
    15_000,
  );
  expect(await facts(page, (g) => g.players[0].hand), "the wild stays in hand").toContain(ids.wild);
  expect(errors).toEqual([]);
});
