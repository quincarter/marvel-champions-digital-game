/**
 * QA of The Sleeper Awakened (04140, issue #130, PR #131) beyond the one path the fix's own tests cover.
 *
 * Printed text: "This scheme cannot leave play while The Sleeper is in play. When Revealed: Put The Sleeper into play
 * engaged with the first player. When The Sleeper is defeated, remove this card from the game."
 * Sources: RRG 1.8 "'Cannot'" p. 11 (a "cannot" is absolute); Golden Rules p. 4 (card text over the rules); older FFG
 * ruling (Caleb, Rise of Red Skull): "that side scheme cannot be defeated. It can only be removed from play". So the
 * "Side Scheme" rule (a scheme with 0 threat is defeated) never takes it, even once The Sleeper is gone (issue #405).
 */
import { cardsInPlay, type GameState, type InstanceId } from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  P2,
  patchInstance,
  settle,
  toHero,
} from "../../testing/harness.js";
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
