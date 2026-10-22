/**
 * Choosing an option of a "choose one" as a triggering condition (`TriggerEvent optionChoosing`), and a rule that bars a
 * named option (`RuleSpec cannotChooseOption`): the TRAP! cards' "Avoid", "Disarm" and "Trip" effects (Shadowland, MC65
 * pp. 12-13), answered by "Forced Interrupt: When you choose the 'Avoid' effect or the 'Trip' effect on a Trap! card"
 * (Path of a Thousand Cuts, 65049) and barred by "you cannot choose the 'Avoid' effect on Trap! cards" (Iron Monk,
 * 65047). An option is named by its `tag`, never by its display label.
 *
 * RRG 1.8 "Interrupt" (p. 25): an interrupt resolves "when its triggering condition initiates, but before that
 * triggering condition resolves", so after the choice and before the chosen option's effects. RRG 1.8 "Choose
 * (Option)" (p. 12) and "'Cannot'" (p. 11): a barred option is not offered; one option left resolves without asking.
 *
 * Synthetic cards. "Panel" (a TRAP! support) and "Plain" (no trait) each have an action "choose one: Red (tag `red`),
 * Blue (tag `blue`) or Green (no tag)", each placing a counter of its colour on the card. "Duo" (TRAP!) offers Red and
 * Green only. "Watcher" is a side scheme with "Forced Interrupt: When you choose the Red effect on a TRAP! card, deal 1
 * damage to your identity". "Monk" is a minion with "While engaged with you, you cannot choose the Red effect on TRAP!
 * cards".
 */

import { trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import type { Command } from "./commands.js";
import { startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, PlayerRef, Predicate, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMinion, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import {
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const TRAP = trait("TRAP!");
const TRAP_CARD: TargetQuery = { trait: TRAP };
const you: PlayerRef = { kind: "controller" };
const self: TargetRef = { kind: "self" };
const count = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: self,
  counterType,
  amount: { kind: "const", value: 1 },
});

const red = { label: "Red: place a red counter", tag: "red", effects: [count("red")] };
const blue = { label: "Blue: place a blue counter", tag: "blue", effects: [count("blue")] };
const green = { label: "Green: place a green counter", effects: [count("green")] };
type Option = {
  readonly label: string;
  readonly tag?: string;
  readonly condition?: Predicate;
  readonly effects: readonly EffectSpec[];
};
const chooser = (id: string, options: readonly Option[]): StubAbility =>
  stubAbility(id, {
    trigger: { kind: "action" },
    effects: [{ kind: "chooseOne", chooser: you, options }],
  } satisfies AbilityDefinition);

const PANEL_CHOOSE = chooser("panel.choose", [red, blue, green]);
/** The same choice, made by P2 ("P2 chooses one: …"): the chooser is "you" for the event. */
const PANEL_P2_CHOOSES = stubAbility("panel.p2-chooses", {
  trigger: { kind: "action" },
  effects: [{ kind: "chooseOne", chooser: { kind: "id", playerId: P2 }, options: [red, blue, green] }],
} satisfies AbilityDefinition);
const PANEL = stubSupport({
  id: "panel",
  cost: 0,
  traits: [TRAP],
  abilities: [PANEL_CHOOSE.ref, PANEL_P2_CHOOSES.ref],
});
const PLAIN_CHOOSE = chooser("plain.choose", [red, blue, green]);
const PLAIN = stubSupport({ id: "plain", cost: 0, abilities: [PLAIN_CHOOSE.ref] });
const DUO_CHOOSE = chooser("duo.choose", [red, green]);
const DUO = stubSupport({ id: "duo", cost: 0, traits: [TRAP], abilities: [DUO_CHOOSE.ref] });
/** Red, and a Green that is never available (outside a campaign): Red, tagged, is the only option. */
const SOLO_CHOOSE = chooser("solo.choose", [red, { ...green, condition: { kind: "inCampaign" } }]);
const SOLO = stubSupport({ id: "solo", cost: 0, traits: [TRAP], abilities: [SOLO_CHOOSE.ref] });

/** What `on.optionChosen(["red"], { source: TRAP })` compiles to. */
const YOU_CHOOSE_RED: EventPattern = {
  on: "optionChoosing",
  playerIs: "controller",
  eventIs: { tag: ["red"] },
  sourceIs: TRAP_CARD,
};
const WATCHER_ANSWER = stubAbility("watcher.answer", {
  trigger: { kind: "interrupt", forced: true, on: YOU_CHOOSE_RED },
  effects: [
    { kind: "dealDamage", target: { kind: "identityOf", player: you }, amount: { kind: "const", value: 1 } },
    count("heard"),
  ],
} satisfies AbilityDefinition);
const WATCHER = stubSideScheme({ id: "watcher", startingThreat: 3, abilities: [WATCHER_ANSWER.ref] });

const MONK_RULE = stubAbility("monk.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "cannotChooseOption",
        player: { kind: "engagedWith", of: self },
        tags: ["red"],
        sources: TRAP_CARD,
      },
    ],
  },
  effects: [],
} satisfies AbilityDefinition);
const MONK = stubMinion({ id: "monk", atk: 1, sch: 1, hp: 4, abilities: [MONK_RULE.ref] });

