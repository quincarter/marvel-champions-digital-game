/**
 * docs/phase7-wave11-scenarios.md §S3.1: a main scheme per player, in their play area (Protection Racket 60134–60138).
 * Synthetic cards shaped like Battle in the Bodega and Hung Out to Dry: one stage each, target 10, acceleration 1,
 * and 1B's "If any main scheme is completed or any player is eliminated, the players lose the game." (the elimination
 * half as a `stateCheck`; the completion half is the RRG's own loss on a final stage).
 *
 * Sources: Protection Racket 1A Setup; MC60 p. 13 "Separate Main Schemes"; RRG 1.8 "Play Area" (p. 33), "Patrol"
 * (p. 32), "Acceleration Token" (p. 5), "Main Scheme" (p. 27), "Player Elimination" (p. 34).
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { attachmentHostCandidates } from "./attachment-hosts.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { thwartForbiddenOn } from "./resolve/event.js";
import { mainSchemesFor, playAreaHolding } from "./per-player-main-schemes.js";
import { MAIN_SCHEME_CHOICE, resolveRef, speakerOf } from "./select.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession, runCommands } from "./testing/drive.js";
import {
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, seatIdentities } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, minionEngagedWith, P1, P2, playFree } from "./testing/wave3.js";

const BOSS = stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 0, sch: 2 }] });

/** 1B: "If … any player is eliminated, the players lose the game." */
const ELIMINATION_LOSS = stubAbility("racket.elimination-loss", {
  trigger: { kind: "stateCheck", when: { kind: "anyPlayerEliminated" } },
  effects: [{ kind: "endGame", result: "loss", reason: "cardAbility" }],
});
const racket = (id: string) =>
  stubMainScheme({
    id,
    stages: [
      {
        startingThreat: flat(0),
        targetThreat: flat(10),
        acceleration: flat(1),
        abilities: [ELIMINATION_LOSS.ref],
      },
    ],
  });
const BODEGA = racket("bodega");
const LAUNDROMAT = racket("laundromat");
const PAWN_SHOP = racket("pawn-shop");
const RACKETS = [BODEGA, LAUNDROMAT, PAWN_SHOP];

