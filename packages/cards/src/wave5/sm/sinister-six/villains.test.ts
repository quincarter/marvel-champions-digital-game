import { createGame, undefeatedVillains, type GameEvent, type GameSetupConfig, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  applyOk,
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
  P1,
} from "../../../testing/harness.js";
import { defeatWithAttack, playFromHand, runWave5, WAVE5_DEPS } from "../../testing.js";
import { wave5Scenario, type Wave5ScenarioOptions } from "../../setup.js";

/**
 * Real-game tests for `villains.ts`'s `sinisterSixVillain` helper, exercised through Doctor Octopus (27094; MC27
 * p. 15, docs/phase7-wave5.md §1.5/§3.1). Electro, Hobgoblin, Kraven the Hunter, Scorpion and Vulture reuse the same
 * helper (separate, later agents' work) and so are covered by these same assertions once they register their own
 * ability ids.
 *
 * Seed 1 (`sinisterSixGame`'s default) puts exactly Doctor Octopus (27094, activation order 1, lowest — so he always
 * holds the active counter at setup) and Electro (27095, activation order 2) into play for a 1-player game.
 */
function sinisterSixGame(
  players: Wave5ScenarioOptions["players"],
  overrides: Partial<Wave5ScenarioOptions> = {},
): GameState {
  const config: GameSetupConfig = wave5Scenario("sinister-six", { seed: 19, players, ...overrides });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
}

/** Changes to hero form so the identity can be attacked (and can itself attack, for `defeatWithAttack`). */
function toHeroApplied(state: GameState): GameState {
  return settle(runWave5(state, toHero(P1)), firstLegal, undefined, WAVE5_DEPS);
}

/** Sinister Synchronization 1A's own `acceleration: { base: 0, perPlayer: 1 }`: +1 main scheme threat every villain
 * phase, in 1 player, independent of anything Doctor Octopus does — accounted for so the main-scheme assertions below
 * isolate his own Forced Response's "+1 threat" from this baseline. */
const ACCELERATION_PER_ROUND = 1;
const mainThreatOf = (state: GameState): number => inst(state, state.mainScheme.instanceId).threat;
const lightThreatOf = (state: GameState): number => inst(state, instancesOf(state, "27102a")[0]!).threat;
const doctorOckOf = (state: GameState) => instancesOf(state, "27094")[0]!;
const electroOf = (state: GameState) => instancesOf(state, "27095")[0]!;
const hobgoblinOf = (state: GameState) => instancesOf(state, "27096")[0]!;
const kravenTheHunterOf = (state: GameState) => instancesOf(state, "27097")[0]!;
const scorpionOf = (state: GameState) => instancesOf(state, "27098")[0]!;
const vultureOf = (state: GameState) => instancesOf(state, "27099")[0]!;

/**
 * Resolves the villain phase `endTurn(P1)` opens up through both villains' own activations, attacks and Forced
 * Responses — but stops the moment the villain phase reaches "deal each player 1 encounter card" / "reveal encounter
 * cards", the same breakpoint `activateVillain` (above) settles to, so a random encounter card reveal never adds its
 * own damage/discard/deck noise to what's being measured here — and returns every `GameEvent` raised along the way.
 *
 * The electro/hobgoblin/kraven/scorpion/vulture tests below read this event log rather than taking a plain before/
 * after state diff because, with two of the six villains in play, *both* attack and trigger their own Forced
 * Response this phase (empirically: activation order does not gate which villains activate, only which one holds the
 * counter when its own "Move the active counter…" step runs) — so a plain damage/discard/deck total can double-count
 * a sibling villain's own, unrelated Forced Response instead of isolating the one under test. Filtering the event log
 * by the acting villain's own `instanceId` (`damageDealt.sourceInstanceId`, `cardDiscardedFromPlay.instanceId`,
 * `statusGiven.instanceId`) sidesteps that.
 */
