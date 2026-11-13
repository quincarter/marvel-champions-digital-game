/**
 * `EffectSpec enemyActivation.boostCards`: "Discard this card → Mephisto activates against you. Apply this card's boost
 * icons ([boost]) for this activation as if it were a boost card" (the Bargain attachments' Response, community pack
 * `mephisto-nep`). The named card joins the activation the effect starts as one of its boost cards: given at step 1,
 * turned faceup, counted and discarded with the activation's own (RRG 1.8 "Boost, Boost Icon", p. 11). An activation
 * that never begins never takes it, so it stays in the encounter discard pile instead of waiting on the villain.
 *
 * Here the applied card is the topmost card of the encounter discard pile (a 3-icon treachery), bound by `selectCards`;
 * the activation is a scheme (the player is in alter-ego form), so nothing is defended. Synthetic cards only.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { playerCardIntoPlay } from "./testing/wave3.js";
import { defaultPick, giveCards, newGame, RESOURCE } from "./testing/scenario.js";

const p1 = playerId("p1");
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);
const SLOT = "applied";
const selectTopDiscard: EffectSpec = {
  kind: "selectCards",
  slot: SLOT,
  cards: { kind: "encounter", zones: ["discard"], topmostOnly: true },
};
const activates = (boostCards: boolean): EffectSpec => ({
  kind: "enemyActivation",
  enemies: { kind: "named", name: "villain" },
  against: { kind: "controller" },
  ...(boostCards ? { boostCards: { kind: "slot", slot: SLOT } } : {}),
});
const action = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects } satisfies AbilityDefinition);
/** "The villain activates against you. Apply [the top encounter discard]'s boost icons as if it were a boost card." */
const APPLY_ABILITY = action("apply", [selectTopDiscard, activates(true)]);
/** "The villain activates against you." */
const PLAIN_ABILITY = action("plain", [activates(false)]);
const APPLY = stubEvent({ id: "apply", cost: 0, abilities: [APPLY_ABILITY.ref] });
const PLAIN = stubEvent({ id: "plain", cost: 0, abilities: [PLAIN_ABILITY.ref] });
/** Every encounter deck card has 1 boost icon; the applied card has 3. */
const ONE = stubTreachery({ id: "one", boostIcons: 1 });
const THREE = stubTreachery({ id: "three", boostIcons: 3 });

/** "Forced Interrupt: When the villain would activate, deal 1 damage to it" (heard, so the activation is announced). */
const WATCH_ABILITY = stubAbility("watch.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyActivating" } },
  effects: [{ kind: "dealDamage", target: { kind: "named", name: "villain" }, amount: { kind: "const", value: 1 } }],
});
/** "Forced Interrupt: When the villain would activate, it does not activate" (Devil's Pacts' shape). */
const PACT_ABILITY = stubAbility("pact.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyActivating" } },
  effects: [{ kind: "cancelTriggeringEvent" }],
});
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: [WATCH_ABILITY.ref] });
const PACT = stubSupport({ id: "pact", cost: 0, abilities: [PACT_ABILITY.ref] });
const deps: EngineDeps = depsOf(APPLY_ABILITY, PLAIN_ABILITY, WATCH_ABILITY, PACT_ABILITY);

interface Setup {
  readonly state: GameState;
  readonly apply: InstanceId;
  readonly plain: InstanceId;
  readonly three: InstanceId;
  readonly villain: InstanceId;
  readonly scheme: InstanceId;
}

