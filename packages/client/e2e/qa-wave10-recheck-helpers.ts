import type { Page } from "@playwright/test";
import { activeScenes, clickText, settle, waitFor } from "./helpers.js";
import { declineMulligans } from "./wave6-helpers-b.js";

/** Shared staging for the wave 10 re-check specs (docs/qa-wave10-client.md "Re-check (2026-10-13)"). */
export const SIZES = [
  { name: "390x844", width: 390, height: 844, phone: true },
  { name: "360x740", width: 360, height: 740, phone: true },
  { name: "1440x900", width: 1440, height: 900, phone: false },
] as const;

export const SHOTS = "../../artifacts/qa";

interface Store {
  start: (cfg: unknown) => Promise<void>;
  dispatch: (c: unknown) => Promise<void>;
  state: {
    game?: { players: { hand: string[] }[]; instances: Record<string, { cardId: string }> };
    legal?: { actions: { legal?: { action: { kind: string; instanceId?: string }; example: any }[] } };
  };
}

/** Restarts the Board on whatever the store now holds. */
async function toBoard(page: Page): Promise<void> {
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
}

/**
 * Wonder Man against Rhino with a staged opening hand. Round 1 is spent flipping to hero form, putting Mr. Hollywood
 * into play (paid with the filler card), and ending the turn so Bomb Scare holds threat in round 2.
 */
export async function wonderManRound2(page: Page, hand: string[], seed = 5801): Promise<void> {
  await page.evaluate(
    async ([hand, seed]) => {
      const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: Store } };
      await appSession().store.start({
        scenarioId: "rhino",
        difficulty: "standard",
        players: [{ starterDeckId: "wonder-man-justice" }],
        seed,
        stack: { players: { 0: hand }, encounter: ["01098", "01109"] },
      });
    },
    [hand, seed] as const,
  );
  await toBoard(page);
  await declineMulligans(page);
  await settle(page);
  await page.evaluate(
    async ([hollywood, filler]) => {
      const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: Store } };
      const { nextTurn } = (await import("/src/store/dev-game-steps.ts")) as unknown as {
        nextTurn: (store: unknown) => Promise<unknown>;
      };
      const { store } = appSession();
      const flip = store.state.legal?.actions.legal?.find((e) => e.action.kind === "changeForm");
      if (flip) await store.dispatch(flip.example);
      const game = store.state.game!;
      const of = (code: string) => game.players[0]!.hand.find((id) => game.instances[id]?.cardId === code)!;
      const play = store.state.legal?.actions.legal?.find(
        (e) => e.action.kind === "playCard" && e.action.instanceId === of(hollywood),
      );
      await store.dispatch({ ...play!.example, payment: [{ fromHand: of(filler) }] });
      const end = store.state.legal?.actions.legal?.find((e) => e.action.kind === "endTurn");
      await store.dispatch(end!.example);
      await nextTurn(store);
    },
    ["58009", "58016"] as const,
  );
  await settle(page);
  await waitFor(async () => ((await activeScenes(page)).includes("VillainPhaseOverlay") ? true : null), "recap", 15000);
  await settle(page);
  await clickText(page, "Continue", { sceneKey: "VillainPhaseOverlay" });
  await waitFor(async () => (!(await activeScenes(page)).includes("VillainPhaseOverlay") ? true : null), "closes");
  await settle(page);
}

/** Starts a game from a full config and lands on the Board. */
export async function startOnBoard(page: Page, cfg: unknown): Promise<void> {
  await page.evaluate(async (cfg) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: Store } };
    await appSession().store.start(cfg);
  }, cfg);
  await toBoard(page);
  await declineMulligans(page);
  await settle(page, { quietMs: 1000, maxMs: 6000 });
}

/** Every Board text with its bounds, for a layout read. */
export const dumpBoard = async (page: Page): Promise<string> => {
  const { visibleTexts } = await import("./wave6-helpers-a.js");
  return (await visibleTexts(page))
    .filter((t) => t.scene === "Board")
    .map(
      (t) => `${JSON.stringify(t.text)} @${Math.round(t.x)},${Math.round(t.y)} ${Math.round(t.w)}x${Math.round(t.h)}`,
    )
    .join("\n");
};

/** Ends the turn through the store, lets the villain phase play out, and closes its recap: the next player turn is up. */
export async function endRound(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: Store } };
    const { nextTurn } = (await import("/src/store/dev-game-steps.ts")) as unknown as {
      nextTurn: (store: unknown) => Promise<unknown>;
    };
    const { store } = appSession();
    const end = store.state.legal?.actions.legal?.find((e) => e.action.kind === "endTurn");
    await store.dispatch(end!.example);
    await nextTurn(store);
  });
  await settle(page);
  await waitFor(async () => ((await activeScenes(page)).includes("VillainPhaseOverlay") ? true : null), "recap", 15000);
  await settle(page);
  await clickText(page, "Continue", { sceneKey: "VillainPhaseOverlay" });
  await waitFor(async () => (!(await activeScenes(page)).includes("VillainPhaseOverlay") ? true : null), "closes");
  await settle(page);
}