function resolveVillainPhase(state: GameState): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  let current = runWave5(state, endTurn(P1));
  const events: GameEvent[] = [];
  const atBreakpoint = (s: GameState) => s.step.phase === "villain" && s.step.kind === "dealEncounterCards";
  for (let guard = 0; current.pendingChoice && !current.outcome && !atBreakpoint(current); guard++) {
    if (guard > 500) throw new Error(`choices did not settle (stuck on ${current.pendingChoice.prompt.kind})`);
    const choice = current.pendingChoice;
    const result = applyOk(
      current,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: firstLegal(current),
      },
      WAVE5_DEPS,
    );
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

/**
 * Ends P1's turn and settles through the villain phase's own enemy activations (Doctor Octopus attacks, since P1 is
 * in hero form), stopping right before "Deal each player 1 encounter card" / "reveal encounter cards" — so a random
 * encounter card reveal (which could itself scheme, attack, or otherwise touch threat) never blurs what Doctor
 * Octopus's own Forced Response did.
 */
function activateVillain(state: GameState): GameState {
  return settle(
    runWave5(state, endTurn(P1)),
    firstLegal,
    (s) => s.step.phase === "villain" && s.step.kind === "dealEncounterCards",
    WAVE5_DEPS,
  );
}

describe("27094.doctor-octopus-forced-response", () => {
  it('places exactly 1 threat on each scheme in play and moves the active counter to the next villain in the activation order (RRG "Activation Order")', () => {
    const state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }]));
    const doctorOck = doctorOckOf(state);
    const electro = electroOf(state);
    expect(state.activeVillainId).toBe(doctorOck); // Doctor Octopus (order 1) starts with the active counter.
    const mainBefore = mainThreatOf(state);
    const lightBefore = lightThreatOf(state);
    const after = activateVillain(state);
    // Doctor Octopus's own attack (ATK 2, undefended) must have damaged the identity for the Forced Response to
    // have fired at all; if it somehow didn't connect this assertion (and the two below) would trivially pass, so
    // guard against that first.
    expect(inst(after, identityOf(after)).damage).toBeGreaterThan(0);
    expect(mainThreatOf(after)).toBe(mainBefore + ACCELERATION_PER_ROUND + 1);
    expect(lightThreatOf(after)).toBe(lightBefore + 1);
    expect(after.activeVillainId).toBe(electro); // moved to the next (and only other) villain in activation order.
  });

  it("a lone Doctor Octopus keeps the active counter after his own Forced Response (MC27 p. 15/p. 21 FAQ: a lone villain keeps the counter)", () => {
    let state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }]));
    const doctorOck = doctorOckOf(state);
    const electro = electroOf(state);
    // Electro has no script yet (later agent's work), so this defeat is a plain, unscripted removal from play — it
    // does not return him to `encounterSetAside`, only Doctor Octopus's own When Defeated does that (tested below).
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    state = defeatWithAttack(state, electro);
    expect(undefeatedVillains(state).map((v) => v.instanceId)).toEqual([doctorOck]);
    expect(state.activeVillainId).toBe(doctorOck);
    const mainBefore = mainThreatOf(state);
    const lightBefore = lightThreatOf(state);
    const after = activateVillain(state);
    expect(inst(after, identityOf(after)).damage).toBeGreaterThan(0);
    expect(mainThreatOf(after)).toBe(mainBefore + ACCELERATION_PER_ROUND + 1); // the Forced Response still fired…
    expect(lightThreatOf(after)).toBe(lightBefore + 1);
    expect(after.activeVillainId).toBe(doctorOck); // …but with no other villain in play, the counter stays put.
  });

  it('does not fire when the attack is fully prevented (no damage taken): the identity\'s "tough" status absorbs the whole hit', () => {
    let state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }]));
    const doctorOck = doctorOckOf(state);
    const electro = electroOf(state);
    const identity = identityOf(state);
    state = patchInstance(state, identity, { statuses: { ...inst(state, identity).statuses, tough: 1 } });
    const mainBefore = mainThreatOf(state);
    const lightBefore = lightThreatOf(state);
    const after = activateVillain(state);
    expect(inst(after, identity).damage).toBe(0); // toughness absorbed the entire attack: no damage was taken.
    expect(mainThreatOf(after)).toBe(mainBefore + ACCELERATION_PER_ROUND); // acceleration still runs; only
    expect(lightThreatOf(after)).toBe(lightBefore); // fired: no threat placed…
    expect(after.activeVillainId).toBe(doctorOck); // …and the active counter did not move either.
    expect(undefeatedVillains(after).map((v) => v.instanceId)).toContain(electro);
  });
});

