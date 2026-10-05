/**
 * docs/phase7-wave7.md §3.7: a villain's defeated last stage placed under another card, and counted there. Synthetic
 * cards only: four one-stage villains of different titles (one in play, the rest set aside, the Mansion Attack shape of
 * `mansion-attack-sequence.test.ts`), `victory: "cardAbility"`, and an environment printing
 *
 *   Forced Response: After the villain is defeated, put it under here. [The next villain enters play.]
 *
 * as `tuckCards(eventTarget, under self)` followed by the existing `selectCards(encounterSetAside random 1)` +
 * `addVillain`. "If there are 3 villains under [the environment], the players win the game" is a `stateCheck` on
 * `countInRef(tuckedUnder(the environment), villain)` with `endGame("win")`.
 *
 * Sources: RRG 1.8 "Villain Defeat" (p. 47: a new stage of a different title carries nothing over), "Leaves Play"
 * (p. 27: "there is no memory of its previous state and it is considered to be a new copy of the card"), "Tuck" (p. 45:
 * tucked cards are out of play).
 */

import { flat, type CardId, type VillainCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { locateCard, mustInstance, undefeatedVillains, villainOf } from "./query.js";
import { cardsInPlay, resolveValue } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import { NO_STATUSES, type GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAttachment,
  stubEnvironment,
  stubEvent,
  stubMainScheme,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, playFree } from "./testing/wave3.js";

const raider = (id: string, name: string): VillainCard =>
  stubVillain({ id, name, stages: [{ hp: flat(10), atk: 0, sch: 0 }] });
const ARC = raider("arc", "Arc");
const BRUTE = raider("brute", "Brute");
const CINDER = raider("cinder", "Cinder");
const DRIFT = raider("drift", "Drift");
/** A villain with a later stage: its first stage's defeat reveals the second, so nothing can be put under a card. */
const TWO_STAGE = stubVillain({
  id: "two-stage",
  name: "Two Stage",
  stages: [
    { hp: flat(10), atk: 0, sch: 0 },
    { hp: flat(12), atk: 0, sch: 0 },
  ],
});

const HIDEOUT_NAME = "Hideout";
const underHideout: TargetRef = { kind: "tuckedUnder", of: { kind: "named", name: HIDEOUT_NAME } };
const villainsUnderHideout: ValueSpec = { kind: "countInRef", cards: underHideout, query: { categories: ["villain"] } };

const nextVillain: readonly EffectSpec[] = [
  {
    kind: "selectCards",
    slot: "next",
    cards: { kind: "encounterSetAside", filter: { categories: ["villain"] }, random: { kind: "const", value: 1 } },
  },
  { kind: "addVillain", villain: { kind: "slot", slot: "next" }, reveal: true },
];
/** "Forced Response: After the villain is defeated, put it under here." Then the next villain is in play. */
const PUT_UNDER = stubAbility("hideout.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "characterDefeated", targetIs: { categories: ["villain"] } } },
  effects: [
    { kind: "tuckCards", cards: { kind: "ref", ref: { kind: "eventTarget" } }, under: { kind: "self" } },
    ...nextVillain,
  ],
});
const HIDEOUT = stubEnvironment({ id: "hideout", name: HIDEOUT_NAME, abilities: [PUT_UNDER.ref] });

/** "If there are 3 villains under [the environment], the players win the game." */
const WIN_AT_THREE = stubAbility("siege.state-check", {
  trigger: {
    kind: "stateCheck",
    when: { kind: "compare", left: villainsUnderHideout, op: "atLeast", right: { kind: "const", value: 3 } },
  },
  effects: [{ kind: "endGame", result: "win" }],
});
const MAIN = stubMainScheme({
  id: "siege",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), abilities: [WIN_AT_THREE.ref] }],
});

const SHACKLE = stubAttachment({ id: "shackle" });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
const SLAY_ABILITY = stubAbility("slay.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 10 } }],
});
const SLAY = stubEvent({ id: "slay", cost: 0, abilities: [SLAY_ABILITY.ref] });

const deps: EngineDeps = depsOf(PUT_UNDER, WIN_AT_THREE, SLAY_ABILITY);

interface Table {
  readonly state: GameState;
  readonly hideout: InstanceId;
}

