import { createGame, handSize, undefeatedVillains, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
  P1,
} from "../../../testing/harness.js";
import { defeatWithAttack, playFromHand, runWave5, WAVE5_DEPS } from "../../testing.js";
import { wave5Scenario } from "../../setup.js";

/**
 * Electro, Hobgoblin, Kraven the Hunter, Scorpion and Vulture (`sm` 27095–27099): each villain's own Forced Response
 * effect, on top of `sinisterSixVillain`'s shared trigger, active-counter move and When Defeated (covered in
 * `villains.test.ts` through Doctor Octopus). Seeds are picked so the villain under test starts with the active
 * counter in a 1-player Ghost-Spider game:
 *
 * | seed | in play            | active    |
 * | ---- | ------------------ | --------- |
 * | 1    | Hobgoblin, Kraven  | Hobgoblin |
 * | 2    | Scorpion, Vulture  | Scorpion  |
 * | 3    | Electro, Vulture   | Electro   |
 * | 10   | Kraven, Vulture    | Kraven    |
 *
 * Vulture (activation order 6) never starts with the counter, so his tests hand it to him in the seed 2 game.
 */
function sinisterSixGame(seed: number): GameState {
  const created = createGame(
    wave5Scenario("sinister-six", { seed, players: [{ starterDeckId: "ghost-spider" }] }),
    WAVE5_DEPS,
  );
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const state = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
  return atHandSize(settle(runWave5(state, toHero(P1)), firstLegal, undefined, WAVE5_DEPS));
}

const villainOf = (state: GameState, code: string): InstanceId => instancesOf(state, code)[0]!;
const damageOf = (state: GameState): number => inst(state, identityOf(state)).damage;

/**
 * Selects `wanted` at the villain phase's own prompts (the Forced Response's choice, or each point of indirect damage,
 * whose options read `<instanceId>#<n>`), never as a defender (so the attack stays undefended) and never at the end
 * of the player phase; otherwise declines like `firstLegal`.
 */
