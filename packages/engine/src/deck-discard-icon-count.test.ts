/**
 * docs/phase7-wave7.md §3.56: `RuleSpec deckDiscardIconCount`, "When counting resources on cards discarded from the top
 * of your deck, count each printed [wild] icon twice" on an identity's hero face, read by the `<bind>.<type>` totals of
 * a `moveCards` and by `ValueSpec totalPrintedResources` over the cards an effect or a cost discarded from that deck.
 * Synthetic cards only: `gadget` carries one action per way of discarding, and each writes what it counted onto `meter`.
 *
 * Sources: MC40 p. 21 FAQ: "When you use an ability that counts resource icons on cards discarded from your deck, each
 * [wild] discarded this way is treated as two [wild] icons" (the icon is wild: the card, and the owner, 2026-10-05), so
 * a count by type reads two wilds; MC40 p. 22: "wild resource icons discarded from the top of your deck count double".
 * RRG 1.8 "Wild Resource" (p. 48): "When resources are not being generated for a cost, a wild resource does not have
 * any characteristic other than 'wild resource.' In such contexts, wild resources cannot be interpreted as any of the
 * other resource types", so the two counted wilds are not two icons of a chosen type. RRG 1.8 "Text Box" (p. 44): a
 * blanked identity has no such ability. Owner decisions §4.1 Q31 = A (any effect or cost that discards from that
 * deck), Q32 = B (a card a response took away is not counted).
 */

import type { HeroIdentityCard, ResourceIconCounts } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { CardSelector, EffectSpec, PlayerRef, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, type StubAbility, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAttachment, stubEvent, stubIdentity, stubResource, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, newGame, TREACHERY } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, P1, P2 } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const you: PlayerRef = { kind: "controller" };
const constant = (value: number): ValueSpec => ({ kind: "const", value });

/** "When counting resources on cards discarded from the top of your deck, count each printed [wild] icon twice." */
const RULE = stubAbility(
  "lucky.constant",
  def({
    trigger: { kind: "constant", rules: [{ kind: "deckDiscardIconCount", player: you, resource: "wild", times: 2 }] },
    effects: [],
  }),
);
const identity = (id: string, heroAbilities: readonly StubAbility[]): HeroIdentityCard =>
  stubIdentity({
    id,
    hp: 10,
    atk: 2,
    thw: 2,
    def: 2,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
    heroAbilities: heroAbilities.map((ability) => ability.ref),
  });
/** The rule is printed on the hero face only. */
const LUCKY = identity("lucky", [RULE]);
const PLAIN = identity("plain", []);

const icons = (id: string, resourceIcons: ResourceIconCounts) => stubEvent({ id, cost: 0, resourceIcons });
const NONE = icons("none", {});
const WILD = stubResource({ id: "wild", icons: 1 });
const TRIO = icons("trio", { energy: 1, mental: 1, physical: 1 });
const DUO = icons("duo", { wild: 1, physical: 1 });
const TWIN = icons("twin", { wild: 2 });
/** One wild icon, and "Response: After this card is discarded from the top of your deck, add it to your hand." */
const TAKEN_RESPONSE = stubAbility(
  "taken.response",
  def({
    trigger: { kind: "response", forced: false, on: { on: "cardDiscardedFromDeck", selfIs: "target" } },
    effects: [{ kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "hand" }],
    activeIn: "discard",
  }),
);
const TAKEN = stubResource({ id: "taken", icons: 1, abilities: [TAKEN_RESPONSE.ref] });
const METER = stubSupport({ id: "meter", cost: 0 });
const PRICEY = stubUpgrade({ id: "pricey", cost: 2 });
/** "Attach to your identity. Treat your identity's printed text box as if it were blank." */
const COLLAR_RULE = stubAbility(
  "collar.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [{ kind: "blankTextBox", target: { categories: ["identity"], hostOfSelf: true } }],
    },
    effects: [],
  }),
);
const COLLAR = stubAttachment({ id: "collar", abilities: [COLLAR_RULE.ref] });