const GRUNT = stubMinion({ id: "grunt", atk: 0, sch: 1, hp: 5, boostIcons: 0 });
const PATROLLER = stubMinion({ id: "patroller", atk: 0, sch: 0, hp: 5, boostIcons: 0, keywords: [{ name: "patrol" }] });
const RUSH = stubSideScheme({ id: "rush", startingThreat: 3, icons: ["acceleration"] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const STIRRED = stubTreachery({ id: "stirred", boostIcons: 0, keywords: [{ name: "incite", value: 1 }] });
const LOUD = stubSideScheme({ id: "loud", startingThreat: 0, boostIcons: 0, keywords: [{ name: "incite", value: 3 }] });

const playerEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Place 1 threat on the main scheme" on a player's event. */
const PLOT = playerEvent("plot", [
  { kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } },
]);
/** The encounter deck's reset, by hand: one acceleration token "on the main scheme". */
const TOKEN = playerEvent("token", [{ kind: "addAccelerationToken" }]);
const KILL_P2 = playerEvent("kill-p2", [
  {
    kind: "dealDamage",
    target: { kind: "identityOf", player: { kind: "id", playerId: P2 } },
    amount: { kind: "const", value: 50 },
  },
]);
const EVENTS = [PLOT, TOKEN, KILL_P2];

const deps: EngineDeps = depsOf(ELIMINATION_LOSS, ...EVENTS.map((event) => event.ability));

const IDENTITIES = seatIdentities(HERO, 2);

function config(over: Partial<GameSetupConfig> = {}): GameSetupConfig {
  return {
    seed: 23,
    cards: [
      ...DEFAULT_CARDS,
      BOSS,
      ...RACKETS,
      GRUNT,
      PATROLLER,
      RUSH,
      BLANK,
      STIRRED,
      LOUD,
      ...EVENTS.map((event) => event.card),
      ...IDENTITIES,
    ],
    villainCardId: BOSS.id,
    mainSchemeCardId: BODEGA.id,
    mainSchemeChoice: {
      kind: "perPlayer",
      cardIds: RACKETS.map((card) => card.id),
      picks: { [P1]: BODEGA.id, [P2]: LAUNDROMAT.id } as Record<PlayerId, CardId>,
    },
    encounterDeck: [...copiesOf(BLANK.id, 20), GRUNT.id, PATROLLER.id, RUSH.id],
    includeIdentitySets: false,
    players: IDENTITIES.map((identity) => ({
      identityCardId: identity.id,
      deck: [...DEFAULT_DECK, ...EVENTS.flatMap((event) => copiesOf(event.card.id, 2))],
    })),
    ...over,
  };
}

function start(over: Partial<GameSetupConfig> = {}) {
  const result = createGame(config(over), deps);
  if (!result.ok) throw new Error(result.error.message);
  const { session, events } = driveSession(startSession(result.state), deps);
  return { state: session.state, events: [...result.events, ...events] };
}

const schemeOf = (state: GameState, card: { readonly id: CardId }): InstanceId => {
  const found = [state.mainScheme, ...(state.extraMainSchemes ?? [])].find((scheme) => scheme.cardId === card.id);
  if (!found) throw new Error(`${card.id} is not in play`);
  return found.instanceId;
};
const threatOn = (state: GameState, card: { readonly id: CardId }): number =>
  mustInstance(state, schemeOf(state, card)).threat;
const withThreat = (state: GameState, card: { readonly id: CardId }, threat: number): GameState => {
  const id = schemeOf(state, card);
  return { ...state, instances: { ...state.instances, [id]: { ...mustInstance(state, id), threat } } };
};

/** Both players end their turns; the villain phase runs to the next player phase. */
function endRound(state: GameState) {
  return runCommands(state, deps, { type: "endTurn", playerId: P1 }, { type: "endTurn", playerId: P2 });
}

describe("§S3.1 setup: each player's main scheme in their play area", () => {
  it("each pick is in play in its player's play area, flipped to 1B, and the unused scheme is set aside", () => {
    const { state, events } = start();
    expect(state.mainScheme.cardId).toBe(BODEGA.id);
    expect(state.mainScheme.playArea).toBe(P1);
    expect(state.extraMainSchemes?.map((scheme) => [scheme.cardId, scheme.playArea])).toEqual([[LAUNDROMAT.id, P2]]);
    // Appendix II step 12b turned both to their B side (`faceupSide` gone).
    expect([state.mainScheme, ...(state.extraMainSchemes ?? [])].every((scheme) => !scheme.faceupSide)).toBe(true);
    const aside = state.encounterSetAside.filter((id) => mustInstance(state, id).cardId === PAWN_SHOP.id);
    expect(aside).toHaveLength(1);
    const chosen = events.find((event) => event.type === "mainSchemesChosen");
    expect(chosen).toMatchObject({
      picks: [
        { playerId: P1, cardId: BODEGA.id, random: false },
        { playerId: P2, cardId: LAUNDROMAT.id, random: false },
      ],
      setAside: aside,
    });
  });

  it("expert: with no picks each seat's scheme is drawn from the seed, distinct, and replays the same", () => {
    const random = { kind: "perPlayer" as const, cardIds: RACKETS.map((card) => card.id) };
    const first = start({ mainSchemeChoice: random, difficulty: "expert" });
    const again = start({ mainSchemeChoice: random, difficulty: "expert" });
    const picks = (state: GameState) => [state.mainScheme, ...(state.extraMainSchemes ?? [])].map((s) => s.cardId);
    expect(picks(first.state)).toEqual(picks(again.state));
    expect(new Set(picks(first.state)).size).toBe(2);
    const chosen = first.events.find((event) => event.type === "mainSchemesChosen");
    expect(chosen?.type === "mainSchemesChosen" && chosen.picks.every((pick) => pick.random)).toBe(true);
  });

  it("refuses a pick shared by two players, a seat with no pick, and a scheme deck of chosen stages", () => {
    const cardIds = RACKETS.map((card) => card.id);
    const twice = createGame(
      config({
        mainSchemeChoice: { kind: "perPlayer", cardIds, picks: { [P1]: BODEGA.id, [P2]: BODEGA.id } },
      }),
      deps,
    );
    expect(twice.ok).toBe(false);
    const missing = createGame(
      config({
        mainSchemeChoice: { kind: "perPlayer", cardIds, picks: { [P1]: BODEGA.id } as Record<PlayerId, CardId> },
      }),
      deps,
    );
    expect(missing.ok).toBe(false);
    expect(createGame(config({ mainSchemeStageIndexes: [0] }), deps).ok).toBe(false);
    // Standard mode: each player chooses, so no picks is refused rather than drawn.
    expect(createGame(config({ mainSchemeChoice: { kind: "perPlayer", cardIds } }), deps).ok).toBe(false);
  });
});

describe('§S3.1 "the main scheme" read by play area (MC60 p. 13)', () => {
  const read = (state: GameState, selfInstanceId: InstanceId | null, controllerId: PlayerId | null) =>
    [
      ...resolveRef(state, { kind: "mainScheme" }, { selfInstanceId, controllerId, event: null, bindings: {}, deps }),
    ].sort();

  it("a minion engaged with a player reads theirs; the villain, a side scheme and scenario text read every one", () => {
    const { state: started } = start();
    const engaged = minionEngagedWith(started, GRUNT.id, P2);
    const side = encounterCardInVillainArea(engaged.state, RUSH.id, 3);
    const state = side.state;
    const both = [schemeOf(state, BODEGA), schemeOf(state, LAUNDROMAT)].sort();
    expect(read(state, engaged.id, null)).toEqual([schemeOf(state, LAUNDROMAT)]);
    expect(read(state, mustPlayer(state, P1).identity.instanceId, P1)).toEqual([schemeOf(state, BODEGA)]);
    expect(read(state, state.activeVillainId, P1)).toEqual(both);
    expect(read(state, side.id, P2)).toEqual(both);
    expect(read(state, null, P1)).toEqual(both);
    // A card out of play (an encounter card in the discard pile still resolving) is read for its player.
    const discardId = state.encounterDecks[state.encounterDeckOrder[0]!]!.deck[0]!;
    expect(playAreaHolding(state, discardId)).toBe("outOfPlay");
    expect(mainSchemesFor(state, { selfInstanceId: discardId, controllerId: P2 })).toEqual([
      schemeOf(state, LAUNDROMAT),
    ]);
  });

  it("an event a player plays lands on their own scheme, with no choice of scheme asked", () => {
    const { state: started } = start();
    const { state, events } = playFree(started, deps, PLOT.card.id, P1);
    expect(threatOn(state, BODEGA)).toBe(1);
    expect(threatOn(state, LAUNDROMAT)).toBe(0);
    expect(events.some((event) => event.type === "targetChosen" && event.slot === MAIN_SCHEME_CHOICE)).toBe(false);
  });

  it("a scheme's 'you' and 'this play area' are its player's", () => {
    const { state } = start();
    expect(speakerOf(state, schemeOf(state, LAUNDROMAT))).toBe(P2);
    const inP2Area = resolveRef(
      state,
      { kind: "each", query: { categories: ["mainScheme"], inPlayAreaOf: { kind: "id", playerId: P2 } } },
      { selfInstanceId: null, controllerId: null, event: null, bindings: {}, deps },
    );
    expect(inP2Area).toEqual([schemeOf(state, LAUNDROMAT)]);
  });
});

describe("§S3.1 the villain phase with a main scheme per player", () => {
  it("step one adds acceleration, icons and the villain's tokens to each; the villain schemes on the activated player's", () => {
    const { state: started } = start();
    const side = encounterCardInVillainArea(started, RUSH.id, 3).state;
    const tokened = playFree(side, deps, TOKEN.card.id, P1).state;
    // MC60 p. 13: the token is "near the villain", not on any one scheme, with no scenario rule saying so.
    expect(mustInstance(tokened, tokened.activeVillainId).counters["acceleration"]).toBe(1);
    const { state, session } = endRound(tokened);
    // Acceleration 1 + the side scheme's icon 1 + the villain's token 1, on each; then the villain (SCH 2, both players
    // in alter-ego form) schemes once against each player, onto that player's own scheme.
    expect(threatOn(state, BODEGA)).toBe(3 + 2);
    expect(threatOn(state, LAUNDROMAT)).toBe(3 + 2);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("incite on a treachery a player reveals goes to their scheme; on a side scheme, to each (RRG 1.8 p. 24)", () => {
    const { state: treacheries } = endRound(start({ encounterDeck: copiesOf(STIRRED.id, 20) }).state);
    // Acceleration 1 + the villain's SCH 2 + the incite 1 of the one treachery each player revealed.
    expect(threatOn(treacheries, BODEGA)).toBe(1 + 2 + 1);
    expect(threatOn(treacheries, LAUNDROMAT)).toBe(1 + 2 + 1);
    const { state: schemes } = endRound(start({ encounterDeck: copiesOf(LOUD.id, 20) }).state);
    // Each player revealed one side scheme: both incites land on both main schemes.
    expect(schemes.outcome).toBeNull();
    expect(threatOn(schemes, BODEGA)).toBe(1 + 2 + 3 + 3);
    expect(threatOn(schemes, LAUNDROMAT)).toBe(1 + 2 + 3 + 3);
  });

  it("a token on a card in a player's play area still adds to each main scheme (MC60 p. 13)", () => {
    const { state: started } = start();
    const engaged = minionEngagedWith(started, GRUNT.id, P2);
    const tokened: GameState = {
      ...engaged.state,
      instances: {
        ...engaged.state.instances,
        [engaged.id]: { ...mustInstance(engaged.state, engaged.id), counters: { acceleration: 1 } },
      },
    };
    const { state } = endRound(tokened);
    // Acceleration 1 + the token 1 on each; the villain's 2 on each; the grunt's 1 on P2's.
    expect(threatOn(state, BODEGA)).toBe(1 + 1 + 2);
    expect(threatOn(state, LAUNDROMAT)).toBe(1 + 1 + 2 + 1);
  });

  it("a minion engaged with a player schemes onto that player's scheme only", () => {
    const { state: started } = start();
    const engaged = minionEngagedWith(started, GRUNT.id, P2).state;
    const { state } = endRound(engaged);
    expect(threatOn(state, BODEGA)).toBe(1 + 2);
    expect(threatOn(state, LAUNDROMAT)).toBe(1 + 2 + 1);
  });
});

describe("§S3.1 thwarting", () => {
  it("a basic thwart may target another player's scheme", () => {
    const { state: started } = start();
    const threatened = withThreat(started, LAUNDROMAT, 4);
    const { state } = runCommands(
      threatened,
      deps,
      { type: "changeForm", playerId: P1 },
      {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: mustPlayer(threatened, P1).identity.instanceId,
        schemeInstanceId: schemeOf(threatened, LAUNDROMAT),
      },
    );
    // The hero thwarts for its THW 2.
    expect(threatOn(state, LAUNDROMAT)).toBe(2);
  });

  it("patrol stops its engaged player thwarting their own scheme, not another player's (RRG 1.8 p. 32)", () => {
    const { state: started } = start();
    const state = minionEngagedWith(started, PATROLLER.id, P1).state;
    const thwart = { thwarterInstanceId: mustPlayer(state, P1).identity.instanceId, playerId: P1 };
    expect(thwartForbiddenOn(state, deps, thwart, schemeOf(state, BODEGA))).toBe("patrol");
    expect(thwartForbiddenOn(state, deps, thwart, schemeOf(state, LAUNDROMAT))).toBeNull();
  });
});

describe("§S3.1 losing", () => {
  it("any one main scheme completing loses the game, the second player's included", () => {
    const { state: started } = start();
    // Step one's 1 threat completes P2's scheme (target 10), not the central one beside it.
    const { state } = endRound(withThreat(started, LAUNDROMAT, 9));
    expect(threatOn(state, BODEGA)).toBeLessThan(10);
    expect(state.outcome).toMatchObject({ result: "loss", reason: "mainSchemeCompleted" });
  });

  it("a player eliminated loses the game, though another player is still in it", () => {
    const { state: started } = start();
    const { state } = playFree(started, deps, KILL_P2.card.id, P1);
    expect(mustPlayer(state, P2).eliminated).toBe(true);
    expect(state.outcome).toMatchObject({ result: "loss", reason: "cardAbility" });
  });
});

describe("§S3.1 attaching to the main scheme", () => {
  it("a treachery a player reveals attaches to the scheme in their play area", () => {
    const { state } = start();
    const discardId = state.encounterDecks[state.encounterDeckOrder[0]!]!.deck[0]!;
    const hosts = (playerId: PlayerId) =>
      attachmentHostCandidates(
        state,
        { kind: "mainScheme" },
        { selfInstanceId: discardId, controllerId: playerId, event: null, bindings: {}, deps },
      );
    expect(hosts(P2)).toEqual([schemeOf(state, LAUNDROMAT)]);
    expect(hosts(P1)).toEqual([schemeOf(state, BODEGA)]);
  });
});
