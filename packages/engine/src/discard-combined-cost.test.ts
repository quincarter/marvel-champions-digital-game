import { flat, trait, type AnyCard, type CardId, type EventCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCards, newGame, RESOURCE, runWith, settle } from "./testing/scenario.js";

/**
 * `AbilityCost.discardFromHand.combined` (`DiscardCombined`): "Discard any number of attack cards from your hand with
 * a combined resource cost of 3 or more →" (Advanced Glider, `sm` 27136). The player picks any number of matching hand
 * cards; the picks' summed printed resource cost (RRG 1.8 "Cost", p. 13) must reach the threshold, an X cost counting 0
 * (RRG 1.8 "Non-Numerical Variable", p. 30). A cost is paid in full or not at all (RRG 1.8 "Cost", p. 13), so a hand
 * that can't reach it never offers the ability.
 */

const p1 = playerId("p1");
const ATTACK = trait("ATTACK");
const def = (definition: AbilityDefinition) => definition;
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);
const toHero: Command = { type: "changeForm", playerId: p1 };
const play = (id: InstanceId, payment: readonly Payment[] = []): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment,
  attachToInstanceId: null,
});

const attackEvent = (id: string, cost: number, extra: Partial<EventCard> = {}): EventCard => ({
  ...stubEvent({ id, cost }),
  traits: [ATTACK],
  ...extra,
});
const A1 = attackEvent("atk1", 1);
const A2 = attackEvent("atk2", 2);
const A3 = attackEvent("atk3", 3);
/** Cost 1, but generates 2 resources: only the printed cost counts, never what it would generate. */
const A1_RICH = attackEvent("atk1rich", 1, { resourceIcons: { wild: 2 } });
/** Printed "X" cost: stored as 0 (`specialCost: "X"`), and X is undefined outside of playing it. */
const AX = attackEvent("atkx", 0, { specialCost: "X" });
/** Not an Attack card, however expensive. */
const PLAIN5 = stubEvent({ id: "plain5", cost: 5 });

const glide = stubAbility(
  "glide.action",
  def({
    trigger: { kind: "action", form: "hero" },
    cost: {
      discardFromHand: {
        min: 1,
        bind: "paid",
        filter: { trait: ATTACK },
        combined: { measure: "printedCost", atLeast: 3 },
      },
    },
    effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "var", name: "paid" } }],
  }),
);
const GLIDER = stubSupport({ id: "glider", cost: 0, abilities: [glide.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
});
const HAND_CARDS: readonly AnyCard[] = [A1, A2, A3, A1_RICH, AX, PLAIN5];

/** Hero form, the glider support in play, and exactly the named cards in hand. */
function board(hand: readonly CardId[]): {
  deps: EngineDeps;
  state: GameState;
  source: InstanceId;
  held: readonly InstanceId[];
} {
  const deps = depsOf(glide);
  const state = newGame({
    villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 2, sch: 0 }] }),
    mainScheme: SCHEME,
    extraCards: [BLANK, GLIDER, ...HAND_CARDS],
    deck: [...copies(GLIDER.id, 2), ...HAND_CARDS.flatMap((c) => copies(c.id, 2)), ...copies(RESOURCE.id, 14)],
    encounterDeck: copies(BLANK.id, 20),
    deps,
  });
  const given = giveCards(state, p1, GLIDER.id, ...hand);
  const source = given.ids[0] as InstanceId;
  let out = settle(runWith(deps, given.state, toHero, play(source)), undefined, deps);
  const held = given.ids.slice(1);
  const keep = new Set(held);
  out = {
    ...out,
    players: out.players.map((p) => (p.playerId === p1 ? { ...p, hand: p.hand.filter((id) => keep.has(id)) } : p)),
  };
  return { deps, state: out, source, held };
}

const use = (source: InstanceId, discard: readonly InstanceId[]): Command => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: source,
  abilityId: glide.ref.id,
  payment: [],
  costChoices: { discard },
});
const villainDamage = (state: GameState): number =>
  mustInstance(state, state.villains[0]?.instanceId as InstanceId).damage;

