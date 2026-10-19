/**
 * docs/phase7-wave11-scenarios.md §S3.10: encounter minions tucked under a side scheme and revealed from there,
 * proven with synthetic cards shaped like the Tracksuit Mafia set (`fne` 60200-60204):
 *
 * - the Den (60204): "When Revealed: Discard cards from the top of the encounter deck until a [Tracksuit] minion is
 *   discarded and tuck that minion here. Forced Response: After a player reveals a [Tracksuit] minion from the
 *   encounter deck, that player reveals 1 minion tucked here.";
 * - the Bro (60203): "When Defeated: Tuck this card under the [Den] side scheme. Otherwise, shuffle this card into
 *   the encounter deck."
 *
 * Sources: RRG 1.8 "Tuck" (p. 45: tucked faceup, not in play; "When a card leaves play, each card tucked under it is
 * discarded"), "When Defeated Abilities" (p. 48: "A defeated card leaves play after its 'When Defeated' ability is
 * resolved"), "Defeat" (p. 15), "'Otherwise'" (p. 31), "Reveal" (p. 38), "Encounter Deck" (p. 17).
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeckId, locateCard, mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubSideScheme, stubTreachery } from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  onTopOfEncounterDeck,
  P1,
  playFree,
} from "./testing/wave3.js";

const TRACKSUIT = trait("TRACKSUIT");
const self: TargetRef = { kind: "self" };
const you = { kind: "controller" } as const;
const tracksuitMinion: TargetQuery = { categories: ["minion"], trait: TRACKSUIT };

const DEN_REVEALED = stubAbility("den.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    { kind: "discardEncounterUntil", filter: tracksuitMinion, bind: "found" },
    { kind: "tuckCards", cards: { kind: "ref", ref: { kind: "slot", slot: "found" } }, under: self },
  ],
});
const DEN_RESPONSE = stubAbility("den.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "cardRevealed", eventIs: { from: "encounterDeck" }, targetIs: tracksuitMinion },
  },
  effects: [
    {
      kind: "chooseCards",
      slot: "pick",
      from: { kind: "tucked", under: self, filter: { categories: ["minion"] } },
      chooser: { kind: "eventPlayer" },
      min: 1,
      max: 1,
    },
    { kind: "revealCard", cards: { kind: "slot", slot: "pick" }, player: { kind: "eventPlayer" } },
  ],
});
const DEN = stubSideScheme({
  id: "den",
  startingThreat: 3,
  boostIcons: 0,
  abilities: [DEN_REVEALED.ref, DEN_RESPONSE.ref],
});
const denInPlay: TargetQuery = { categories: ["sideScheme"], name: DEN.name };
const BRO_DEFEATED = stubAbility("bro.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [
    {
      kind: "if",
      condition: { kind: "exists", query: denInPlay },
      then: [{ kind: "tuckCards", cards: { kind: "ref", ref: self }, under: { kind: "named", name: DEN.name } }],
      otherwise: [{ kind: "setDefeatDestination", to: "encounterDeckShuffle" }],
    },
  ],
});
const BRO = stubMinion({ id: "bro", traits: [TRACKSUIT], atk: 1, sch: 1, hp: 3, abilities: [BRO_DEFEATED.ref] });
/** "When Defeated: Tuck this card under the [Den]. Remove 9 threat from the [Den]." (the host leaves first). */
const RAT_DEFEATED = stubAbility("rat.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [
    { kind: "tuckCards", cards: { kind: "ref", ref: self }, under: { kind: "named", name: DEN.name } },
    { kind: "removeThreat", target: { kind: "named", name: DEN.name }, amount: { kind: "const", value: 9 } },
  ],
});
const RAT = stubMinion({ id: "rat", traits: [TRACKSUIT], atk: 1, sch: 1, hp: 3, abilities: [RAT_DEFEATED.ref] });
const THUG = stubMinion({ id: "thug", traits: [TRACKSUIT], atk: 1, sch: 1, hp: 3 });
const GOON = stubMinion({ id: "goon", atk: 1, sch: 1, hp: 3 });
const NOISE = stubTreachery({ id: "noise", boostIcons: 0 });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Reveal the top card of the encounter deck." */
const REVEAL = event("reveal", [{ kind: "revealEncounterCard", player: you }]);
/** "Deal 9 damage to each [name] minion." */
const smash = (name: string) =>
  event(`smash-${name}`, [
    {
      kind: "dealDamage",
      target: { kind: "each", query: { categories: ["minion"], name } },
      amount: { kind: "const", value: 9 },
    },
  ]);
const SMASH_BRO = smash(BRO.name);
const SMASH_RAT = smash(RAT.name);
/** "Remove 9 threat from the [Den]." */
const CLEAR = event("clear", [
  { kind: "removeThreat", target: { kind: "named", name: DEN.name }, amount: { kind: "const", value: 9 } },
]);
const EVENTS = [REVEAL, SMASH_BRO, SMASH_RAT, CLEAR];

