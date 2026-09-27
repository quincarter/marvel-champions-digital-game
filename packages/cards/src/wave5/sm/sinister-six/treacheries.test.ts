import { cardId } from "@mc/content";
import { cardsInPlay, undefeatedVillains, hasKeyword, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  P1,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../../testing/harness.js";
import { playFromHand, runWave5, startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { wave5Scenario, type Wave5ScenarioOptions } from "../../setup.js";

/**
 * The Sinister Six's five treacheries (`sm` 27108–27112, MC27 pp. 15–16, docs/phase7-wave5.md §3.1/§3.11/§4.1
 * Q67; `treacheries.ts`). The six villains (Doctor Octopus 27094 order 1, Electro 27095 order 2, Hobgoblin 27096
 * order 3, Kraven the Hunter 27097 order 4, Scorpion 27098 order 5, Vulture 27099 order 6) are named by printed
 * title only, per `treacheries.ts`'s own convention — nothing here imports their (separately-scripted) cards.
 *
 * Forcing 2-3 of the six villains into play (below) always leaves one of them holding the *real* active counter, so
 * MC27 p. 15's own "only the villain with the active counter activates" still fires that villain's ordinary
 * per-phase attack/scheme *in addition to* whatever the revealed treachery scripts (RRG's normal step 2, unrelated
 * to step 4's reveal). Rather than fight that with test-only stunning (which turned out to suppress the villain's
 * per-activation boost draw too — RRG "Stun" discards the status "instead of activating", so `activateEnemy` never
 * reaches `giveBoostCard` for a cancelled activation, silently pushing the stacked target card into that boost slot
 * instead of the player's dealt card), these tests read which villain actually holds the counter and add its known,
 * boost-icon-free (the leading `FILLER` filler prints 0) printed ATK/SCH into the expected total instead.
 */
const DOC_OCK = cardId("27094");
const ELECTRO = cardId("27095");
const HOBGOBLIN = cardId("27096");
const KRAVEN = cardId("27097");
const SCORPION = cardId("27098");
const VULTURE = cardId("27099");

/** Printed ATK/SCH (MC27 pp. 15–16), read directly off each villain's own stage in `packages/content/src/data/sm/cards.ts`. */
const VILLAIN_STATS: Readonly<Record<string, { readonly atk: number; readonly sch: number }>> = {
  [DOC_OCK]: { atk: 2, sch: 2 },
  [ELECTRO]: { atk: 1, sch: 2 },
  [HOBGOBLIN]: { atk: 1, sch: 2 },
  [KRAVEN]: { atk: 2, sch: 1 },
  [SCORPION]: { atk: 3, sch: 0 },
  [VULTURE]: { atk: 2, sch: 1 },
};

function sinisterSixGame(
  players: Wave5ScenarioOptions["players"],
  overrides: Partial<Wave5ScenarioOptions> = {},
): GameState {
  return startWave5Game(wave5Scenario("sinister-six", { seed: 1, players, ...overrides }));
}

/**
 * Test-only surgery (the `packages/engine/src/set-aside-villains.test.ts` `keepInPlay` precedent, re-pointed at
 * `sm` villain card ids instead of activation order values): forces exactly `keep` to be in play and every other
 * one of the six set aside, so "if [named villain] is already in play" is deterministic instead of depending on
 * the Setup's own random players+1 pick. Whichever of `keep` ends up holding the active counter is read back by the
 * tests below (`activeVillainCardId`) rather than pinned, since — as the module docblock explains — suppressing it
 * outright is worse than accounting for it.
 */
function forceVillainsInPlay(state: GameState, keep: readonly string[]): GameState {
  const keepSet = new Set(keep);
  const wantInPlay = (id: InstanceId) => keepSet.has(inst(state, id).cardId as string);
  const villains = state.villains.map((v) => ({ ...v, defeated: !wantInPlay(v.instanceId) }));
  const stillSetAside = state.encounterSetAside.filter((id) => !villains.some((v) => v.instanceId === id));
  const instances = { ...state.instances };
  for (const v of villains) instances[v.instanceId] = { ...instances[v.instanceId]!, faceup: !v.defeated };
  const active =
    villains.find((v) => v.instanceId === state.activeVillainId && !v.defeated) ?? villains.find((v) => !v.defeated);
  return {
    ...state,
    villains,
    instances,
    encounterSetAside: [...stillSetAside, ...villains.filter((v) => v.defeated).map((v) => v.instanceId)],
    activeVillainId: active?.instanceId ?? state.activeVillainId,
  };
}

const activeVillainCardId = (state: GameState): string => inst(state, state.activeVillainId).cardId as string;
const villainCardIdsInPlay = (state: GameState): readonly string[] =>
  undefeatedVillains(state).map((v) => v.cardId as string);

/** A 0-boost-icon Core filler ("Advance", `core` 01186), always in a wave 5 scenario's shared deck via its
 * Standard/Expert set. Stacked ahead of a target card so the villain's own per-activation boost draw (`harness.ts`'s
 * `stackEncounterDeck` docblock: "the villain's boost card is drawn first ... then each player is dealt their
 * card(s)") consumes it instead of the card under test — `museum.test.ts`/`ronan.test.ts`'s own precedent — leaving
 * the real per-phase activation's own ATK/SCH exactly its printed value (module docblock). */
const FILLER = "01186";

/** Reveals `code` as the villain phase's dealt encounter card (past the villain's own boost draw). */
function reveal(state: GameState, code: string): GameState {
  const staged = stackEncounterDeck(state, FILLER, code);
  return settle(runWave5(staged, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
}

/**
 * Reveals `code`, whose own "When Revealed" effect initiates a further enemy attack/scheme (Partnership of Pain):
 * that activation deals its own boost card too, so a second filler goes right behind it.
 */
function revealWithNestedActivation(state: GameState, code: string): GameState {
  const staged = stackEncounterDeck(state, FILLER, code, FILLER);
  return settle(runWave5(staged, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
}

/** Changes to hero form so the identity can be attacked/play allies (`main-scheme.test.ts`'s own `toHeroApplied` precedent). */
function toHeroApplied(state: GameState): GameState {
  return settle(runWave5(state, toHero(P1)), firstLegal, undefined, WAVE5_DEPS);
}

function handSize(state: GameState): number {
  return state.players.find((p) => p.playerId === P1)!.hand.length;
}

describe("Frequent Flyers (27108)", () => {
  it("neither villain in play: puts the set-aside Hobgoblin and Vulture into play, no bonus effect", () => {
    let state = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    state = forceVillainsInPlay(state, [DOC_OCK, ELECTRO]); // neither Hobgoblin nor Vulture
    state = toHeroApplied(state);
    const identity = identityOf(state, P1);
    const damageBefore = inst(state, identity).damage;
    const realNoiseAtk = VILLAIN_STATS[activeVillainCardId(state)]!.atk; // the active counter's own ordinary attack
    const after = reveal(state, "27108");
    // No indirect damage: Hobgoblin was not already in play. Only the real per-phase attack lands.
    expect(inst(after, identity).damage).toBe(damageBefore + realNoiseAtk);
    const inPlay = villainCardIdsInPlay(after);
    expect(inPlay).toContain(HOBGOBLIN);
    expect(inPlay).toContain(VULTURE);
    expect(inPlay).toHaveLength(4); // the 2 original + Hobgoblin + Vulture
  });

  it("Hobgoblin already in play: takes 2 indirect damage instead of duplicating him; Vulture still enters", () => {
    let state = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    state = forceVillainsInPlay(state, [HOBGOBLIN, ELECTRO]);
    state = toHeroApplied(state);
    const identity = identityOf(state, P1);
    const damageBefore = inst(state, identity).damage;
    const realNoiseAtk = VILLAIN_STATS[activeVillainCardId(state)]!.atk;
    const after = reveal(state, "27108");
    // "Take 2 indirect damage" on top of the real per-phase attack.
    expect(inst(after, identity).damage).toBe(damageBefore + 2 + realNoiseAtk);
    const inPlay = villainCardIdsInPlay(after);
    expect(inPlay.filter((id) => id === HOBGOBLIN)).toHaveLength(1); // not put into play again
    expect(inPlay).toContain(VULTURE); // Vulture was not already in play, so he enters
  });

  it("Vulture already in play: discards 1 card at random from hand instead of duplicating him; Hobgoblin still enters", () => {
    let state = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    state = forceVillainsInPlay(state, [VULTURE, DOC_OCK]);
    state = toHeroApplied(state);
    // Ending the hero's turn trims the hand to its printed hand size first (RRG "Hand Size"), independently of this
    // card — Ghost-Spider prints hand size 5, and this seed deals her a 6-card opening hand.
    const handSizeLimit = 5;
    const handBeforeVillainPhase = Math.min(handSize(state), handSizeLimit);
    const after = reveal(state, "27108");
    expect(handSize(after)).toBe(handBeforeVillainPhase - 1); // "discard 1 card at random from your hand"
    const inPlay = villainCardIdsInPlay(after);
    expect(inPlay.filter((id) => id === VULTURE)).toHaveLength(1); // not put into play again
    expect(inPlay).toContain(HOBGOBLIN); // Hobgoblin was not already in play, so he enters
  });

  it("in expert mode gains incite 1; in standard mode it does not", () => {
    const standard = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    const [ff] = instancesOf(standard, "27108");
    expect(hasKeyword(standard, ff!, "incite", WAVE5_DEPS)).toBe(false);
    const expert = sinisterSixGame([{ starterDeckId: "ghost-spider" }], { difficulty: "expert" });
    const [ffExpert] = instancesOf(expert, "27108");
    expect(hasKeyword(expert, ffExpert!, "incite", WAVE5_DEPS)).toBe(true);
  });
});

describe("High Fashion (27109)", () => {
  /** Silk (27010, cost 2) and Spider-UK (27012, cost 3): both playable with no prerequisite, distinct printed
   * costs, from the Ghost-Spider starter deck itself. */
  function withTwoAllies(state: GameState): {
    readonly state: GameState;
    readonly cheap: InstanceId;
    readonly costly: InstanceId;
  } {
    const { state: withSilk, id: cheap } = playFromHand(state, "27010", 2);
    const { state: withBoth, id: costly } = playFromHand(withSilk, "27012", 3);
    return { state: withBoth, cheap, costly };
  }

  it("Electro already in play: discards the highest-cost card you control instead of duplicating him; Kraven still enters", () => {
    let state = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    state = forceVillainsInPlay(state, [ELECTRO, DOC_OCK]);
    state = toHeroApplied(state);
    const { state: withAllies, cheap, costly } = withTwoAllies(state);
    const after = reveal(withAllies, "27109");
    expect(cardsInPlay(after)).not.toContain(costly); // "discard the highest-cost card you control" (Spider-UK, cost 3)
    expect(cardsInPlay(after)).toContain(cheap); // Silk (cost 2) is untouched
    const inPlay = villainCardIdsInPlay(after);
    expect(inPlay.filter((id) => id === ELECTRO)).toHaveLength(1); // not put into play again
    expect(inPlay).toContain(KRAVEN); // Kraven was not already in play, so he enters
  });

  it("Kraven the Hunter already in play: discards the lowest-cost card you control instead of duplicating him; Electro still enters", () => {
    let state = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    state = forceVillainsInPlay(state, [KRAVEN, DOC_OCK]);
    state = toHeroApplied(state);
    const { state: withAllies, cheap, costly } = withTwoAllies(state);
    const after = reveal(withAllies, "27109");
    expect(cardsInPlay(after)).not.toContain(cheap); // "discard the lowest-cost card you control" (Silk, cost 2)
    expect(cardsInPlay(after)).toContain(costly); // Spider-UK (cost 3) is untouched
    const inPlay = villainCardIdsInPlay(after);
    expect(inPlay.filter((id) => id === KRAVEN)).toHaveLength(1); // not put into play again
    expect(inPlay).toContain(ELECTRO); // Electro was not already in play, so he enters
  });
});

describe("Robotic Enhancements (27110)", () => {
  it("Doctor Octopus already in play: confuses a character you control instead of duplicating him; Scorpion still enters", () => {
    let state = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    state = forceVillainsInPlay(state, [DOC_OCK, ELECTRO]);
    state = toHeroApplied(state);
    const identity = identityOf(state, P1);
    const after = reveal(state, "27110");
    expect(inst(after, identity).statuses.confused ?? 0).toBeGreaterThan(0); // "confuse a character you control" (only the identity is a candidate)
    const inPlay = villainCardIdsInPlay(after);
    expect(inPlay.filter((id) => id === DOC_OCK)).toHaveLength(1); // not put into play again
    expect(inPlay).toContain(SCORPION); // Scorpion was not already in play, so he enters
  });

  it("Scorpion already in play: stuns a character you control instead of duplicating him; Doctor Octopus still enters", () => {
    let state = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    state = forceVillainsInPlay(state, [SCORPION, ELECTRO]);
    state = toHeroApplied(state);
    const identity = identityOf(state, P1);
    const after = reveal(state, "27110");
    expect(inst(after, identity).statuses.stunned ?? 0).toBeGreaterThan(0); // "stun a character you control"
    const inPlay = villainCardIdsInPlay(after);
    expect(inPlay.filter((id) => id === SCORPION)).toHaveLength(1); // not put into play again
    expect(inPlay).toContain(DOC_OCK); // Doctor Octopus was not already in play, so he enters
  });
});

describe("Partnership of Pain (27111)", () => {
  it("When Revealed (Alter-Ego): the lowest activation order villain schemes with +X SCH, X the other villains' total SCH", () => {
    // Scorpion (order 5, SCH 0) and Vulture (order 6, SCH 1): lowest order is Scorpion, so he schemes with +1 SCH
    // (Vulture's own SCH) on top of his own printed SCH 0 — deliberately a small combination (rather than, say,
    // Doctor Octopus/Kraven/Vulture) so the real per-phase activation plus this scripted one can never coincidentally
    // sum to stage 1's own threat threshold (8[per_hero]) and complete it mid-test.
    let state = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    state = forceVillainsInPlay(state, [SCORPION, VULTURE]);
    // A fresh game starts in alter-ego form, which is exactly the branch this reveals. Two other sources of threat
    // land on the same main scheme in the same villain phase: RRG "Villain Phase" step 1's own acceleration (this
    // stage prints 1[per_hero], so +1 for a solo game) before anything is even revealed, and whoever holds the real
    // active counter schemes normally in step 2 (module docblock) — both added in here alongside Partnership of
    // Pain's own scripted scheme.
    const stepOneAcceleration = 1; // Sinister Synchronization 1A's own printed acceleration, 1[per_hero], 1 player
    const realNoiseSch = VILLAIN_STATS[activeVillainCardId(state)]!.sch;
    const threatBefore = mainThreat(state);
    const after = revealWithNestedActivation(state, "27111");
    // step 1 acceleration + real step 2 activation + his own SCH 0 + the +1 SCH bonus
    expect(mainThreat(after)).toBe(threatBefore + stepOneAcceleration + realNoiseSch + 0 + 1);
  });

  it("When Revealed (Hero): the highest activation order villain attacks you with +X ATK, X the other villains' total ATK", () => {
    // Doctor Octopus (order 1, ATK 2), Kraven the Hunter (order 4, ATK 2), Vulture (order 6, ATK 2): highest order
    // is Vulture, so he attacks with +4 ATK (Doctor Octopus's 2 + Kraven's 2) on top of his own printed ATK 2.
    let state = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    state = forceVillainsInPlay(state, [DOC_OCK, KRAVEN, VULTURE]);
    state = toHeroApplied(state);
    const identity = identityOf(state, P1);
    const damageBefore = inst(state, identity).damage;
    // Whoever holds the real active counter also attacks normally this same villain phase (module docblock).
    const realNoiseAtk = VILLAIN_STATS[activeVillainCardId(state)]!.atk;
    // `firstLegal` declines every defender prompt, so both attacks land undefended at their full ATK.
    const after = revealWithNestedActivation(state, "27111");
    expect(inst(after, identity).damage).toBe(damageBefore + realNoiseAtk + 6); // real activation + (2 own + 4 bonus)
  });
});

describe("Surprise! (27112)", () => {
  it('resolves "Ambush!" on the main scheme, putting a set-aside villain into play', () => {
    let state = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    state = toHeroApplied(state);
    const before = villainCardIdsInPlay(state);
    const light = instancesOf(state, "27102a")[0]!;
    const threatBefore = inst(state, light).threat;
    const after = reveal(state, "27112");
    const inPlayAfter = villainCardIdsInPlay(after);
    expect(inPlayAfter).toHaveLength(before.length + 1); // Ambush! put one more villain into play
    expect(inst(after, light).threat).toBe(threatBefore); // "if no villain was put into play" branch did not fire
  });

  it("if no villain was put into play (none left set aside), places 3 threat on Light at the End", () => {
    let state = sinisterSixGame([{ starterDeckId: "ghost-spider" }]);
    state = toHeroApplied(state);
    // Bring every remaining set-aside villain into play, so Ambush! has nothing left to put into play.
    state = forceVillainsInPlay(state, [DOC_OCK, ELECTRO, HOBGOBLIN, KRAVEN, SCORPION, VULTURE]);
    const light = instancesOf(state, "27102a")[0]!;
    const threatBefore = inst(state, light).threat;
    const after = reveal(state, "27112");
    expect(inst(after, light).threat).toBe(threatBefore + 3); // "place 3 threat on Light at the End"
  });
});