describe("27094.when-defeated", () => {
  it("removes 4 threat from a side scheme when another villain is still in play", () => {
    let state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }]));
    const doctorOck = doctorOckOf(state);
    const lightBefore = lightThreatOf(state);
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    const after = defeatWithAttack(state, doctorOck);
    expect(undefeatedVillains(after).map((v) => v.cardId)).toEqual(["27095"]); // Electro is still in play.
    expect(lightThreatOf(after)).toBe(lightBefore - 4);
  });

  it("removes 7 threat instead when no other villain is in play", () => {
    let state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }]));
    const doctorOck = doctorOckOf(state);
    const electro = electroOf(state);
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    state = defeatWithAttack(state, electro); // unscripted removal, leaving Doctor Octopus alone.
    const lightBefore = lightThreatOf(state);
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    const after = defeatWithAttack(state, doctorOck);
    expect(undefeatedVillains(after)).toHaveLength(0);
    expect(lightThreatOf(after)).toBe(lightBefore - 7);
  });

  it('sets Doctor Octopus aside (RRG 1.8 "Leaves Play", p. 27), so "Ambush!" can later draw him back into play', () => {
    let state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }]));
    const doctorOck = doctorOckOf(state);
    const electro = electroOf(state);
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    state = defeatWithAttack(state, electro);
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    state = defeatWithAttack(state, doctorOck);
    expect(undefeatedVillains(state)).toHaveLength(0);
    expect(state.encounterSetAside).toContain(doctorOck); // back in the pool Sinister Synchronization's "Ambush!"
    // (main-scheme.ts) draws a random set-aside villain from.

    // With no villain in play, ending the turn resolves "Ambush!" (main-scheme.ts's own Forced Interrupt) before
    // continuing the villain's activation; rng value 2's random draw happens to pick Doctor Octopus back out of the
    // pool — which, now that Electro (27095) has its own registered When Defeated, also holds a fresh Electro copy
    // (`setVillainAside`, RRG 1.8 "Leaves Play", p. 27), not just the four villains never touched this game.
    state = { ...state, rng: { value: 2, draws: 0 } };
    state = stackEncounterDeck(state, "01186");
    const after = settle(runWave5(state, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    // Ambush! brings him back; a treachery dealt later in the same phase may add another villain, so check membership.
    expect(undefeatedVillains(after).map((v) => v.instanceId)).toContain(doctorOck);
    expect(after.activeVillainId).toBe(doctorOck); // "…and place the active counter on it."
  });
});

describe("27095.electro-forced-response", () => {
  it("discards exactly the top 7 cards of your deck and moves the active counter (seed 3: Electro + Vulture)", () => {
    const state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }], { seed: 3 }));
    const electro = electroOf(state);
    const vulture = vultureOf(state);
    expect(state.activeVillainId).toBe(electro);
    const { state: after, events } = resolveVillainPhase(state);
    const milled = events.filter(
      (e) => e.type === "cardMoved" && e.from.kind === "deck" && e.to.kind === "discard" && e.from.playerId === P1,
    );
    expect(milled).toHaveLength(7);
    // Vulture (order 6, the only other villain in play) is left holding the counter once both villains' own Forced
    // Responses (each "moves the active counter to the next villain in the activation order") have resolved this
    // villain phase — `moveActiveCounterToNextVillain`'s own engine behavior, not scripted here.
    expect(after.activeVillainId).toBe(vulture);
  });

  it('discards however many cards remain when fewer than 7 are left, and lets the emptied deck reset itself (RRG 1.8 "Player Deck", p. 33 — `settlePlayerDecks`, `packages/engine/src/ctx.ts`, generically exercised by `packages/engine/src/player-deck-reset.test.ts`, not scripted by this ability)', () => {
    // Seed 31 (not 3): Electro's partner here is Hobgoblin, whose own Forced Response deals indirect damage rather
    // than touching hand/deck/discard, so it can't add an unrelated card to the discard pile this test is measuring.
    let state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }], { seed: 31 }));
    const p1 = P1;
    // Shrink P1's deck to 3 cards, moving the rest into their own discard pile so no card vanishes and the discard
    // pile is non-empty — RRG 1.8 p. 33: "the deck does not reset until there is at least one card in the player's
    // discard pile", which this setup already satisfies.
    state = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === p1 ? { ...p, deck: p.deck.slice(0, 3), discard: [...p.discard, ...p.deck.slice(3)] } : p,
      ),
    };
    const { state: after, events } = resolveVillainPhase(state);
    const milled = events.filter(
      (e): e is GameEvent & { type: "cardMoved" } =>
        e.type === "cardMoved" && e.from.kind === "deck" && e.to.kind === "discard" && e.from.playerId === p1,
    );
    expect(milled).toHaveLength(3); // only the 3 cards actually in the deck — no error, no "until" search to keep going.
    expect(events.some((e) => e.type === "playerDeckReset" && e.playerId === p1)).toBe(true);
    const p1After = after.players.find((p) => p.playerId === p1)!;
    // The reset shuffled those same 3 cards straight back into a fresh deck (not lost, not left sitting in the
    // discard pile) — this is the substantive claim; a plain deck-size check would also have to account for the
    // hero's own turn ending over hand size, an unrelated `cardMoved` from hand to discard this same villain phase.
    expect(p1After.deck).toEqual(expect.arrayContaining(milled.map((e) => e.instanceId)));
  });
});