const deps: EngineDeps = depsOf(
  DEN_REVEALED,
  DEN_RESPONSE,
  BRO_DEFEATED,
  RAT_DEFEATED,
  ...EVENTS.map((e) => e.ability),
);

function start(): GameState {
  return gameAtFirstTurn({
    cards: [DEN, BRO, RAT, THUG, GOON, NOISE, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: [DEN.id, ...copiesOf(BRO.id, 3), RAT.id, THUG.id, GOON.id, ...copiesOf(NOISE.id, 14)],
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 3)),
  });
}
/** Puts `cards` on top of the encounter deck, the first on top. */
const stackEncounter = (state: GameState, cards: readonly { readonly id: string }[]): GameState =>
  [...cards].reverse().reduce((s, card) => onTopOfEncounterDeck(s, card.id as never), state);
const encounterPiles = (state: GameState) => state.encounterDecks[activeEncounterDeckId(state)]!;
const instanceOf = (state: GameState, card: { readonly id: string }) =>
  Object.values(state.instances).filter((i) => i.cardId === card.id);
const denOf = (state: GameState): InstanceId =>
  instanceOf(state, DEN).find((i) => cardsInPlay(state).includes(i.instanceId))!.instanceId;
const under = (state: GameState, id: InstanceId) => mustInstance(state, id).tucked;
const resolved = (events: readonly GameEvent[], abilityId: string) =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === abilityId).length;
function play(state: GameState, card: (typeof EVENTS)[number]) {
  const result = playFree(state, deps, card.card.id, P1);
  const replayed = replay(result.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.state);
  return result;
}
/** The Den in the villain area with `tucked` under it, faceup, out of play (surgery). */
function denWith(state: GameState, tucked: readonly { readonly id: string }[]) {
  const den = encounterCardInVillainArea(state, DEN.id, 3);
  let s = den.state;
  const ids: InstanceId[] = [];
  for (const card of tucked) {
    const piles = encounterPiles(s);
    const id = piles.deck.find((c) => s.instances[c]?.cardId === card.id && !ids.includes(c))!;
    ids.push(id);
    s = {
      ...s,
      encounterDecks: {
        ...s.encounterDecks,
        [activeEncounterDeckId(s)]: { ...piles, deck: piles.deck.filter((c) => c !== id) },
      },
      instances: {
        ...s.instances,
        [id]: { ...mustInstance(s, id), faceup: true },
        [den.id]: { ...mustInstance(s, den.id), tucked: [...mustInstance(s, den.id).tucked, id] },
      },
    };
  }
  return { state: s, den: den.id, tucked: ids };
}

