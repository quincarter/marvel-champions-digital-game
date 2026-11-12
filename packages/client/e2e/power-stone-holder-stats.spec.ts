import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { settle, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts, type VisibleText } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, boardUp } from "./x-men-helpers.js";

/**
 * Issue #678: after No Quarter moved the Power Stone from Nebula to Gamora, Gamora's ATK did not go up, because the
 * stone's printed "+1 SCH/THW" and "+1 ATK" stat boxes were missing from its card data. The game is the reporter's own
 * (Gamora, Drax and Rocket against Nebula, seed 179208494), replayed to where they reported it; Gamora's panel now
 * carries the stone's +1 ATK and +1 THW, and Nebula's no longer does.
 */

const REPLAY = JSON.parse(
  readFileSync(new URL("../src/view/fixtures/issue-678-replay.json", import.meta.url), "utf8"),
) as {
  readonly config: unknown;
  readonly commands: readonly { readonly command: unknown }[];
};

const SIZES = [
  ["se", 375, 667],
  ["pixel-10", 412, 924],
  ["tablet-portrait", 820, 1180],
  ["tablet", 1180, 820],
  ["desktop", 1600, 900],
] as const;

interface StatTile {
  readonly label: string;
  readonly bonus: number;
}

/**
 * The stat labels the board draws a "+1" bonus chip over: each "+1" text in the Board scene, matched to the stat label
 * ("ATK", "THW", …) drawn just below it in the same column.
 */
function labelsWithPlusOne(texts: readonly VisibleText[]): readonly string[] {
  const board = texts.filter((t) => t.scene === "Board");
  const labels = board.filter((t) => ["ATK", "THW", "DEF", "SCH"].includes(t.text.trim()));
  const found: string[] = [];
  for (const chip of board.filter((t) => t.text.trim() === "+1")) {
    const below = labels
      .filter((l) => Math.abs(l.x + l.w / 2 - (chip.x + chip.w / 2)) < 30 && l.y > chip.y && l.y - chip.y < 80)
      .sort((a, b) => a.y - b.y)[0];
    if (below) found.push(below.text.trim());
  }
  return found.sort();
}

test("the Power Stone gives Gamora +1 ATK and +1 THW once it moves to her", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await installWave6Helpers(page);
  await openApp(page);
  const stats = await page.evaluate(async (replay) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: {
          start: (c: unknown) => Promise<void>;
          dispatch: (c: unknown) => Promise<unknown>;
          state: { game: unknown };
        };
      };
    };
    const store = appSession().store;
    await store.start(replay.config);
    for (const { command } of replay.commands) await store.dispatch(command);
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
    const { characterPanel } = (await import("/src/view/board-model.ts")) as unknown as {
      characterPanel: (state: unknown, id: string, deps: unknown) => { stats: readonly StatTile[] };
    };
    const { POOL_DEPS } = (await import("/src/content/pool.ts")) as unknown as { POOL_DEPS: unknown };
    const game = store.state.game as {
      players: readonly { identity: { instanceId: string } }[];
      villains: readonly { instanceId: string }[];
    };
    const tiles = (id: string) =>
      characterPanel(game, id, POOL_DEPS).stats.map((tile) => ({ label: tile.label, bonus: tile.bonus }));
    return { gamora: tiles(game.players[0]!.identity.instanceId), nebula: tiles(game.villains[0]!.instanceId) };
  }, REPLAY as never);
  await boardUp(page);

  const bonus = (tiles: readonly StatTile[], label: string) => tiles.find((tile) => tile.label === label)?.bonus;
  expect(bonus(stats.gamora, "ATK")).toBe(1);
  expect(bonus(stats.gamora, "THW")).toBe(1);
  expect(bonus(stats.nebula, "ATK")).toBe(0);
  expect(bonus(stats.nebula, "SCH")).toBe(0);

  // What the board actually draws: a "+1" chip over Gamora's THW and ATK, and none over Nebula's ATK or SCH (on a phone
  // the board opens on Gamora's own tab, so only her tiles are showing there).
  const drawn = await waitFor(
    async () => {
      const found = labelsWithPlusOne(await visibleTexts(page));
      return found.length >= 2 ? found : null;
    },
    "the +1 chips over Gamora's stats",
    30000,
  );
  expect(drawn).toEqual(["ATK", "THW"]);

  if (SHOT && testInfo.project.name === "desktop") {
    for (const [name, width, height] of SIZES) {
      await page.setViewportSize({ width, height });
      await settle(page, { quietMs: 800, maxMs: 4000 });
      await page.screenshot({ path: `${SHOT}/issue-678-board-${name}.png` });
    }
  }
});