function offered(state: GameState, deps: EngineDeps, source: InstanceId) {
  const actions = legalActions(state, p1, deps);
  if (actions.kind !== "turn") throw new Error("not a turn");
  return actions.legal.find((a) => a.action.kind === "useAbility" && a.action.instanceId === source);
}

describe("`AbilityCost.discardFromHand.combined`: discard any number of matching cards totalling N or more", () => {
  it("pays with the player's own subset reaching the threshold, discarding exactly those cards", () => {
    const { deps, state, source, held } = board([A1.id, A2.id, A3.id]);
    const [one, two, three] = held as [InstanceId, InstanceId, InstanceId];
    const after = settle(runWith(deps, state, use(source, [one, two])), undefined, deps);
    expect(mustPlayer(after, p1).discard).toEqual(expect.arrayContaining([one, two]));
    expect(mustPlayer(after, p1).hand).toEqual([three]);
    // `bind` reports how many cards paid it.
    expect(villainDamage(after)).toBe(2);
  });

  it("lets the player overpay: 'any number' of cards whose total is 3 or more", () => {
    const { deps, state, source, held } = board([A2.id, A3.id]);
    const after = settle(runWith(deps, state, use(source, held)), undefined, deps);
    expect(mustPlayer(after, p1).hand).toEqual([]);
    expect(villainDamage(after)).toBe(2);
  });

  it("refuses a subset under the threshold without paying any of it", () => {
    const { deps, state, source, held } = board([A1.id, A2.id, A3.id]);
    const two = held[1] as InstanceId;
    const result = applyCommand(state, use(source, [two]), deps);
    if (result.ok) throw new Error("expected a rejection");
    expect(result.error.code).toBe("invalid_choice");
    expect(mustPlayer(state, p1).hand).toContain(two);
  });

  it("refuses an empty pick ('any number' still means at least one card, RRG 1.8 'Cost', p. 14)", () => {
    const { deps, state, source } = board([A3.id]);
    const result = applyCommand(state, use(source, []), deps);
    expect(result.ok).toBe(false);
  });

  it("refuses a card that doesn't match the filter, however much it costs", () => {
    const { deps, state, source, held } = board([PLAIN5.id, A1.id]);
    const result = applyCommand(state, use(source, [held[0] as InstanceId]), deps);
    if (result.ok) throw new Error("expected a rejection");
    expect(result.error.code).toBe("no_valid_target");
  });

  it("counts an X cost as 0", () => {
    const { deps, state, source, held } = board([AX.id, A2.id]);
    const result = applyCommand(state, use(source, held), deps);
    if (result.ok) throw new Error("expected a rejection");
    expect(result.error.code).toBe("invalid_choice");
    expect(offered(state, deps, source)).toBeUndefined();
  });

  it("counts the printed cost, not the resources the card would generate", () => {
    const { deps, state, source, held } = board([A1_RICH.id, A1.id]);
    const result = applyCommand(state, use(source, held), deps);
    expect(result.ok).toBe(false);
    expect(offered(state, deps, source)).toBeUndefined();
  });

  it("is offered by `legalActions` only while the matching hand cards can reach the threshold", () => {
    const can = (hand: readonly CardId[]): boolean => {
      const { deps, state, source } = board(hand);
      return offered(state, deps, source) !== undefined;
    };
    expect(can([A3.id])).toBe(true);
    expect(can([A1.id, A2.id])).toBe(true);
    expect(can([A2.id])).toBe(false);
    // A non-matching card is never counted toward it.
    expect(can([A2.id, PLAIN5.id])).toBe(false);
    expect(can([])).toBe(false);
  });

  it("fills the example command with the fewest matching cards that reach it, never a non-matching one", () => {
    const { deps, state, source, held } = board([A1.id, PLAIN5.id, A3.id, A2.id]);
    const action = offered(state, deps, source);
    if (!action || action.example.type !== "useAbility") throw new Error("not offered");
    expect(action.example.costChoices?.discard).toEqual([held[2]]);
  });
});
