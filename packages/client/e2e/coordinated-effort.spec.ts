import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, pressAt, settle, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { declineMulligans, hook, openApp } from "./wave6-helpers-b.js";
import { facts, press, pressCard, waitForBoardText } from "./x-men-helpers.js";

/**
 * Coordinated Effort (Wonder Man's pack, 58032): "While paying costs on attached card, any player may help pay those
 * costs." (hero packs HT16; owner answer 21B). A two-seat hot-seat game against Rhino: Hercules first, Wonder Man
 * second. Hercules's obligation Appeal to Athena (59035) is stacked to be dealt in round one:
 * "Alter-Ego Action: Exhaust Hercules or spend [mental][mental] -> remove this obligation from the game."
 *
 * Coordinated Effort is a Leadership card, and a deck is checked for legality, so it sits in Hercules's Leadership deck
 * rather than Wonder Man's Justice one; Wonder Man is the helper, with a Genius (basic, [mental][mental]) in his hand.
 *
 * Staging goes through the store, the way `wonder-man-overpay.spec.ts` does (the round-one passes, Coordinated Effort
 * onto the obligation). Everything under test is real pointer input: Hercules opens the obligation's ability, chooses
 * to spend [mental][mental], pays with Wonder Man's Genius, Wonder Man is asked to agree (and is declined once, which
 * returns Hercules to the payment), and the log then says who helped.
 */

const EFFORT = "58032";
const APPEAL = "59035";
const GENIUS = "01089";

type Json = Record<string, any>;
type Rect = { x: number; y: number; width: number; height: number };

async function setup(page: Page): Promise<void> {
  await page.evaluate(
    async ([effort, appeal, genius]) => {
      const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => Json };
      const pool = (await import("/src/content/pool.ts")) as unknown as { POOL_STARTER_DECKS: Json[] };
      const expand = (id: string): { identity: string; aspects: string[]; codes: string[] } => {
        const starter = pool.POOL_STARTER_DECKS.find((deck) => deck.id === id)!;
        const codes: string[] = starter.cards.flatMap((entry: Json) =>
          Array<string>(entry.quantity).fill(entry.cardId),
        );
        return { identity: starter.identityCardId, aspects: starter.aspects, codes };
      };
      // One card of each precon gives way to the card the test needs, so both decks stay legal and 40 cards.
      const hercules = expand("hercules-leadership");
      const wonder = expand("wonder-man-justice");
      await appSession().store.start({
        scenarioId: "rhino",
        difficulty: "standard",
        players: [
          {
            identityCardId: hercules.identity,
            deck: [...hercules.codes.slice(0, hercules.codes.length - 1), effort],
            aspects: hercules.aspects,
          },
          {
            identityCardId: wonder.identity,
            deck: [...wonder.codes.slice(0, wonder.codes.length - 1), genius],
            aspects: wonder.aspects,
          },
        ],
        seed: 5832,
        // Round one's villain phase: Armored Rhino Suit is the boost card and Bomb Scare the card Hercules is dealt, so
        // the obligation is the one Wonder Man is dealt, and "give to the Hercules player" puts it in Hercules's area.
        stack: { players: { 0: [effort], 1: [genius] }, encounter: ["01098", "01109", appeal] },
      });
      if (appSession().store.state.error) throw new Error(`start failed: ${appSession().store.state.error}`);
      const scenes = (window as unknown as Json).__mcGame.scene;
      for (const s of scenes.getScenes(true)) scenes.stop(s.sys.settings.key);
      scenes.start("Board");
    },
    [EFFORT, APPEAL, GENIUS] as const,
  );
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "Board is up", 20000);
  await settle(page);
  await declineMulligans(page);
  await settle(page);
}

/** Dispatches the first legal action of a kind (optionally on a card code) from the store, as the buttons would. */
async function send(page: Page, kind: string, code = "", patch: Json = {}): Promise<void> {
  const ok = await page.evaluate(
    async ([kind, code, patch]) => {
      const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => Json };
      const { store } = appSession();
      const game = store.state.game;
      const entry = store.state.legal?.actions.legal?.find(
        (e: Json) => e.action.kind === kind && (!code || game.instances[e.action.instanceId]?.cardId === code),
      );
      if (!entry) return false;
      await store.dispatch({ ...entry.example, ...patch });
      return true;
    },
    [kind, code, patch] as const,
  );
  expect(ok, `${kind} ${code} is legal`).toBe(true);
}

/** Answers every decision the engine has open with its minimum (the villain phase's own choices). */
async function answerAnyChoice(page: Page): Promise<void> {
  for (let i = 0; i < 12; i++) {
    const answered = await page.evaluate(async () => {
      const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => Json };
      const { store } = appSession();
      const actions = store.state.legal?.actions;
      if (actions?.kind !== "choice") return false;
      await store.resolveChoice(
        actions.choice.options.slice(0, actions.choice.minSelections).map((o: Json) => o.optionId),
      );
      return true;
    });
    if (!answered) return;
  }
}

const turn = (page: Page): Promise<string> => facts(page, (game) => `${game.step.activePlayerId}/r${game.round}`);

/** Round one's villain-phase recap, when it comes up over the board. */
async function dismissRecap(page: Page): Promise<void> {
  try {
    await waitFor(
      async () => ((await activeScenes(page)).includes("VillainPhaseOverlay") ? true : null),
      "recap",
      12000,
    );
    await settle(page);
    await clickText(page, "Start player phase", { sceneKey: "VillainPhaseOverlay" });
    await waitFor(
      async () => (!(await activeScenes(page)).includes("VillainPhaseOverlay") ? true : null),
      "recap closes",
    );
  } catch {
    // No recap this round.
  }
  await settle(page);
}

