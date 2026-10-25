/**
 * QA of The Sleeper Awakened (04140, issue #130, PR #131) beyond the one path the fix's own tests cover.
 *
 * Printed text: "This scheme cannot leave play while The Sleeper is in play. When Revealed: Put The Sleeper into play
 * engaged with the first player. When The Sleeper is defeated, remove this card from the game."
 * Sources: RRG 1.8 "'Cannot'" p. 11 (a "cannot" is absolute); Golden Rules p. 4 (card text over the rules); older FFG
 * ruling (Caleb, Rise of Red Skull): "that side scheme cannot be defeated. It can only be removed from play". So the
 * "Side Scheme" rule (a scheme with 0 threat is defeated) never takes it, even once The Sleeper is gone (issue #405).
 */
import { cardsInPlay, characterProfile, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  P2,
  patchInstance,
  type Picker,
  settle,
  toHero,
} from "../../testing/harness.js";
import { playFromHand } from "../../testing/staging.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";

const redSkullVsHeroes = (seed = 2026, count = 1) =>
  startWave2Game(
    wave2Scenario("red-skull", {
      players: [{ starterDeckId: "hawkeye-leadership" }, { starterDeckId: "spider-woman-aggression-justice" }].slice(
        0,
        count,
      ),
      seed,
    }),
  );

function stackSideSchemeDeck(state: GameState, code: string): GameState {
  const pile = state.scenarioDecks["side-scheme deck"]!;
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === code) ??
    pile.discard.find((i) => state.instances[i]?.cardId === code);
  if (!id) throw new Error(`no ${code} in the side-scheme deck or discard`);
  return {
    ...state,
    scenarioDecks: {
      ...state.scenarioDecks,
      "side-scheme deck": {
        ...pile,
        deck: [id, ...pile.deck.filter((i) => i !== id)],
        discard: pile.discard.filter((i) => i !== id),
      },
    },
  };
}

/** The Sleeper Awakened revealed with The Sleeper engaged, on the hero's turn. */
function awake(count = 1) {
  const stacked = stackSideSchemeDeck(runWave2(redSkullVsHeroes(2028, count), toHero()), "04140");
  const revealed = settle(
    runWave2(stacked, endTurn(), ...(count === 2 ? [endTurn(P2)] : [])),
    firstLegal,
    undefined,
    WAVE2_DEPS,
  );
  const sleeper = instancesOf(revealed, "04130").find((id) => cardsInPlay(revealed).includes(id));
  const scheme = instancesOf(revealed, "04140").find((id) => cardsInPlay(revealed).includes(id));
  if (!sleeper || !scheme) throw new Error("The Sleeper Awakened did not put The Sleeper into play");
  const ready = revealed.players.reduce(
    (acc, p) => patchInstance(acc, p.identity.instanceId, { exhausted: false }),
    revealed,
  );
  return { state: ready, sleeper, scheme };
}

/** Test-only surgery: The Sleeper leaves play by some means other than defeat. */
function sleeperLeaves(state: GameState, sleeper: InstanceId, to: "removed" | "discard"): GameState {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const piles = state.encounterDecks[deckId]!;
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((id) => id !== sleeper) })),
    removedFromGame: to === "removed" ? [...state.removedFromGame, sleeper] : state.removedFromGame,
    encounterDecks:
      to === "discard"
        ? { ...state.encounterDecks, [deckId]: { ...piles, discard: [...piles.discard, sleeper] } }
        : state.encounterDecks,
    instances: { ...state.instances, [sleeper]: { ...state.instances[sleeper]!, engagedWith: null } },
  };
}

const thwart = (state: GameState, scheme: InstanceId) => {
  const actor = state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : P1;
  return settle(
    runWave2(state, {
      type: "basicThwart",
      playerId: actor,
      thwarterInstanceId: identityOf(state, actor),
      schemeInstanceId: scheme,
    }),
    firstLegal,
    undefined,
    WAVE2_DEPS,
  );
};

