import { activeAbilityRefs, activeEncounterDeckId, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  playerOf,
  runWith,
  settle,
  toHero,
  use,
} from "../../testing/harness.js";
import { revealFromEncounterDeck } from "../../testing/staging.js";
import { traceAbilities } from "../../testing/trace.js";
import { WAVE4_DEPS } from "../index.js";
import { startWave4Game } from "../testing.js";
import { visionScenario } from "./support.js";

const visionVsRhino = (seed = 1) => startWave4Game(visionScenario("rhino", { seed }));

/** Stages an obligation on top of the encounter deck, with a filler card behind it (so a villain's own unconditional
 * boost draw during the same villain phase doesn't eat the staged reveal — `../nebu/nebula-obligation-nemesis.test.ts`'s
 * own `stageWithFiller`, and the standing trap `docs/card-scripting-process.md` §7 names). */
function stageObligation(state: GameState, code: string): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === code) ??
    pile.discard.find((i) => state.instances[i]?.cardId === code);
  if (!id) throw new Error(`no ${code} in the encounter deck`);
  const filler = pile.deck.find((i) => state.instances[i]?.cardId === "01186" && i !== id);
  const rest = pile.deck.filter((i) => i !== id && i !== filler);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { ...pile, deck: filler ? [filler, id, ...rest] : [id, ...rest] },
    },
  };
}

describe("Corrupted Programming (obligation, 26028)", () => {
  it("26028.corrupted-programming-action: exhausting your identity removes it from the game", () => {
    const start = visionVsRhino(1);
    const staged = stageObligation(start, "26028");
    const revealed = settle(runWith(WAVE4_DEPS, staged, endTurn()), firstLegal, undefined, WAVE4_DEPS);
    const [obligation] = instancesOf(revealed, "26028") as [InstanceId];
    const after = settle(
      runWith(WAVE4_DEPS, revealed, use(P1, obligation, "26028.corrupted-programming-action")),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(after.removedFromGame).toContain(obligation);
  });

  it("26028.corrupted-programming-constant: blanks the mass form upgrade's text box, but not its form keyword", () => {
    const start = visionVsRhino(2);
    const identity = identityOf(start, P1);
    const mass = instancesOf(start, "26002")[0]!;
    // Dense's own printed ability (a "form"-keyword flip response) is live before the obligation is in play.
    expect(activeAbilityRefs(start, mass, WAVE4_DEPS).length).toBeGreaterThan(0);
    const staged = stageObligation(start, "26028");
    const revealed = settle(runWith(WAVE4_DEPS, staged, endTurn()), firstLegal, undefined, WAVE4_DEPS);
    // With Corrupted Programming in play, the mass form upgrade's own abilities are blanked…
    expect(activeAbilityRefs(revealed, mass, WAVE4_DEPS)).toEqual([]);
    // …but the "mass" form keyword itself survives (`exceptKeywords`): Density Manipulation (26001a's own action,
    // which finds "the only" printed-form-mass card to flip) still works.
    const hero = runWith(WAVE4_DEPS, revealed, toHero());
    const flipped = settle(
      runWith(WAVE4_DEPS, hero, use(P1, identity, "26001a.vision-constant")),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(flipped, mass).flipped).toBe(true);
  });
});

describe("Vision's nemesis set (Ultron, Ultron Unleashed, Relentless Android)", () => {
  it("26029.ultron-forced-interrupt: when Ultron attacks and Ultron Drones is in play, puts the top deck card into play as a Drone", () => {
    // Seed 35 is pinned because it's confirmed (by brute-force search over 1-40) to actually reach the branch this
    // test asserts on — Ultron's minion activation isn't itself scripted, so whether he attacks (rather than Rhino
    // activating alone, or Ultron being engaged but skipped) depends on the encounter deck's own shuffle.
    const hero = runWith(WAVE4_DEPS, visionVsRhino(35), toHero());
    const { state: withDrones } = revealFromEncounterDeck(WAVE4_DEPS, hero, "26031", firstLegal, 1);
    const { state: withUltron, id: ultron } = revealFromEncounterDeck(WAVE4_DEPS, withDrones, "26029", firstLegal, 1);
    // Force the engagement directly (test surgery, the same shape `../nebu/nebula-obligation-nemesis.test.ts`'s own
    // Gamora nemesis test uses): the reveal above may or may not already have engaged Ultron with P1 depending on
    // setup order, and this test cares only about the forced interrupt once he attacks.
    const engaged = patchInstance(withUltron, ultron, { engagedWith: P1 });
    const beforeDeck = playerOf(engaged, P1).deck.length;
    const { deps, trace } = traceAbilities(WAVE4_DEPS);
    const attacked = settle(runWith(deps, engaged, endTurn()), firstLegal, undefined, deps);
    expect(trace.resolved()).toContain("26029.ultron-forced-interrupt");
    expect(playerOf(attacked, P1).deck.length).toBeLessThan(beforeDeck);
  });

  it("26030.when-revealed (Ultron Unleashed): searches for Ultron Drones, puts it into play, and engages a Drone with each player", () => {
    const start = visionVsRhino(3);
    const { deps, trace } = traceAbilities(WAVE4_DEPS);
    const { state: revealed } = revealFromEncounterDeck(deps, start, "26030");
    expect(trace.resolved()).toContain("26030.when-revealed");
    const drones = instancesOf(revealed, "26031").find((id) => revealed.villainArea.includes(id));
    expect(drones).toBeDefined();
    // "Each player puts the top card of their deck into play facedown, engaged with them as a Drone minion."
    const engagedDrone = playerOf(revealed, P1).playArea.find(
      (id) => revealed.instances[id]?.facedownAs && revealed.instances[id]?.engagedWith === P1,
    );
    expect(engagedDrone).toBeDefined();
  });

  it("26032.when-revealed (Relentless Android): with Ultron Drones in play, engages 2 Drones from the deck", () => {
    const start = visionVsRhino(4);
    const { state: withDrones } = revealFromEncounterDeck(WAVE4_DEPS, start, "26031", firstLegal, 1);
    const { deps, trace } = traceAbilities(WAVE4_DEPS);
    const { state: revealed } = revealFromEncounterDeck(deps, withDrones, "26032", firstLegal, 1);
    expect(trace.resolved()).toContain("26032.when-revealed");
    const engagedDrones = playerOf(revealed, P1).playArea.filter(
      (id) => revealed.instances[id]?.facedownAs && revealed.instances[id]?.engagedWith === P1,
    );
    expect(engagedDrones.length).toBe(2);
  });

  it("26032.when-revealed (Relentless Android): without Ultron Drones in play, discards 2 random cards from hand", () => {
    const start = visionVsRhino(5);
    const beforeHand = playerOf(start, P1).hand;
    const { deps, trace } = traceAbilities(WAVE4_DEPS);
    const { state: revealed } = revealFromEncounterDeck(deps, start, "26032");
    expect(trace.resolved()).toContain("26032.when-revealed");
    const stillHeld = playerOf(revealed, P1).hand.filter((id) => beforeHand.includes(id));
    expect(stillHeld.length).toBe(beforeHand.length - 2);
  });
});
