/**
 * `InPlayCostPick.includesSelf`: a cost whose pick always holds the ability's own card. Synthetic cards shaped like The
 * Elephant's Trunk (`bp` 51007): "Alter-Ego Action: Exhaust The Elephant's Trunk and up to 2 other [Wakanda] allies
 * and/or supports you control → draw 1 card for each card exhausted this way (including this one)."
 *
 * Sources: RRG 1.8 FAQ "The Elephant's Trunk (#7)" (p. 65): "The Elephant's Trunk is itself a Wakanda support, so it
 * satisfies the minimum of one Wakanda ally or support needed to pay its ability's cost." RRG 1.8 "Cost" (p. 14): "A
 * cost requiring 'any number' or 'up to' some number of game elements requires a minimum of one"; (p. 13) multiple
 * costs "must be paid simultaneously", so one card pays one part. "Initiating Abilities" (p. 24), steps 3 and 5.
 */
import { trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command, CostChoices } from "./commands.js";
import { applyCommand, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession, runCommands } from "./testing/drive.js";
import { stubAlly, stubSupport } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const CLUB = trait("CLUB");
const def = (definition: AbilityDefinition) => definition;
const cost = {
  exhaustCards: {
    slot: "exhausted",
    query: { categories: ["ally", "support"], trait: CLUB },
    min: 1,
    max: 3,
    includesSelf: true,
    bind: "n",
  },
} as const;
const hitVillainPerCard = {
  kind: "dealDamage",
  target: { kind: "villain" },
  amount: { kind: "var", name: "n" },
} as const;

/** "Action: Exhaust this and up to 2 other [Club] allies and/or supports you control → deal 1 damage to the villain for each card exhausted this way (including this one)." */
const COUNCIL_ACTION = stubAbility(
  "council.action",
  def({ trigger: { kind: "action" }, cost, effects: [hitVillainPerCard] }),
);
const COUNCIL = { ...stubSupport({ id: "council", cost: 0, abilities: [COUNCIL_ACTION.ref] }), traits: [CLUB] };
/** The same cost on an interrupt, paid inside a timing window. */
const VIGIL_INTERRUPT = stubAbility(
  "vigil.interrupt",
  def({
    trigger: { kind: "interrupt", forced: false, on: { on: "turnEnding", playerIs: "controller" } },
    cost,
    effects: [hitVillainPerCard],
  }),
);
const VIGIL = { ...stubSupport({ id: "vigil", cost: 0, abilities: [VIGIL_INTERRUPT.ref] }), traits: [CLUB] };
const MEMBER = { ...stubSupport({ id: "member", cost: 0 }), traits: [CLUB] };
const MEMBER_ALLY = { ...stubAlly({ id: "member-ally", cost: 0, atk: 1, thw: 1, hp: 3 }), traits: [CLUB] };
const OUTSIDER = stubSupport({ id: "outsider", cost: 0 });

const CARDS = [COUNCIL, VIGIL, MEMBER, MEMBER_ALLY, OUTSIDER];
const deps = depsOf(COUNCIL_ACTION, VIGIL_INTERRUPT);
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
const villainDamage = (state: GameState): number => mustInstance(state, state.activeVillainId).damage;
const exhaust = (state: GameState, id: InstanceId): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), exhausted: true } },
});
/** The example command `legalActions` gives P1 for this card's ability, or undefined when it is not offered. */
function example(state: GameState, card: InstanceId): Command | undefined {
  const result = legalActions(state, P1, deps);
  if (result.kind !== "turn") throw new Error(`not P1's turn: ${result.kind}`);
  return result.legal.find((a) => a.action.kind === "useAbility" && a.action.instanceId === card)?.example;
}
function refusal(state: GameState, command: Command): string {
  const result = applyCommand(state, command, deps);
  if (result.ok) throw new Error("the command was accepted");
  return result.error.code;
}
/** The council in play with these other cards, in order. */
function table(others: readonly (typeof CARDS)[number][], players: 1 | 2 = 1) {
  const council = playerCardIntoPlay(start(players), COUNCIL.id);
  let state = council.state;
  const ids: InstanceId[] = [];
  for (const card of others) {
    const placed = playerCardIntoPlay(state, card.id);
    state = placed.state;
    ids.push(placed.id);
  }
  return { state, council: council.id, ids };
}

