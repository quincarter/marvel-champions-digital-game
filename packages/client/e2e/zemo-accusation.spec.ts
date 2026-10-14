import { expect, test, type Page } from "@playwright/test";
import {
  activeScenes,
  clickText,
  findText,
  installPageHelpers,
  isSceneUp,
  settle,
  trackPageErrors,
  waitFor,
} from "./helpers.js";
import { skipVillainPhase } from "./wave6-helpers-a.js";

/**
 * Baron Zemo's evidence and accusation (MC50 pp. 18 and 19), through the real prompts and real presses: the Evidence
 * view before and after gaining two cards, the accuse sheet (pick a combination, read a card from it, confirm), and the
 * board afterwards (the mole unmasked, the answer in the Evidence view). The `?fixture=zemo` jump (`store/dev-zemo-game.ts`)
 * is a real Zemo game at the first player turn with the Tactical Board Member bare, so the end-of-phase Response can be
 * taken in round 1.
 */

type Store = { state: any; resolveChoice(ids: string[]): Promise<boolean> };

/** The open decision's kind and option labels, read from the store (what the engine is asking, not what is drawn). */
async function pendingKind(page: Page): Promise<{ kind: string; labels: string[] } | null> {
  return page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: Store } };
    const choice = appSession().store.state.game?.pendingChoice;
    return choice ? { kind: choice.prompt.kind, labels: choice.options.map((o: any) => o.label) } : null;
  });
}

/** Answers the open decision with the first option whose label contains `text` (or the first option). */
async function answer(page: Page, text?: string): Promise<void> {
  await page.evaluate(async (text) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: Store } };
    const store = appSession().store;
    const choice = store.state.game.pendingChoice;
    const option = text ? choice.options.find((o: any) => o.label.includes(text)) : choice.options[0];
    await store.resolveChoice([option.optionId]);
  }, text);
}

async function endTurn(page: Page): Promise<void> {
  await clickText(page, "END TURN", { sceneKey: "Board" });
  await waitFor(async () => {
    const scenes = await activeScenes(page);
    return ["HoldOnOverlay", "ChoiceOverlay", "VillainPhaseOverlay"].some((s) => scenes.includes(s)) || null;
  }, "End turn reacted");
  if (await isSceneUp(page, "HoldOnOverlay")) await clickText(page, "END TURN ANYWAY", { sceneKey: "HoldOnOverlay" });
  await waitFor(async () => (await pendingKind(page)) !== null || null, "a decision after End turn");
  if ((await pendingKind(page))?.kind === "discardDownToHandSize")
    await clickText(page, "DECLINE", { sceneKey: "ChoiceOverlay" });
}

/** The villain-phase walkthrough's own "use it" press for the Response, then the engine's prompts for what it does. */
async function useManipulations(page: Page): Promise<void> {
  await waitFor(
    async () => (await findText(page, "USE ZEMO", "VillainPhaseOverlay")).length > 0 || null,
    "the Response window",
  );
  await clickText(page, "USE ZEMO", { sceneKey: "VillainPhaseOverlay" });
  await waitFor(
    async () => (await pendingKind(page))?.kind === "chooseOption" || null,
    "the Response's first question",
  );
}

