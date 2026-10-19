/**
 * docs/phase7-wave11-scenarios.md §S3.2: swapping a main scheme with a set-aside one, carrying its threat. Change of
 * Venue (`fne` 60141), When Revealed: "Swap your main scheme with a random set-aside main scheme. Place the threat from
 * the previous scheme on the new scheme." MC60 p. 26 FAQ: "All cards attached to the previous main scheme are
 * discarded." Synthetic Protection Racket schemes, as `per-player-main-schemes.test.ts` builds them.
 *
 * Sources: RRG 1.8 "'Swap'" (p. 42), "Attack (Enemy Activation)" (p. 8: a Boost ability's "you"), "Main Scheme"
 * (p. 27); MC60 p. 13 "Separate Main Schemes".
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "../abilities.js";
import { replay, startSession } from "../engine.js";
import type { GameEvent } from "../events.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { mustInstance } from "../query.js";
import { resolveRef } from "../select.js";
import { createGame, type GameSetupConfig } from "../setup.js";
import type { EffectSpec } from "../spec.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { driveSession, runCommands } from "../testing/drive.js";
import {
  stubAttachment,
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubTreachery,
  stubVillain,
} from "../testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, seatIdentities } from "../testing/scenario.js";
import { copiesOf, minionEngagedWith, P1, P2, playFree } from "../testing/wave3.js";

const BOSS = stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 0, sch: 2 }] });

const racket = (id: string, target = 10) =>
  stubMainScheme({
    id,
    stages: [{ startingThreat: flat(0), targetThreat: flat(target), acceleration: flat(1) }],
  });
const BODEGA = racket("bodega");
const LAUNDROMAT = racket("laundromat");
const PAWN_SHOP = racket("pawn-shop");
/** A set-aside scheme with a low target, to show the placed threat can complete it. */
const CHOP_SHOP = racket("chop-shop", 4);
const RACKETS = [BODEGA, LAUNDROMAT, PAWN_SHOP];

/** Change of Venue's When Revealed, as `@mc/cards` writes it (`selectCards`, then `swapMainScheme`). */
const VENUE_EFFECTS: readonly EffectSpec[] = [
  {
    kind: "selectCards",
    slot: "venue",
    cards: { kind: "encounterSetAside", filter: { categories: ["mainScheme"] }, random: { kind: "const", value: 1 } },
  },
  {
    kind: "swapCards",
    a: { kind: "mainScheme", of: "yours" },
    b: { kind: "slot", slot: "venue" },
    placePreviousThreat: true,
  },
];
const VENUE_REVEALED = stubAbility("venue.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: VENUE_EFFECTS,
});
const VENUE_BOOST = stubAbility("venue.boost", { trigger: { kind: "boost" }, effects: VENUE_EFFECTS });
const VENUE = stubTreachery({ id: "venue", boostIcons: 0, abilities: [VENUE_REVEALED.ref, VENUE_BOOST.ref] });
/** The same text on a player's event, to drive it from the player phase. */
const VENUE_ACTION = stubAbility("venue-event.action", { trigger: { kind: "action" }, effects: VENUE_EFFECTS });
const VENUE_EVENT = stubEvent({ id: "venue-event", cost: 0, abilities: [VENUE_ACTION.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const LOCK = stubAttachment({ id: "lock", attachesTo: { kind: "mainScheme" } });
/** "Forced Interrupt: When this card leaves play, place 2 threat on the attached scheme." */
const TRIPWIRE_LEAVES = stubAbility("tripwire.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [{ kind: "placeThreat", target: { kind: "host" }, amount: { kind: "const", value: 2 } }],
});
const TRIPWIRE = stubAttachment({
  id: "tripwire",
  attachesTo: { kind: "mainScheme" },
  abilities: [TRIPWIRE_LEAVES.ref],
});

/** "Forced Response: After a minion is defeated, place 1 threat here." on 1B, for the entered-since test. */
const WATCHFUL = stubAbility("watchful.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "characterDefeated", targetIs: { categories: ["minion"] } } },
  effects: [{ kind: "placeThreat", target: { kind: "self" }, amount: { kind: "const", value: 1 } }],
});
const watchful = (id: string) =>
  stubMainScheme({
    id,
    stages: [{ startingThreat: flat(0), targetThreat: flat(10), acceleration: flat(1), abilities: [WATCHFUL.ref] }],
  });
const WATCH_LAUNDROMAT = watchful("watch-laundromat");
const WATCH_PAWN_SHOP = watchful("watch-pawn-shop");

/**
 * The minion's own "When Defeated: swap your main scheme …": When Defeated abilities resolve before the defeat's
 * responses (RRG 1.8 "When Defeated", p. 48), so the swap happens while that defeat's response window is still to come.
 */
const SWAP_ON_DEFEAT = stubAbility("swap-on-defeat.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: VENUE_EFFECTS,
});
const GRUNT = stubMinion({ id: "grunt", atk: 0, sch: 0, hp: 1, boostIcons: 0, abilities: [SWAP_ON_DEFEAT.ref] });
const KILL = stubAbility("kill.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "each", query: { categories: ["minion"] } },
      amount: { kind: "const", value: 5 },
    },
  ],
});
const KILL_EVENT = stubEvent({ id: "kill", cost: 0, abilities: [KILL.ref] });

