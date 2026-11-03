import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, boardUp, facts } from "./x-men-helpers.js";

/**
 * Issue #635: on a 360x788 phone, an environment in the strip under the villain left the minion row about 50px tall,
 * with no HP to be seen on the board or in Inspect. The game is the reporter's own (Klaw, Echo, seed 3213), replayed
 * from the issue to round 3 with Pursued by the Past in play and Tiger Shark and Whirlwind engaged. Held sideways, the
 * same phone drew no minions at all: the row under the band was too short, and the room beside the environment unused.
 */

const REPLAY = {
  config: {
    scenarioId: "klaw",
    difficulty: "standard",
    players: [
      {
        starterDeckId: "fne-echo-protection",
      },
    ],
    seed: 3213,
    difficultySets: {
      standard: "standard_iii",
    },
    tableRules: {
      sameNameHeroAllyConflict: true,
    },
    outsideFacts: [
      {
        wonPreviousGame: false,
      },
    ],
  },
  commands: [
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c1",
        selectedOptionIds: ["i4"],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c2",
        selectedOptionIds: [],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "playCard",
        playerId: "p1",
        cardInstanceId: "i18",
        payment: [
          {
            fromHand: "i25",
          },
          {
            fromHand: "i39",
          },
          {
            fromHand: "i30",
          },
        ],
        attachToInstanceId: null,
      },
    },
    {
      playerId: "p1",
      command: {
        type: "playCard",
        playerId: "p1",
        cardInstanceId: "i4",
        payment: [
          {
            fromHand: "i29",
          },
        ],
        attachToInstanceId: null,
      },
    },
    {
      playerId: "p1",
      command: {
        type: "changeForm",
        playerId: "p1",
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c3",
        selectedOptionIds: ["i3:60037b.practice-makes-perfect"],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c4",
        selectedOptionIds: ["i26"],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "basicThwart",
        playerId: "p1",
        thwarterInstanceId: "i3",
        schemeInstanceId: "i63",
      },
    },
    {
      playerId: "p1",
      command: {
        type: "endTurn",
        playerId: "p1",
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c5",
        selectedOptionIds: [],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c6",
        selectedOptionIds: ["i3"],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "playCard",
        playerId: "p1",
        cardInstanceId: "i26",
        payment: [
          {
            fromHand: "i20",
          },
          {
            fromHand: "i27",
          },
          {
            fromHand: "i6",
          },
        ],
        attachToInstanceId: null,
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c7",
        selectedOptionIds: ["i1"],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c8",
        selectedOptionIds: ["i63"],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c9",
        selectedOptionIds: ["i3:60037a.watch-and-learn", "i18:60046.improvisation-response"],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c10",
        selectedOptionIds: ["i69"],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "endTurn",
        playerId: "p1",
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c11",
        selectedOptionIds: [],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c12",
        selectedOptionIds: ["i3"],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "playCard",
        playerId: "p1",
        cardInstanceId: "i26",
        payment: [
          {
            fromHand: "i22",
          },
        ],
        attachToInstanceId: null,
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c13",
        selectedOptionIds: ["i68"],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c14",
        selectedOptionIds: ["i2"],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c15",
        selectedOptionIds: ["i18:60046.improvisation-response"],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c16",
        selectedOptionIds: ["i68"],
      },
    },
  ],
} as const;

type Box = { x: number; y: number; width: number; height: number };

const hitRect = (page: Page, id: string): Promise<Box | null> =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcBoardDebug: { hitRect: (k: string) => Box | null } }).__mcBoardDebug.hitRect(key),
    id,
  );

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The reporter's game on the Enemies tab, and where its environment and two minions are drawn. */
async function enemiesTab(page: Page): Promise<{ environment: Box; minions: Box[] }> {
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async (replay) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { start: (c: unknown) => Promise<void>; dispatch: (c: unknown) => Promise<unknown> } };
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
  }, REPLAY);
  await boardUp(page);
  await clickText(page, "ENEMIES", { sceneKey: "Board" });
  await settle(page, { quietMs: 400, maxMs: 3000 });
  const ids = await facts(page, (game) => {
    const named = (name: string) =>
      Object.keys(game.instances).filter((id) => game.cardPool[game.instances[id].cardId]?.name === name);
    return { environment: named("Pursued by the Past"), minions: [...named("Tiger Shark"), ...named("Whirlwind")] };
  });
  const environment = (await Promise.all(ids.environment.map((id) => hitRect(page, id)))).find(Boolean);
  const minions = (await Promise.all(ids.minions.map((id) => hitRect(page, id)))).filter((r): r is Box => r !== null);
  expect(environment, "the environment is drawn").toBeTruthy();
  expect(minions, "both minions are drawn").toHaveLength(2);
  for (const minion of minions) {
    // Never under the environment tile, and tall enough to hold the HP plate (it was 50px, or not drawn at all).
    expect(overlaps(minion, environment!)).toBe(false);
    expect(minion.height).toBeGreaterThanOrEqual(88);
  }
  return { environment: environment!, minions };
}

test.describe("portrait phone, 360x788", () => {
  test.use({ viewport: { width: 360, height: 788 }, hasTouch: true, isMobile: true });

  test("minions under an environment keep a readable tile, and Inspect shows their HP", async ({ page }) => {
    test.setTimeout(180_000);
    const { environment, minions } = await enemiesTab(page);
    for (const minion of minions) expect(minion.y).toBeGreaterThanOrEqual(environment.y + environment.height);
    if (SHOT) await page.screenshot({ path: `${SHOT}/issue-635-enemies.png` });

    // Inspect on a minion names its HP in words under the type line, not only on the scan's printed number.
    const whirlwind = minions[minions.length - 1]!;
    // A long press opens Inspect on a phone (a tap would pick it as a target).
    await page.mouse.move(whirlwind.x + whirlwind.width / 2, whirlwind.y + whirlwind.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
    await waitFor(async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null), "Inspect", 10000);
    await settle(page, { quietMs: 500, maxMs: 3000 });
    const hp = await facts(page, (game) => {
      const id = Object.keys(game.instances).find(
        (key) => game.cardPool[game.instances[key].cardId]?.name === "Whirlwind",
      )!;
      return game.instances[id].damage as number;
    });
    const texts = (await visibleTexts(page)).filter((t) => t.scene === "InspectOverlay").map((t) => t.text);
    expect(texts.some((t) => t.includes(`HP ${6 - hp}/6`))).toBe(true);
    if (SHOT) await page.screenshot({ path: `${SHOT}/issue-635-inspect.png` });
  });
});

test.describe("landscape phone, 844x390", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test("minions sit beside the environment instead of not being drawn", async ({ page }) => {
    test.setTimeout(180_000);
    const { environment, minions } = await enemiesTab(page);
    for (const minion of minions) expect(minion.x).toBeGreaterThanOrEqual(environment.x + environment.width);
    if (SHOT) await page.screenshot({ path: `${SHOT}/issue-635-enemies-landscape.png` });
  });
});