describe("27095.when-defeated", () => {
  it("resolves (shares Doctor Octopus's own fully-covered When Defeated)", () => {
    let state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }], { seed: 3 }));
    const electro = electroOf(state);
    const lightBefore = lightThreatOf(state);
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    const after = defeatWithAttack(state, electro);
    expect(lightThreatOf(after)).toBeLessThan(lightBefore); // 4 or 7 threat removed, per whether Vulture is still up.
    expect(after.encounterSetAside).toContain(electro);
  });
});

describe("27096.hobgoblin-forced-response", () => {
  it("deals exactly 2 indirect damage to you (seed 1: Hobgoblin + Kraven the Hunter)", () => {
    const state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }], { seed: 1 }));
    const hobgoblin = hobgoblinOf(state);
    expect(state.activeVillainId).toBe(hobgoblin);
    const { state: after, events } = resolveVillainPhase(state);
    const indirect = events.filter(
      (e) => e.type === "damageDealt" && e.sourceInstanceId === hobgoblin && e.amount === 2,
    );
    expect(indirect).toHaveLength(1);
    // With Kraven the Hunter (order 4) the only other villain in play, both villains' own Forced Responses move the
    // active counter to "the next villain in the activation order" this phase, which — with only two villains —
    // lands back on Hobgoblin (order 3); `moveActiveCounterToNextVillain`'s own behavior, not scripted here.
    expect(after.activeVillainId).toBe(hobgoblin);
  });
});

describe("27096.when-defeated", () => {
  it("resolves (shares Doctor Octopus's own fully-covered When Defeated)", () => {
    let state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }], { seed: 1 }));
    const hobgoblin = hobgoblinOf(state);
    const lightBefore = lightThreatOf(state);
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    const after = defeatWithAttack(state, hobgoblin);
    expect(lightThreatOf(after)).toBeLessThan(lightBefore);
    expect(after.encounterSetAside).toContain(hobgoblin);
  });
});

describe("27097.kraven-the-hunter-forced-response", () => {
  it("discards exactly the 1 support/upgrade you control (seed 10: Kraven the Hunter + Vulture)", () => {
    let state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }], { seed: 10 }));
    const { state: withPlanB, id: planB } = playFromHand(state, "27024", 1); // Plan B, an upgrade in her own deck.
    state = withPlanB;
    const kraven = kravenTheHunterOf(state);
    const vulture = vultureOf(state);
    expect(state.activeVillainId).toBe(kraven);
    const { state: after, events } = resolveVillainPhase(state);
    const discarded = events.filter((e) => e.type === "cardDiscardedFromPlay" && e.instanceId === planB);
    expect(discarded).toHaveLength(1);
    expect(playerOf(after, P1).discard).toContain(planB); // discarded, not just left in play.
    expect(playerOf(after, P1).hand).not.toContain(planB);
    expect(after.activeVillainId).toBe(vulture); // the counter's final resting place once both villains' own Forced
    // Responses have moved it this phase (`moveActiveCounterToNextVillain`'s own behavior, not scripted here).
  });

  it("does nothing beyond moving the counter when you control no support or upgrade", () => {
    const state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }], { seed: 10 }));
    const kraven = kravenTheHunterOf(state);
    const { events } = resolveVillainPhase(state);
    expect(events.some((e) => e.type === "cardDiscardedFromPlay")).toBe(false);
    expect(events.some((e) => e.type === "damageDealt" && e.sourceInstanceId === kraven)).toBe(true); // still attacked.
  });
});

