/**
 * Primitives added while scripting wave 1's Captain America pack, reviewed against RRG 1.8. Stub cards only.
 *
 * - Costs paid with cards in play: `AbilityCost.exhaustCards` / `returnToHand` (`InPlayCostPick`). "Exhaust Captain
 *   America's Shield →", "exhaust any number of allies you control →", "return Captain America's Shield from play to
 *   your hand →".
 * - `reduceNextCardCost.cardFilter`, conditional `allyLimit.while`, `scaled.divide`, `maxPrintedCost` as a value,
 *   `countInRef`, and `<bind>.boostIcons`.
 */
import { cardId, trait } from "@mc/content";
import type { AbilityDefinition } from "./abilities.js";
import type { Command, CostChoices, Payment } from "./commands.js";
import { applyCommand } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { playerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { boostIconsFor } from "./modifiers.js";
import { activeEncounterDeckId, cardOf, encounterDeckOf, mustInstance, mustPlayer } from "./query.js";
import { allyLimitFor } from "./rules.js";
import { cardsInPlay, matchesQuery, resolveValue, type EffectContext } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubEvent, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import {
  ALLY,
  DEFAULT_DECK,
  RESOURCE,
  UPGRADE,
  expectOk,
  giveCards,
  newGame,
  payFor,
  runWith,
  settle,
} from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const AVENGER = trait("Avenger");

const decoy: AbilityDefinition["effects"] = [
  { kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 1 } },
];
const actionWith = (id: string, definition: Omit<AbilityDefinition, "trigger">) =>
  stubAbility(id, { trigger: { kind: "action" }, ...definition });

// "Captain America's Shield" stand-ins: an identity upgrade, and one that cannot leave play.
const SHIELD = stubUpgrade({ id: "shield", cost: 0 });
const STUCK_RULE = stubAbility("stuck.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotLeavePlay", target: { self: true } }] },
  effects: [],
});
const STUCK = stubUpgrade({ id: "stuck", cost: 0, abilities: [STUCK_RULE.ref] });

// "Exhaust [the Shield] →" (Shield Block).
const BLOCK_ACTION = actionWith("block.action", {
  cost: { exhaustCards: { slot: "exhausted", query: { name: SHIELD.name }, min: 1, max: 1 } },
  effects: decoy,
});
const BLOCK = stubEvent({ id: "block", cost: 0, abilities: [BLOCK_ACTION.ref] });

// "Discard X cards from your hand, then return [the Shield] from play to your hand → …" (Shield Toss); draws X to expose X.
const TOSS_ACTION = actionWith("toss.action", {
  cost: {
    discardFromHand: { min: 0, bind: "x" },
    returnToHand: { slot: "returned", query: { name: SHIELD.name }, min: 1, max: 1 },
  },
  effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "var", name: "x" } }],
});
const TOSS = stubEvent({ id: "toss", cost: 0, abilities: [TOSS_ACTION.ref] });
const TOSS_STUCK_ACTION = actionWith("toss-stuck.action", {
  cost: { returnToHand: { slot: "returned", query: { name: STUCK.name }, min: 1, max: 1 } },
  effects: decoy,
});
const TOSS_STUCK = stubEvent({ id: "toss-stuck", cost: 0, abilities: [TOSS_STUCK_ACTION.ref] });

// "Exhaust any number of allies you control → draw 1 card for each ally exhausted this way." (Strength in Numbers).
const STRENGTH_ACTION = actionWith("strength.action", {
  cost: { exhaustCards: { slot: "exhausted", query: { categories: ["ally"] }, min: 1, bind: "n" } },
  effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "var", name: "n" } }],
});
const STRENGTH = stubEvent({ id: "strength", cost: 0, abilities: [STRENGTH_ACTION.ref] });

// A support whose resource ability exhausts it, and a 1-cost event that exhausts a support as its cost.
const GENERATOR_RESOURCE = stubAbility("generator.resource", {
  trigger: { kind: "resource" },
  cost: { exhaustSelf: true },
  generates: { wild: 1 },
  effects: [],
});
const GENERATOR = stubSupport({ id: "generator", cost: 0, abilities: [GENERATOR_RESOURCE.ref] });
const OVERLOAD_ACTION = actionWith("overload.action", {
  cost: { exhaustCards: { slot: "exhausted", query: { categories: ["support"] }, min: 1, max: 1 } },
  effects: decoy,
});
const OVERLOAD = stubEvent({ id: "overload", cost: 1, abilities: [OVERLOAD_ACTION.ref] });
// "Exhaust this and exhaust a support →": the source itself is the only support in play.
const DOUBLE_ACTION = actionWith("double.action", {
  cost: { exhaustSelf: true, exhaustCards: { slot: "exhausted", query: { categories: ["support"] }, min: 1, max: 1 } },
  effects: decoy,
});
const DOUBLE = stubSupport({ id: "double", cost: 0, abilities: [DOUBLE_ACTION.ref] });