describe("a cost that exhausts this card and up to N others (InPlayCostPick.includesSelf)", () => {
  it("alone, the card itself meets the minimum of one (FAQ p. 65): 1 card exhausted, 1 damage, no picks named", () => {
    const t = table([OUTSIDER]);
    const { state } = runCommands(t.state, deps, use(t.council, COUNCIL_ACTION));
    expect(exhausted(state, t.council)).toBe(true);
    expect(exhausted(state, t.ids[0]!)).toBe(false);
    expect(villainDamage(state)).toBe(villainDamage(t.state) + 1);
  });

  it("legalActions' default pick is the card alone, whatever else could pay, and that command is accepted", () => {
    const t = table([MEMBER, MEMBER_ALLY]);
    const command = example(t.state, t.council);
    expect(command).toMatchObject({ type: "useAbility", costChoices: { exhausted: [t.council] } });
    const { state } = runCommands(t.state, deps, command!);
    expect([t.council, ...t.ids].map((id) => exhausted(state, id))).toEqual([true, false, false]);
    expect(villainDamage(state)).toBe(villainDamage(t.state) + 1);
  });

  it("with others able to pay the choice is the player's: no picks named is refused", () => {
    const t = table([MEMBER]);
    expect(refusal(t.state, use(t.council, COUNCIL_ACTION))).toBe("invalid_choice");
  });

  it("with 1 other: 2 cards exhausted, 2 damage; with 2 others (a support and an ally): 3 exhausted, 3 damage", () => {
    const t = table([MEMBER, MEMBER_ALLY]);
    const one = runCommands(t.state, deps, use(t.council, COUNCIL_ACTION, { exhausted: [t.council, t.ids[0]!] }));
    expect([t.council, ...t.ids].map((id) => exhausted(one.state, id))).toEqual([true, true, false]);
    expect(villainDamage(one.state)).toBe(villainDamage(t.state) + 2);
    // The card need not be named first.
    const two = runCommands(t.state, deps, use(t.council, COUNCIL_ACTION, { exhausted: [...t.ids, t.council] }));
    expect([t.council, ...t.ids].map((id) => exhausted(two.state, id))).toEqual([true, true, true]);
    expect(villainDamage(two.state)).toBe(villainDamage(t.state) + 3);
  });

  it("'up to 2 other': a third other is one too many, and nothing is exhausted", () => {
    const t = table([MEMBER, MEMBER, MEMBER_ALLY]);
    expect(refusal(t.state, use(t.council, COUNCIL_ACTION, { exhausted: [t.council, ...t.ids] }))).toBe(
      "invalid_choice",
    );
    expect(exhausted(t.state, t.council)).toBe(false);
  });

  it("picks that leave the card out are refused, however many others they name", () => {
    const t = table([MEMBER, MEMBER_ALLY]);
    expect(refusal(t.state, use(t.council, COUNCIL_ACTION, { exhausted: [t.ids[0]!] }))).toBe("invalid_choice");
    expect(refusal(t.state, use(t.council, COUNCIL_ACTION, { exhausted: [...t.ids] }))).toBe("invalid_choice");
  });

  it("a card that does not match, or another player's, is no pick", () => {
    const t = table([OUTSIDER], 2);
    const theirs = playerCardIntoPlay(t.state, MEMBER.id, P2);
    const picks = (other: InstanceId) => use(t.council, COUNCIL_ACTION, { exhausted: [t.council, other] });
    expect(refusal(theirs.state, picks(t.ids[0]!))).toBe("no_valid_target");
    expect(refusal(theirs.state, picks(theirs.id))).toBe("no_valid_target");
  });

  it("an exhausted card cannot pay with the others alone: not offered, refused, nothing exhausted (p. 24, step 5)", () => {
    const t = table([MEMBER, MEMBER_ALLY]);
    const tired = exhaust(t.state, t.council);
    expect(example(tired, t.council)).toBeUndefined();
    expect(refusal(tired, use(t.council, COUNCIL_ACTION))).toBe("already_exhausted");
    expect(refusal(tired, use(t.council, COUNCIL_ACTION, { exhausted: [...t.ids] }))).toBe("already_exhausted");
    expect(refusal(tired, use(t.council, COUNCIL_ACTION, { exhausted: [t.council, t.ids[0]!] }))).toBe(
      "already_exhausted",
    );
    expect(t.ids.map((id) => exhausted(tired, id))).toEqual([false, false]);
  });

  it("exhausted others are no picks, and the card still pays alone: 1 damage", () => {
    const t = table([MEMBER]);
    const tired = exhaust(t.state, t.ids[0]!);
    expect(refusal(tired, use(t.council, COUNCIL_ACTION, { exhausted: [t.council, t.ids[0]!] }))).toBe(
      "already_exhausted",
    );
    const { state } = runCommands(tired, deps, use(t.council, COUNCIL_ACTION));
    expect(villainDamage(state)).toBe(villainDamage(tired) + 1);
  });

  /** Ends the turn with a Vigil and these others in play, taking the interrupt and answering its cost prompt with `others`. */
  function endTurnWith(cards: readonly (typeof CARDS)[number][], others: (offered: readonly string[]) => string[]) {
    const vigil = playerCardIntoPlay(start(), VIGIL.id);
    let state = vigil.state;
    const ids: InstanceId[] = [];
    for (const card of cards) {
      const placed = playerCardIntoPlay(state, card.id);
      state = placed.state;
      ids.push(placed.id);
    }
    const asked: { options: string[]; max: number }[] = [];
    const pick = (s: GameState): readonly string[] => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
      if (choice?.prompt.kind === "chooseCostCards") {
        const options = choice.options.map((o) => o.optionId);
        asked.push({ options, max: choice.maxSelections });
        return others(options);
      }
      return defaultPick(s);
    };
    const driven = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }], pick);
    const exhaustedNow = driven.events.flatMap((e) => (e.type === "cardExhausted" ? [e.instanceId] : []));
    return {
      vigil: vigil.id,
      ids,
      asked,
      exhaustedNow,
      dealt: villainDamage(driven.session.state) - villainDamage(state),
    };
  }

  it("inside a timing window only the others are asked for (up to 2 of them), and the card is added: 3 exhausted, 3 damage", () => {
    const run = endTurnWith([MEMBER, MEMBER, MEMBER_ALLY], (offered) => offered.slice(0, 2));
    expect(run.asked).toEqual([{ options: run.ids, max: 2 }]);
    expect(run.exhaustedNow).toEqual(expect.arrayContaining([run.vigil, run.ids[0]!, run.ids[1]!]));
    expect(run.exhaustedNow).not.toContain(run.ids[2]!);
    expect(run.dealt).toBe(3);
  });

  it("inside a timing window, picking none of the others pays with the card alone: 1 damage", () => {
    const run = endTurnWith([MEMBER], () => []);
    expect(run.asked).toEqual([{ options: run.ids, max: 1 }]);
    expect(run.exhaustedNow).toContain(run.vigil);
    expect(run.exhaustedNow).not.toContain(run.ids[0]!);
    expect(run.dealt).toBe(1);
  });

  it("inside a timing window with no other card nothing is asked: 1 damage", () => {
    const run = endTurnWith([OUTSIDER], () => []);
    expect(run.asked).toEqual([]);
    expect(run.dealt).toBe(1);
  });
});
