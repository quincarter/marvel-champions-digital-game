/**
 * Drives `TUTORIAL_CONFIG` through `TUTORIAL_SCRIPT` the way the client does — via `EngineSessionCore`, the same
 * layer `session-core.test.ts` and `dev-alliance-game.ts` use — and asserts each of §5.1's five lesson preconditions
 * along the way. If any of these breaks, a lesson's spotlighted step would find the board in a state it doesn't
 * expect, so this is the contract `guide/lesson-model.ts` (G5b) will script the tutorial lessons against.
 */
import { describe, expect, test } from "vitest";
import { EngineSessionCore } from "../engine/session-core.js";
import { TUTORIAL_CONFIG, TUTORIAL_PLAYER_ID, TUTORIAL_SCRIPT } from "./tutorial-config.js";

/** The instance ids this stacked setup always assigns (replay-safe): see `tutorial-config.ts`'s own header note. */
const SPIDER_MAN_ID = "i3";
const BLACK_CAT_ID = "i4";
const INTERROGATION_ROOM_ID = "i27";
const MAIN_SCHEME_ID = "i2";
const RHINO_ID = "i1";

function dispatch(core: EngineSessionCore, index: number) {
  const command = TUTORIAL_SCRIPT[index];
  if (!command) throw new Error(`TUTORIAL_SCRIPT has no command at index ${index}`);
  const result = core.dispatch(command);
  if (!result.ok) {
    throw new Error(`command ${index} (${command.type}) was refused: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

describe("TUTORIAL_CONFIG (docs/guided-mode.md G5a)", () => {
  test("lesson 1/2 precondition: round 1 starts in alter-ego with the stacked opening hand", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const state = started.snapshot.state;
    expect(state.round).toBe(1);

    const player = state.players.find((p) => p.playerId === TUTORIAL_PLAYER_ID)!;
    expect(player.identity.form).toBe("alterEgo");
    expect(player.hand.map((id) => state.instances[id]!.cardId)).toEqual([
      "01002",
      "01063",
      "01060",
      "01006",
      "01007",
      "01003",
    ]);

    // The mulligan choice this test is about to keep is exactly `TUTORIAL_SCRIPT`'s first command.
    expect(started.snapshot.legal?.actions.kind).toBe("choice");
  });

  test("lesson 2 precondition: Black Cat is playable as Peter Parker, paid with Scientist plus Interrogation Room", async () => {
    const core = new EngineSessionCore();
    await core.start(TUTORIAL_CONFIG);
    const afterMulligan = dispatch(core, 0); // keep the mulligan

    const player = afterMulligan.state.players.find((p) => p.playerId === TUTORIAL_PLAYER_ID)!;
    expect(player.identity.form).toBe("alterEgo");

    const legal = afterMulligan.legal;
    expect(legal?.actions.kind).toBe("turn");
    const playBlackCat =
      legal?.actions.kind === "turn"
        ? legal.actions.legal.find(
            (entry) => entry.action.kind === "playCard" && entry.action.instanceId === BLACK_CAT_ID,
          )
        : undefined;
    expect(playBlackCat).toBeDefined();

    const afterPlay = dispatch(core, 1); // play Black Cat, paying with Scientist + Interrogation Room
    const played = afterPlay.state.players.find((p) => p.playerId === TUTORIAL_PLAYER_ID)!;
    expect(played.identity.form).toBe("alterEgo"); // still Peter Parker — the flip is lesson 3
    expect(played.playArea).toContain(BLACK_CAT_ID);
    expect(played.hand.map((id) => afterPlay.state.instances[id]?.cardId)).not.toContain("01063");
    expect(played.discard).toContain(INTERROGATION_ROOM_ID); // discarded to pay, not just moved
  });

  test("lesson 3 precondition: the flip to hero form is legal right after Black Cat is played", async () => {
    const core = new EngineSessionCore();
    await core.start(TUTORIAL_CONFIG);
    dispatch(core, 0); // keep the mulligan
    const afterPlay = dispatch(core, 1); // play Black Cat as Peter Parker

    const legal = afterPlay.legal;
    expect(legal?.actions.kind).toBe("turn");
    const flip =
      legal?.actions.kind === "turn"
        ? legal.actions.legal.find((entry) => entry.action.kind === "changeForm")
        : undefined;
    expect(flip).toBeDefined();

    const afterFlip = dispatch(core, 2); // flip to hero form
    const player = afterFlip.state.players.find((p) => p.playerId === TUTORIAL_PLAYER_ID)!;
    expect(player.identity.form).toBe("hero");
  });

  test("lesson 4 precondition: Rhino's round-1 attack targets Spider-Man and Black Cat is a legal defender", async () => {
    const core = new EngineSessionCore();
    await core.start(TUTORIAL_CONFIG);
    dispatch(core, 0); // keep the mulligan
    dispatch(core, 1); // play Black Cat as Peter Parker
    dispatch(core, 2); // flip to hero
    dispatch(core, 3); // end the turn
    const afterDiscard = dispatch(core, 4); // end-of-phase discard (nothing to discard)
    expect(afterDiscard.legal?.actions.kind).toBe("choice");

    const afterSpiderSense = dispatch(core, 5); // decline the Spider-Sense interrupt
    const declareDefender = afterSpiderSense.legal;
    expect(declareDefender?.actions.kind).toBe("choice");
    if (declareDefender?.actions.kind !== "choice") throw new Error("expected the defend prompt");
    expect(declareDefender.actions.choice.prompt).toMatchObject({
      kind: "declareDefender",
      attack: {
        enemyInstanceId: RHINO_ID,
        targetPlayerId: TUTORIAL_PLAYER_ID,
        targetCharacterInstanceId: SPIDER_MAN_ID,
      },
    });
    expect(declareDefender.actions.choice.options.map((option) => option.optionId)).toContain(BLACK_CAT_ID);
  });

  test("lesson 4 outcome and lesson 5 precondition: the first revealed card lands, and round 2 has threat to thwart", async () => {
    const core = new EngineSessionCore();
    await core.start(TUTORIAL_CONFIG);
    for (let i = 0; i < 6; i++) dispatch(core, i); // through defending with Black Cat
    const afterDefend = dispatch(core, 6); // declare Black Cat as defender

    // Advance ("When Revealed: The villain schemes.") was the first card revealed from the encounter deck.
    const revealed = afterDefend.events.find((event) => event.type === "encounterCardRevealed") as
      | { readonly cardId: string }
      | undefined;
    expect(revealed?.cardId).toBe("01186");

    // Spider-Man took no damage: Black Cat absorbed the whole attack.
    const spiderMan = afterDefend.state.instances[SPIDER_MAN_ID]!;
    expect(spiderMan.damage).toBe(0);

    // Round 2's player phase, with threat on the main scheme and Spider-Man able to thwart it.
    expect(afterDefend.state.round).toBe(2);
    const mainScheme = afterDefend.state.instances[MAIN_SCHEME_ID]!;
    expect(mainScheme.threat).toBeGreaterThan(0);

    const legal = afterDefend.legal;
    expect(legal?.actions.kind).toBe("turn");
    const thwart =
      legal?.actions.kind === "turn"
        ? legal.actions.legal.find((entry) => entry.action.kind === "basicThwart")
        : undefined;
    expect(thwart?.example).toEqual({
      type: "basicThwart",
      playerId: TUTORIAL_PLAYER_ID,
      thwarterInstanceId: SPIDER_MAN_ID,
      schemeInstanceId: MAIN_SCHEME_ID,
    });
  });

  test("the full script runs start to finish with no refused command", async () => {
    const core = new EngineSessionCore();
    await core.start(TUTORIAL_CONFIG);
    for (let i = 0; i < TUTORIAL_SCRIPT.length; i++) dispatch(core, i);
  });
});
