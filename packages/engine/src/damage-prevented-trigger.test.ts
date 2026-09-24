/**
 * docs/phase7-wave4.md §3.20: a trigger on damage a card prevented. Synthetic cards shaped like Abjuration (`mts`
 * 21082: "Attach to Ebony Maw. Prevent all damage to Ebony Maw. Forced Response: After Abjuration prevents 2 or more
 * damage from a single attack, discard it.") and Telekinetic Force Field (`next_evol` 40034: "When attached character
 * would take any amount of damage, prevent that damage. If 2 or more damage was prevented this way, discard this card.").
 *
 * Sources: RRG 1.8 "Prevent" (p. 34): prevented damage is dealt but not taken; "'Cannot'" (p. 11).
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAttachment, stubEvent, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1 } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const MAW = stubVillain({ id: "maw", stages: [{ hp: flat(20), atk: 1, sch: 1 }] });
const WARD_RULE = stubAbility(
  "ward.constant",
  def({
    trigger: { kind: "constant", rules: [{ kind: "preventAllDamage", target: { hostOfSelf: true } }] },
    effects: [],
  }),
);
const WARD_RESPONSE = stubAbility(
  "ward.forced-response",
  def({
    trigger: {
      kind: "response",
      forced: true,
      on: { on: "damagePrevented", selfIs: "source", fromAttack: true, eventAtLeast: { amount: 2 } },
    },
    effects: [{ kind: "discardFromPlay", target: { kind: "self" } }],
  }),
);
const WARD = stubAttachment({
  id: "ward",
  attachesTo: { kind: "villain" },
  abilities: [WARD_RULE.ref, WARD_RESPONSE.ref],
});
/** "Forced Interrupt: When attached character would take any amount of damage, prevent that damage. If 2 or more damage
 * was prevented this way, discard this card." */
const FIELD_INTERRUPT = stubAbility(
  "field.forced-interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "dealDamage", targetIs: { hostOfSelf: true } } },
    effects: [
      { kind: "preventDamage", bind: "prevented" },
      {
        kind: "if",
        condition: { kind: "varAtLeast", name: "prevented.amount", amount: 2 },
        then: [{ kind: "discardFromPlay", target: { kind: "self" } }],
      },
    ],
  }),
);
const FIELD = stubAttachment({ id: "field", attachesTo: { kind: "villain" }, abilities: [FIELD_INTERRUPT.ref] });
/** "Action: deal N damage to the villain" (not an attack) and "Hero Action (attack): deal N damage to the villain". */
const zap = (n: number) =>
  stubAbility(
    `zap${n}.action`,
    def({
      trigger: { kind: "action" },
      effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: n } }],
    }),
  );
const strike = (n: number) =>
  stubAbility(
    `strike${n}.action`,
    def({
      trigger: { kind: "action" },
      label: ["attack"],
      effects: [{ kind: "attack", target: { kind: "villain" }, amount: { kind: "const", value: n } }],
    }),
  );
const ZAP3 = zap(3);
const STRIKE1 = strike(1);
const STRIKE3 = strike(3);
const ZAP3_CARD = stubEvent({ id: "zap3", cost: 0, abilities: [ZAP3.ref] });
const STRIKE1_CARD = stubEvent({ id: "strike1", cost: 0, abilities: [STRIKE1.ref] });
const STRIKE3_CARD = stubEvent({ id: "strike3", cost: 0, abilities: [STRIKE3.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const deps = depsOf(WARD_RULE, WARD_RESPONSE, FIELD_INTERRUPT, ZAP3, STRIKE1, STRIKE3);
const DECK: readonly CardId[] = [ZAP3_CARD.id, STRIKE1_CARD.id, STRIKE3_CARD.id];

/** A hero-form game with the ward (or field) attached to the villain. */
function start(attachment: typeof WARD | typeof FIELD): { state: GameState; card: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [MAW, WARD, FIELD, ZAP3_CARD, STRIKE1_CARD, STRIKE3_CARD, BLANK],
    deps,
    villain: MAW,
    deck: DECK,
    encounter: [attachment.id, ...copiesOf(BLANK.id, 20)],
  });
  const hero: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const placed = encounterCardInVillainArea(hero, attachment.id);
  const villain = placed.state.villains[0]!.instanceId;
  return {
    card: placed.id,
    state: {
      ...placed.state,
      villainArea: placed.state.villainArea.filter((id) => id !== placed.id),
      instances: {
        ...placed.state.instances,
        [placed.id]: { ...mustInstance(placed.state, placed.id), attachedTo: villain },
        [villain]: { ...mustInstance(placed.state, villain), attachments: [placed.id] },
      },
    },
  };
}
function play(state: GameState, cardId: string) {
  const given = giveCard(state, P1, cardId);
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  const driven = driveSession(startSession(given.state), deps, [command]);
  return { state: driven.session.state, events: driven.events, session: driven.session };
}
const villainDamage = (state: GameState) => mustInstance(state, state.villains[0]!.instanceId).damage;
const discarded = (state: GameState, id: InstanceId) =>
  state.encounterDecks[Object.keys(state.encounterDecks)[0]!]!.discard.includes(id);

describe("§3.20 'After Abjuration prevents 2 or more damage from a single attack, discard it'", () => {
  it("an attack for 3: all prevented, the ward hears it and is discarded", () => {
    const { state: base, card } = start(WARD);
    const { state, events, session } = play(base, STRIKE3_CARD.id);
    expect(villainDamage(state)).toBe(0);
    const heard = events.find((e) => e.type === "triggerEvent" && e.event.kind === "damagePrevented");
    expect(heard?.type === "triggerEvent" && heard.event).toMatchObject({
      kind: "damagePrevented",
      amount: 3,
      preventerInstanceId: card,
      fromAttack: true,
    });
    expect(discarded(state, card)).toBe(true);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(state);
  });

  it("an attack for 1: prevented, but under 2, so the ward stays", () => {
    const { state: base, card } = start(WARD);
    const { state } = play(base, STRIKE1_CARD.id);
    expect(villainDamage(state)).toBe(0);
    expect(mustInstance(state, card).attachedTo).toBe(state.villains[0]!.instanceId);
  });

  it("3 damage that is not an attack: prevented, and the ward stays ('from a single attack')", () => {
    const { state: base, card } = start(WARD);
    const { state } = play(base, ZAP3_CARD.id);
    expect(villainDamage(state)).toBe(0);
    expect(mustInstance(state, card).attachedTo).toBe(state.villains[0]!.instanceId);
  });
});

describe("§3.20 'If 2 or more damage was prevented this way' (preventDamage bind)", () => {
  it("the effect's own amount prevented is bound: 3 prevented discards the field; 1 keeps it", () => {
    const three = start(FIELD);
    const after3 = play(three.state, ZAP3_CARD.id).state;
    expect(villainDamage(after3)).toBe(0);
    expect(discarded(after3, three.card)).toBe(true);
    const one = start(FIELD);
    const after1 = play(one.state, STRIKE1_CARD.id).state;
    expect(villainDamage(after1)).toBe(0);
    expect(mustInstance(after1, one.card).attachedTo).toBe(after1.villains[0]!.instanceId);
  });
});
