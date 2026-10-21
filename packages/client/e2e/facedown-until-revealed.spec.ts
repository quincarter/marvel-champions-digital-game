import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressAt, settle, waitFor } from "./helpers.js";
import { villainDebugRect } from "./overlay-helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Issue #311: Eviction Notice was dealt facedown, but the table showed it face up in the play area while the villain
 * phase was still on the deal (the engine had already revealed it). The reported game (Rhino, Spider-Man Justice, seed
 * 53823) is replayed to its round-3 villain phase: the table keeps both dealt cards off the board until the phase
 * reveals them, then shows Eviction Notice in the play area.
 */

// Paced, so the phase waits on Start and on each card rather than catching up at once.
test.use({ reducedMotion: "no-preference" });

const COMMANDS = [
  { type: "resolveChoice", playerId: "p1", choiceId: "c1", selectedOptionIds: [] },
  {
    type: "playCard",
    playerId: "p1",
    cardInstanceId: "i19",
    payment: [
      { fromHand: "i25" },
      { ability: { instanceId: "i3", abilityId: "01001b.scientist" } },
      { fromHand: "i7" },
    ],
    attachToInstanceId: null,
  },
  { type: "changeForm", playerId: "p1" },
  { type: "basicAttack", playerId: "p1", attackerInstanceId: "i3", targetInstanceId: "i1" },
  { type: "basicAttack", playerId: "p1", attackerInstanceId: "i19", targetInstanceId: "i1" },
  { type: "endTurn", playerId: "p1" },
  { type: "resolveChoice", playerId: "p1", choiceId: "c2", selectedOptionIds: [] },
  { type: "resolveChoice", playerId: "p1", choiceId: "c3", selectedOptionIds: ["i3:01001a.spider-sense"] },
  { type: "resolveChoice", playerId: "p1", choiceId: "c4", selectedOptionIds: ["decline"] },
  { type: "playCard", playerId: "p1", cardInstanceId: "i4", payment: [{ fromHand: "i39" }], attachToInstanceId: null },
  {
    type: "playCard",
    playerId: "p1",
    cardInstanceId: "i31",
    payment: [{ fromHand: "i23" }, { fromHand: "i8" }],
    attachToInstanceId: null,
  },
  { type: "basicThwart", playerId: "p1", thwarterInstanceId: "i3", schemeInstanceId: "i2" },
  { type: "basicAttack", playerId: "p1", attackerInstanceId: "i19", targetInstanceId: "i1" },
  { type: "basicAttack", playerId: "p1", attackerInstanceId: "i4", targetInstanceId: "i1" },
  { type: "endTurn", playerId: "p1" },
  { type: "resolveChoice", playerId: "p1", choiceId: "c5", selectedOptionIds: [] },
  { type: "resolveChoice", playerId: "p1", choiceId: "c6", selectedOptionIds: ["i3:01001a.spider-sense"] },
  { type: "resolveChoice", playerId: "p1", choiceId: "c7", selectedOptionIds: ["i3"] },
  { type: "resolveChoice", playerId: "p1", choiceId: "c8", selectedOptionIds: ["i3:01001a.spider-sense"] },
  { type: "resolveChoice", playerId: "p1", choiceId: "c9", selectedOptionIds: ["i19"] },
  {
    type: "playCard",
    playerId: "p1",
    cardInstanceId: "i9",
    payment: [{ fromHand: "i35" }, { fromHand: "i12" }, { fromHand: "i33" }],
    attachToInstanceId: null,
  },
  { type: "resolveChoice", playerId: "p1", choiceId: "c10", selectedOptionIds: ["i1"] },
  { type: "basicThwart", playerId: "p1", thwarterInstanceId: "i4", schemeInstanceId: "i65" },
  { type: "changeForm", playerId: "p1" },
  { type: "endTurn", playerId: "p1" },
  { type: "resolveChoice", playerId: "p1", choiceId: "c11", selectedOptionIds: [] },
];

const drawn = (page: Page, id: string): Promise<boolean> =>
  page.evaluate((instanceId) => {
    const board = (
      window as unknown as {
        __mcGame: {
          scene: { getScene: (k: string) => { guideAnchorFrame: () => { hitRects: Map<string, unknown> } } };
        };
      }
    ).__mcGame.scene.getScene("Board");
    return board.guideAnchorFrame().hitRects.has(instanceId);
  }, id);

test("a card dealt facedown stays off the table until the villain phase reveals it", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one size covers the table's model");
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await page.addInitScript(() => {
    localStorage.setItem("mc-settings", JSON.stringify({ version: 1, villainAutoAdvance: "off" }));
  });
  await installWave6Helpers(page);
  await openApp(page);
  const dispatchAll = (commands: readonly unknown[]) =>
    page.evaluate(async (list) => {
      const { appSession } = (await import("/src/session.ts")) as unknown as {
        appSession: () => { store: { dispatch: (c: unknown) => Promise<void> } };
      };
      for (const command of list) await appSession().store.dispatch(command);
    }, commands);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { start: (cfg: unknown) => Promise<void> } };
    };
    await appSession().store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 53823,
    });
  });
  // Rounds 1 and 2, and round 3's turn, before the table is up; the end of the turn and its villain phase with it.
  await dispatchAll(COMMANDS.slice(0, -2));
  await page.evaluate(() => {
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
  });
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "Board is up", 20000);
  await settle(page);
  expect(await drawn(page, "i44"), "Eviction Notice is still in the encounter deck").toBe(false);
  await dispatchAll(COMMANDS.slice(-2));
  await waitFor(
    async () => ((await activeScenes(page)).includes("VillainPhaseOverlay") ? true : null),
    "the villain phase",
    20000,
  );
  await settle(page);
  expect(await drawn(page, "i44"), "Eviction Notice is held facedown before its reveal").toBe(false);
  expect(await drawn(page, "i51"), "Charge is held facedown before its reveal").toBe(false);
  await page.screenshot({ path: info.outputPath("dealt-held-facedown.png") });

  // Start, Flip Encounter Card and Next card, until the phase reaches Eviction Notice's decision.
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline && !(await villainDebugRect(page, "answerRect"))) {
    // Charge waits on Flip Encounter Card with its reveal beat up: still off the table until it is flipped.
    if (await villainDebugRect(page, "flipRect")) {
      expect(await drawn(page, "i44"), "Eviction Notice is still held while a card waits to flip").toBe(false);
    }
    for (const name of ["startRect", "flipRect", "nextRect"]) {
      const rect = await villainDebugRect(page, name);
      if (rect) {
        await settle(page);
        await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
        break;
      }
    }
    await page.waitForTimeout(150);
  }
  expect(await villainDebugRect(page, "answerRect"), "the phase reached Eviction Notice's decision").not.toBeNull();
  await settle(page);
  await waitFor(async () => ((await drawn(page, "i44")) ? true : null), "Eviction Notice on the table", 10000);
  await page.screenshot({ path: info.outputPath("dealt-revealed.png") });
  expect(errors).toEqual([]);
});