// "Reduce the cost of the next [ally] played this phase by 1" (Avengers Tower's action) and the unfiltered version.
const reduction = (id: string, cardFilter?: { readonly categories: readonly ["ally"] }) =>
  actionWith(id, {
    effects: [
      {
        kind: "reduceNextCardCost",
        player: { kind: "controller" },
        amount: { kind: "const", value: 1 },
        duration: "phase",
        ...(cardFilter ? { cardFilter } : {}),
      },
    ],
  });
const ALLY_DISCOUNT_ACTION = reduction("ally-discount.action", { categories: ["ally"] });
const ALLY_DISCOUNT = stubEvent({ id: "ally-discount", cost: 0, abilities: [ALLY_DISCOUNT_ACTION.ref] });
const ANY_DISCOUNT_ACTION = reduction("any-discount.action");
const ANY_DISCOUNT = stubEvent({ id: "any-discount", cost: 0, abilities: [ANY_DISCOUNT_ACTION.ref] });

// "If each of your allies has the Avenger trait, increase your ally limit by 1." (Avengers Tower's constant).
const TOWER_RULE = stubAbility("tower.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "allyLimit",
        amount: 1,
        while: {
          kind: "not",
          of: { kind: "exists", query: { categories: ["ally"], controller: "you", withoutTrait: AVENGER } },
        },
      },
    ],
  },
  effects: [],
});
const TOWER = stubSupport({ id: "tower", cost: 0, abilities: [TOWER_RULE.ref] });
const AVENGER_ALLY = stubAlly({ id: "avenger-ally", traits: [AVENGER], cost: 0, atk: 1, thw: 1, hp: 2 });
const PLAIN_ALLY = stubAlly({ id: "plain-ally", cost: 0, atk: 1, thw: 1, hp: 2 });
const DEMOLISH_ACTION = actionWith("demolish.action", {
  effects: [{ kind: "discardFromPlay", target: { kind: "named", name: TOWER.name } }],
});
const DEMOLISH = stubEvent({ id: "demolish", cost: 0, abilities: [DEMOLISH_ACTION.ref] });

// "Discard the top 2 cards of the encounter deck; draw 1 card for each boost icon discarded this way" (Hit Squad's shape).
const MILL_ACTION = actionWith("mill.action", {
  effects: [
    {
      kind: "moveCards",
      cards: { kind: "encounter", zones: ["deck"], top: { kind: "const", value: 2 } },
      to: "discard",
      bind: "milled",
    },
    { kind: "draw", player: { kind: "controller" }, amount: { kind: "var", name: "milled.boostIcons" } },
  ],
});
const MILL = stubEvent({ id: "mill", cost: 0, abilities: [MILL_ACTION.ref] });

const DEPS = depsOf(
  BLOCK_ACTION,
  TOSS_ACTION,
  TOSS_STUCK_ACTION,
  STUCK_RULE,
  STRENGTH_ACTION,
  GENERATOR_RESOURCE,
  OVERLOAD_ACTION,
  DOUBLE_ACTION,
  ALLY_DISCOUNT_ACTION,
  ANY_DISCOUNT_ACTION,
  TOWER_RULE,
  DEMOLISH_ACTION,
  MILL_ACTION,
);
const EXTRA_CARDS = [
  SHIELD,
  STUCK,
  BLOCK,
  TOSS,
  TOSS_STUCK,
  STRENGTH,
  GENERATOR,
  OVERLOAD,
  DOUBLE,
  ALLY_DISCOUNT,
  ANY_DISCOUNT,
  TOWER,
  AVENGER_ALLY,
  PLAIN_ALLY,
  DEMOLISH,
  MILL,
];
const twice = (ids: readonly string[]) => [...ids, ...ids];
const DECK = [
  ...DEFAULT_DECK,
  ...twice([SHIELD.id, BLOCK.id, TOSS.id, ALLY_DISCOUNT.id, ANY_DISCOUNT.id]),
  ...[
    STUCK.id,
    TOSS_STUCK.id,
    STRENGTH.id,
    GENERATOR.id,
    OVERLOAD.id,
    DOUBLE.id,
    TOWER.id,
    DEMOLISH.id,
    MILL.id,
    PLAIN_ALLY.id,
  ],
  ...twice(twice([AVENGER_ALLY.id])),
];