describe("The Sleeper Awakened (04140): leaving play without a defeat", () => {
  // With The Sleeper gone the first sentence no longer holds it, but it still cannot be defeated: only its own text
  // removes it. Nothing in the game takes The Sleeper out of play short of defeating it, so these are surgery.
  it("with The Sleeper gone (removed from the game), thwarting its last threat does not defeat the scheme", () => {
    const { state, sleeper, scheme } = awake();
    const gone = patchInstance(sleeperLeaves(state, sleeper, "removed"), scheme, { threat: 1 });
    const after = thwart(gone, scheme);
    expect(inst(after, scheme).threat).toBe(0);
    expect(cardsInPlay(after)).toContain(scheme);
  });

  it("same with The Sleeper discarded by an effect instead", () => {
    const { state, sleeper, scheme } = awake();
    const gone = patchInstance(sleeperLeaves(state, sleeper, "discard"), scheme, { threat: 1 });
    const after = thwart(gone, scheme);
    expect(cardsInPlay(after)).toContain(scheme);
  });

  it("two-player table: the same scheme/Sleeper interaction holds (scheme survives 0 threat while The Sleeper stands)", () => {
    const awoke = awake(2);
    const { scheme } = awoke;
    const state = runWave2(awoke.state, toHero(P2));
    const after = thwart(patchInstance(state, scheme, { threat: 1 }), scheme);
    expect(inst(after, scheme).threat).toBe(0);
    expect(cardsInPlay(after)).toContain(scheme);
  });

  it("at 0 threat, it is not defeated when The Sleeper leaves play undefeated", () => {
    const { state, sleeper, scheme } = awake();
    const held = thwart(patchInstance(state, scheme, { threat: 1 }), scheme);
    expect(cardsInPlay(held)).toContain(scheme);
    const gone = sleeperLeaves(held, sleeper, "removed");
    // Any later command re-runs the engine's state checks.
    const later = settle(runWave2(gone, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(cardsInPlay(later)).toContain(scheme);
  });
});

// Issue #405 (a regression of #130): The Sleeper Awakened went back into the side-scheme deck when players had thwarted
// it to 0 before defeating The Sleeper. Every way The Sleeper can be defeated, with and without threat on the scheme,
// must leave both cards removed from the game and in no deck, discard pile or play area.
describe("The Sleeper Awakened (04140): removed from the game however The Sleeper is defeated", () => {
  /** The Sleeper one damage from defeat, with no tough status card. */
  const weakened = (state: GameState, sleeper: InstanceId) => {
    const profile = characterProfile(state, sleeper, WAVE2_DEPS);
    if (profile?.kind !== "minion") throw new Error("The Sleeper has no minion profile");
    return patchInstance(state, sleeper, {
      damage: profile.maxHp - 1,
      statuses: { ...inst(state, sleeper).statuses, tough: 0 },
    });
  };

  /** Thwarted to 0 while The Sleeper stands: held in play by its first sentence, every identity readied again. */
  const thwartedToZero = (state: GameState, scheme: InstanceId) => {
    const held = thwart(patchInstance(state, scheme, { threat: 1 }), scheme);
    expect(inst(held, scheme).threat).toBe(0);
    expect(cardsInPlay(held)).toContain(scheme);
    return held.players.reduce((acc, p) => patchInstance(acc, p.identity.instanceId, { exhausted: false }), held);
  };

  const attack = (state: GameState, player: PlayerId, attacker: InstanceId, target: InstanceId) =>
    settle(
      runWave2(state, {
        type: "basicAttack",
        playerId: player,
        attackerInstanceId: attacker,
        targetInstanceId: target,
      }),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );

  function expectBothRemoved(after: GameState, sleeper: InstanceId, scheme: InstanceId) {
    expect(after.removedFromGame).toContain(sleeper);
    expect(after.removedFromGame).toContain(scheme);
    expect(cardsInPlay(after)).not.toContain(sleeper);
    expect(cardsInPlay(after)).not.toContain(scheme);
    const piles = [...Object.values(after.scenarioDecks), ...Object.values(after.encounterDecks)].flatMap((pile) => [
      ...pile.deck,
      ...pile.discard,
    ]);
    expect(piles).not.toContain(sleeper);
    expect(piles).not.toContain(scheme);
  }

  it("with threat still on the scheme, by a hero's basic attack", () => {
    const { state, sleeper, scheme } = awake();
    const ready = weakened(patchInstance(state, scheme, { threat: 2 }), sleeper);
    expectBothRemoved(attack(ready, P1, identityOf(ready), sleeper), sleeper, scheme);
  });

  it("with the scheme as it was revealed, by a hero's basic attack", () => {
    const { state, sleeper, scheme } = awake();
    const ready = weakened(state, sleeper);
    expectBothRemoved(attack(ready, P1, identityOf(ready), sleeper), sleeper, scheme);
  });

  it("thwarted to 0 first, by a hero's basic attack (the reported game)", () => {
    const { state, sleeper, scheme } = awake();
    const ready = weakened(thwartedToZero(state, scheme), sleeper);
    expectBothRemoved(attack(ready, P1, identityOf(ready), sleeper), sleeper, scheme);
  });

  it("two players: the hero it is not engaged with thwarts the scheme to 0, then defeats The Sleeper", () => {
    const awoke = awake(2);
    const { sleeper, scheme } = awoke;
    const ready = weakened(thwartedToZero(runWave2(awoke.state, toHero(P2)), scheme), sleeper);
    expect(inst(ready, sleeper).engagedWith).toBe(P1);
    expectBothRemoved(attack(ready, P2, identityOf(ready, P2), sleeper), sleeper, scheme);
  });

  it("thwarted to 0 first, by an event's damage (Piercing Strike)", () => {
    const awoke = awake(2);
    const { sleeper, scheme } = awoke;
    const ready = weakened(thwartedToZero(runWave2(awoke.state, toHero(P2)), scheme), sleeper);
    const pickSleeper: Picker = (s) =>
      s.pendingChoice!.options.some((o) => o.optionId === sleeper) ? [sleeper] : firstLegal(s);
    const { state: after } = playFromHand(WAVE2_DEPS, ready, "04044", 2, pickSleeper, P2);
    expectBothRemoved(after, sleeper, scheme);
  });

  it("thwarted to 0 first, by an ally's basic attack (Black Knight)", () => {
    const { state, sleeper, scheme } = awake();
    const held = thwartedToZero(state, scheme);
    const { state: withAlly, id: knight } = playFromHand(WAVE2_DEPS, held, "04012", 3);
    expect(cardsInPlay(withAlly)).toContain(knight);
    const ready = weakened(withAlly, sleeper);
    expectBothRemoved(attack(ready, P1, knight, sleeper), sleeper, scheme);
  });

  it("once removed, The Sleeper Awakened does not come back over the rounds that follow", () => {
    const { state, sleeper, scheme } = awake();
    const ready = weakened(thwartedToZero(state, scheme), sleeper);
    let current = attack(ready, P1, identityOf(ready), sleeper);
    expectBothRemoved(current, sleeper, scheme);
    const sideSchemeDeck = () => {
      const pile = current.scenarioDecks["side-scheme deck"]!;
      return [...pile.deck, ...pile.discard];
    };
    const unrevealed = sideSchemeDeck();
    let rounds = 0;
    for (; rounds < 8 && !current.outcome; rounds++) {
      // Keep the hero standing and the main scheme short of its target, so the game runs on for every round.
      const healed = patchInstance(
        patchInstance(current, identityOf(current), { damage: 0 }),
        current.mainScheme.instanceId,
        { threat: 0 },
      );
      current = settle(runWave2(healed, endTurn()), firstLegal, undefined, WAVE2_DEPS);
      if (current.outcome) break;
      expectBothRemoved(current, sleeper, scheme);
      expect(instancesOf(current, "04140")).toEqual([scheme]);
    }
    // The side-scheme deck kept revealing other schemes while The Sleeper Awakened stayed out of the game.
    expect(rounds).toBeGreaterThanOrEqual(3);
    expect(unrevealed.some((id) => !sideSchemeDeck().includes(id))).toBe(true);
  });
});
