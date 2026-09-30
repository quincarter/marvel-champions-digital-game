import { cardId, encounterSetId } from "@mc/content";
import {
  cardOf,
  characterProfile,
  handSize,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  P2,
  patchInstance,
  payWith,
  picking,
  play,
  playerOf,
  run,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
} from "../../../testing/harness.js";
import { driveEvents, driveEventsPicking, encounterCardInVillainArea } from "../../../testing/staging.js";
import { startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario, ghostSpiderScenarioWithExtras } from "../ghost-spider/support.js";

const mysterioGame = () =>
  startWave5Game(ghostSpiderScenario("mysterio", { seed: 1, modularSetIds: [encounterSetId("bomb_scare")] }));

/**
 * How many cards `player` held in hand right when `revealedCardId` was revealed: the initial hand, adjusted for
 * every `cardDrawn`/`cardDiscardedFromHand`/hand-leaving `cardMoved` event strictly before its own
 * `encounterCardRevealed`. Ghost-Spider's own kit (27006, a card that discards itself early in the round) changes
 * her hand between game start and the villain phase's own reveal step, so "the number of cards in your hand" for
 * Weakness from Within/Deepest Fears has to be read at the reveal, not at the start of the round.
 */
function handCountAtReveal(
  handBefore: number,
  events: readonly GameEvent[],
  player: string,
  revealedCardId: string,
): number {
  const revealIndex = events.findIndex(
    (e) => e.type === "encounterCardRevealed" && e.instanceId === revealedCardId && e.playerId === player,
  );
  if (revealIndex < 0) throw new Error(`${revealedCardId} was never revealed to ${player}`);
  let count = handBefore;
  for (const event of events.slice(0, revealIndex)) {
    if (event.type === "cardDrawn" && event.playerId === player) count += 1;
    else if (event.type === "cardDiscardedFromHand" && event.playerId === player) count -= 1;
    else if (
      event.type === "cardMoved" &&
      event.from.kind === "hand" &&
      event.from.playerId === player &&
      event.to.kind !== "discard"
    ) {
      count -= 1;
    }
  }
  return count;
}

/** Test surgery: Evil Doppelgänger out of the encounter deck, into `player`'s play area, engaged with them. */
function engagedDoppelganger(state: GameState, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const { state: staged, id } = encounterCardInVillainArea(state, "27154");
  return {
    id,
    state: {
      ...staged,
      villainArea: staged.villainArea.filter((i) => i !== id),
      players: staged.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...staged.instances, [id]: { ...staged.instances[id]!, engagedWith: player } },
    },
  };
}
const isIdentitySpecific = (state: GameState, id: InstanceId): boolean => {
  const card = cardOf(state, id);
  return card !== undefined && "aspect" in card && String(card.aspect).startsWith("hero:");
};
/** Test surgery: `player`'s hand becomes `identitySpecific` of their identity-specific cards plus `other` others. */
function handOf(state: GameState, player: PlayerId, identitySpecific: number, other: number): GameState {
  const seat = playerOf(state, player);
  const pool = [...seat.hand, ...seat.deck];
  const mine = pool.filter((id) => isIdentitySpecific(state, id)).slice(0, identitySpecific);
  const rest = pool.filter((id) => !isIdentitySpecific(state, id)).slice(0, other);
  if (mine.length < identitySpecific || rest.length < other) throw new Error(`${player} lacks the cards to stage`);
  const hand = [...mine, ...rest];
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, hand, deck: pool.filter((id) => !hand.includes(id)) } : p,
    ),
  };
}
const statsOf = (state: GameState, id: InstanceId) => {
  const profile = characterProfile(state, id, WAVE5_DEPS)!;
  return { atk: profile.atk, sch: profile.sch };
};