const meter: TargetRef = { kind: "named", name: METER.name };
const TYPES = ["physical", "mental", "energy", "wild"] as const;
const write = (counterType: string, amount: ValueSpec): EffectSpec => ({
  kind: "addCounters",
  target: meter,
  counterType,
  amount,
});
/** Counts a bound set with `totalPrintedResources`: every icon as `total`, and each type as `<type>`. */
const countSlot = (name: string): readonly EffectSpec[] => {
  const cards: TargetRef = { kind: "slot", slot: name };
  return [
    write("total", { kind: "totalPrintedResources", cards }),
    ...TYPES.map((type) => write(type, { kind: "totalPrintedResources", cards, types: [type] })),
  ];
};
/** Reads the `<bind>.<type>` totals a `moveCards` reports, as `var.<type>`. */
const readVars = (name: string): readonly EffectSpec[] =>
  TYPES.map((type) => write(`var.${type}`, { kind: "var", name: `${name}.${type}` }));
const topOfDeck = (n: number, player: PlayerRef = you): CardSelector => ({
  kind: "zone",
  zone: "deck",
  player,
  top: constant(n),
});
const action = (id: string, definition: Omit<AbilityDefinition, "trigger">) =>
  stubAbility(`gadget.${id}`, def({ trigger: { kind: "action" }, ...definition }));
const milling = (cards: CardSelector): readonly EffectSpec[] => [
  { kind: "moveCards", cards, to: "discard", bind: "milled" },
  ...countSlot("milled"),
  ...readVars("milled"),
];

// "Discard the top card (top 3 cards) of your deck. For each resource icon discarded this way, …"
const MILL_1 = action("mill-1", { effects: milling(topOfDeck(1)) });
const MILL_3 = action("mill-3", { effects: milling(topOfDeck(3)) });
// "Discard the top card (top 2 cards) of your deck → … for each resource icon discarded this way."
const PAY_1 = action("pay-1", {
  cost: { discardFromDeck: 1, discardFromDeckSlot: "paid" },
  effects: countSlot("paid"),
});
const PAY_2 = action("pay-2", {
  cost: { discardFromDeck: 2, discardFromDeckSlot: "paid" },
  effects: countSlot("paid"),
});
// "Discard cards from the top of your deck until you discard a [wild] card. Count the resources on it."
const UNTIL = action("until", {
  effects: [
    { kind: "discardDeckUntil", player: you, filter: { printedResource: "wild" }, bind: "found" },
    ...countSlot("found"),
  ],
});
// The other player's deck, and a card that was never in a deck.
const MILL_THEIRS = action("mill-theirs", { effects: milling(topOfDeck(1, { kind: "id", playerId: P2 })) });
const TOSS = action("toss", {
  effects: milling({ kind: "zone", zone: "hand", player: you, filter: { name: WILD.name } }),
});
const GADGET_ACTIONS = [MILL_1, MILL_3, PAY_1, PAY_2, UNTIL, MILL_THEIRS, TOSS];
const GADGET = stubSupport({ id: "gadget", cost: 0, abilities: GADGET_ACTIONS.map((ability) => ability.ref) });

/** No ability hears a deck discard: nothing is announced, and the counts must not depend on that. */
const deps: EngineDeps = depsOf(RULE, COLLAR_RULE, ...GADGET_ACTIONS);
const hearingDeps: EngineDeps = depsOf(RULE, COLLAR_RULE, TAKEN_RESPONSE, ...GADGET_ACTIONS);

type Name = "none" | "wild" | "trio" | "duo" | "twin" | "taken";
interface Table {
  readonly state: GameState;
  readonly gadget: InstanceId;
  readonly meter: InstanceId;
  /** p1's deck top, in order. */
  readonly top: readonly InstanceId[];
}

/**
 * Two players; p1 in `form` (hero by default) with the gadget and the meter in play, their deck `top` (in order) then
 * blanks, every other card of theirs in hand. p2 stays in alter-ego form, so their own copy of the identity's hero text
 * is not in force, with `theirs` on top of their deck. Surgery before the first command.
 */