test.describe("Baron Zemo: evidence and the accusation", () => {
  test("gain evidence, read the Evidence view, accuse the mole through the sheet, see it on the board", async ({
    page,
  }, info) => {
    test.setTimeout(240_000);
    const errors = trackPageErrors(page);
    await installPageHelpers(page);
    await page.goto("/?screen=board&fixture=zemo");
    await page.waitForFunction(() => !!(window as unknown as { __mcZemo?: unknown }).__mcZemo, undefined, {
      timeout: 60000,
    });
    await settle(page, { quietMs: 600, maxMs: 4000 });
    const evidenceButton = info.project.name === "phone" ? "EVID." : "EVIDENCE";

    // The Evidence view before anything is gained: both envelopes by size, every combination open.
    await clickText(page, evidenceButton, { sceneKey: "Board", until: () => isSceneUp(page, "EvidenceOverlay") });
    await settle(page, { quietMs: 400, maxMs: 2500 });
    expect(await findText(page, "3 HIDDEN", "EvidenceOverlay")).not.toHaveLength(0);
    expect(await findText(page, "6 HIDDEN", "EvidenceOverlay")).not.toHaveLength(0);
    expect(await findText(page, "27 of 27", "EvidenceOverlay")).not.toHaveLength(0);
    await clickText(page, "CLOSE", {
      sceneKey: "EvidenceOverlay",
      until: async () => !(await isSceneUp(page, "EvidenceOverlay")),
    });

    // Round 1: the Response gains two cards for two secret counters on the bare Tactical environment.
    await endTurn(page);
    await useManipulations(page);
    await answer(page, "Place 2 secret counters");
    await waitFor(
      async () => (await pendingKind(page))?.kind === "chooseTarget" || null,
      "the environment to place them on",
    );
    await answer(page);
    await waitFor(
      async () => (await pendingKind(page))?.labels.includes("Do not advance") || null,
      "the advance question",
    );
    await answer(page, "Do not advance");
    await waitFor(async () => (await pendingKind(page)) === null || null, "the round to go on");
    // The walkthrough covers the table until it is skipped.
    if (await isSceneUp(page, "VillainPhaseOverlay")) {
      // Skip mid-phase, or Start player phase on the recap: the phase's own way out either way.
      for (let i = 0; i < 5 && (await isSceneUp(page, "VillainPhaseOverlay")); i++) {
        await skipVillainPhase(page);
        await settle(page);
      }
    }

    // The Evidence view now: two cards faceup, four still in the S.H.I.E.L.D. envelope, rows crossed out.
    await clickText(page, evidenceButton, { sceneKey: "Board", until: () => isSceneUp(page, "EvidenceOverlay") });
    await settle(page, { quietMs: 400, maxMs: 2500 });
    expect(await findText(page, "4 HIDDEN", "EvidenceOverlay")).not.toHaveLength(0);
    expect(await findText(page, "3 HIDDEN", "EvidenceOverlay"), "the A.I.M. envelope stays closed").not.toHaveLength(0);
    expect(await findText(page, "FACEUP", "EvidenceOverlay")).not.toHaveLength(0);
    expect(await findText(page, "✕", "EvidenceOverlay")).not.toHaveLength(0);
    expect(await findText(page, "27 of 27", "EvidenceOverlay")).toHaveLength(0);
    await clickText(page, "CLOSE", {
      sceneKey: "EvidenceOverlay",
      until: async () => !(await isSceneUp(page, "EvidenceOverlay")),
    });

    // Round 2: advance to stage 2A. The accuse sheet is up with every open combination as a cell.
    await endTurn(page);
    await useManipulations(page); // no bare environment is left: its first question is the advance
    await waitFor(
      async () => (await pendingKind(page))?.labels.some((l) => l.startsWith("Advance to stage 2A")) || null,
      "the advance question",
    );
    await answer(page, "Advance to stage 2A");
    await waitFor(async () => (await pendingKind(page))?.kind === "accuse" || null, "the accusation prompt");
    await waitFor(
      async () => (await findText(page, "MAKE THE ACCUSATION", "ChoiceOverlay")).length > 0 || null,
      "the sheet",
    );
    await settle(page, { quietMs: 500, maxMs: 3000 });
    const rects = await page.evaluate(() =>
      (
        window as unknown as {
          __mcChoiceDebug: { allRects(): [string, { x: number; y: number; width: number; height: number }][] };
        }
      ).__mcChoiceDebug.allRects(),
    );
    const cells = rects.filter(([key]) => /^option:\d+\+/.test(key));
    const open = (await pendingKind(page))!.labels.length;
    expect(cells, "one cell per open combination").toHaveLength(open);
    expect(await findText(page, "ACCUSE", "ChoiceOverlay")).not.toHaveLength(0);

    // Pick the combination the first scan of the scenario fixture's mole row does not name: any open cell works; the
    // sheet shows the four cards of the pick and the confirm names the accused.
    const [, rect] = cells[0]!;
    await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await waitFor(
      async () => (await findText(page, "ACCUSE CHIEF", "ChoiceOverlay")).length > 0 || null,
      "the confirm names the accused",
    );
    // A card of the pick opens in Inspect.
    await clickText(page, "means:", { sceneKey: "ChoiceOverlay", until: () => isSceneUp(page, "InspectOverlay") });
    await page.keyboard.press("Escape");
    await waitFor(async () => !(await isSceneUp(page, "InspectOverlay")) || null, "Inspect closes");

    await clickText(page, "ACCUSE CHIEF", { sceneKey: "ChoiceOverlay" });
    await waitFor(
      async () =>
        page.evaluate(async () => {
          const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: Store } };
          const game = appSession().store.state.game;
          return game?.outcome != null || game?.accusation?.mole !== undefined || null;
        }),
      "the accusation to be made",
    );

    // The result on the table: the mole identified; the game goes on or ends by the rules (a wrong accusation can lose).
    const result = await page.evaluate(async () => {
      const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: Store } };
      const game = appSession().store.state.game;
      return { mole: game.accusation?.mole?.boardMember ?? null, outcome: game.outcome?.result ?? null };
    });
    expect(result.mole).not.toBeNull();
    if (result.outcome === null) {
      // Walk the villain phase out (the unmasked Zemo asks first), then read the answer in the Evidence view.
      for (let step = 0; step < 8 && (await pendingKind(page)); step++) await answer(page);
      if (await isSceneUp(page, "VillainPhaseOverlay")) {
        // Skip mid-phase, or Start player phase on the recap: the phase's own way out either way.
        for (let i = 0; i < 5 && (await isSceneUp(page, "VillainPhaseOverlay")); i++) {
          await skipVillainPhase(page);
          await settle(page);
        }
      }
      await clickText(page, evidenceButton, { sceneKey: "Board", until: () => isSceneUp(page, "EvidenceOverlay") });
      await settle(page, { quietMs: 400, maxMs: 2500 });
      expect(await findText(page, "The mole is unmasked", "EvidenceOverlay")).not.toHaveLength(0);
      expect(await findText(page, "MOLE", "EvidenceOverlay")).not.toHaveLength(0);
      expect(await findText(page, "ALL FACEUP", "EvidenceOverlay")).not.toHaveLength(0);
    }
    expect(errors, `no page errors (${JSON.stringify(errors)})`).toEqual([]);
  });
});
