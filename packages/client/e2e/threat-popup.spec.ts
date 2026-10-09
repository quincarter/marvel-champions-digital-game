import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressAt, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { boardUp } from "./x-men-helpers.js";

/**
 * The "choose a target" sheet's tiles carry the board's own bars (`view/choice-tile-bars.ts`): Spider-Man's
 * Surveillance Team asks which scheme to remove 1 threat from, and each scheme's tile shows the threat it holds, with
 * the engine's preview of the pick as a hatched part ("1 → 0"). Daredevil's "deal 1 damage to an enemy" does the same
 * with the enemies' hit points. The fixtures are `store/dev-threat-popup-game.ts`.
 */

const SHOTS = process.env.E2E_SHOTS ?? "";
const shot = async (page: Page, name: string): Promise<void> => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

const sheetTexts = async (page: Page): Promise<string[]> =>
  (await visibleTexts(page)).filter((t) => t.scene === "ChoiceOverlay").map((t) => t.text.trim());

async function startGame(page: Page, start: "startThreatPopupGame" | "startEnemyPopupGame"): Promise<void> {
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async (name) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: unknown } };
    const { SessionStore } = (await import(/* @vite-ignore */ "/src/store/session-store.ts")) as any;
    const { LocalEngineHost } = (await import(/* @vite-ignore */ "/src/engine/local-host.ts")) as any;
    const game = (await import(/* @vite-ignore */ "/src/store/dev-threat-popup-game.ts")) as any;
    const store = new SessionStore(new LocalEngineHost());
    (appSession() as { store: unknown }).store = store;
    await game[name](store);
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
  }, start);
  await boardUp(page);
}

/** Dispatches the first legal action `pick` names (read in the page from the store's own legal list). */
/** Taps one tile of the open sheet at the rect the sheet itself drew for it (`__mcChoiceDebug`). */
async function tapOption(page: Page, optionId: string): Promise<void> {
  const rect = await waitFor(
    async () =>
      (
        await page.evaluate(
          () =>
            (
              window as unknown as {
                __mcChoiceDebug?: { allRects(): [string, { x: number; y: number; width: number; height: number }][] };
              }
            ).__mcChoiceDebug?.allRects() ?? [],
        )
      ).find(([key]) => key === `option:${optionId}`)?.[1] ?? null,
    `the tile for ${optionId}`,
    10000,
  );
  await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
}

async function dispatchLegal(page: Page, pick: string): Promise<void> {
  await page.evaluate(async (source) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: any };
    };
    const store = appSession().store;
    const turn = store.state.legal.actions;
    const found = new Function("game", "legal", `return (${source})(game, legal)`)(store.state.game, turn.legal);
    await store.dispatch(found.example);
  }, pick);
}

test("Surveillance Team's popup shows each scheme's threat and previews what the pick removes", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  await startGame(page, "startThreatPopupGame");
  await dispatchLegal(
    page,
    `(game, legal) => legal.find((e) => e.action.kind === "useAbility" && game.instances[e.action.instanceId].cardId === "01064")`,
  );
  await waitFor(async () => ((await activeScenes(page)).includes("ChoiceOverlay") ? true : null), "the sheet", 15000);
  await settle(page, { quietMs: 600, maxMs: 3000 });

  const schemes = await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: any } };
    const game = appSession().store.state.game;
    const of = (code: string) => {
      const found = Object.entries<any>(game.instances).find(([, i]) => i.cardId === code)!;
      return { id: found[0] as string, threat: found[1].threat as number };
    };
    return { crowd: of("01108"), breakin: of("01107") };
  });
  expect(schemes.crowd.threat).not.toBe(schemes.breakin.threat);

  const plain = await sheetTexts(page);
  expect(plain, "each scheme tile reads its own threat").toEqual(
    expect.arrayContaining([`${schemes.crowd.threat} THREAT`, `${schemes.breakin.threat} THREAT`]),
  );
  await shot(page, `threat-popup-${info.project.name}-none`);

  await tapOption(page, schemes.breakin.id);
  await settle(page, { quietMs: 500, maxMs: 3000 });
  const after = await sheetTexts(page);
  expect(after, "the picked scheme shows what the effect leaves").toContain(
    `${schemes.breakin.threat} → ${schemes.breakin.threat - 1} THREAT`,
  );
  expect(after, "the other scheme stays plain").toContain(`${schemes.crowd.threat} THREAT`);
  await shot(page, `threat-popup-${info.project.name}-selected`);
});

test("Daredevil's popup shows each enemy's hit points and previews the damage on the pick", async ({ page }, info) => {
  test.setTimeout(240_000);
  await startGame(page, "startEnemyPopupGame");
  await dispatchLegal(
    page,
    `(game, legal) => legal.find((e) => e.action.kind === "basicThwart" && game.instances[e.action.instanceId].cardId === "01058")`,
  );
  // "After Daredevil thwarts" is a response: say to use it, and the sheet asks which enemy.
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: any } };
    const store = appSession().store;
    const first = store.state.game.pendingChoice.options[0].optionId;
    await store.resolveChoice([first]);
  });
  await waitFor(async () => ((await activeScenes(page)).includes("ChoiceOverlay") ? true : null), "the sheet", 15000);
  await settle(page, { quietMs: 600, maxMs: 3000 });
  const bomber = await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: any } };
    const game = appSession().store.state.game;
    return Object.keys(game.instances).find((id) => game.instances[id].cardId === "01110")!;
  });
  await shot(page, `threat-popup-${info.project.name}-enemy-none`);
  await tapOption(page, bomber);
  await settle(page, { quietMs: 500, maxMs: 3000 });
  expect(
    (await sheetTexts(page)).some((text) => /^\d+→\d+$/.test(text)),
    "the pick previews its hit points",
  ).toBe(true);
  await shot(page, `threat-popup-${info.project.name}-enemy-selected`);
});