const game = (players = 1) =>
  newGame({ players, extraCards: EXTRA_CARDS, deck: DECK.map((id) => cardId(id)), deps: DEPS });
const run = (state: GameState, ...commands: readonly Command[]) => runWith(DEPS, state, ...commands);
const attempt = (state: GameState, command: Command) => applyCommand(state, command, DEPS);

const play = (id: InstanceId, payment: readonly Payment[] = [], costChoices?: CostChoices): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment,
  attachToInstanceId: null,
  ...(costChoices ? { costChoices } : {}),
});

const patch = (state: GameState, id: InstanceId, changes: Partial<ReturnType<typeof mustInstance>>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...changes } },
});

function expectRefused(state: GameState, command: Command, code: string): void {
  const result = attempt(state, command);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe(code);
}

/** Whether `legalActions` lists playing this card, and (if so) that its example command is accepted. */
function offered(state: GameState, id: InstanceId): boolean {
  const result = legalActions(state, p1, DEPS);
  if (result.kind !== "turn") return false;
  const entry = result.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === id);
  if (entry) expectOk(attempt(state, entry.example));
  return entry !== undefined;
}

/** Gives player 1 these cards and plays the free ones in order (shields, supports, allies). */
function inPlay(
  state: GameState,
  ...cards: readonly string[]
): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  const given = giveCards(state, p1, ...cards);
  return { state: given.ids.reduce((current, id) => run(current, play(id)), given.state), ids: given.ids };
}