const deps: EngineDeps = depsOf(
  VENUE_REVEALED,
  VENUE_BOOST,
  VENUE_ACTION,
  TRIPWIRE_LEAVES,
  WATCHFUL,
  SWAP_ON_DEFEAT,
  KILL,
);
const IDENTITIES = seatIdentities(HERO, 2);

function config(over: Partial<GameSetupConfig> = {}): GameSetupConfig {
  return {
    seed: 31,
    cards: [
      ...DEFAULT_CARDS,
      BOSS,
      ...RACKETS,
      CHOP_SHOP,
      VENUE,
      VENUE_EVENT,
      BLANK,
      LOCK,
      TRIPWIRE,
      WATCH_LAUNDROMAT,
      WATCH_PAWN_SHOP,
      GRUNT,
      KILL_EVENT,
      ...IDENTITIES,
    ],
    villainCardId: BOSS.id,
    mainSchemeCardId: BODEGA.id,
    mainSchemeChoice: {
      kind: "perPlayer",
      cardIds: RACKETS.map((card) => card.id),
      picks: { [P1]: BODEGA.id, [P2]: LAUNDROMAT.id } as Record<PlayerId, CardId>,
    },
    encounterDeck: [...copiesOf(BLANK.id, 20), LOCK.id, TRIPWIRE.id, GRUNT.id],
    includeIdentitySets: false,
    players: IDENTITIES.map((identity) => ({
      identityCardId: identity.id,
      deck: [...DEFAULT_DECK, ...copiesOf(VENUE_EVENT.id, 2), KILL_EVENT.id],
    })),
    ...over,
  };
}

function start(over: Partial<GameSetupConfig> = {}) {
  const result = createGame(config(over), deps);
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}

const schemes = (state: GameState) => [state.mainScheme, ...(state.extraMainSchemes ?? [])];
const schemeOf = (state: GameState, card: { readonly id: CardId }): InstanceId => {
  const found = schemes(state).find((scheme) => scheme.cardId === card.id);
  if (!found) throw new Error(`${card.id} is not in play`);
  return found.instanceId;
};
const setAsideCards = (state: GameState): readonly CardId[] =>
  state.encounterSetAside.map((id) => mustInstance(state, id).cardId);
const withThreat = (state: GameState, card: { readonly id: CardId }, threat: number): GameState => {
  const id = schemeOf(state, card);
  return { ...state, instances: { ...state.instances, [id]: { ...mustInstance(state, id), threat } } };
};
/** Moves the encounter deck's `attachment` onto `card`'s scheme, as its own When Revealed would have attached it. */
function lockOn(
  state: GameState,
  card: { readonly id: CardId },
  attachment: { readonly id: CardId } = LOCK,
): { readonly state: GameState; readonly id: InstanceId } {
  const host = schemeOf(state, card);
  const deckId = state.encounterDeckOrder[0]!;
  const piles = state.encounterDecks[deckId]!;
  const id = piles.deck.find((candidate) => mustInstance(state, candidate).cardId === attachment.id)!;
  return {
    id,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((x) => x !== id) } },
      instances: {
        ...state.instances,
        [id]: { ...mustInstance(state, id), attachedTo: host, faceup: true },
        [host]: { ...mustInstance(state, host), attachments: [...mustInstance(state, host).attachments, id] },
      },
    },
  };
}
const swapsIn = (events: readonly GameEvent[]) => events.filter((event) => event.type === "mainSchemeSwapped");

