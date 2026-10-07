/**
 * "You" in a constant ability on a card no player controls, where the rules name who it is:
 * - RRG 1.8 "Attachment" (p. 8): "When an attachment attached to a player card uses the word 'you' or 'your,' it
 *   refers to the attached player card's controller."
 * - RRG 1.8 "Obligation" (p. 30): "Abilities on obligations that use the words 'you' or 'your' apply only to the
 *   player whose play area the obligation is in."
 *
 * Read here by a cost modifier ("increase the resource cost of each ally you play by 2"), a `cannotReady` rule
 * ("allies you control cannot ready"), an `entersPlayExhausted` rule, a keyword grant and a trait grant. Two players,
 * the encounter card speaking to P2 only. Synthetic cards.
 */

import { trait, type AnyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { playCostContributions } from "./actions.js";
import type { InstanceId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { activeEncounterDeckId, activeVillain, mustInstance, mustPlayer } from "./query.js";
import { cannotReady, entersPlayExhausted } from "./rules.js";
import { traitsOf } from "./select.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubAttachment, stubObligation } from "./testing/fixtures.js";
import { giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const MARKED = trait("Marked");
const YOUR_ALLIES: TargetQuery = { categories: ["ally"], controller: "you" };
const constant = (id: string, trigger: Omit<Extract<AbilityDefinition["trigger"], { kind: "constant" }>, "kind">) =>
  stubAbility(id, { trigger: { kind: "constant", ...trigger }, effects: [] });

const COST = constant("yours.cost", { costModifiers: [{ delta: 2, appliesTo: YOUR_ALLIES }] });
const NO_READY = constant("yours.no-ready", { rules: [{ kind: "cannotReady", target: YOUR_ALLIES }] });
const EXHAUSTED = constant("yours.exhausted", { rules: [{ kind: "entersPlayExhausted", target: YOUR_ALLIES }] });
const GUARDS = constant("yours.guards", { keywordGrants: [{ keyword: { name: "guard" }, target: YOUR_ALLIES }] });
const MARKS = constant("yours.marks", { traitGrants: [{ trait: MARKED, target: YOUR_ALLIES }] });
const ABILITIES = [COST, NO_READY, EXHAUSTED, GUARDS, MARKS];
const refs = ABILITIES.map((ability) => ability.ref);

const SNARE = stubAttachment({ id: "snare", abilities: refs });
const DUTY = stubObligation({ id: "duty", abilities: refs });
const FRIEND = stubAlly({ id: "friend", cost: 1, atk: 1, thw: 1, hp: 2 });
const deps: EngineDeps = depsOf(...ABILITIES);

interface Table {
  readonly state: GameState;
  /** P1's and P2's ally in play, and a second copy in each hand. */
  readonly inPlay: Readonly<Record<"p1" | "p2", InstanceId>>;
  readonly inHand: Readonly<Record<"p1" | "p2", InstanceId>>;
}

/** Two players, each with an ally in play and a copy in hand; `place` puts the encounter card on P2's side. */
function table(card: AnyCard, place: (state: GameState, id: InstanceId) => GameState): Table {
  const base = gameAtFirstTurn({
    cards: [SNARE, DUTY, FRIEND],
    deps,
    players: 2,
    encounter: [card.id, ...copiesOf(TREACHERY.id, 30)],
    deck: [FRIEND.id, FRIEND.id],
  });
  const deckId = activeEncounterDeckId(base);
  const piles = base.encounterDecks[deckId]!;
  const id = piles.deck.find((c) => base.instances[c]?.cardId === card.id)!;
  const taken: GameState = {
    ...base,
    encounterDecks: { ...base.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((c) => c !== id) } },
    instances: { ...base.instances, [id]: { ...mustInstance(base, id), faceup: true, controllerId: null } },
  };
  const one = playerCardIntoPlay(place(taken, id), FRIEND.id, P1);
  const two = playerCardIntoPlay(one.state, FRIEND.id, P2);
  const handOne = giveCard(two.state, P1, FRIEND.id, [one.id]);
  const handTwo = giveCard(handOne.state, P2, FRIEND.id, [two.id]);
  return {
    state: handTwo.state,
    inPlay: { p1: one.id, p2: two.id },
    inHand: { p1: handOne.id, p2: handTwo.id },
  };
}

/** The attachment attached to P2's identity: in no play area, controlled by nobody. */
const attachedToIdentity = (state: GameState, id: InstanceId): GameState => {
  const host = mustPlayer(state, P2).identity.instanceId;
  return {
    ...state,
    instances: {
      ...state.instances,
      [id]: { ...mustInstance(state, id), attachedTo: host },
      [host]: { ...mustInstance(state, host), attachments: [...mustInstance(state, host).attachments, id] },
    },
  };
};
/** The obligation faceup in P2's play area. */
const inPlayArea = (state: GameState, id: InstanceId): GameState => ({
  ...state,
  players: state.players.map((p) => (p.playerId === P2 ? { ...p, playArea: [...p.playArea, id] } : p)),
});

const deltas = (t: Table, player: typeof P1, card: InstanceId) =>
  playCostContributions(t.state, deps, player, card, null).map((c) => c.delta);

describe.each([
  ["an attachment on a player's identity (RRG p. 8)", SNARE, attachedToIdentity],
  ["an obligation in a player's play area (RRG p. 30)", DUTY, inPlayArea],
] as const)("'you' on %s is that player", (_name, card, place) => {
  it("nobody controls the card", () => {
    const t = table(card, place);
    const id = Object.values(t.state.instances).find((i) => i.cardId === card.id)!;
    expect(id.controllerId).toBeNull();
  });

  it("cost modifier: that player's ally costs 2 more (one contribution of +2), the other player's is unchanged", () => {
    const t = table(card, place);
    expect(deltas(t, P2, t.inHand.p2)).toEqual([2]);
    expect(deltas(t, P1, t.inHand.p1)).toEqual([]);
  });

  it("cannotReady: that player's ally cannot ready, the other player's can", () => {
    const t = table(card, place);
    expect(cannotReady(t.state, deps, t.inPlay.p2)).toBe(true);
    expect(cannotReady(t.state, deps, t.inPlay.p1)).toBe(false);
  });

  it("entersPlayExhausted: that player's ally, not the other player's", () => {
    const t = table(card, place);
    expect(entersPlayExhausted(t.state, deps, t.inPlay.p2)).toBe(true);
    expect(entersPlayExhausted(t.state, deps, t.inPlay.p1)).toBe(false);
  });

  it("keyword grant: that player's ally gains guard, the other player's does not", () => {
    const t = table(card, place);
    expect(hasKeyword(t.state, t.inPlay.p2, "guard", deps)).toBe(true);
    expect(hasKeyword(t.state, t.inPlay.p1, "guard", deps)).toBe(false);
  });

  it("trait grant: that player's ally gains the trait, the other player's does not", () => {
    const t = table(card, place);
    expect(traitsOf(t.state, t.inPlay.p2, deps)).toEqual([MARKED]);
    expect(traitsOf(t.state, t.inPlay.p1, deps)).toEqual([]);
  });
});

describe("an attachment on a card no player controls names no one", () => {
  it("attached to the villain: no player's ally is touched by any of the five", () => {
    const t = table(SNARE, (state, id) => {
      const host = activeVillain(state).instanceId;
      return {
        ...state,
        instances: {
          ...state.instances,
          [id]: { ...mustInstance(state, id), attachedTo: host },
          [host]: { ...mustInstance(state, host), attachments: [...mustInstance(state, host).attachments, id] },
        },
      };
    });
    for (const seat of ["p1", "p2"] as const) {
      const player = seat === "p1" ? P1 : P2;
      expect(deltas(t, player, t.inHand[seat])).toEqual([]);
      expect(cannotReady(t.state, deps, t.inPlay[seat])).toBe(false);
      expect(entersPlayExhausted(t.state, deps, t.inPlay[seat])).toBe(false);
      expect(hasKeyword(t.state, t.inPlay[seat], "guard", deps)).toBe(false);
      expect(traitsOf(t.state, t.inPlay[seat], deps)).toEqual([]);
    }
  });
});
