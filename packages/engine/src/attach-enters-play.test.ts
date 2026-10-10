/**
 * A card that an `attach` effect takes from out of play onto a host enters play by it (`attachCardBy`): its keywords
 * resolve and one `cardEntersPlay` is announced, as for a card `putIntoPlay` attaches. A card already in play that only
 * changes host enters nothing.
 *
 * Sources: RRG 1.8 "Enters Play" (p. 18: "any time a card transitions from an out-of-play area into play"), "Uses"
 * (p. 46: the card "enters play with" its counters), "Attach To" (p. 8), "In Play and Out of Play" (p. 23: a deck, a
 * discard pile, a hand, the set-aside area and a boost card are all out of play; so is a facedown card).
 *
 * Synthetic cards only: the Holster ("Uses (3 ammo counters)"), the Spring (an encounter attachment with "Uses (4 leap
 * counters)" and "Boost: Attach this card to the villain"), a witness that counts the Holster's entries, and the
 * events that attach.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { CardSelector, EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubAttachment, stubEvent, stubSupport, stubTreachery, stubUpgrade } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const self = { kind: "self" } as const;
const you = { kind: "controller" } as const;
const one = { kind: "const", value: 1 } as const;
const found = { kind: "slot", slot: "found" } as const;
const named = (name: string): TargetRef => ({ kind: "each", query: { name } });

/** "Forced Response: After the Holster enters play, place 1 entered counter here." */
const WITNESS_RESPONSE = stubAbility("witness.response", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", targetIs: { name: "holster" } } },
  effects: [{ kind: "addCounters", target: self, counterType: "entered", amount: one }],
});
/** "Boost: Attach this card to the villain." */
const SPRING_BOOST = stubAbility("spring.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "attach", card: self, to: { kind: "villain" } }],
});

const HOLSTER = stubUpgrade({ id: "holster", cost: 0, keywords: [{ name: "uses", count: 3, counterType: "ammo" }] });
const SPRING = stubAttachment({
  id: "spring",
  boostIcons: 0,
  keywords: [{ name: "uses", count: 4, counterType: "leap" }],
  abilities: [SPRING_BOOST.ref],
});
const WITNESS = stubSupport({ id: "witness", cost: 0, abilities: [WITNESS_RESPONSE.ref] });
const BUDDY = stubAlly({ id: "buddy", cost: 0, atk: 1, thw: 1, hp: 3 });
const PAL = stubAlly({ id: "pal", cost: 0, atk: 1, thw: 1, hp: 3 });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

type From = "deck" | "discard" | "hand" | "setAside";
const holsterIn = (from: From): CardSelector =>
  from === "setAside"
    ? { kind: "setAside", player: you, filter: { name: "holster" } }
    : { kind: "zone", zone: from, player: you, filter: { name: "holster" } };

function event(id: string, effects: readonly EffectSpec[]) {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { ability, card: stubEvent({ id, cost: 0, abilities: [ability.ref] }) };
}
/** "Search your [zone] for the Holster and attach it to Buddy." */
const attachFrom = (from: From, facedown = false) =>
  event(`attach-${from}${facedown ? "-facedown" : ""}`, [
    { kind: "selectCards", slot: "found", cards: holsterIn(from) },
    { kind: "attach", card: found, to: named("buddy"), ...(facedown ? { facedown: true } : {}) },
  ]);
const FROM: Readonly<Record<From, ReturnType<typeof event>>> = {
  deck: attachFrom("deck"),
  discard: attachFrom("discard"),
  hand: attachFrom("hand"),
  setAside: attachFrom("setAside"),
};
const FACEDOWN = attachFrom("hand", true);
/** "Attach the Holster to Pal." (it is in play) */
const MOVE = event("move", [{ kind: "attach", card: named("holster"), to: named("pal") }]);
/** "The villain attacks you." */
const SMITE = event("smite", [{ kind: "enemyAttack", enemies: { kind: "villain" }, against: you }]);
const EVENTS = [...Object.values(FROM), FACEDOWN, MOVE, SMITE];

const deps: EngineDeps = depsOf(WITNESS_RESPONSE, SPRING_BOOST, ...EVENTS.map((e) => e.ability));

interface Table {
  readonly state: GameState;
  readonly holster: InstanceId;
  readonly witness: InstanceId;
  readonly buddy: InstanceId;
  readonly pal: InstanceId;
}