/** Villain SCH 1; the 3-icon card on top of the encounter discard pile; alter-ego form (a scheme, no defense). */
function setup(confused = false, listener?: typeof WATCH): Setup {
  const state = newGame({
    villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 1, sch: 1 }] }),
    mainScheme: stubMainScheme({
      id: "scheme",
      stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
    }),
    extraCards: [ONE, THREE, APPLY, PLAIN, WATCH, PACT],
    deck: [APPLY.id, PLAIN.id, WATCH.id, PACT.id, ...copies(RESOURCE.id, 20)],
    encounterDeck: [THREE.id, ...copies(ONE.id, 20)],
    deps,
  });
  const given = giveCards(listener ? playerCardIntoPlay(state, listener.id, p1).state : state, p1, APPLY.id, PLAIN.id);
  const piles = activeEncounterDeck(given.state);
  const three = piles.deck.find((id) => given.state.instances[id]?.cardId === THREE.id)!;
  const deckId = Object.keys(given.state.encounterDecks)[0]! as keyof GameState["encounterDecks"];
  const villain = Object.values(given.state.instances).find((i) => i.cardId === "villain")!;
  const ready: GameState = {
    ...given.state,
    encounterDecks: {
      ...given.state.encounterDecks,
      [deckId]: { ...piles, deck: piles.deck.filter((id) => id !== three), discard: [three, ...piles.discard] },
    },
    instances: {
      ...given.state.instances,
      [three]: { ...mustInstance(given.state, three), faceup: true },
      [villain.instanceId]: {
        ...villain,
        statuses: { ...villain.statuses, ...(confused ? { confused: 1 } : {}) },
      },
    },
  };
  return {
    state: ready,
    apply: given.ids[0]!,
    plain: given.ids[1]!,
    three,
    villain: villain.instanceId,
    scheme: ready.mainScheme!.instanceId,
  };
}

const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const flips = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "boostCardFlipped" ? [e.boostIcons] : []));
const threatOf = (state: GameState, s: Setup) => state.instances[s.scheme]!.threat;

describe("enemyActivation.boostCards: a card applied as a boost card for that activation only", () => {
  it("the card is one of the activation's boost cards: SCH 1 + 1 + 3 threat, then it is back in the discard pile", () => {
    const s = setup();
    const threat = threatOf(s.state, s);
    const { session, events } = driveSession(startSession(s.state), deps, [play(s.apply)], defaultPick);
    expect([...flips(events)].sort()).toEqual([1, 3]);
    expect(threatOf(session.state, s) - threat).toBe(5);
    expect(events).toContainEqual({ type: "boostCardDealt", enemyInstanceId: s.villain, instanceId: s.three });
    expect(activeEncounterDeck(session.state).discard).toContain(s.three);
    expect(session.state.instances[s.villain]!.boostCards).toEqual([]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("an activation that never begins (a confused villain's scheme) leaves the card in the discard pile", () => {
    const s = setup(true);
    const threat = threatOf(s.state, s);
    const { session, events } = driveSession(startSession(s.state), deps, [play(s.apply)], defaultPick);
    expect(flips(events)).toEqual([]);
    expect(threatOf(session.state, s)).toBe(threat);
    expect(activeEncounterDeck(session.state).discard).toContain(s.three);
    // It never waits on the villain: the next activation has only its own boost card.
    const next = driveSession(startSession(session.state), deps, [play(s.plain)], defaultPick);
    expect(flips(next.events)).toEqual([1]);
    expect(threatOf(next.session.state, s) - threat).toBe(2);
  });

  it("without the option, nothing changes: SCH 1 + 1", () => {
    const s = setup();
    const threat = threatOf(s.state, s);
    const { session, events } = driveSession(startSession(s.state), deps, [play(s.plain)], defaultPick);
    expect(flips(events)).toEqual([1]);
    expect(threatOf(session.state, s) - threat).toBe(2);
  });

  it("announced to a 'when it activates' interrupt, the activation still takes the card", () => {
    const s = setup(false, WATCH);
    const threat = threatOf(s.state, s);
    const { session, events } = driveSession(startSession(s.state), deps, [play(s.apply)], defaultPick);
    expect([...flips(events)].sort()).toEqual([1, 3]);
    expect(threatOf(session.state, s) - threat).toBe(5);
    expect(activeEncounterDeck(session.state).discard).toContain(s.three);
  });

  it("cancelled by that interrupt, the card stays in the discard pile and never reaches the villain", () => {
    const s = setup(false, PACT);
    const threat = threatOf(s.state, s);
    const { session, events } = driveSession(startSession(s.state), deps, [play(s.apply)], defaultPick);
    expect(flips(events)).toEqual([]);
    expect(threatOf(session.state, s)).toBe(threat);
    expect(activeEncounterDeck(session.state).discard).toContain(s.three);
    expect(session.state.instances[s.villain]!.boostCards).toEqual([]);
  });
});