describe("27097.when-defeated", () => {
  it("resolves (shares Doctor Octopus's own fully-covered When Defeated)", () => {
    let state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }], { seed: 10 }));
    const kraven = kravenTheHunterOf(state);
    const lightBefore = lightThreatOf(state);
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    const after = defeatWithAttack(state, kraven);
    expect(lightThreatOf(after)).toBeLessThan(lightBefore);
    expect(after.encounterSetAside).toContain(kraven);
  });
});

describe("27098.scorpion-forced-response", () => {
  it("stuns exactly 1 character you control (seed 2: Scorpion + Vulture)", () => {
    const state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }], { seed: 2 }));
    const scorpion = scorpionOf(state);
    const vulture = vultureOf(state);
    const identity = identityOf(state, P1);
    expect(state.activeVillainId).toBe(scorpion);
    const { state: after, events } = resolveVillainPhase(state);
    const stunned = events.filter(
      (e) => e.type === "statusGiven" && e.status === "stunned" && e.instanceId === identity,
    );
    expect(stunned).toHaveLength(1);
    expect(inst(after, identity).statuses.stunned).toBeGreaterThan(0);
    expect(after.activeVillainId).toBe(vulture);
  });
});

describe("27098.when-defeated", () => {
  it("resolves (shares Doctor Octopus's own fully-covered When Defeated)", () => {
    let state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }], { seed: 2 }));
    const scorpion = scorpionOf(state);
    const lightBefore = lightThreatOf(state);
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    const after = defeatWithAttack(state, scorpion);
    expect(lightThreatOf(after)).toBeLessThan(lightBefore);
    expect(after.encounterSetAside).toContain(scorpion);
  });
});

describe("27099.vulture-forced-response", () => {
  it("discards exactly 1 card from your hand, chosen by you (seed 3: defeat Electro, leaving Vulture alone)", () => {
    let state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }], { seed: 3 }));
    const electro = electroOf(state);
    const vulture = vultureOf(state);
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    state = defeatWithAttack(state, electro); // unscripted removal, leaving Vulture alone (and active).
    expect(undefeatedVillains(state).map((v) => v.instanceId)).toEqual([vulture]);
    expect(state.activeVillainId).toBe(vulture);
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    const { events } = resolveVillainPhase(state);
    // The villain phase's own end-of-turn hand-size discard can also raise a `cardDiscardedFromHand` before the
    // villain even activates; only the one *after* Vulture's own attack resolves is this Forced Response's.
    const attackedAt = events.findIndex((e) => e.type === "attackResolved");
    const forcedResponseDiscards = events.filter((e, i) => e.type === "cardDiscardedFromHand" && i > attackedAt);
    expect(forcedResponseDiscards).toHaveLength(1);
  });
});

describe("27099.when-defeated", () => {
  it("resolves (shares Doctor Octopus's own fully-covered When Defeated)", () => {
    let state = toHeroApplied(sinisterSixGame([{ starterDeckId: "ghost-spider" }], { seed: 3 }));
    const electro = electroOf(state);
    const vulture = vultureOf(state);
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    state = defeatWithAttack(state, electro);
    const lightBefore = lightThreatOf(state);
    state = patchInstance(state, identityOf(state, P1), { exhausted: false });
    const after = defeatWithAttack(state, vulture);
    expect(lightThreatOf(after)).toBeLessThan(lightBefore);
    expect(after.encounterSetAside).toContain(vulture);
  });
});
