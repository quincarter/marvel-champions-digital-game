/**
 * A resource ability that works from the hand (`AbilityDefinition.activeIn: "hand"`) and pays for its own card alone
 * (#890 item 2), on a synthetic event shaped like Enhanced Combat Sense (the `spider-punisher-tw` community pack): "You
 * can exhaust any number of Weapon or Tech upgrades you control to generate that many [wild] resources while paying for
 * this card. … For each upgrade you exhausted to pay for this card, …". The count is `paid.ability.<id>`, what that
 * ability generated in the payment.
 */

import { trait, type AbilityId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { paymentOptions } from "./actions.js";
import { createCtx } from "./ctx.js";
import { applyCommand } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubUpgrade } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const WEAPON = trait("Weapon");
const SENSE_RESOURCE = stubAbility("sense.resource", {
  trigger: { kind: "resource" },
  activeIn: "hand",
  cost: {
    exhaustCards: { slot: "exhausted", query: { categories: ["upgrade"], trait: WEAPON, controller: "you" }, min: 1 },
  },
  generates: {
    kind: "amount",
    resource: "wild",
    amount: { kind: "count", query: { categories: ["upgrade"], inSlot: "exhausted" } },
  },
  effects: [],
} satisfies AbilityDefinition);
const SENSE_ACTION = stubAbility("sense.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "identityOf", player: { kind: "controller" } },
      counterType: "sensed",
      amount: { kind: "var", name: `paid.ability.${SENSE_RESOURCE.ref.id}` },
    },
  ],
} satisfies AbilityDefinition);
const SENSE = stubEvent({ id: "sense", cost: 3, abilities: [SENSE_RESOURCE.ref, SENSE_ACTION.ref] });
const RIFLE = { ...stubUpgrade({ id: "rifle", cost: 0 }), traits: [WEAPON] };
/** Another card costing 2: the event's own resource never pays for it. */
const OTHER = stubEvent({ id: "other", cost: 2 });
const deps: EngineDeps = depsOf(SENSE_RESOURCE, SENSE_ACTION);

function start(): { state: GameState; sense: InstanceId; other: InstanceId; rifles: InstanceId[]; spare: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [SENSE, RIFLE, OTHER],
    deps,
    deck: [SENSE.id, ...Array.from({ length: 6 }, () => RIFLE.id), OTHER.id],
  });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const rifles: InstanceId[] = [];
  for (let i = 0; i < 2; i += 1) {
    const put = playerCardIntoPlay(state, RIFLE.id, P1);
    state = put.state;
    rifles.push(put.id);
  }
  const sense = giveCard(state, P1, SENSE.id);
  const other = giveCard(sense.state, P1, OTHER.id);
  const spare = mustPlayer(other.state, P1).hand.find((id) => id !== sense.id && id !== other.id)!;
  return { state: other.state, sense: sense.id, other: other.id, rifles, spare };
}

const senseResource = (sense: InstanceId, rifles: readonly InstanceId[]) => ({
  ability: {
    instanceId: sense,
    abilityId: SENSE_RESOURCE.ref.id as AbilityId,
    costChoices: { exhausted: [...rifles] },
  },
});

describe("a resource ability in hand that pays for its own card (#890 item 2)", () => {
  it("two Weapon upgrades exhausted generate 2, a hand card pays the third, and the event counts the 2", () => {
    const s = start();
    const result = applyCommand(
      s.state,
      {
        type: "playCard",
        playerId: P1,
        cardInstanceId: s.sense,
        payment: [senseResource(s.sense, s.rifles), { fromHand: s.spare }],
        attachToInstanceId: null,
      },
      deps,
    );
    if (!result.ok) throw new Error(result.error.message);
    for (const rifle of s.rifles) expect(mustInstance(result.state, rifle).exhausted).toBe(true);
    const identity = mustPlayer(result.state, P1).identity.instanceId;
    expect(mustInstance(result.state, identity).counters.sensed).toBe(2);
  });

  it("a card payable only through its own resource is still listed as playable, and its example pays with it", () => {
    const s = start();
    let state = playerCardIntoPlay(s.state, RIFLE.id, P1).state;
    state = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: [s.sense], deck: [...p.deck, ...p.hand.filter((id) => id !== s.sense)] } : p,
      ),
    };
    const legal = legalActions(state, P1, deps);
    if (legal.kind !== "turn") throw new Error("expected a turn");
    const entry = legal.legal.find((e) => e.action.kind === "playCard" && e.action.instanceId === s.sense);
    if (!entry) throw new Error("expected the event to be playable with its own resource");
    const result = applyCommand(state, entry!.example, deps);
    if (!result.ok) throw new Error(result.error.message);
    const identity = mustPlayer(result.state, P1).identity.instanceId;
    expect(mustInstance(result.state, identity).counters.sensed).toBe(3);
  });

  it("with six Weapon upgrades and no hand resources, every size of the pick is offered and the card is playable", () => {
    const s = start();
    let state = s.state;
    for (let i = 0; i < 4; i += 1) state = playerCardIntoPlay(state, RIFLE.id, P1).state;
    state = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: [s.sense], deck: [...p.deck, ...p.hand.filter((id) => id !== s.sense)] } : p,
      ),
    };
    const inPlay = Object.values(state.instances).filter(
      (i) =>
        (i.cardId as string) === RIFLE.id &&
        (i.attachedTo !== null || mustPlayer(state, P1).playArea.includes(i.instanceId)),
    );
    expect(inPlay.length).toBe(6);
    const sizes = new Set(
      paymentOptions(createCtx(state, deps), P1, null, s.sense)
        .filter((o) => o.optionId.includes(SENSE_RESOURCE.ref.id))
        .map((o) => (o.optionId.split("exhausted=")[1] ?? "").split(/[;#]/)[0]!.split(",").filter(Boolean).length),
    );
    for (const size of [1, 2, 3, 4, 5, 6]) expect(sizes.has(size), `a ${size}-upgrade option`).toBe(true);
    const legal = legalActions(state, P1, deps);
    if (legal.kind !== "turn") throw new Error("expected a turn");
    const entry = legal.legal.find((e) => e.action.kind === "playCard" && e.action.instanceId === s.sense);
    if (!entry) throw new Error("expected the event to be playable with six upgrades");
    const result = applyCommand(state, entry.example, deps);
    if (!result.ok) throw new Error(result.error.message);
  });

  it("is offered as a payment option for its own card only", () => {
    const s = start();
    const legal = legalActions(s.state, P1, deps);
    if (legal.kind !== "turn") throw new Error("expected a turn");
    expect(legal.legal.some((e) => e.action.kind === "playCard" && e.action.instanceId === s.sense)).toBe(true);
    const result = applyCommand(
      s.state,
      {
        type: "playCard",
        playerId: P1,
        cardInstanceId: s.other,
        payment: [senseResource(s.sense, s.rifles)],
        attachToInstanceId: null,
      },
      deps,
    );
    expect(result.ok).toBe(false);
  });
});