function start(
  top: readonly Name[],
  options: {
    readonly rule?: boolean;
    readonly form?: "hero" | "alterEgo";
    readonly theirs?: readonly Name[];
    readonly using?: EngineDeps;
  } = {},
): Table {
  const base = newGame({
    identity: options.rule === false ? PLAIN : LUCKY,
    players: 2,
    extraCards: [NONE, WILD, TRIO, DUO, TWIN, TAKEN, METER, PRICEY, GADGET, COLLAR],
    deck: [
      ...copiesOf(NONE.id, 10),
      ...copiesOf(WILD.id, 3),
      ...copiesOf(TRIO.id, 2),
      ...copiesOf(DUO.id, 2),
      ...copiesOf(TWIN.id, 2),
      ...copiesOf(TAKEN.id, 2),
      METER.id,
      PRICEY.id,
      GADGET.id,
    ],
    encounterDeck: [COLLAR.id, ...copiesOf(TREACHERY.id, 20)],
    deps: options.using ?? deps,
  });
  const taken = new Set<InstanceId>();
  const stack = (playerId: PlayerId, names: readonly string[]) => {
    const seat = mustPlayer(base, playerId);
    const pool = [...seat.hand, ...seat.deck, ...seat.discard];
    const take = (cardId: string): InstanceId => {
      const id = pool.find((candidate) => !taken.has(candidate) && base.instances[candidate]?.cardId === cardId);
      if (!id) throw new Error(`no ${cardId} copy left`);
      taken.add(id);
      return id;
    };
    const topIds = names.map(take);
    const rest = Array.from({ length: 4 }, () => take(NONE.id));
    return { pool, take, deck: [...topIds, ...rest], topIds };
  };
  const mine = stack(P1, top);
  const gadget = mine.take(GADGET.id);
  const meterId = mine.take(METER.id);
  const theirs = stack(P2, options.theirs ?? []);
  const instances = { ...base.instances };
  for (const id of [gadget, meterId]) instances[id] = { ...mustInstance(base, id), controllerId: P1, faceup: true };
  const state: GameState = {
    ...base,
    instances,
    players: base.players.map((p) => {
      const seat = p.playerId === P1 ? mine : theirs;
      return {
        ...p,
        hand: seat.pool.filter((id) => !taken.has(id)),
        deck: seat.deck,
        discard: [],
        playArea: p.playerId === P1 ? [...p.playArea, gadget, meterId] : p.playArea,
        identity: { ...p.identity, form: p.playerId === P1 ? (options.form ?? "hero") : ("alterEgo" as const) },
      };
    }),
  };
  return { state, gadget, meter: meterId, top: mine.topIds };
}

type Pick = (state: GameState) => readonly string[];
/** Triggers the card's own response to its discard whenever it is offered. */
const takingBack: Pick = (state) => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind !== "chooseTriggers") return defaultPick(state);
  return choice.options
    .filter((option) => option.ref.kind === "ability" && option.ref.abilityId === TAKEN_RESPONSE.ref.id)
    .map((option) => option.optionId);
};
const use = (table: Table, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: table.gadget,
  abilityId: ability.ref.id,
  payment: [],
});
function run(table: Table, ability: StubAbility, using: EngineDeps = deps, pick: Pick = defaultPick) {
  return runCommandsPicking(table.state, using, pick, use(table, ability));
}
/** What the meter reads after the ability: `[total, physical, mental, energy, wild]` by `totalPrintedResources`. */
const counted = (state: GameState, table: Table): readonly number[] => {
  const counters = mustInstance(state, table.meter).counters;
  return ["total", ...TYPES].map((type) => counters[type] ?? 0);
};
/** The `<bind>.<type>` vars the `moveCards` reported: `[physical, mental, energy, wild]`. */
const reported = (state: GameState, table: Table): readonly number[] => {
  const counters = mustInstance(state, table.meter).counters;
  return TYPES.map((type) => counters[`var.${type}`] ?? 0);
};
function expectReplays(result: ReturnType<typeof run>, using: EngineDeps = deps): void {
  const replayed = replay(result.session.log, using);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.session.state);
}

/** Surgery: the blanking attachment on p1's identity (no reveal). */
function collared(table: Table): Table {
  const placed = encounterCardInVillainArea(table.state, COLLAR.id);
  const host = mustPlayer(placed.state, P1).identity.instanceId;
  const state: GameState = {
    ...placed.state,
    villainArea: placed.state.villainArea.filter((id) => id !== placed.id),
    instances: {
      ...placed.state.instances,
      [placed.id]: { ...mustInstance(placed.state, placed.id), attachedTo: host },
      [host]: {
        ...mustInstance(placed.state, host),
        attachments: [...mustInstance(placed.state, host).attachments, placed.id],
      },
    },
  };
  return { ...table, state };
}