describe("§S3.2 swapping your main scheme with a set-aside one", () => {
  it("the set-aside scheme takes your slot and play area at 1B with your threat; the old one is set aside", () => {
    const started = withThreat(start(), BODEGA, 4);
    const oldId = schemeOf(started, BODEGA);
    const asideId = started.encounterSetAside.find((id) => mustInstance(started, id).cardId === PAWN_SHOP.id)!;
    const { state, events, session } = playFree(started, deps, VENUE_EVENT.id, P1);

    expect(state.mainScheme).toEqual({
      instanceId: asideId,
      cardId: PAWN_SHOP.id,
      stageIndex: 0,
      completed: false,
      accelerationTokens: 0,
      playArea: P1,
    });
    expect(mustInstance(state, asideId).threat).toBe(4);
    // The other player's scheme is not theirs to swap.
    expect(schemes(state).map((scheme) => [scheme.cardId, scheme.playArea])).toEqual([
      [PAWN_SHOP.id, P1],
      [LAUNDROMAT.id, P2],
    ]);
    expect(setAsideCards(state)).toContain(BODEGA.id);
    expect(setAsideCards(state)).not.toContain(PAWN_SHOP.id);
    expect(mustInstance(state, oldId).threat).toBe(0);
    expect(swapsIn(events)).toEqual([
      {
        type: "mainSchemeSwapped",
        outgoing: oldId,
        incoming: asideId,
        cardIds: [BODEGA.id, PAWN_SHOP.id],
        playArea: P1,
        threat: 4,
      },
    ]);
    // Placed, not moved: the ordinary threat placement on the new scheme.
    expect(events).toContainEqual(
      expect.objectContaining({ type: "threatPlaced", schemeInstanceId: asideId, amount: 4 }),
    );
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("the cards attached to the previous scheme are discarded (MC60 p. 26 FAQ)", () => {
    const locked = lockOn(withThreat(start(), BODEGA, 2), BODEGA);
    const { state } = playFree(locked.state, deps, VENUE_EVENT.id, P1);
    const deckId = state.encounterDeckOrder[0]!;
    expect(state.encounterDecks[deckId]!.discard).toContain(locked.id);
    expect(mustInstance(state, locked.id).attachedTo).toBeNull();
    expect(mustInstance(state, schemeOf(state, PAWN_SHOP)).attachments).toEqual([]);
  });

  it("an attachment's 'when this leaves play' interrupt resolves first, on the old scheme still in play", () => {
    const wired = lockOn(withThreat(start(), BODEGA, 1), BODEGA, TRIPWIRE);
    const { state, events, session } = playFree(wired.state, deps, VENUE_EVENT.id, P1);
    // The interrupt's 2 threat lands on the Bodega before the swap reads its threat: 1 + 2 go to the Pawn Shop.
    expect(swapsIn(events)).toMatchObject([{ cardIds: [BODEGA.id, PAWN_SHOP.id], threat: 3 }]);
    expect(mustInstance(state, schemeOf(state, PAWN_SHOP)).threat).toBe(3);
    expect(state.encounterDecks[state.encounterDeckOrder[0]!]!.discard).toContain(wired.id);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("the swapped-in scheme does not answer a defeat that occurred before it entered play (RRG 1.8 p. 45)", () => {
    const started = start({
      mainSchemeChoice: {
        kind: "perPlayer",
        cardIds: [BODEGA.id, WATCH_LAUNDROMAT.id, WATCH_PAWN_SHOP.id],
        picks: { [P1]: BODEGA.id, [P2]: WATCH_LAUNDROMAT.id } as Record<PlayerId, CardId>,
      },
    });
    const engaged = minionEngagedWith(started, GRUNT.id, P1);
    const { state, events } = playFree(engaged.state, deps, KILL_EVENT.id, P1);
    expect(events).toContainEqual(expect.objectContaining({ type: "characterDefeated", instanceId: engaged.id }));
    expect(state.mainScheme.cardId).toBe(WATCH_PAWN_SHOP.id);
    // The Laundromat was in play when the minion was defeated and answers it; the Pawn Shop, swapped in by the
    // minion's When Defeated, entered play after the defeat and does not.
    expect(mustInstance(state, schemeOf(state, WATCH_LAUNDROMAT)).threat).toBe(1);
    expect(mustInstance(state, schemeOf(state, WATCH_PAWN_SHOP)).threat).toBe(0);
  });

  it("the old scheme is a new copy: its ability uses and the lasting effects naming it are gone (RRG 1.8 p. 26)", () => {
    const started = start();
    const oldId = schemeOf(started, BODEGA);
    const otherId = schemeOf(started, LAUNDROMAT);
    const blank = (id: string, targets: readonly InstanceId[]) => ({
      kind: "blankTextBox" as const,
      targets,
      id,
      duration: { kind: "endOfRound" as const },
    });
    const marked: GameState = {
      ...started,
      abilityUses: { ...started.abilityUses, [`${oldId}:some.ability`]: 1, [`${otherId}:some.ability`]: 1 },
      lastingEffects: [...started.lastingEffects, blank("only-old", [oldId]), blank("both", [oldId, otherId])],
    };
    const { state, events } = playFree(marked, deps, VENUE_EVENT.id, P1);
    expect(Object.keys(state.abilityUses)).not.toContain(`${oldId}:some.ability`);
    expect(state.abilityUses[`${otherId}:some.ability`]).toBe(1);
    expect(state.lastingEffects.find((effect) => effect.id === "only-old")).toBeUndefined();
    expect(state.lastingEffects.find((effect) => effect.id === "both")).toMatchObject({ targets: [otherId] });
    expect(events).toContainEqual({ type: "lastingEffectEnded", id: "only-old", reason: "targetLeftPlay" });
  });

  it("the threat placed can complete the new scheme, which loses the game", () => {
    const started = withThreat(
      start({
        mainSchemeChoice: {
          kind: "perPlayer",
          cardIds: [BODEGA.id, LAUNDROMAT.id, CHOP_SHOP.id],
          picks: { [P1]: BODEGA.id, [P2]: LAUNDROMAT.id } as Record<PlayerId, CardId>,
        },
      }),
      BODEGA,
      5,
    );
    const { state } = playFree(started, deps, VENUE_EVENT.id, P1);
    expect(state.mainScheme.cardId).toBe(CHOP_SHOP.id);
    expect(state.outcome).toMatchObject({ result: "loss", reason: "mainSchemeCompleted" });
  });

  it("with no set-aside main scheme the swap cannot be completed and no threat is placed (RRG 1.8 p. 42)", () => {
    const started = withThreat(
      start({
        mainSchemeChoice: {
          kind: "perPlayer",
          cardIds: [BODEGA.id, LAUNDROMAT.id],
          picks: { [P1]: BODEGA.id, [P2]: LAUNDROMAT.id } as Record<PlayerId, CardId>,
        },
      }),
      BODEGA,
      3,
    );
    const { state, events } = playFree(started, deps, VENUE_EVENT.id, P1);
    expect(swapsIn(events)).toEqual([]);
    expect(events).toContainEqual(expect.objectContaining({ type: "swapRefused", reason: "missingCard" }));
    expect(mustInstance(state, schemeOf(state, BODEGA)).threat).toBe(3);
  });

  it("in the villain phase: a Boost swaps the schemed-against player's, a reveal the revealing player's", () => {
    // Every encounter card is Change of Venue: the villain's boost card when it schemes against each player (both in
    // alter-ego form), then each player's revealed card.
    const { state, events } = runCommands(
      start({ encounterDeck: copiesOf(VENUE.id, 20) }),
      deps,
      { type: "endTurn", playerId: P1 },
      { type: "endTurn", playerId: P2 },
    );
    const swaps = swapsIn(events);
    expect(
      swaps.map((swap) => swap.type === "mainSchemeSwapped" && [...swap.cardIds, swap.playArea, swap.threat]),
    ).toEqual([
      // P1's boost: step one's acceleration 1 carried over.
      [BODEGA.id, PAWN_SHOP.id, P1, 1],
      // P2's boost takes the Bodega P1 just set aside.
      [LAUNDROMAT.id, BODEGA.id, P2, 1],
      // The reveals: the villain's SCH 2 was placed on the swapped-in scheme, and travels on.
      [PAWN_SHOP.id, LAUNDROMAT.id, P1, 3],
      [BODEGA.id, PAWN_SHOP.id, P2, 3],
    ]);
    // The villain's scheme (SCH 2) after its boost card's swap lands on the scheme now in that player's play area.
    const first = swaps[0];
    const villainThreat = events.find(
      (event) => event.type === "threatPlaced" && event.sourceInstanceId === state.activeVillainId,
    );
    expect(first?.type === "mainSchemeSwapped" && villainThreat).toMatchObject({
      schemeInstanceId: first?.type === "mainSchemeSwapped" ? first.incoming : null,
      amount: 2,
    });
    expect(schemes(state).map((scheme) => [scheme.cardId, scheme.playArea])).toEqual([
      [LAUNDROMAT.id, P1],
      [PAWN_SHOP.id, P2],
    ]);
    expect(setAsideCards(state)).toEqual([BODEGA.id]);
    expect(mustInstance(state, schemeOf(state, LAUNDROMAT)).threat).toBe(3);
    expect(mustInstance(state, schemeOf(state, PAWN_SHOP)).threat).toBe(3);
  });
});

describe('§S3.2 "your main scheme"', () => {
  it("from a card on the villain (a Boost ability) is the one in your play area, not every one", () => {
    const state = start();
    const read = (of: "yours" | undefined, controllerId: PlayerId) =>
      resolveRef(
        state,
        { kind: "mainScheme", ...(of ? { of } : {}) },
        { selfInstanceId: state.activeVillainId, controllerId, event: null, bindings: {}, deps },
      );
    expect(read("yours", P2)).toEqual([schemeOf(state, LAUNDROMAT)]);
    expect(read("yours", P1)).toEqual([schemeOf(state, BODEGA)]);
    expect([...read(undefined, P2)].sort()).toEqual([schemeOf(state, BODEGA), schemeOf(state, LAUNDROMAT)].sort());
  });
});
