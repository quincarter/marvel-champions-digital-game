/**
 * `InPlayCostPick.each`: a cost that takes every matching card the payer controls. Synthetic cards shaped like Family
 * Matters (`mojo` 39061): "Alter-Ego Action: Exhaust your identity and each support you control → discard this
 * obligation."
 *
 * Sources: RRG 1.8 "Initiating Abilities" (p. 24), step 3 "Determine the cost (or costs) … and the player's ability to
 * pay them" and step 5 "If this step is reached and the cost(s) cannot be paid, abort this process without paying any
 * costs"; "Cost Arrow Icon" (p. 14), the text before the arrow "must be paid and/or resolved in full"; "Cost" (p. 13),
 * "that player must pay costs with cards and/or game elements they control".
 */
import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command, CostChoices } from "./commands.js";
import { applyCommand, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession, runCommands } from "./testing/drive.js";
import { stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const hitVillain = (amount: ValueSpec) => ({ kind: "dealDamage", target: { kind: "villain" }, amount }) as const;
const SUPPORTS = { categories: ["support"] } as const;

/** "Action: Exhaust your identity and each support you control → deal 1 damage to the villain." */
const LEVER_ACTION = stubAbility(
  "lever.action",
  def({
    trigger: { kind: "action" },
    cost: { exhaustIdentity: true, exhaustCards: { slot: "exhausted", query: SUPPORTS, min: 0, each: true } },
    effects: [hitVillain({ kind: "const", value: 1 })],
  }),
);
const LEVER = stubUpgrade({ id: "lever", cost: 0, abilities: [LEVER_ACTION.ref] });

/** "Action: Exhaust each support you control → deal 1 damage to the villain for each support exhausted this way." */
const TALLY_ACTION = stubAbility(
  "tally.action",
  def({
    trigger: { kind: "action" },
    cost: { exhaustCards: { slot: "exhausted", query: SUPPORTS, min: 1, each: true, bind: "n" } },
    effects: [hitVillain({ kind: "var", name: "n" })],
  }),
);
const TALLY = stubUpgrade({ id: "tally", cost: 0, abilities: [TALLY_ACTION.ref] });

/** "Interrupt: When your turn would end, exhaust each support you control → deal 1 damage to the villain." */
const DUSK_INTERRUPT = stubAbility(
  "dusk.interrupt",
  def({
    trigger: { kind: "interrupt", forced: false, on: { on: "turnEnding", playerIs: "controller" } },
    cost: { exhaustCards: { slot: "exhausted", query: SUPPORTS, min: 1, each: true } },
    effects: [hitVillain({ kind: "const", value: 1 })],
  }),
);
const DUSK = stubUpgrade({ id: "dusk", cost: 0, abilities: [DUSK_INTERRUPT.ref] });

const GADGET = stubSupport({ id: "gadget", cost: 0 });

const CARDS = [LEVER, TALLY, DUSK, GADGET];
const deps = depsOf(LEVER_ACTION, TALLY_ACTION, DUSK_INTERRUPT);
const DECK: readonly CardId[] = CARDS.flatMap((card) => [card.id, card.id, card.id]);

const start = (players: 1 | 2 = 1): GameState => gameAtFirstTurn({ cards: CARDS, deps, players, deck: DECK });
const use = (card: InstanceId, ability: StubAbility, costChoices?: CostChoices): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: card,
  abilityId: ability.ref.id,
  payment: [],
  ...(costChoices ? { costChoices } : {}),
});
const exhausted = (state: GameState, id: InstanceId): boolean => mustInstance(state, id).exhausted;
const identityOf = (state: GameState, player = P1): InstanceId => mustPlayer(state, player).identity.instanceId;
const villainDamage = (state: GameState): number => mustInstance(state, state.activeVillainId).damage;
const exhaust = (state: GameState, id: InstanceId): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), exhausted: true } },
});
/** Whether `legalActions` offers P1 this card's ability, and (if so) that its example command is accepted. */
function offered(state: GameState, card: InstanceId): boolean {
  const result = legalActions(state, P1, deps);
  if (result.kind !== "turn") throw new Error(`not P1's turn: ${result.kind}`);
  const entry = result.legal.find((a) => a.action.kind === "useAbility" && a.action.instanceId === card);
  if (entry) expect(applyCommand(state, entry.example, deps).ok).toBe(true);
  return entry !== undefined;
}
function refusal(state: GameState, command: Command): string {
  const result = applyCommand(state, command, deps);
  if (result.ok) throw new Error("the command was accepted");
  return result.error.code;
}