function start(first: VillainCard = ARC, setAside: readonly VillainCard[] = [BRUTE, CINDER, DRIFT]): Table {
  const result = createGame(
    {
      seed: 11,
      cards: [...DEFAULT_CARDS, ARC, BRUTE, CINDER, DRIFT, TWO_STAGE, HIDEOUT, MAIN, SHACKLE, FILLER, SLAY],
      villainCardId: first.id,
      setAsideVillainCardIds: setAside.map((card) => card.id),
      mainSchemeCardId: MAIN.id,
      encounterDeck: [HIDEOUT.id, ...copiesOf(SHACKLE.id, 2), ...copiesOf(FILLER.id, 10)],
      victory: "cardAbility",
      includeIdentitySets: false,
      players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, ...copiesOf(SLAY.id, 3)] }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  const placed = encounterCardInVillainArea(driveSession(startSession(result.state), deps).session.state, HIDEOUT.id);
  return { state: placed.state, hideout: placed.id };
}

const slay = (state: GameState): GameState => playFree(state, deps, SLAY.id).state;
const under = (state: GameState, host: InstanceId): readonly CardId[] =>
  mustInstance(state, host).tucked.map((id) => mustInstance(state, id).cardId);
const countUnder = (state: GameState): number =>
  resolveValue(
    state,
    villainsUnderHideout,
    { selfInstanceId: state.mainScheme.instanceId, controllerId: null, event: null, bindings: {} },
    deps,
  );
const activeCard = (state: GameState): CardId => mustInstance(state, state.activeVillainId).cardId;

/** Test surgery: the first `card` in the encounter deck leaves it for `place` on `host` (attached, or as a boost card). */
function fromEncounterDeckOnto(
  state: GameState,
  card: CardId,
  host: InstanceId,
  place: "attachments" | "boostCards",
): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = state.encounterDeckOrder[0]!;
  const piles = state.encounterDecks[deckId]!;
  const id = piles.deck.find((candidate) => mustInstance(state, candidate).cardId === card);
  if (!id) throw new Error(`no ${card} in the encounter deck`);
  const on = mustInstance(state, host);
  return {
    id,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((x) => x !== id) } },
      instances: {
        ...state.instances,
        [host]: { ...on, [place]: [...on[place], id] },
        [id]: {
          ...mustInstance(state, id),
          faceup: place === "attachments",
          attachedTo: place === "attachments" ? host : null,
        },
      },
    },
  };
}

