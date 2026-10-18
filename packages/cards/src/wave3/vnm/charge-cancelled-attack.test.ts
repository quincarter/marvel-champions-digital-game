import { activeEncounterDeck, activeVillain, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import {
  attachedCodes,
  attachEncounter,
  bothEnd,
  conjure as conjureFor,
  drive as driveRules,
  fillers,
  funded,
  game,
  takes,
  villainOf,
} from "../../wave7/rulings-2026-10-06-harness.js";
import { runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";
import { venomScenario } from "./support.js";

/**
 * Rhino's Charge (01099) against Venom's Grasping Tendrils (20003): an "at the end of this attack" delayed effect whose
 * attack is cancelled in the same "when the villain attacks" window.
 *
 * Charge: "Forced Interrupt: When Rhino attacks, the attack gains overkill. At the end of this attack, discard
 * Charge." Grasping Tendrils: "Hero Interrupt (defense): When the villain initiates an attack against you, cancel that
 * attack. If you paid for this card using only [physical] resources, stun the villain." The two share a window (RRG 1.8
 * "Attack (Enemy Activation)", p. 9: "when [enemy name] attacks" has the timing of "when [the villain] initiates an
 * attack") and the forced one resolves first, so Charge's delayed effect exists when the attack is cancelled.
 *
 * RRG 1.8 "Cancel" (p. 11): the cancelled effect is "replaced with no effect" and "is not considered to have
 * occurred". "Delayed Effect" (p. 16): a delayed effect resolves "immediately after [its] specified timing point".
 * An attack that did not occur has no end, so Charge is not discarded and waits for Rhino's next attack. No ruling
 * found addresses it (the ruling of January 11, 2026 - Ruling 1, answer 3 is about an attacker that left play, whose
 * attack did end).
 */
const CHARGE = "01099";
const TENDRILS = "20003";
const STRENGTH = "20019"; // a [physical] resource: Grasping Tendrils costs 1
const BLANK = "01186"; // Core treachery with no boost icon
const FILLER = "01098"; // Armored Rhino Suit: attaches to Rhino without touching the player
const TENDRILS_REF = "20003.grasping-tendrils-interrupt";

/** Plays Grasping Tendrils when it is offered (paying its cost from hand); takes the first legal option otherwise. */
const playingTendrils: Picker = (state) => {
  const choice = state.pendingChoice;
  if (!choice) return [];
  if (choice.prompt.kind === "payForCard") return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
  const hit = choice.options.find((o) => o.optionId === TENDRILS_REF || o.optionId.endsWith(`:${TENDRILS_REF}`));
  return hit ? [hit.optionId] : firstLegal(state);
};
/** Never plays it: declines the interrupt and takes the first legal option of anything else. */
const decliningTendrils: Picker = (state) => {
  const choice = state.pendingChoice;
  if (!choice) return [];
  const others = choice.options.filter((o) => !o.optionId.endsWith(TENDRILS_REF));
  if (others.length < choice.options.length) return others.slice(0, choice.minSelections).map((o) => o.optionId);
  return firstLegal(state);
};

/** Venom in hero form against Rhino with a Charge attached to him (surgery: no reveal) and the cards in hand. */
function start(): { readonly state: GameState; readonly charge: InstanceId; readonly villain: InstanceId } {
  const hero = runWave3(startWave3Game(venomScenario("rhino", { seed: 1 })), toHero());
  const { state: withHand } = moveToHand(hero, P1, TENDRILS, STRENGTH);
  const villain = activeVillain(withHand).instanceId;
  const charge = activeEncounterDeck(withHand).deck.find((id) => (inst(withHand, id).cardId as string) === CHARGE);
  if (!charge) throw new Error("no Charge in the encounter deck");
  const stacked = stackEncounterDeck(withHand, CHARGE);
  const [, ...rest] = activeEncounterDeck(stacked).deck;
  const removed: GameState = {
    ...stacked,
    encounterDecks: Object.fromEntries(
      Object.entries(stacked.encounterDecks).map(([key, pile]) => [
        key,
        pile.deck[0] === charge ? { ...pile, deck: rest } : pile,
      ]),
    ) as GameState["encounterDecks"],
  };
  const attached = patchInstance(removed, charge, { faceup: true, attachedTo: villain });
  return {
    charge,
    villain,
    state: patchInstance(attached, villain, { attachments: [...inst(attached, villain).attachments, charge] }),
  };
}
const villainPhase = (state: GameState, pick: Picker, ...stack: readonly string[]): GameState =>
  settle(runWith(WAVE3_DEPS, stackEncounterDeck(state, ...stack), endTurn()), pick, undefined, WAVE3_DEPS);
const damageOf = (state: GameState): number => inst(state, identityOf(state)).damage;

describe("Charge (01099) when Rhino's attack is cancelled by Grasping Tendrils (20003)", () => {
  it("the attack is cancelled: no damage, Rhino is stunned, and Charge is not discarded", () => {
    const { state, charge, villain } = start();
    expect(inst(state, villain).attachments).toContain(charge);
    // No boost card is dealt for a cancelled attack: the first card of the deck is the player's encounter card.
    const after = villainPhase(state, playingTendrils, FILLER);

    expect(damageOf(after)).toBe(damageOf(state));
    expect(inst(after, villain).statuses.stunned).toBe(1);
    expect(inst(after, charge).attachedTo).toBe(villain);
    expect(inst(after, villain).attachments).toContain(charge);
    expect(activeEncounterDeck(after).discard).not.toContain(charge);
    // Grasping Tendrils was played: it is in Venom's discard pile.
    const tendrils = after.players[0]!.discard.filter((id) => (inst(after, id).cardId as string) === TENDRILS);
    expect(tendrils).toHaveLength(1);
  });

  it("control: the same attack let through deals Rhino's 2 + 3 ATK, and Charge is discarded at its end", () => {
    const { state, charge, villain } = start();
    const after = villainPhase(state, decliningTendrils, BLANK, FILLER);

    expect(damageOf(after) - damageOf(state)).toBe(5);
    expect(inst(after, villain).statuses.stunned).toBe(0);
    expect(inst(after, charge).attachedTo).toBeNull();
    expect(inst(after, villain).attachments).not.toContain(charge);
    expect(activeEncounterDeck(after).discard).toContain(charge);
    expect(after.players[0]!.hand.some((id) => (inst(after, id).cardId as string) === TENDRILS)).toBe(true);
  });
});

// Conflict between sources, flagged for the owner: the describe above pins "no ruling found; an attack that did not
// occur has no end, so Charge is not discarded" (RRG 1.8 "Cancel", p. 11). FFG ruling 148 (Feb 15, 2024, post-RRG 1.5)
// says a canceled attack still ends, so "at the end of this attack" effects run. The test below states the ruling and
// stays an expected failure until the two readings are reconciled.
describe("Ruling 148, Feb 15, 2024 (post-RRG 1.5): a canceled attack still ends, so 'at the end of this attack' effects run (RRG 1.8 p. 9)", () => {
  it.fails("Charge (01099) is discarded when Grasping Tendrils (20003) cancels Rhino's attack", () => {
    const base = game("rhino", ["core-spider-man-justice"], ["the_doomsday_chair"]);
    const rhinoId = villainOf(base);
    const charge = attachEncounter(base, CHARGE, rhinoId);
    const given = conjureFor(funded(charge.state, 4, P1), P1, "20003");
    const staged = fillers(given.state);
    const run = driveRules(staged, { chooseTriggers: takes("20003") }, ...bothEnd(staged));
    // Staging sanity: Tendrils resolved.
    expect(
      run.events.some((e) => e.type === "abilityResolved" && e.abilityId === "20003.grasping-tendrils-interrupt"),
    ).toBe(true);
    // Actual: Charge stays attached (its delayed discard is dropped with the canceled attack).
    expect(attachedCodes(run.state, rhinoId)).not.toContain(CHARGE);
  });
});
