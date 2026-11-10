import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { settle, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, boardUp } from "./x-men-helpers.js";

/**
 * Issue #665: after Psychic Misdirection sent Rhino's attack to a Hydra Mercenary, the defend sheet still read as if
 * Cable would take the hit, so defending with Cable (whose DEF then cancelled the redirected damage) looked like it
 * protected him. The game is the reporter's own (Cable vs Rhino, seed 92019), replayed to the Declare Defender prompt
 * that follows Psychic Misdirection; the sheet now says where the damage goes.
 */

const REPLAY = JSON.parse(
  readFileSync(new URL("../src/view/fixtures/issue-665-replay.json", import.meta.url), "utf8"),
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

test("the defend sheet after Psychic Misdirection names the enemy taking the damage", async ({ page }) => {
  test.setTimeout(180_000);
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async (replay) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { start: (c: unknown) => Promise<void>; dispatch: (c: unknown) => Promise<unknown> } };
    };
    const store = appSession().store;
    await store.start(replay.config);
    // Every command but the last, which declared Cable the defender.
    for (const { command } of replay.commands.slice(0, -1)) await store.dispatch(command);
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
  }, REPLAY as never);
  await boardUp(page);

  const note = "goes to Hydra Mercenary instead of you";
  const shown = async (): Promise<string | null> => {
    const texts = (await visibleTexts(page)).map((t) => t.text.replace(/\s+/g, " ")).join(" | ");
    return texts.includes(note) ? texts : null;
  };
  const texts = await waitFor(shown, "the defend sheet's redirect note", 30000);
  expect(texts).toContain("DEF 6 comes off the damage Hydra Mercenary takes.");

  if (SHOT) {
    for (const [name, width, height] of SIZES) {
      await page.setViewportSize({ width, height });
      await settle(page, { quietMs: 800, maxMs: 4000 });
      await waitFor(shown, `the redirect note at ${name}`, 15000);
      await page.screenshot({ path: `${SHOT}/issue-665-defend-${name}.png` });
    }
  }
});