test("Coordinated Effort: the helper pays a resource, agrees in turn, and the log says who helped", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "the hot-seat hand-over is the same on the phone; one project is enough");
  test.setTimeout(300_000);
  await installWave6Helpers(page);
  await openApp(page);
  await setup(page);

  // Round one: both heroes pass and the villain phase puts Appeal to Athena in Hercules's play area.
  await send(page, "endTurn");
  await answerAnyChoice(page);
  await send(page, "endTurn");
  await answerAnyChoice(page);
  await dismissRecap(page);
  await answerAnyChoice(page);
  const appeal = await facts(page, (game) => {
    const id = Object.keys(game.instances).find((k) => game.instances[k].cardId === "59035");
    return { id, holders: game.players.map((p: Json) => p.playArea.includes(id)) };
  });
  expect(appeal.holders, "Appeal to Athena is in Hercules's play area (the first seat)").toEqual([true, false]);

  // Round two: the first-player token moved on, so Wonder Man passes and then Hercules plays Coordinated Effort.
  expect(await turn(page)).toBe("p2/r2");
  await send(page, "endTurn");
  await answerAnyChoice(page);
  await settle(page);
  expect(await turn(page)).toBe("p1/r2");
  await send(page, "playCard", EFFORT, { attachToInstanceId: appeal.id });
  await answerAnyChoice(page);
  await settle(page);
  const attached = await facts(
    page,
    (game) =>
      Object.values(game.instances as Record<string, Json>).filter((i) => i.cardId === "58032" && i.attachedTo !== null)
        .length,
  );
  expect(attached, "Coordinated Effort is attached").toBe(1);

  // Hercules opens Appeal to Athena and uses its Alter-Ego Action.
  const rect = await hook<Rect>(page, "__mcBoardDebug", "hitRect", appeal.id);
  expect(rect, "the obligation is drawn in Hercules's play area").not.toBeNull();
  await pressAt(page, rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
  await waitFor(
    async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null),
    "Inspect opens",
    6000,
  );
  await settle(page);
  await clickText(page, "Appeal to Athena", { sceneKey: "InspectOverlay", minY: 700 });
  await settle(page);

  // The cost is either/or, and the branch is asked first: spend [mental][mental], with Wonder Man's Genius to pay it.
  await waitForBoardText(page, /^Choose how to pay$/i, "the either/or cost branch is asked");
  await clickText(page, "Spend 2 mental", { sceneKey: "Board" });
  await settle(page);
  await waitForBoardText(page, /^PAYING/i, "the payment bar opens");
  const genius = await facts(page, (game) =>
    game.players[1].hand.find((id: string) => game.instances[id].cardId === "01089"),
  );
  const tile = await hook<Rect>(page, "__mcBoardDebug", "focusRect", `card:${genius}`);
  expect(tile, "Wonder Man's Genius is drawn as a payment source for Hercules").not.toBeNull();

  // Pick the Genius and press Pay: before anything is spent, the helper agrees (the pass-the-device prompt Alliance uses).
  await pressCard(page, false, genius);
  await waitForBoardText(page, /Helped by Simon Williams: 2 mental/i, "the bar says who is paying");
  const pay = await waitForBoardText(page, /^pay$/i, "Pay is offered");
  await press(page, false, pay.x, pay.y);
  await waitForBoardText(
    page,
    /Simon Williams . approve spending Genius\?/i,
    "Wonder Man is asked to approve spending his Genius",
  );
  expect(await facts(page, (game) => game.removedFromGame.length), "nothing has happened yet").toBe(0);

  // Wonder Man declines: Hercules is back at the payment with the same pick, and nothing was spent.
  await clickText(page, "Decline", { sceneKey: "Board" });
  await settle(page);
  await waitForBoardText(page, /Helped by Simon Williams: 2 mental/i, "declining returns to the payment, pick kept");
  expect(await facts(page, (game) => game.players[1].hand.length), "Wonder Man still holds his hand").toBe(6);
  const payAgain = await waitForBoardText(page, /^pay$/i, "Pay is offered again");
  await press(page, false, payAgain.x, payAgain.y);
  await waitForBoardText(page, /Simon Williams . approve spending Genius\?/i, "Wonder Man is asked again");
  await clickText(page, "Approve", { sceneKey: "Board" });
  await settle(page);

  // The obligation is gone, the Genius is in its owner's discard pile, and Hercules did not exhaust.
  const after = await facts(page, (game) => ({
    removed: game.removedFromGame.map((id: string) => game.instances[id].cardId),
    geniusInDiscard: game.players[1].discard.some((id: string) => game.instances[id].cardId === "01089"),
    exhausted: game.instances[game.players[0].identity.instanceId].exhausted,
  }));
  expect(after.removed).toContain(APPEAL);
  expect(after.geniusInDiscard, "Wonder Man's Genius was spent").toBe(true);
  expect(after.exhausted, "Hercules paid with the helper's resources, not by exhausting").toBe(false);

  // The log says who helped.
  const lines: string[] = await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => Json };
    return appSession().gameLog.lines.map((line: Json) => line.text);
  });
  expect(
    lines.filter((text) => /discards Genius to help pay/i.test(text)),
    "the log names the helper",
  ).toHaveLength(1);
});