describe("Evil Doppelgänger (27154)", () => {
  it("27154.evil-doppelganger-constant: +X SCH and +X ATK, X the identity-specific cards in the engaged player's hand", () => {
    const { state, id } = engagedDoppelganger(mysterioGame());
    expect(cardOf(state, id)?.id).toBe(cardId("27154"));
    // Printed 1 ATK / 1 SCH; non-identity-specific cards never count.
    expect(statsOf(handOf(state, P1, 0, 5), id)).toEqual({ atk: 1, sch: 1 });
    expect(statsOf(handOf(state, P1, 1, 4), id)).toEqual({ atk: 2, sch: 2 });
    // Read live: the same minion rises and falls as identity-specific cards enter and leave the hand.
    expect(statsOf(handOf(state, P1, 3, 2), id)).toEqual({ atk: 4, sch: 4 });
    expect(statsOf(handOf(state, P1, 2, 0), id)).toEqual({ atk: 3, sch: 3 });
  });

  it("reads only the engaged player's hand in a 2-player game", () => {
    const twoPlayer = startWave5Game(
      ghostSpiderScenario("mysterio", {
        seed: 1,
        modularSetIds: [encounterSetId("bomb_scare")],
        extraPlayers: [{ starterDeckId: "spider-man-morales" }],
      }),
    );
    const { state, id } = engagedDoppelganger(handOf(handOf(twoPlayer, P1, 1, 3), P2, 4, 1));
    expect(statsOf(state, id)).toEqual({ atk: 2, sch: 2 });
    const onP2 = engagedDoppelganger(handOf(handOf(twoPlayer, P1, 1, 3), P2, 4, 1), P2);
    expect(statsOf(onP2.state, onP2.id)).toEqual({ atk: 5, sch: 5 });
  });

  it("engaged with no one, there is no engaged player's hand, so it has its printed stats", () => {
    const { state, id } = engagedDoppelganger(handOf(mysterioGame(), P1, 3, 0));
    expect(statsOf(state, id)).toEqual({ atk: 4, sch: 4 });
    const unengaged = {
      ...state,
      instances: { ...state.instances, [id]: { ...state.instances[id]!, engagedWith: null } },
    };
    expect(statsOf(unengaged, id)).toEqual({ atk: 1, sch: 1 });
  });
});

describe("Fool's Paradise (27155)", () => {
  it("27155.fools-paradise-constant: each identity gets +2 hand size", () => {
    const state = mysterioGame();
    const before = handSize(state, P1, WAVE5_DEPS);
    const { state: withCard } = encounterCardInVillainArea(state, "27155");
    expect(handSize(withCard, P1, WAVE5_DEPS)).toBe(before + 2);
  });
});

describe("Weakness from Within (27156)", () => {
  it("27156.when-revealed: places 1 additional threat here for each card in your hand", () => {
    const state = mysterioGame();
    const handBefore = playerOf(state, P1).hand.length;
    const stacked = stackEncounterDeck(state, "01186", "27156");
    const { state: after, events } = driveEvents(WAVE5_DEPS, stacked, toHero(P1), endTurn(P1));
    const card = instancesOf(after, "27156")[0]!;
    const handCount = handCountAtReveal(handBefore, events, P1, card);
    expect(inst(after, card).threat).toBe(1 + handCount); // 1 startingThreat (data) + 1 per hand card
  });
});

describe("Deepest Fears (27157)", () => {
  it("27157.when-revealed: discards cards from the top of your deck equal to your hand size; identity-specific discard places threat, otherwise you take damage", () => {
    const state = mysterioGame();
    const handBefore = playerOf(state, P1).hand.length;
    const deckBefore = playerOf(state, P1).deck.length;
    const stacked = stackEncounterDeck(state, "01186", "27157");
    const { state: after, events } = driveEvents(WAVE5_DEPS, stacked, toHero(P1), endTurn(P1));
    // Deepest Fears prints 2 copies (quantityInSet): the one this round actually reveals, not necessarily
    // `instancesOf`'s own first hit.
    const revealed = events.find(
      (e) => e.type === "encounterCardRevealed" && e.cardId === "27157" && e.playerId === P1,
    );
    if (revealed?.type !== "encounterCardRevealed") throw new Error("Deepest Fears was never revealed");
    const card = revealed.instanceId;
    const handCount = handCountAtReveal(handBefore, events, P1, card);
    expect(playerOf(after, P1).deck.length).toBe(deckBefore - handCount);
    const placedThreat = events.some((e) => e.type === "threatPlaced" && e.sourceInstanceId === card);
    const tookDamage = events.some((e) => e.type === "damageDealt" && e.sourceInstanceId === card);
    // Exactly one of the two printed branches fires, depending on whether an identity-specific card was among the
    // discards (Ghost-Spider's own precon carries several, so this is not a coin flip in practice, but either
    // outcome is a legal reveal).
    expect(placedThreat).not.toBe(tookDamage);
  });
});

/** Test surgery: Induced Panic out of the encounter deck, attached to `player`'s identity. */
function inducedPanicAttached(state: GameState, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const { state: staged, id } = encounterCardInVillainArea(state, "27153");
  const identity = identityOf(staged, player);
  return {
    id,
    state: {
      ...staged,
      villainArea: staged.villainArea.filter((i) => i !== id),
      instances: {
        ...staged.instances,
        [id]: { ...staged.instances[id]!, attachedTo: identity },
        [identity]: { ...staged.instances[identity]!, attachments: [...staged.instances[identity]!.attachments, id] },
      },
    },
  };
}