describe("a cost that exhausts each matching card you control (InPlayCostPick.each)", () => {
  it("exhausts the identity and every support you control, with no picks named", () => {
    const lever = playerCardIntoPlay(start(), LEVER.id);
    const a = playerCardIntoPlay(lever.state, GADGET.id);
    const b = playerCardIntoPlay(a.state, GADGET.id);
    expect(offered(b.state, lever.id)).toBe(true);
    const { state } = runCommands(b.state, deps, use(lever.id, LEVER_ACTION));
    expect([a.id, b.id, identityOf(state)].map((id) => exhausted(state, id))).toEqual([true, true, true]);
    expect(exhausted(state, lever.id)).toBe(false); // an upgrade: not a support, not part of the cost
    expect(villainDamage(state)).toBe(villainDamage(b.state) + 1);
  });

  it("with no support in play that part asks for nothing: the identity alone pays", () => {
    const lever = playerCardIntoPlay(start(), LEVER.id);
    expect(offered(lever.state, lever.id)).toBe(true);
    const { state } = runCommands(lever.state, deps, use(lever.id, LEVER_ACTION));
    expect(exhausted(state, identityOf(state))).toBe(true);
    expect(villainDamage(state)).toBe(villainDamage(lever.state) + 1);
  });

  it("one exhausted support makes the cost unpayable: not offered, refused, and nothing is exhausted (p. 24, step 5)", () => {
    const lever = playerCardIntoPlay(start(), LEVER.id);
    const a = playerCardIntoPlay(lever.state, GADGET.id);
    const b = playerCardIntoPlay(a.state, GADGET.id);
    const blocked = exhaust(b.state, b.id);
    expect(offered(blocked, lever.id)).toBe(false);
    expect(refusal(blocked, use(lever.id, LEVER_ACTION))).toBe("already_exhausted");
    // Naming only the ready support does not pay "each" of them.
    expect(refusal(blocked, use(lever.id, LEVER_ACTION, { exhausted: [a.id] }))).toBe("already_exhausted");
    expect(exhausted(blocked, a.id)).toBe(false);
    expect(exhausted(blocked, identityOf(blocked))).toBe(false);
  });

  it("an exhausted identity leaves it unpayable however many supports are ready", () => {
    const lever = playerCardIntoPlay(start(), LEVER.id);
    const a = playerCardIntoPlay(lever.state, GADGET.id);
    const tired = exhaust(a.state, identityOf(a.state));
    expect(offered(tired, lever.id)).toBe(false);
    expect(applyCommand(tired, use(lever.id, LEVER_ACTION), deps).ok).toBe(false);
  });

  it("another player's supports are not exhausted, and their exhausted support does not stop the cost (p. 13)", () => {
    const lever = playerCardIntoPlay(start(2), LEVER.id);
    const mine = playerCardIntoPlay(lever.state, GADGET.id);
    const theirs = playerCardIntoPlay(mine.state, GADGET.id, P2);
    const theirTired = playerCardIntoPlay(theirs.state, GADGET.id, P2);
    const before = exhaust(theirTired.state, theirTired.id);
    expect(offered(before, lever.id)).toBe(true);
    const { state } = runCommands(before, deps, use(lever.id, LEVER_ACTION));
    expect(exhausted(state, mine.id)).toBe(true);
    expect(exhausted(state, theirs.id)).toBe(false);
    expect(exhausted(state, identityOf(state, P2))).toBe(false);
    // Naming another player's support as part of the set is refused.
    expect(refusal(before, use(lever.id, LEVER_ACTION, { exhausted: [theirs.id] }))).toBe("no_valid_target");
  });

  it("the set is read when the cost is paid: a support that entered play later is exhausted too", () => {
    const lever = playerCardIntoPlay(start(), LEVER.id);
    const first = playerCardIntoPlay(lever.state, GADGET.id);
    const later = playerCardIntoPlay(first.state, GADGET.id);
    const early = runCommands(first.state, deps, use(lever.id, LEVER_ACTION)).state;
    expect(exhausted(early, first.id)).toBe(true);
    const late = runCommands(later.state, deps, use(lever.id, LEVER_ACTION)).state;
    expect([first.id, later.id].map((id) => exhausted(late, id))).toEqual([true, true]);
    // The later support entering exhausted would instead make the cost unpayable.
    expect(offered(exhaust(later.state, later.id), lever.id)).toBe(false);
  });

  it("named picks must be exactly the whole set: a subset or a duplicate is refused, the full set accepted", () => {
    const lever = playerCardIntoPlay(start(), LEVER.id);
    const a = playerCardIntoPlay(lever.state, GADGET.id);
    const b = playerCardIntoPlay(a.state, GADGET.id);
    expect(refusal(b.state, use(lever.id, LEVER_ACTION, { exhausted: [a.id] }))).toBe("invalid_choice");
    expect(refusal(b.state, use(lever.id, LEVER_ACTION, { exhausted: [a.id, a.id] }))).toBe("invalid_choice");
    const { state } = runCommands(b.state, deps, use(lever.id, LEVER_ACTION, { exhausted: [b.id, a.id] }));
    expect([a.id, b.id].map((id) => exhausted(state, id))).toEqual([true, true]);
  });

  it("`min` is how many must match, and `bind` counts the cards that paid", () => {
    const tally = playerCardIntoPlay(start(), TALLY.id);
    expect(offered(tally.state, tally.id)).toBe(false);
    expect(refusal(tally.state, use(tally.id, TALLY_ACTION))).toBe("no_valid_target");
    const a = playerCardIntoPlay(tally.state, GADGET.id);
    const b = playerCardIntoPlay(a.state, GADGET.id);
    const c = playerCardIntoPlay(b.state, GADGET.id);
    const { state } = runCommands(c.state, deps, use(tally.id, TALLY_ACTION));
    expect(villainDamage(state)).toBe(villainDamage(c.state) + 3);
  });

  it("inside a timing window the player is not asked which cards: every support is exhausted", () => {
    const dusk = playerCardIntoPlay(start(), DUSK.id);
    const a = playerCardIntoPlay(dusk.state, GADGET.id);
    const b = playerCardIntoPlay(a.state, GADGET.id);
    const prompts: string[] = [];
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      prompts.push(choice.prompt.kind);
      return choice.prompt.kind === "chooseTriggers" ? choice.options.map((o) => o.optionId) : defaultPick(state);
    };
    const driven = driveSession(startSession(b.state), deps, [{ type: "endTurn", playerId: P1 }], pick);
    expect(prompts).toContain("chooseTriggers");
    expect(prompts).not.toContain("chooseCostCards");
    const exhaustedNow = driven.events.flatMap((e) => (e.type === "cardExhausted" ? [e.instanceId] : []));
    expect(exhaustedNow).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(villainDamage(driven.session.state)).toBe(villainDamage(b.state) + 1);
  });

  it("inside a timing window an exhausted support leaves the ability unoffered", () => {
    const dusk = playerCardIntoPlay(start(), DUSK.id);
    const a = playerCardIntoPlay(dusk.state, GADGET.id);
    const b = playerCardIntoPlay(a.state, GADGET.id);
    const blocked = exhaust(b.state, b.id);
    const prompts: string[] = [];
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseTriggers") {
        prompts.push(...choice.options.map((o) => o.optionId));
        return choice.options.map((o) => o.optionId);
      }
      return defaultPick(state);
    };
    const driven = driveSession(startSession(blocked), deps, [{ type: "endTurn", playerId: P1 }], pick);
    expect(prompts.some((id) => id.includes(dusk.id))).toBe(false);
    expect(driven.events.some((e) => e.type === "cardExhausted" && e.instanceId === a.id)).toBe(false);
  });
});