describe("§3.7 a defeated villain placed under a card, and counted there", () => {
  it("the defeated villain ends under the host, faceup and out of play, in no other zone", () => {
    const { state: before, hideout } = start();
    const arc = before.activeVillainId;
    expect(countUnder(before)).toBe(0);
    const { state, session, events } = playFree(before, deps, SLAY.id);
    expect(mustInstance(state, hideout).tucked).toEqual([arc]);
    expect(locateCard(state, arc)).toEqual({ kind: "tucked", hostInstanceId: hideout });
    expect(mustInstance(state, arc).faceup).toBe(true);
    expect(cardsInPlay(state)).not.toContain(arc);
    expect(villainOf(state, arc)?.defeated).toBe(true);
    expect(state.victoryDisplay).not.toContain(arc);
    expect(state.removedFromGame).not.toContain(arc);
    expect(state.encounterSetAside).not.toContain(arc);
    for (const piles of Object.values(state.encounterDecks)) {
      expect(piles.deck).not.toContain(arc);
      expect(piles.discard).not.toContain(arc);
    }
    // The move is logged as any zone change is, from no zone (a villain's card sits in none while it is the villain).
    expect(events).toContainEqual({
      type: "cardMoved",
      instanceId: arc,
      cardId: ARC.id,
      from: { kind: "removedFromGame" },
      to: { kind: "tucked", hostInstanceId: hideout },
    });
    expect(countUnder(state)).toBe(1);
    expect(state.outcome).toBeNull();
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("nothing that was on the villain stays on its card: damage, status cards, counters, attachments, boost cards", () => {
    const table = start();
    const arc = table.state.activeVillainId;
    const attached = fromEncounterDeckOnto(table.state, SHACKLE.id, arc, "attachments");
    const boosted = fromEncounterDeckOnto(attached.state, SHACKLE.id, arc, "boostCards");
    const marked: GameState = {
      ...boosted.state,
      instances: {
        ...boosted.state.instances,
        [arc]: {
          ...mustInstance(boosted.state, arc),
          damage: 3,
          statuses: { stunned: 1, confused: 1, tough: 0 },
          counters: { grudge: 2 },
          exhausted: true,
        },
      },
    };
    const state = slay(marked);
    const card = mustInstance(state, arc);
    expect(mustInstance(state, table.hideout).tucked).toEqual([arc]);
    expect(card.damage).toBe(0);
    expect(card.statuses).toEqual(NO_STATUSES);
    expect(card.counters).toEqual({});
    expect(card.exhausted).toBe(false);
    expect(card.attachments).toEqual([]);
    expect(card.boostCards).toEqual([]);
    const deckId = state.encounterDeckOrder[0]!;
    expect(locateCard(state, attached.id)).toEqual({ kind: "encounterDiscard", deckId });
    expect(locateCard(state, boosted.id)).toEqual({ kind: "encounterDiscard", deckId });
  });

  it("the next villain from the set-aside villains becomes the active villain, with nothing carried over", () => {
    const { state: before } = start();
    const state = slay(before);
    const now = undefeatedVillains(state);
    expect(now).toHaveLength(1);
    expect([BRUTE.id, CINDER.id, DRIFT.id]).toContain(now[0]!.cardId);
    expect(state.activeVillainId).toBe(now[0]!.instanceId);
    expect(mustInstance(state, now[0]!.instanceId).damage).toBe(0);
    expect(state.encounterSetAside.filter((id) => villainOf(state, id) === undefined)).toHaveLength(2);
  });

  it("a second and a third defeat accumulate in order, the count reads 0, 1, 2, 3, and the third wins the game", () => {
    const { state: zero, hideout } = start();
    const order: CardId[] = [activeCard(zero)];
    expect(countUnder(zero)).toBe(0);
    const one = slay(zero);
    expect(countUnder(one)).toBe(1);
    expect(one.outcome).toBeNull();
    order.push(activeCard(one));
    const two = slay(one);
    expect(countUnder(two)).toBe(2);
    expect(under(two, hideout)).toEqual(order);
    expect(two.outcome).toBeNull();
    order.push(activeCard(two));
    const three = slay(two);
    expect(countUnder(three)).toBe(3);
    expect(under(three, hideout)).toEqual(order);
    expect(new Set(order).size).toBe(3);
    expect(three.victoryDisplay).toEqual([]);
    expect(three.outcome).toEqual({ result: "win", reason: "villainDefeated" });
  });

  it("the win is checked as the third villain goes under the host: the fourth villain never enters play", () => {
    const { state: zero } = start();
    const three = slay(slay(slay(zero)));
    expect(three.outcome?.result).toBe("win");
    expect(undefeatedVillains(three)).toHaveLength(0);
    // Three villains ever entered play (the first and two more); the fourth is still set aside.
    expect(three.villains).toHaveLength(3);
    expect(
      three.encounterSetAside.filter((id) => three.cardPool[mustInstance(three, id).cardId]?.type === "villain"),
    ).toHaveLength(1);
  });

  it("a villain with a later stage is not put under the host: its next stage is revealed and it stays the villain", () => {
    const { state: before, hideout } = start(TWO_STAGE, [BRUTE]);
    const villain = before.activeVillainId;
    const state = slay(before);
    expect(mustInstance(state, hideout).tucked).toEqual([]);
    expect(countUnder(state)).toBe(0);
    expect(cardsInPlay(state)).toContain(villain);
    expect(villainOf(state, villain)).toMatchObject({ defeated: false, stageIndex: 1 });
    expect(mustInstance(state, villain).damage).toBe(0);
    // Its last stage's defeat is the one that goes under the host (stage 2 has 12 hit points).
    const last = slay(slay(state));
    expect(mustInstance(last, hideout).tucked).toEqual([villain]);
    expect(countUnder(last)).toBe(1);
    expect(villainOf(last, villain)?.defeated).toBe(true);
  });
});