describe("Induced Panic (27153)", () => {
  /**
   * Ghost-Spider's hero face prints "Response: After you resolve an 'Interrupt' or 'Response' ability on an event,
   * ready Ghost-Spider." (27001a, Dizzying Reflexes). Backflip (01003, "Hero Interrupt: When you would take damage
   * from an attack, prevent all of that damage") gives it an Interrupt on an event to hear when Mysterio attacks, the
   * `ghost-spider/identity.test.ts` flow; read from the event log, since Mysterio's own encounter cards also
   * damage and exhaust her.
   */
  function backflipThenReflexes(panic: boolean) {
    const base = startWave5Game(
      ghostSpiderScenarioWithExtras("mysterio", {
        seed: 1,
        extraCodes: ["01003"],
        modularSetIds: [encounterSetId("bomb_scare")],
      }),
    );
    const staged = panic ? inducedPanicAttached(base).state : base;
    const given = moveToHand(staged, P1, "01003");
    const [backflip] = given.ids as [never];
    const { events } = driveEventsPicking(
      WAVE5_DEPS,
      run(given.state, toHero(P1)),
      (s) => {
        const prompt = s.pendingChoice?.prompt;
        if (prompt?.kind === "payForCard" && prompt.instanceId === backflip) return [];
        return picking(`${backflip}:01003.backflip-interrupt`, `${identityOf(s, P1)}:${REFLEXES}`)(s);
      },
      endTurn(P1),
    );
    const resolved = (ability: string) =>
      events.some((e) => e.type === "abilityResolved" && String(e.abilityId) === ability);
    const offered = events.some(
      (e) => e.type === "windowOpened" && e.candidates.some((c) => String(c.abilityId) === REFLEXES),
    );
    return { backflipResolved: resolved("01003.backflip-interrupt"), reflexesResolved: resolved(REFLEXES), offered };
  }
  const REFLEXES = "27001a.ghost-spider-constant";

  it("27153.induced-panic-constant: a Response in the hero's printed text box is not offered while attached", () => {
    expect(backflipThenReflexes(false)).toEqual({ backflipResolved: true, reflexesResolved: true, offered: true });
    // Backflip is an event from hand, not the hero's text box: it still resolves. Dizzying Reflexes is never offered.
    expect(backflipThenReflexes(true)).toEqual({ backflipResolved: true, reflexesResolved: false, offered: false });
  });

  it("27153.induced-panic-constant: the alter-ego's own triggered abilities stay usable", () => {
    const given = moveToHand(mysterioGame(), P1, "27007"); // George Stacy.
    const [stacy] = given.ids as [never];
    const withStacy = run(given.state, play(P1, stacy, payWith(given.state, P1, 1, given.ids)));
    const { state } = inducedPanicAttached(patchInstance(withStacy, stacy, { exhausted: true }));
    const identity = identityOf(state, P1);
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    const after = settle(
      runWith(WAVE5_DEPS, state, use(P1, identity, "27001b.gwen-stacy-action")),
      picking("1"), // "Ready George Stacy".
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, stacy).exhausted).toBe(false);
  });

  it("27153.induced-panic-action: discards exactly 1 identity-specific card at random from hand, then this card", () => {
    // One identity-specific card among five: an unfiltered random pick would usually miss it.
    const { state, id } = inducedPanicAttached(handOf(mysterioGame(), P1, 1, 4));
    const identity = identityOf(state, P1);
    const hand = playerOf(state, P1).hand;
    const after = settle(
      runWith(WAVE5_DEPS, state, use(P1, id, "27153.induced-panic-action")),
      undefined,
      undefined,
      WAVE5_DEPS,
    );
    const left = hand.filter((c) => !playerOf(after, P1).hand.includes(c));
    expect(left).toHaveLength(1);
    expect(isIdentitySpecific(state, left[0]!)).toBe(true);
    expect(playerOf(after, P1).discard).toContain(left[0]);
    // Induced Panic left the identity for the encounter discard pile.
    expect(inst(after, identity).attachments).not.toContain(id);
    const discards = Object.values(after.encounterDecks).flatMap((pile) => pile.discard);
    expect(discards).toContain(id);
  });

  it("27153.induced-panic-action: cannot be used with no identity-specific card in hand", () => {
    const { state, id } = inducedPanicAttached(handOf(mysterioGame(), P1, 0, 5));
    expect(() => runWith(WAVE5_DEPS, state, use(P1, id, "27153.induced-panic-action"))).toThrow();
    expect(playerOf(state, P1).hand).toHaveLength(5);
  });
});