const deps: EngineDeps = depsOf(
  PANEL_CHOOSE,
  PANEL_P2_CHOOSES,
  PLAIN_CHOOSE,
  DUO_CHOOSE,
  SOLO_CHOOSE,
  WATCHER_ANSWER,
  MONK_RULE,
);

interface Table {
  readonly state: GameState;
  readonly ids: Readonly<Record<string, InstanceId>>;
}

/** Panel, Plain and Duo in play under P1; the watcher in the villain's area; the monk engaged with P1, in the villain's area, or absent. */
function table(
  opts: {
    readonly watcher?: boolean;
    readonly monk?: "engaged" | "engagedWithP2" | "unengaged";
    readonly players?: 1 | 2;
  } = {},
): Table {
  const base = gameAtFirstTurn({
    cards: [PANEL, PLAIN, DUO, SOLO, WATCHER, MONK],
    deps,
    deck: [PANEL.id, PLAIN.id, DUO.id, SOLO.id],
    encounter: [WATCHER.id, MONK.id, ...Array.from({ length: 28 }, () => "treachery" as CardId)],
    players: opts.players ?? 1,
  });
  let state = base;
  const ids: Record<string, InstanceId> = {};
  for (const card of [PANEL.id, PLAIN.id, DUO.id, SOLO.id]) {
    const placed = playerCardIntoPlay(state, card);
    state = placed.state;
    ids[card] = placed.id;
  }
  if (opts.watcher !== false) {
    const placed = encounterCardInVillainArea(state, WATCHER.id, 3);
    state = placed.state;
    ids[WATCHER.id] = placed.id;
  }
  if (opts.monk === "engaged" || opts.monk === "engagedWithP2") {
    const placed = minionEngagedWith(state, MONK.id, opts.monk === "engaged" ? P1 : P2);
    state = placed.state;
    ids[MONK.id] = placed.id;
  } else if (opts.monk === "unengaged") {
    const placed = encounterCardInVillainArea(state, MONK.id);
    state = placed.state;
    ids[MONK.id] = placed.id;
  }
  return { state, ids };
}

/** Uses `ability` on `card`, answering the option prompt with the option whose label starts with `pick`. */
function choose(at: Table, card: CardId, ability: StubAbility, pick: string) {
  const offered: string[][] = [];
  const askedOf: PlayerId[] = [];
  const command: Command = {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: at.ids[card]!,
    abilityId: ability.ref.id,
    payment: [],
  };
  const { session, events } = driveSession(startSession(at.state), deps, [command], (current) => {
    const choice = current.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseOption") {
      askedOf.push(choice.playerId);
      offered.push(choice.options.map((o) => o.label.split(":")[0]!));
      const option = choice.options.find((o) => o.label.startsWith(pick));
      if (!option) throw new Error(`no option ${pick}`);
      return [option.optionId];
    }
    return defaultPick(current);
  });
  return { state: session.state, events, offered, askedOf };
}

const identityDamage = (state: GameState, player: PlayerId = P1): number =>
  mustInstance(state, mustPlayer(state, player).identity.instanceId).damage;
const counter = (state: GameState, id: InstanceId, type: string): number => mustInstance(state, id).counters[type] ?? 0;
/** Abilities resolving and counters placed, in order. */
const trace = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((event) =>
    event.type === "abilityResolved"
      ? [`resolved ${event.abilityId}`]
      : event.type === "counterAdded"
        ? [`counter ${event.counterType}`]
        : [],
  );
const choosingOnStack = (events: readonly GameEvent[]) =>
  events.filter((event) => event.type === "triggerEvent" && event.event.kind === "optionChoosing");
const chosenLog = (events: readonly GameEvent[]) =>
  events.flatMap((event) => (event.type === "optionChosen" ? [event] : []));