describe('AbilityCost.exhaustCards (RRG 1.8 "Cost", pp. 13-14)', () => {
  it("a forced pick pays itself: the only matching card you control is exhausted with no costChoices", () => {
    const { state, ids } = inPlay(game(), SHIELD.id);
    const {
      state: dealt,
      ids: [block],
    } = giveCards(state, p1, BLOCK.id);
    const after = run(dealt, play(block!));
    expect(mustInstance(after, ids[0]!).exhausted).toBe(true);
  });

  it("with no matching card in play the ability can't be initiated, and legalActions doesn't offer it (p. 24, steps 3 and 5)", () => {
    const {
      state,
      ids: [block],
    } = giveCards(game(), p1, BLOCK.id);
    expectRefused(state, play(block!), "no_valid_target");
    expect(offered(state, block!)).toBe(false);
  });

  it("an exhausted match can't pay, and legalActions doesn't offer it", () => {
    const { state, ids } = inPlay(game(), SHIELD.id);
    const exhausted = patch(state, ids[0]!, { exhausted: true });
    const {
      state: dealt,
      ids: [block],
    } = giveCards(exhausted, p1, BLOCK.id);
    expectRefused(dealt, play(block!), "already_exhausted");
    expect(offered(dealt, block!)).toBe(false);
  });

  it("only cards the paying player controls can pay (p. 14; ruling June 25, 2026 #1)", () => {
    const { state, ids } = inPlay(game(2), SHIELD.id);
    const theirs = patch(state, ids[0]!, { controllerId: p2 });
    const {
      state: dealt,
      ids: [block],
    } = giveCards(theirs, p1, BLOCK.id);
    expectRefused(dealt, play(block!), "no_valid_target");
    expectRefused(dealt, play(block!, [], { exhausted: [ids[0]!] }), "no_valid_target");
  });

  it("finds your own copy when another player's same-named card is earlier in play", () => {
    // A `named` TargetRef returns only the first card in play with that name, then filtering by controller found
    // nothing. The query-based pick considers every candidate.
    const { state, ids } = inPlay(game(2), SHIELD.id, SHIELD.id);
    const [first, second] = cardsInPlay(state).filter((id) => ids.includes(id));
    const theirsFirst = patch(state, first!, { controllerId: p2 });
    const {
      state: dealt,
      ids: [block],
    } = giveCards(theirsFirst, p1, BLOCK.id);
    const after = run(dealt, play(block!));
    expect(mustInstance(after, second!).exhausted).toBe(true);
    expect(mustInstance(after, first!).exhausted).toBe(false);
  });

  it("an unforced pick must be named, exhausts only what was named, and legalActions still offers the card", () => {
    const { state, ids } = inPlay(game(), SHIELD.id, SHIELD.id);
    const {
      state: dealt,
      ids: [block],
    } = giveCards(state, p1, BLOCK.id);
    expectRefused(dealt, play(block!), "invalid_choice");
    expectRefused(dealt, play(block!, [], { exhausted: [ids[0]!, ids[1]!] }), "invalid_choice"); // max 1
    const after = run(dealt, play(block!, [], { exhausted: [ids[1]!] }));
    expect(mustInstance(after, ids[1]!).exhausted).toBe(true);
    expect(mustInstance(after, ids[0]!).exhausted).toBe(false);
    expect(offered(dealt, block!)).toBe(true);
  });

  it("a card outside play is not a legal pick, even if it matches the query", () => {
    const { state } = inPlay(game(), AVENGER_ALLY.id);
    const {
      state: dealt,
      ids: [strength, allyInHand],
    } = giveCards(state, p1, STRENGTH.id, ALLY.id);
    expectRefused(dealt, play(strength!, [], { exhausted: [allyInHand!] }), "no_valid_target");
  });

  it('"any number" exhausts every chosen card and binds the count, but needs at least one (p. 14)', () => {
    const { state, ids } = inPlay(game(), AVENGER_ALLY.id, AVENGER_ALLY.id);
    const {
      state: dealt,
      ids: [strength],
    } = giveCards(state, p1, STRENGTH.id);
    expectRefused(dealt, play(strength!, [], { exhausted: [] }), "invalid_choice");
    const handBefore = mustPlayer(dealt, p1).hand.length;
    const after = run(dealt, play(strength!, [], { exhausted: [...ids] }));
    for (const id of ids) expect(mustInstance(after, id).exhausted).toBe(true);
    expect(mustPlayer(after, p1).hand.length).toBe(handBefore - 1 + 2);
  });

  it("one card can't pay two parts of a cost: the ability's own exhaust and the pick (p. 13)", () => {
    const {
      state,
      ids: [double],
    } = inPlay(game(), DOUBLE.id);
    const use: Command = {
      type: "useAbility",
      playerId: p1,
      cardInstanceId: double!,
      abilityId: DOUBLE_ACTION.ref.id,
      payment: [],
    };
    expectRefused(state, use, "invalid_choice");
  });

  it("one card can't be exhausted both for a resource in the payment and for the cost (p. 13)", () => {
    const {
      state,
      ids: [generator],
    } = inPlay(game(), GENERATOR.id);
    const {
      state: dealt,
      ids: [overload],
    } = giveCards(state, p1, OVERLOAD.id, RESOURCE.id);
    const viaGenerator: Payment[] = [{ ability: { instanceId: generator!, abilityId: GENERATOR_RESOURCE.ref.id } }];
    expectRefused(dealt, play(overload!, viaGenerator, { exhausted: [generator!] }), "invalid_choice");
    const after = run(dealt, play(overload!, payFor(dealt, p1, 1), { exhausted: [generator!] }));
    expect(mustInstance(after, generator!).exhausted).toBe(true);
  });
});

describe("AbilityCost.returnToHand", () => {
  it("returns the card from play to its owner's hand, off its host, and pays together with discard X", () => {
    const {
      state,
      ids: [shield],
    } = inPlay(game(), SHIELD.id);
    const host = mustInstance(state, shield!).attachedTo!;
    const {
      state: dealt,
      ids: [toss, spare],
    } = giveCards(state, p1, TOSS.id, ALLY.id);
    const handBefore = mustPlayer(dealt, p1).hand.length;
    const after = run(dealt, play(toss!, [], { discard: [spare!] }));
    const hand = mustPlayer(after, p1).hand;
    expect(hand).toContain(shield);
    expect(mustInstance(after, host).attachments).not.toContain(shield);
    expect(mustPlayer(after, p1).discard).toContain(spare);
    // -1 Toss, -1 discarded, +1 Shield returned, +1 drawn for X = 1.
    expect(hand.length).toBe(handBefore);
  });

  it("when the return can't be paid, the discard isn't paid either: the ability can't be initiated (p. 24, step 5)", () => {
    const {
      state,
      ids: [toss, spare],
    } = giveCards(game(), p1, TOSS.id, ALLY.id);
    expectRefused(state, play(toss!, [], { discard: [spare!] }), "no_valid_target");
    expect(offered(state, toss!)).toBe(false);
  });

  it('a card that cannot leave play can\'t be returned as a cost (RRG 1.8 "Cannot", p. 11)', () => {
    const { state } = inPlay(game(), STUCK.id);
    const {
      state: dealt,
      ids: [toss],
    } = giveCards(state, p1, TOSS_STUCK.id);
    expectRefused(dealt, play(toss!), "no_valid_target");
  });
});