describe("§3.56 without the rule, a discarded card's icons count as printed", () => {
  it("one wild icon counts 1, by an effect and by a cost", () => {
    const effect = start(["wild"], { rule: false });
    const milled = run(effect, MILL_1);
    expect(counted(milled.state, effect)).toEqual([1, 0, 0, 0, 1]);
    expect(reported(milled.state, effect)).toEqual([0, 0, 0, 1]);
    const cost = start(["wild"], { rule: false });
    expect(counted(run(cost, PAY_1).state, cost)).toEqual([1, 0, 0, 0, 1]);
  });

  it("three different icons count 3; a wild and a physical count 2", () => {
    const trio = start(["trio"], { rule: false });
    expect(counted(run(trio, MILL_1).state, trio)).toEqual([3, 1, 1, 1, 0]);
    const duo = start(["duo"], { rule: false });
    expect(counted(run(duo, MILL_1).state, duo)).toEqual([2, 1, 0, 0, 1]);
  });
});

describe("§3.56 with the rule, each printed wild icon of a card discarded from your deck counts twice", () => {
  it("discarded by an effect: one wild counts 2, as two wild icons in the totalPrintedResources count and the vars", () => {
    const table = start(["wild"]);
    const result = run(table, MILL_1);
    expect(counted(result.state, table)).toEqual([2, 0, 0, 0, 2]);
    expect(reported(result.state, table)).toEqual([0, 0, 0, 2]);
    expect(mustPlayer(result.state, P1).discard).toEqual([table.top[0]]);
    expectReplays(result);
  });

  it("discarded as a cost: the cost's slot is counted the same way by the ability's effects", () => {
    const table = start(["wild"]);
    const result = run(table, PAY_1);
    expect(counted(result.state, table)).toEqual([2, 0, 0, 0, 2]);
    expectReplays(result);
  });

  it("three different icons, none wild, still count 3", () => {
    const effect = start(["trio"]);
    const milled = run(effect, MILL_1);
    expect(counted(milled.state, effect)).toEqual([3, 1, 1, 1, 0]);
    expect(reported(milled.state, effect)).toEqual([1, 1, 1, 0]);
    const cost = start(["trio"]);
    expect(counted(run(cost, PAY_1).state, cost)).toEqual([3, 1, 1, 1, 0]);
  });

  it("a wild and another icon count 3: the wild twice, the physical once", () => {
    const table = start(["duo"]);
    const result = run(table, MILL_1);
    expect(counted(result.state, table)).toEqual([3, 1, 0, 0, 2]);
    expect(reported(result.state, table)).toEqual([1, 0, 0, 2]);
  });

  it("two wild icons on one card each count twice: 4", () => {
    const effect = start(["twin"]);
    expect(counted(run(effect, MILL_1).state, effect)).toEqual([4, 0, 0, 0, 4]);
    const cost = start(["twin"]);
    expect(counted(run(cost, PAY_1).state, cost)).toEqual([4, 0, 0, 0, 4]);
  });

  it("several cards discarded at once sum: wild (2) + three icons (3) + wild and physical (3) = 8", () => {
    const table = start(["wild", "trio", "duo"]);
    const result = run(table, MILL_3);
    expect(counted(result.state, table)).toEqual([8, 2, 1, 1, 4]);
    expect(reported(result.state, table)).toEqual([2, 1, 1, 4]);
  });

  it("several cards discarded as one cost sum: wild (2) + wild and physical (3) = 5", () => {
    const table = start(["wild", "duo"]);
    expect(counted(run(table, PAY_2).state, table)).toEqual([5, 1, 0, 0, 4]);
  });

  it("a 'discard until' counts the card it stopped on the same way", () => {
    const table = start(["none", "trio", "duo"]);
    const result = run(table, UNTIL);
    expect(mustPlayer(result.state, P1).discard).toHaveLength(3);
    // Only the card found is in the set: the three icons passed over are not counted.
    expect(counted(result.state, table)).toEqual([3, 1, 0, 0, 2]);
  });

  it("counts the same in a game where an ability hears deck discards and none answers this one", () => {
    const table = start(["wild", "duo"], { using: hearingDeps });
    const result = run(table, MILL_3, hearingDeps);
    expect(counted(result.state, table)).toEqual([5, 1, 0, 0, 4]);
    expectReplays(result, hearingDeps);
  });
});