describe("TriggerEvent optionChoosing: 'When you choose the Red effect on a TRAP! card'", () => {
  it("the forced interrupt resolves after the choice and before the chosen option's effects", () => {
    const at = table();
    const after = choose(at, PANEL.id, PANEL_CHOOSE, "Red");
    expect(after.offered).toEqual([["Red", "Blue", "Green"]]);
    expect(trace(after.events)).toEqual([
      `resolved ${PANEL_CHOOSE.ref.id}`,
      `resolved ${WATCHER_ANSWER.ref.id}`,
      "counter heard",
      "counter red",
    ]);
    expect(identityDamage(after.state)).toBe(1);
    expect(counter(after.state, at.ids[PANEL.id]!, "red")).toBe(1);
    // The log names the option by its tag as well as its label.
    expect(chosenLog(after.events)).toEqual([{ type: "optionChosen", label: red.label, index: 0, tag: "red" }]);
    expect(after.state.stack).toEqual([]);
  });

  it("another tag is not heard: choosing Blue deals no damage", () => {
    const after = choose(table(), PANEL.id, PANEL_CHOOSE, "Blue");
    expect(trace(after.events)).toEqual([`resolved ${PANEL_CHOOSE.ref.id}`, "counter blue"]);
    expect(identityDamage(after.state)).toBe(0);
  });

  it("the source must match: Red on a card without the TRAP! trait is not heard", () => {
    const after = choose(table(), PLAIN.id, PLAIN_CHOOSE, "Red");
    expect(identityDamage(after.state)).toBe(0);
    expect(choosingOnStack(after.events)).toEqual([]);
  });

  it("an untagged option has no name: nothing hears it and its log entry carries no tag", () => {
    const after = choose(table(), PANEL.id, PANEL_CHOOSE, "Green");
    expect(identityDamage(after.state)).toBe(0);
    expect(chosenLog(after.events)).toEqual([{ type: "optionChosen", label: green.label, index: 2 }]);
  });

  it("goes on the stack only when an ability could answer it", () => {
    const heard = choose(table(), PANEL.id, PANEL_CHOOSE, "Red");
    expect(choosingOnStack(heard.events).length).toBeGreaterThan(0);
    const unheard = choose(table({ watcher: false }), PANEL.id, PANEL_CHOOSE, "Red");
    expect(choosingOnStack(unheard.events)).toEqual([]);
    expect(trace(unheard.events)).toEqual([`resolved ${PANEL_CHOOSE.ref.id}`, "counter red"]);
  });
});

describe("RuleSpec cannotChooseOption: 'you cannot choose the Red effect on TRAP! cards'", () => {
  it("bars the tagged option for the player the monk is engaged with", () => {
    const after = choose(table({ watcher: false, monk: "engaged" }), PANEL.id, PANEL_CHOOSE, "Blue");
    expect(after.offered).toEqual([["Blue", "Green"]]);
  });

  it("does not bar it on a card its `sources` does not match", () => {
    const after = choose(table({ watcher: false, monk: "engaged" }), PLAIN.id, PLAIN_CHOOSE, "Red");
    expect(after.offered).toEqual([["Red", "Blue", "Green"]]);
  });

  it("bars nobody while the monk is engaged with no player", () => {
    const after = choose(table({ watcher: false, monk: "unengaged" }), PANEL.id, PANEL_CHOOSE, "Red");
    expect(after.offered).toEqual([["Red", "Blue", "Green"]]);
  });

  it("one option left resolves without asking (RRG 1.8 'Choose (Option)', p. 12), and the barred option is never heard", () => {
    const at = table({ monk: "engaged" });
    const after = choose(at, DUO.id, DUO_CHOOSE, "Green");
    expect(after.offered).toEqual([]);
    expect(chosenLog(after.events)).toEqual([{ type: "optionChosen", label: green.label, index: 1, onlyOption: true }]);
    expect(counter(after.state, at.ids[DUO.id]!, "green")).toBe(1);
    expect(identityDamage(after.state)).toBe(0);
  });
});

describe("an only option that is tagged, and two players", () => {
  it("a tagged option left alone is chosen without asking, and the watcher still hears it", () => {
    const at = table();
    const after = choose(at, SOLO.id, SOLO_CHOOSE, "Red");
    expect(after.offered).toEqual([]);
    expect(chosenLog(after.events)).toEqual([
      { type: "optionChosen", label: red.label, index: 0, onlyOption: true, tag: "red" },
    ]);
    expect(trace(after.events)).toEqual([
      `resolved ${SOLO_CHOOSE.ref.id}`,
      `resolved ${WATCHER_ANSWER.ref.id}`,
      "counter heard",
      "counter red",
    ]);
    expect(identityDamage(after.state)).toBe(1);
  });

  it("the rule binds only the player the monk is engaged with: P1 is still offered Red, P2 is not", () => {
    const at = table({ watcher: false, monk: "engagedWithP2", players: 2 });
    const p1 = choose(at, PANEL.id, PANEL_CHOOSE, "Red");
    expect(p1.askedOf).toEqual([P1]);
    expect(p1.offered).toEqual([["Red", "Blue", "Green"]]);
    const p2 = choose(at, PANEL.id, PANEL_P2_CHOOSES, "Blue");
    expect(p2.askedOf).toEqual([P2]);
    expect(p2.offered).toEqual([["Blue", "Green"]]);
  });

  it("P2 choosing Red is 'you' for the watcher: P2's identity takes the damage, not P1's", () => {
    const at = table({ players: 2 });
    const after = choose(at, PANEL.id, PANEL_P2_CHOOSES, "Red");
    expect(after.askedOf).toEqual([P2]);
    expect(identityDamage(after.state, P2)).toBe(1);
    expect(identityDamage(after.state, P1)).toBe(0);
  });
});