describe("reduceNextCardCost.cardFilter", () => {
  const reductions = (state: GameState) => state.lastingEffects.filter((effect) => effect.kind === "costReduction");

  it("waits through a card it doesn't match, then the matching card uses and consumes it", () => {
    const {
      state,
      ids: [discount, upgrade, ally1, ally2],
    } = giveCards(game(), p1, ALLY_DISCOUNT.id, UPGRADE.id, ALLY.id, ALLY.id, RESOURCE.id, RESOURCE.id, RESOURCE.id);
    const waiting = run(state, play(discount!));
    expectRefused(waiting, play(upgrade!), "insufficient_resources");
    const afterUpgrade = run(waiting, play(upgrade!, payFor(waiting, p1, 1)));
    expect(reductions(afterUpgrade)).toHaveLength(1);
    const afterAlly = run(afterUpgrade, play(ally1!, payFor(afterUpgrade, p1, 1)));
    expect(reductions(afterAlly)).toHaveLength(0);
    expectRefused(afterAlly, play(ally2!, payFor(afterAlly, p1, 1)), "insufficient_resources");
  });

  it("stacks with an unfiltered reduction: a matching card uses both, any other card only the unfiltered one", () => {
    const {
      state,
      ids: [allyDiscount, anyDiscount, upgrade, ally],
    } = giveCards(game(), p1, ALLY_DISCOUNT.id, ANY_DISCOUNT.id, UPGRADE.id, ALLY.id);
    const both = run(state, play(allyDiscount!), play(anyDiscount!));
    const afterUpgrade = run(both, play(upgrade!)); // 1 - 1 unfiltered = free
    expect(reductions(afterUpgrade).map((effect) => "cardFilter" in effect && effect.cardFilter !== undefined)).toEqual(
      [true],
    );
    expectRefused(afterUpgrade, play(ally!), "insufficient_resources"); // 2 - 1 = 1

    const {
      state: again,
      ids: [allyDiscount2, anyDiscount2],
    } = giveCards(afterUpgrade, p1, ALLY_DISCOUNT.id, ANY_DISCOUNT.id);
    const stacked = run(again, play(allyDiscount2!), play(anyDiscount2!));
    const afterAlly = run(stacked, play(ally!)); // 2 - 1 filtered - 1 unfiltered = free; both are consumed
    expect(reductions(afterAlly)).toHaveLength(0);
  });

  it("expires at the end of the phase when nothing matched it", () => {
    const {
      state,
      ids: [discount],
    } = giveCards(game(), p1, ALLY_DISCOUNT.id);
    const waiting = run(state, play(discount!));
    expect(reductions(waiting)).toHaveLength(1);
    // Ending the turn can stop at the end-of-phase hand-size discard. Settle every choice through to the next turn.
    const next = settle(run(waiting, { type: "endTurn", playerId: p1 }), undefined, DEPS);
    expect(next.step).toMatchObject({ phase: "player" });
    expect(reductions(next)).toHaveLength(0);
  });
});

