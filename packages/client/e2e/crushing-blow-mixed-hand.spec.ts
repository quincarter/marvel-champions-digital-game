import { expect, test, type Page } from "@playwright/test";
import { settle, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, boardUp, facts, payWith, playFromHand } from "./x-men-helpers.js";

/**
 * Issue #648: Crushing Blow (10002, "You can only spend [physical] resources to pay for this card") read as
 * unaffordable whenever the hand also held a card of another type, though a [physical] card or a wild could pay for it.
 * The game is the reporter's own (Hulk vs Ronan the Accuser, seed 97856), replayed from the issue to round 2's turn,
 * where the hand is Sub-Orbital Leap ([physical]), Crushing Blow, Unstoppable Force ([physical]) and Toe to Toe
 * ([mental]), with the Milano ready for a wild.
 */

const REPLAY = {
  config: {
    scenarioId: "ronan-the-accuser",
    difficulty: "standard",
    players: [{ starterDeckId: "hlk-aggression" }],
    seed: 97856,
    tableRules: { sameNameHeroAllyConflict: true },
    outsideFacts: [{ wonPreviousGame: false }],
  },
  commands: [
    { type: "resolveChoice", playerId: "p1", choiceId: "c1", selectedOptionIds: ["i24", "i11", "i39", "i28", "i38"] },
    { type: "changeForm", playerId: "p1" },
    {
      type: "playCard",
      playerId: "p1",
      cardInstanceId: "i22",
      payment: [{ ability: { instanceId: "i88", abilityId: "16142.milano-constant-2" } }, { fromHand: "i32" }],
      attachToInstanceId: null,
    },
    { type: "resolveChoice", playerId: "p1", choiceId: "c2", selectedOptionIds: ["i1"] },
    { type: "basicAttack", playerId: "p1", attackerInstanceId: "i3", targetInstanceId: "i1" },
    { type: "resolveChoice", playerId: "p1", choiceId: "c3", selectedOptionIds: ["i6:10003.hulk-smash-interrupt"] },
    { type: "resolveChoice", playerId: "p1", choiceId: "c4", selectedOptionIds: ["hand:i21", "hand:i33", "hand:i18"] },
    { type: "endTurn", playerId: "p1" },
    { type: "resolveChoice", playerId: "p1", choiceId: "c5", selectedOptionIds: ["decline"] },
    { type: "resolveChoice", playerId: "p1", choiceId: "c6", selectedOptionIds: [] },
    { type: "resolveChoice", playerId: "p1", choiceId: "c7", selectedOptionIds: ["decline"] },
  ],
} as const;

// In this game Crushing Blow is i4, Sub-Orbital Leap i8 and Toe to Toe i26; the `facts` readers run in the page, so
// they spell the ids out.
const CRUSHING_BLOW = "i4";
const SUB_ORBITAL_LEAP = "i8";

const payOpen = (page: Page): Promise<boolean> =>
  page.evaluate(
    () => (window as unknown as { __mcBoardDebug?: { paymentView(): unknown } }).__mcBoardDebug?.paymentView() != null,
  );

test("Crushing Blow can be paid with a [physical] card while a [mental] card is also in hand", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async (replay) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { start: (c: unknown) => Promise<void>; dispatch: (c: unknown) => Promise<unknown> } };
    };
    const store = appSession().store;
    await store.start(replay.config);
    for (const command of replay.commands) await store.dispatch(command);
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

  const hand = await facts(page, (game) =>
    (game.players[0].hand as string[]).map((id) => game.cardPool[game.instances[id].cardId].name as string).sort(),
  );
  expect(hand).toEqual(["Crushing Blow", "Sub-Orbital Leap", "Toe to Toe", "Unstoppable Force"]);
  if (SHOT) await page.screenshot({ path: `${SHOT}/issue-648-hand.png` });

  await playFromHand(page, phone, CRUSHING_BLOW, () => payOpen(page));
  await settle(page, { quietMs: 300, maxMs: 2000 });
  if (SHOT) await page.screenshot({ path: `${SHOT}/issue-648-payment.png` });
  await payWith(page, phone, [SUB_ORBITAL_LEAP]);

  const after = await waitFor(
    () =>
      facts(page, (game) =>
        game.players[0].hand.includes("i4")
          ? null
          : {
              leapSpent: game.players[0].discard.includes("i8") as boolean,
              toeToeInHand: game.players[0].hand.includes("i26") as boolean,
            },
      ),
    "Crushing Blow leaves the hand",
    15000,
  );
  expect(after.leapSpent, "Sub-Orbital Leap paid for it").toBe(true);
  expect(after.toeToeInHand, "Toe to Toe was not spent").toBe(true);
});