describe("§3.56 the rule is its identity's, about its player's deck, while its text is in force", () => {
  it("a card discarded from another player's deck is not doubled", () => {
    const table = start([], { theirs: ["wild"] });
    const result = run(table, MILL_THEIRS);
    expect(mustPlayer(result.state, P2).discard).toHaveLength(1);
    expect(counted(result.state, table)).toEqual([1, 0, 0, 0, 1]);
    expect(reported(result.state, table)).toEqual([0, 0, 0, 1]);
  });

  it("a card discarded from hand is not doubled", () => {
    const table = start([]);
    const inHand = mustPlayer(table.state, P1).hand.filter((id) => table.state.instances[id]?.cardId === WILD.id);
    expect(inHand).toHaveLength(3);
    const result = run(table, TOSS);
    expect(counted(result.state, table)).toEqual([3, 0, 0, 0, 3]);
    expect(reported(result.state, table)).toEqual([0, 0, 0, 3]);
  });

  it("printed on the hero face only: in alter-ego form nothing is doubled", () => {
    const effect = start(["wild"], { form: "alterEgo" });
    expect(counted(run(effect, MILL_1).state, effect)).toEqual([1, 0, 0, 0, 1]);
    const cost = start(["wild"], { form: "alterEgo" });
    expect(counted(run(cost, PAY_1).state, cost)).toEqual([1, 0, 0, 0, 1]);
  });

  it("the identity's text box blanked: nothing is doubled (RRG 1.8 'Text Box', p. 44)", () => {
    const effect = collared(start(["wild"]));
    const milled = run(effect, MILL_1);
    expect(counted(milled.state, effect)).toEqual([1, 0, 0, 0, 1]);
    expect(reported(milled.state, effect)).toEqual([0, 0, 0, 1]);
    const cost = collared(start(["duo"]));
    expect(counted(run(cost, PAY_1).state, cost)).toEqual([2, 1, 0, 0, 1]);
  });

  it("paying a cost with a wild resource from hand is unaffected: one card pays 1, not 2", () => {
    const table = start(["wild"]);
    const seat = mustPlayer(table.state, P1);
    const pricey = seat.hand.find((id) => table.state.instances[id]?.cardId === PRICEY.id)!;
    const [first, second] = seat.hand.filter((id) => table.state.instances[id]?.cardId === WILD.id);
    const play = (payment: readonly (InstanceId | undefined)[]): Command => ({
      type: "playCard",
      playerId: P1,
      cardInstanceId: pricey,
      payment: payment.map((id) => ({ fromHand: id! })),
      attachToInstanceId: null,
    });
    expect(applyCommand(table.state, play([first]), deps).ok).toBe(false);
    // After a wild card was discarded from the deck and counted twice, the wilds in hand are still one resource each.
    const after = run(table, MILL_1).state;
    expect(applyCommand(after, play([first]), deps).ok).toBe(false);
    expect(applyCommand(after, play([first, second]), deps).ok).toBe(true);
  });
});

describe("§3.56 with §4.1 Q32 = B: a card a response took away is not counted", () => {
  it("an effect's discard taken back to hand contributes 0, rule or not", () => {
    const table = start(["taken"], { using: hearingDeps });
    const result = run(table, MILL_1, hearingDeps, takingBack);
    expect(mustPlayer(result.state, P1).hand).toContain(table.top[0]);
    expect(counted(result.state, table)).toEqual([0, 0, 0, 0, 0]);
    expect(reported(result.state, table)).toEqual([0, 0, 0, 0]);
    expectReplays(result, hearingDeps);
  });

  it("a cost's discard taken back to hand contributes 0", () => {
    const table = start(["taken"], { using: hearingDeps });
    const result = run(table, PAY_1, hearingDeps, takingBack);
    expect(mustPlayer(result.state, P1).hand).toContain(table.top[0]);
    expect(counted(result.state, table)).toEqual([0, 0, 0, 0, 0]);
  });

  it("the cards left are counted with the rule: taken (0) + wild (2) + wild and physical (3) = 5", () => {
    const table = start(["taken", "wild", "duo"], { using: hearingDeps });
    const result = run(table, MILL_3, hearingDeps, takingBack);
    expect(mustPlayer(result.state, P1).hand).toContain(table.top[0]);
    expect(counted(result.state, table)).toEqual([5, 1, 0, 0, 4]);
    expect(reported(result.state, table)).toEqual([1, 0, 0, 4]);
  });

  it("left in the discard pile (the response declined), the card counts twice like any other", () => {
    const table = start(["taken"], { using: hearingDeps });
    const result = run(table, MILL_1, hearingDeps, (state) =>
      state.pendingChoice?.prompt.kind === "chooseTriggers" ? [] : defaultPick(state),
    );
    expect(mustPlayer(result.state, P1).discard).toEqual([table.top[0]]);
    expect(counted(result.state, table)).toEqual([2, 0, 0, 0, 2]);
  });
});
