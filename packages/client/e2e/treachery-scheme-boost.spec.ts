import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressAt, settle, waitFor } from "./helpers.js";
import { villainDebugRect } from "./overlay-helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { openApp, type Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #370 (@zackburnley, seed 98683): Dark Designs makes Rhino scheme during the reveal step, and the docked phase
 * kept showing the treachery through that scheme, so its boost card and its threat breakdown never showed. Replays the
 * report's own commands; under reduced motion (the suite's default, and what power saving turns on) the phase holds on
 * Dark Designs' last beat, which is now the scheme's breakdown with its boost card under it, as step 2 shows one.
 */

const CONFIG = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 98683,
  difficultySets: { standard: "standard_iii" },
  tableRules: { sameNameHeroAllyConflict: true },
  outsideFacts: [{ wonPreviousGame: false }],
};

const choice = (choiceId: string, selectedOptionIds: string[]) => ({
  type: "resolveChoice",
  playerId: "p1",
  choiceId,
  selectedOptionIds,
});

const COMMANDS = [
  choice("c1", []),
  {
    type: "playCard",
    playerId: "p1",
    cardInstanceId: "i43",
    payment: [{ ability: { instanceId: "i3", abilityId: "01001b.scientist" } }, { fromHand: "i36" }],
    attachToInstanceId: null,
  },
  { type: "changeForm", playerId: "p1" },
  {
    type: "playCard",
    playerId: "p1",
    cardInstanceId: "i11",
    payment: [{ fromHand: "i40" }, { fromHand: "i39" }],
    attachToInstanceId: null,
  },
  choice("c2", ["i1"]),
  { type: "basicAttack", playerId: "p1", attackerInstanceId: "i3", targetInstanceId: "i1" },
  { type: "endTurn", playerId: "p1" },
  choice("c3", []),
  choice("c4", ["i3:01001a.spider-sense"]),
  choice("c5", ["decline"]),
  choice("c6", ["i35:01085.emergency-interrupt"]),
  choice("c7", [
    "i73:45075a.pursued-by-the-past-forced-response@1",
    "i73:45075a.pursued-by-the-past-forced-response@0",
  ]),
];

interface BoostedBeat {
  readonly text: string;
  readonly boosts: Rect[];
}

const boostedBeat = (page: Page): Promise<BoostedBeat | null> =>
  page.evaluate(
    () =>
      (
        window as unknown as { __mcVillainPhaseDebug?: { boostedBeat?: () => BoostedBeat | null } }
      ).__mcVillainPhaseDebug?.boostedBeat?.() ?? null,
  );

async function dispatch(page: Page, command: unknown): Promise<boolean> {
  return page.evaluate(async (c) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { dispatch: (c: unknown) => Promise<boolean> } };
    };
    return appSession().store.dispatch(c);
  }, command);
}

test("issue #370: a treachery's scheme shows its boost card and breakdown, not the treachery", async ({
  page,
}, info) => {
  test.setTimeout(150_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await page.addInitScript(() =>
    localStorage.setItem("mc-settings", JSON.stringify({ version: 1, villainAutoAdvance: "off" })),
  );
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async (config) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { start: (cfg: unknown) => Promise<void> } };
    };
    await appSession().store.start(config);
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
  }, CONFIG);
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "Board is up", 20000);
  await settle(page);

  for (const [index, command] of COMMANDS.entries()) {
    expect(await dispatch(page, command), `command ${index} replays`).toBe(true);
    await settle(page);
    // The phase waits on START VILLAIN PHASE before it shows anything.
    const start = await villainDebugRect(page, "startRect");
    if (start) {
      if (phone) await page.touchscreen.tap(start.x + start.width / 2, start.y + start.height / 2);
      else await pressAt(page, start.x + start.width / 2, start.y + start.height / 2);
      await settle(page);
    }
  }

  // Flip Encounter Card, then held on Dark Designs (Next card): the body is Rhino's scheme with its one boost card.
  await waitFor(
    async () => {
      const next = await villainDebugRect(page, "nextRect");
      if (next) return next;
      const flip = await villainDebugRect(page, "flipRect");
      if (flip) {
        if (phone) await page.touchscreen.tap(flip.x + flip.width / 2, flip.y + flip.height / 2);
        else await pressAt(page, flip.x + flip.width / 2, flip.y + flip.height / 2);
        await settle(page);
      }
      return null;
    },
    "held on Dark Designs",
    30_000,
  );
  const beat = await waitFor(
    async () => {
      const shown = await boostedBeat(page);
      return shown && /threat/i.test(shown.text) ? shown : null;
    },
    "the scheme's breakdown with its boost card",
    15_000,
  );
  expect(beat.boosts, "the scheme's one boost card").toHaveLength(1);
  if (SHOT) await page.screenshot({ path: `${SHOT}/treachery-scheme-boost-${info.project.name}.png` });
  expect(errors).toEqual([]);
});