const choosing =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice || state.step.phase !== "villain" || choice.prompt.kind === "declareDefender") return firstLegal(state);
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.startsWith(`${w}#`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/**
 * Trims or tops up P1's hand to exactly their hand size (extras go to the bottom of the deck), so the end of the
 * player phase neither discards nor draws and the hand, deck and discard seen before `endTurn` are the ones the
 * villain's Forced Response acts on.
 */
function atHandSize(state: GameState): GameState {
  const size = handSize(state, P1, WAVE5_DEPS);
  const player = playerOf(state, P1);
  const pool = [...player.hand, ...player.deck];
  const hand = pool.slice(0, size);
  const deck = [...player.deck.filter((id) => !hand.includes(id)), ...player.hand.filter((id) => !hand.includes(id))];
  return { ...state, players: state.players.map((p) => (p.playerId === P1 ? { ...p, hand, deck } : p)) };
}

/**
 * Ends P1's turn and settles through the villain's activation, stopping before encounter cards are dealt. Two
 * boost-0 Advances (01186) on top of the encounter deck make the attack exactly the villain's printed ATK. Callers
 * pass a state already `atHandSize`.
 */
function activateVillain(state: GameState, pick: Picker = firstLegal): GameState {
  return settle(
    runWave5(stackEncounterDeck(state, "01186", "01186"), endTurn(P1)),
    pick,
    (s) => s.step.phase === "villain" && s.step.kind === "dealEncounterCards",
    WAVE5_DEPS,
  );
}

/** The identity's `tough` status absorbs the villain's whole attack, so it doesn't damage "you". */
const toughen = (state: GameState): GameState => {
  const identity = identityOf(state);
  return patchInstance(state, identity, { statuses: { ...inst(state, identity).statuses, tough: 1 } });
};

describe("27095.electro-forced-response", () => {
  it("discards exactly the top 7 cards of the attacked player's deck, in order, and moves the counter to Vulture", () => {
    const state = sinisterSixGame(3);
    const electro = villainOf(state, "27095");
    const vulture = villainOf(state, "27099");
    expect(state.activeVillainId).toBe(electro);
    const deckBefore = playerOf(state, P1).deck;
    const discardBefore = playerOf(state, P1).discard;
    const topSeven = deckBefore.slice(0, 7);
    const after = activateVillain(state);
    expect(damageOf(after)).toBe(1); // ATK 1, undefended, boost 0.
    expect(playerOf(after, P1).deck).toEqual(deckBefore.slice(7));
    // Each discarded card goes on top of the pile (index 0), so the 7th card of the deck ends up on top.
    expect(playerOf(after, P1).discard).toEqual([...topSeven].reverse().concat(discardBefore));
    expect(after.activeVillainId).toBe(vulture);
  });

  it("discards nothing and keeps the counter when the attack deals no damage", () => {
    const state = toughen(sinisterSixGame(3));
    const electro = villainOf(state, "27095");
    const deckBefore = playerOf(state, P1).deck;
    const after = activateVillain(state);
    expect(damageOf(after)).toBe(0);
    expect(playerOf(after, P1).deck).toEqual(deckBefore);
    expect(after.activeVillainId).toBe(electro);
  });
});

describe("27096.hobgoblin-forced-response", () => {
  it("deals exactly 2 indirect damage on top of his ATK 1 attack and moves the counter to Kraven", () => {
    const state = sinisterSixGame(1);
    const hobgoblin = villainOf(state, "27096");
    const kraven = villainOf(state, "27097");
    expect(state.activeVillainId).toBe(hobgoblin);
    expect(damageOf(state)).toBe(0);
    const after = activateVillain(state);
    expect(damageOf(after)).toBe(1 + 2); // the attack, then the 2 indirect (no allies: all of it to the identity).
    expect(after.activeVillainId).toBe(kraven);
  });

  it("lets the player put the indirect damage on an ally they control", () => {
    let state = sinisterSixGame(1);
    const played = playFromHand(state, "27010", 2); // Silk (ally, 2 HP).
    state = atHandSize(played.state);
    // Split the 2 points: 1 on Silk (2 HP, so she survives it) and 1 on the hero.
    const after = activateVillain(state, choosing(`${played.id}#1`, `${identityOf(state)}#1`));
    expect(damageOf(after)).toBe(1 + 1); // the attack and 1 indirect…
    expect(inst(after, played.id).damage).toBe(1); // …and the other point on Silk.
  });

  it("deals no indirect damage when the attack deals no damage", () => {
    const state = toughen(sinisterSixGame(1));
    const after = activateVillain(state);
    expect(damageOf(after)).toBe(0);
    expect(after.activeVillainId).toBe(villainOf(state, "27096"));
  });
});

describe("27097.kraven-the-hunter-forced-response", () => {
  it("discards exactly the support or upgrade the player chooses; the other one stays in play", () => {
    let state = sinisterSixGame(10);
    const kraven = villainOf(state, "27097");
    const vulture = villainOf(state, "27099");
    expect(state.activeVillainId).toBe(kraven);
    const stacy = playFromHand(state, "27007", 1); // George Stacy (support).
    state = stacy.state;
    const bracelet = playFromHand(state, "27009", 2); // Web-Bracelet (upgrade).
    state = atHandSize(bracelet.state);
    expect(playerOf(state, P1).playArea).toContain(stacy.id);
    expect(inst(state, bracelet.id).attachedTo).toBe(identityOf(state)); // Web-Bracelet attaches to the hero.
    const after = activateVillain(state, choosing(bracelet.id));
    expect(damageOf(after)).toBe(2);
    expect(playerOf(after, P1).discard[0]).toBe(bracelet.id);
    expect(playerOf(after, P1).playArea).toContain(stacy.id);
    expect(playerOf(after, P1).playArea).not.toContain(bracelet.id);
    expect(after.activeVillainId).toBe(vulture);
  });

  it("with no support or upgrade in play, does nothing but still moves the counter", () => {
    const state = sinisterSixGame(10);
    const discardBefore = playerOf(state, P1).discard;
    const after = activateVillain(state);
    expect(damageOf(after)).toBe(2);
    expect(playerOf(after, P1).discard).toEqual(discardBefore);
    expect(after.activeVillainId).toBe(villainOf(state, "27099"));
  });
});

describe("27098.scorpion-forced-response", () => {
  it("stuns the character the player chooses (an ally here, not the hero) and moves the counter to Vulture", () => {
    let state = sinisterSixGame(2);
    const scorpion = villainOf(state, "27098");
    const vulture = villainOf(state, "27099");
    expect(state.activeVillainId).toBe(scorpion);
    const silk = playFromHand(state, "27010", 2);
    state = atHandSize(silk.state);
    const after = activateVillain(state, choosing(silk.id));
    expect(damageOf(after)).toBe(3);
    expect(inst(after, silk.id).statuses.stunned).toBeTruthy();
    expect(inst(after, identityOf(after)).statuses.stunned).toBeFalsy();
    expect(after.activeVillainId).toBe(vulture);
  });

  it("stuns the hero when the hero is chosen", () => {
    const state = sinisterSixGame(2);
    const after = activateVillain(state, choosing(identityOf(state)));
    expect(inst(after, identityOf(after)).statuses.stunned).toBeTruthy();
  });

  it("stuns nobody when the attack deals no damage", () => {
    const state = toughen(sinisterSixGame(2));
    const after = activateVillain(state);
    expect(damageOf(after)).toBe(0);
    expect(inst(after, identityOf(after)).statuses.stunned).toBeFalsy();
    expect(after.activeVillainId).toBe(villainOf(state, "27098"));
  });
});

describe("27099.vulture-forced-response", () => {
  /** Seed 2's game with the active counter handed to Vulture. */
  const vultureActive = (): GameState => {
    const state = sinisterSixGame(2);
    return { ...state, activeVillainId: villainOf(state, "27099") };
  };

  it("discards exactly the hand card the player chooses and wraps the counter back to Scorpion", () => {
    const state = vultureActive();
    const hand = playerOf(state, P1).hand;
    expect(hand.length).toBeGreaterThan(1);
    const chosen = hand[hand.length - 1]!;
    const after = activateVillain(state, choosing(chosen));
    expect(damageOf(after)).toBe(2);
    expect(playerOf(after, P1).hand).toEqual(hand.filter((id) => id !== chosen));
    expect(playerOf(after, P1).discard[0]).toBe(chosen);
    expect(after.activeVillainId).toBe(villainOf(state, "27098"));
  });
});

describe("27095–27099 When Defeated (the shared helper, through Electro)", () => {
  it("removes 4 threat from Light at the End while Vulture is still in play, then sets Electro aside", () => {
    let state = sinisterSixGame(3);
    const electro = villainOf(state, "27095");
    const light = instancesOf(state, "27102a")[0]!;
    state = patchInstance(state, light, { threat: 8 });
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    const after = defeatWithAttack(state, electro);
    expect(undefeatedVillains(after).map((v) => v.cardId)).toEqual(["27099"]);
    expect(inst(after, light).threat).toBe(4);
    expect(after.encounterSetAside).toContain(electro);
  });
});