describe('allyLimit.while (RRG 1.8 "Ally Limit", p. 7)', () => {
  const discardPrompt = (state: GameState) =>
    state.pendingChoice?.prompt.kind === "discardOverAllyLimit" ? state.pendingChoice : null;

  it("is read live when an ally enters play: a fourth Avenger fits, a non-Avenger drops the limit back to 3", () => {
    const { state } = inPlay(game(), TOWER.id, AVENGER_ALLY.id, AVENGER_ALLY.id, AVENGER_ALLY.id, AVENGER_ALLY.id);
    expect(discardPrompt(state)).toBeNull();
    expect(allyLimitFor(state, DEPS, p1)).toBe(4);
    const {
      state: dealt,
      ids: [plain],
    } = giveCards(state, p1, PLAIN_ALLY.id);
    const over = run(dealt, play(plain!));
    // OPEN QUESTION (reported): discarding the non-Avenger first would put the limit back to 4. This engine uses the
    // limit at the moment of the check and asks for all 2 discards at once.
    expect(discardPrompt(over)?.minSelections).toBe(2);
  });

  it("applies whenever the limit drops, not only when an ally enters: the Tower leaving play forces a discard", () => {
    const { state } = inPlay(game(), TOWER.id, AVENGER_ALLY.id, AVENGER_ALLY.id, AVENGER_ALLY.id, AVENGER_ALLY.id);
    const {
      state: dealt,
      ids: [demolish],
    } = giveCards(state, p1, DEMOLISH.id);
    const after = run(dealt, play(demolish!));
    expect(discardPrompt(after)?.minSelections).toBe(1);
  });
});

describe("value primitives", () => {
  const contextFor = (
    selfInstanceId: InstanceId | null,
    bindings: Record<string, readonly InstanceId[]> = {},
  ): EffectContext => ({
    selfInstanceId,
    controllerId: p1,
    event: null,
    bindings,
    deps: DEPS,
  });
  const halve = (value: number, round: "down" | "up", by = 2) =>
    resolveValue(game(), { kind: "scaled", value: { kind: "const", value }, divide: { by, round } }, contextFor(null));

  it("scaled.divide rounds the way the card says (RRG 1.8 p. 29 rounds up unless told otherwise)", () => {
    expect([
      halve(5, "down"),
      halve(5, "up"),
      halve(4, "down"),
      halve(1, "down"),
      halve(1, "up"),
      halve(0, "up"),
    ]).toEqual([2, 3, 2, 0, 1, 0]);
    expect(halve(5, "down", 0)).toBe(0); // an invalid divisor never produces NaN or Infinity
    const withTimes = resolveValue(
      game(),
      { kind: "scaled", value: { kind: "const", value: 7 }, divide: { by: 2, round: "down" }, times: 2, plus: 1 },
      contextFor(null),
    );
    expect(withTimes).toBe(7); // floor(7 / 2) * 2 + 1
  });

  it("maxPrintedCost as a value is re-read on every check", () => {
    const {
      state,
      ids: [quinjet],
    } = inPlay(game(), GENERATOR.id);
    const {
      state: dealt,
      ids: [ally],
    } = giveCards(state, p1, ALLY.id); // printed cost 2
    const query = {
      categories: ["ally"],
      maxPrintedCost: { kind: "counters", of: { kind: "self" }, counterType: "time" },
    } as const;
    const withCounters = (n: number) => patch(dealt, quinjet!, { counters: { time: n } });
    expect(matchesQuery(withCounters(1), ally!, query, contextFor(quinjet!))).toBe(false);
    expect(matchesQuery(withCounters(2), ally!, query, contextFor(quinjet!))).toBe(true);
    expect(matchesQuery(dealt, ally!, { categories: ["ally"], maxPrintedCost: 0 }, contextFor(quinjet!))).toBe(false);
  });

  it("countInRef counts matches among bound cards outside play, and an empty slot counts 0", () => {
    const state = game();
    const top = encounterDeckOf(state, activeEncounterDeckId(state)).deck.slice(0, 3);
    const treacheries = top.filter((id) => cardOf(state, id)?.type === "treachery").length;
    const count = (bindings: Record<string, readonly InstanceId[]>) =>
      resolveValue(
        state,
        { kind: "countInRef", cards: { kind: "slot", slot: "looked" }, query: { categories: ["treachery"] } },
        contextFor(null, bindings),
      );
    expect(count({ looked: top })).toBe(treacheries);
    expect(count({ looked: [] })).toBe(0);
    expect(count({})).toBe(0);
  });

  it("<bind>.boostIcons totals the boost icons (with modifiers) of every card a moveCards moved", () => {
    const {
      state,
      ids: [mill],
    } = giveCards(game(), p1, MILL.id);
    const top = encounterDeckOf(state, activeEncounterDeckId(state)).deck.slice(0, 2);
    const icons = top.reduce((sum, id) => sum + boostIconsFor(state, DEPS, id), 0);
    const handBefore = mustPlayer(state, p1).hand.length;
    const after = run(state, play(mill!));
    expect(mustPlayer(after, p1).hand.length).toBe(handBefore - 1 + icons);
  });
});