/** P1 controls the witness, Buddy and Pal; the one Holster is in `from`. */
function table(from: From): Table {
  const start = gameAtFirstTurn({
    cards: [HOLSTER, SPRING, WITNESS, BUDDY, PAL, FILLER, ...EVENTS.map((e) => e.card)],
    deps,
    deck: [HOLSTER.id, WITNESS.id, BUDDY.id, PAL.id, ...EVENTS.map((e) => e.card.id)],
    encounter: [SPRING.id, ...copiesOf(FILLER.id, 20)],
  });
  const witness = playerCardIntoPlay(start, WITNESS.id);
  const buddy = playerCardIntoPlay(witness.state, BUDDY.id);
  const pal = playerCardIntoPlay(buddy.state, PAL.id);
  const seat = mustPlayer(pal.state, P1);
  const holster = [...seat.deck, ...seat.hand].find((id) => mustInstance(pal.state, id).cardId === HOLSTER.id)!;
  // Surgery: the Holster in the zone asked for, and nowhere else.
  const without = (ids: readonly InstanceId[]) => ids.filter((id) => id !== holster);
  const state: GameState = {
    ...pal.state,
    players: pal.state.players.map((p) =>
      p.playerId !== P1
        ? p
        : {
            ...p,
            deck: from === "deck" ? [holster, ...without(p.deck)] : without(p.deck),
            hand: from === "hand" ? [...without(p.hand), holster] : without(p.hand),
            discard: from === "discard" ? [holster, ...p.discard] : p.discard,
            setAside: from === "setAside" ? [...p.setAside, holster] : p.setAside,
          },
    ),
    instances: { ...pal.state.instances, [holster]: { ...mustInstance(pal.state, holster), faceup: from !== "deck" } },
  };
  return { state, holster, witness: witness.id, buddy: buddy.id, pal: pal.id };
}

const entries = (events: readonly GameEvent[], id: InstanceId, phase: "initiated" | "resolved" = "initiated") =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === phase && e.event.kind === "cardEntersPlay" && e.event.instanceId === id
      ? [e.event.playerId]
      : [],
  );
const counted = (state: GameState, t: Table) => mustInstance(state, t.witness).counters.entered ?? 0;
function expectReplays(session: GameSession) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("a card attached from out of play enters play", () => {
  it.each(["deck", "discard", "hand", "setAside"] as const)(
    "from the %s: on Buddy faceup with 3 ammo counters, 1 enters-play event, 1 response",
    (from) => {
      const t = table(from);
      const { state, events, session } = playFree(t.state, deps, FROM[from].card.id);
      expect(mustInstance(state, t.holster)).toMatchObject({
        attachedTo: t.buddy,
        faceup: true,
        controllerId: P1,
        counters: { ammo: 3 },
      });
      expect(cardsInPlay(state)).toContain(t.holster);
      expect(entries(events, t.holster)).toEqual<(PlayerId | null)[]>([P1]);
      expect(entries(events, t.holster, "resolved")).toHaveLength(1);
      expect(counted(state, t)).toBe(1);
      expectReplays(session);
    },
  );

  it("as a boost card: the Spring is on the villain with 4 leap counters, 1 enters-play event", () => {
    const t = table("deck");
    const villain = t.state.villains[0]!.instanceId;
    const top = onTopOfEncounterDeck(t.state, SPRING.id);
    const { state, events, session } = playFree(top, deps, SMITE.card.id);
    const spring = mustInstance(state, villain).attachments[0]!;
    expect(mustInstance(state, spring)).toMatchObject({
      cardId: SPRING.id,
      attachedTo: villain,
      counters: { leap: 4 },
    });
    expect(mustInstance(state, villain).boostCards).toEqual([]);
    expect(cardsInPlay(state)).toContain(spring);
    // Nobody controls it: the entry is the attaching player's.
    expect(entries(events, spring)).toEqual<(PlayerId | null)[]>([P1]);
    expectReplays(session);
  });

  it("attached facedown from the hand: out of play on its host, 0 counters, 0 enters-play events", () => {
    const t = table("hand");
    const { state, events } = playFree(t.state, deps, FACEDOWN.card.id);
    expect(mustInstance(state, t.holster)).toMatchObject({ attachedTo: t.buddy, faceup: false, counters: {} });
    expect(cardsInPlay(state)).not.toContain(t.holster);
    expect(entries(events, t.holster)).toEqual([]);
    expect(counted(state, t)).toBe(0);
  });
});

describe("a card in play moved from one host to another does not enter play", () => {
  it("3 ammo, 1 spent, moved from Buddy to Pal: 2 counters still, no second enters-play event, 1 response in all", () => {
    const t = table("deck");
    const first = playFree(t.state, deps, FROM.deck.card.id);
    // Surgery: one ammo counter spent.
    const spent: GameState = {
      ...first.state,
      instances: {
        ...first.state.instances,
        [t.holster]: { ...mustInstance(first.state, t.holster), counters: { ammo: 2 }, exhausted: true },
      },
    };
    const { state, events, session } = playFree(spent, deps, MOVE.card.id);
    expect(mustInstance(state, t.holster)).toMatchObject({ attachedTo: t.pal, counters: { ammo: 2 }, exhausted: true });
    expect(mustInstance(state, t.buddy).attachments).toEqual([]);
    expect(entries(events, t.holster)).toEqual([]);
    expect(counted(state, t)).toBe(1);
    expectReplays(session);
  });
});