describe("§S3.10 encounter minions tucked under a side scheme", () => {
  it("When Revealed: discards until a [Tracksuit] minion and tucks it faceup under the scheme, out of play", () => {
    const state = stackEncounter(start(), [DEN, NOISE, GOON, THUG]);
    const run = play(state, REVEAL);
    const den = denOf(run.state);
    const [thug] = under(run.state, den);
    expect(thug).toBeDefined();
    expect(mustInstance(run.state, thug!).cardId).toBe(THUG.id);
    expect(mustInstance(run.state, thug!).faceup).toBe(true);
    expect(locateCard(run.state, thug!)).toEqual({ kind: "tucked", hostInstanceId: den });
    expect(cardsInPlay(run.state)).not.toContain(thug);
    // The cards passed over (a treachery, a minion without the trait) are in the encounter discard pile.
    const discard = encounterPiles(run.state).discard.map((id) => mustInstance(run.state, id).cardId);
    expect(discard).toEqual(expect.arrayContaining([NOISE.id, GOON.id]));
    expect(discard).not.toContain(THUG.id);
  });

  it("Forced Response: a [Tracksuit] minion revealed from the encounter deck reveals 1 minion tucked here, once", () => {
    const table = denWith(start(), [THUG, BRO]);
    const state = stackEncounter(table.state, [BRO]);
    const run = play(state, REVEAL);
    // One response: the minion revealed from under the scheme was not revealed from the encounter deck.
    expect(resolved(run.events, DEN_RESPONSE.ref.id)).toBe(1);
    const left = under(run.state, table.den);
    expect(left).toHaveLength(1);
    const revealed = table.tucked.find((id) => !left.includes(id))!;
    expect(cardsInPlay(run.state)).toContain(revealed);
    expect(mustInstance(run.state, revealed).engagedWith).toBe(P1);
    const heard = run.events.flatMap((e) =>
      e.type === "triggerEvent" && e.event.kind === "cardRevealed" ? [e.event] : [],
    );
    expect(heard.find((e) => e.instanceId === revealed)?.from).toBeUndefined();
    expect(heard.filter((e) => e.from === "encounterDeck")).toHaveLength(1);
  });

  it("a minion without the trait, or a treachery, revealed from the encounter deck is not heard", () => {
    const table = denWith(start(), [THUG]);
    for (const card of [GOON, NOISE]) {
      const run = play(stackEncounter(table.state, [card]), REVEAL);
      expect(resolved(run.events, DEN_RESPONSE.ref.id)).toBe(0);
      expect(under(run.state, table.den)).toEqual(table.tucked);
    }
  });

  it("with nothing tucked the response resolves and reveals nothing", () => {
    const table = denWith(start(), []);
    const run = play(stackEncounter(table.state, [THUG]), REVEAL);
    expect(resolved(run.events, DEN_RESPONSE.ref.id)).toBe(1);
    expect(instanceOf(run.state, THUG).filter((i) => cardsInPlay(run.state).includes(i.instanceId))).toHaveLength(1);
  });

  it("When Defeated: the defeated minion goes under the scheme in place of its discard, faceup and clean", () => {
    const table = denWith(start(), []);
    const bro = minionEngagedWith(table.state, BRO.id);
    const run = play(bro.state, SMASH_BRO);
    expect(under(run.state, table.den)).toEqual([bro.id]);
    const card = mustInstance(run.state, bro.id);
    expect(card.faceup).toBe(true);
    expect(card.damage).toBe(0);
    expect(card.engagedWith).toBeNull();
    expect(encounterPiles(run.state).discard).not.toContain(bro.id);
    expect(run.events.some((e) => e.type === "triggerEvent" && e.event.kind === "characterDefeated")).toBe(true);
    // RRG 1.8 p. 48: it leaves play after its When Defeated has resolved, at the defeat's own leaving step.
    const whenDefeated = run.events.findIndex(
      (e) => e.type === "abilityResolved" && e.abilityId === BRO_DEFEATED.ref.id,
    );
    const moved = run.events.findIndex(
      (e) => e.type === "cardMoved" && e.instanceId === bro.id && e.to.kind === "tucked",
    );
    expect(whenDefeated).toBeGreaterThan(-1);
    expect(moved).toBeGreaterThan(whenDefeated);
  });

  it("two engaged minions defeated by one damage effect each go under the scheme at their own leaving step", () => {
    const table = denWith(start(), []);
    const first = minionEngagedWith(table.state, BRO.id);
    const second = minionEngagedWith(first.state, BRO.id);
    const run = play(second.state, SMASH_BRO);
    expect([...under(run.state, table.den)].sort()).toEqual([first.id, second.id].sort());
    for (const id of [first.id, second.id]) {
      expect(mustInstance(run.state, id).faceup).toBe(true);
      expect(encounterPiles(run.state).discard).not.toContain(id);
      expect(cardsInPlay(run.state)).not.toContain(id);
    }
  });

  it("a minion revealed from the deck, defeated and tucked, is later revealed from under the scheme with no `from`", () => {
    const table = denWith(start(), []);
    const dealt = play(stackEncounter(table.state, [BRO]), REVEAL);
    const [bro] = instanceOf(dealt.state, BRO).filter((i) => cardsInPlay(dealt.state).includes(i.instanceId));
    const smashed = play(dealt.state, SMASH_BRO);
    expect(under(smashed.state, table.den)).toEqual([bro!.instanceId]);
    const run = play(stackEncounter(smashed.state, [THUG]), REVEAL);
    expect(cardsInPlay(run.state)).toContain(bro!.instanceId);
    const revealed = run.events.flatMap((e) =>
      e.type === "triggerEvent" && e.event.kind === "cardRevealed" && e.event.instanceId === bro!.instanceId
        ? [e.event]
        : [],
    );
    expect(revealed.length).toBeGreaterThan(0);
    for (const e of revealed) expect(e.from).toBeUndefined();
  });

  it("a host that leaves play before the leaving step takes nothing: the minion is discarded as normal", () => {
    const table = denWith(start(), []);
    const rat = minionEngagedWith(table.state, RAT.id);
    const run = play(rat.state, SMASH_RAT);
    expect(cardsInPlay(run.state)).not.toContain(table.den);
    expect(encounterPiles(run.state).discard).toContain(rat.id);
    expect(locateCard(run.state, rat.id)?.kind).toBe("encounterDiscard");
  });

  it("Otherwise: with no such scheme in play the defeated minion is shuffled into the encounter deck", () => {
    const bro = minionEngagedWith(start(), BRO.id);
    const run = play(bro.state, SMASH_BRO);
    expect(locateCard(run.state, bro.id)?.kind).toBe("encounterDeck");
  });

  it("the scheme leaving play discards each card tucked under it to the encounter discard pile", () => {
    const table = denWith(start(), [THUG, BRO]);
    const run = play(table.state, CLEAR);
    expect(cardsInPlay(run.state)).not.toContain(table.den);
    for (const id of table.tucked) {
      expect(encounterPiles(run.state).discard).toContain(id);
      expect(mustInstance(run.state, id).faceup).toBe(true);
    }
    expect(mustPlayer(run.state, P1).discard).not.toContain(table.tucked[0]);
  });
});
