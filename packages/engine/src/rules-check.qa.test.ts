/**
 * Wave 8 rules check (docs/phase7-wave8-rules-check.md): the pin for the one engine rule the check found to contradict
 * a primary source. An `it.fails` states what the source says; a companion states what the game does today. The card
 * side's pin is in `packages/cards/src/wave8/rules-check.qa.test.ts`.
 *
 * The second pin (an ally an effect plays does not offer the mission area) is MC45 p. 5: "When a player plays an ally,
 * they must choose: either play that ally into their game area per the normal rules of the game, or play it into the
 * mission area." RRG 1.8 "Play, Put Into Play" (p. 32): an effect that says "play" plays the card.
 *
 * RRG 1.8 "Labeled Ability" (p. 26): "The identity of the player using the labeled ability is considered to be
 * performing the labeled effect when the labeled ability begins resolving (after costs have been paid)"; "When a
 * player resolves an ability labeled '(attack),' that ability is considered to be an attack made by that player's
 * identity." The engine (`resolve/attack-ability.ts`, `openLabelAttack`) opens a label-only attack's `attack` event,
 * and so its "when you attack" interrupt window, at the ability's first damage instruction that names an attackable
 * enemy, so an instruction written before it resolves before the attack is made. Synthetic cards only, as in
 * `attack-label.test.ts`.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import { sessionApply, startSession } from "./engine.js";
import { driveSession } from "./testing/drive.js";
import { giveCard } from "./testing/scenario.js";
import type { GameEvent } from "./events.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import {
  stubAlly,
  stubEvent,
  stubMainScheme,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, playerCardIntoPlay, playFree } from "./testing/wave3.js";
import type { CardId } from "@mc/content";

const n = (value: number) => ({ kind: "const", value }) as const;
const MARKER_NAME = "marker";

/** A support in play to hold the counter an earlier instruction places. */
const MARKER = stubSupport({ id: MARKER_NAME, cost: 0, abilities: [] });
const VILLAIN = stubVillain({ id: "plain-villain", stages: [{ hp: flat(40), atk: 2, sch: 1 }] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

/** "Hero Action (attack): Place 1 counter on the marker. Deal 3 damage to the villain." (a preliminary instruction) */
const PREP_STRIKE_ABILITY = stubAbility("prep-strike.action", {
  trigger: { kind: "action" },
  label: ["attack" as const],
  effects: [
    {
      kind: "addCounters",
      target: { kind: "each", query: { categories: ["support"], name: MARKER_NAME } },
      counterType: "prep",
      amount: n(1),
    },
    { kind: "dealDamage", target: { kind: "villain" }, amount: n(3) },
  ],
} satisfies AbilityDefinition);
const PREP_STRIKE = stubEvent({ id: "prep-strike", cost: 0, abilities: [PREP_STRIKE_ABILITY.ref] });

const deps: EngineDeps = depsOf(PREP_STRIKE_ABILITY);

function played() {
  const base = gameAtFirstTurn({
    cards: [VILLAIN, BLANK, MARKER, PREP_STRIKE],
    deps,
    villain: VILLAIN,
    encounter: copiesOf(BLANK.id, 20),
    deck: [MARKER.id, PREP_STRIKE.id].flatMap((id) => copiesOf(id as CardId, 2)),
  });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  state = playerCardIntoPlay(state, MARKER.id).state;
  return playFree(state, deps, PREP_STRIKE.id).events;
}

const indexOf = (events: readonly GameEvent[], test: (e: GameEvent) => boolean): number => events.findIndex(test);
const attackBegins = (e: GameEvent) =>
  e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "attack";
const counterPlaced = (e: GameEvent) => e.type === "counterAdded";

describe("rules check: when a label-only attack begins (RRG 1.8 'Labeled Ability', p. 26)", () => {
  it.fails("expected: the attack begins as the ability begins resolving, before its first instruction", () => {
    const events = played();
    const attack = indexOf(events, attackBegins);
    const counter = indexOf(events, counterPlaced);
    expect(attack).toBeGreaterThanOrEqual(0);
    expect(counter).toBeGreaterThanOrEqual(0);
    expect(attack).toBeLessThan(counter);
  });

  it("today: the attack begins at its first damage instruction, after the preliminary instruction has resolved", () => {
    const events = played();
    const attack = indexOf(events, attackBegins);
    const counter = indexOf(events, counterPlaced);
    expect(counter).toBeGreaterThanOrEqual(0);
    expect(counter).toBeLessThan(attack);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// An ally that an effect plays, with a mission area in the game (MC45 p. 5)
// ---------------------------------------------------------------------------------------------------------------

const AREA = "mission";
const INTO = { scenarioPlayArea: AREA } as const;
const you = { kind: "controller" } as const;
const ERRAND = stubSideScheme({ id: "errand", startingThreat: 5, boostIcons: 0 });
const RECRUIT = stubAlly({ id: "recruit", cost: 0, atk: 1, thw: 1, hp: 2 });
const RULES: readonly RuleSpec[] = [
  {
    kind: "playDestination",
    cards: { categories: ["ally"] },
    area: AREA,
    while: { kind: "exists", query: { categories: ["sideScheme"], inScenarioPlayArea: AREA } },
  },
];
const OPEN_ABILITY = stubAbility("open.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "createScenarioPlayArea", name: AREA, closed: true },
    { kind: "putIntoPlay", card: { kind: "find", query: { name: ERRAND.id } }, controller: you, into: INTO },
  ],
});
const OPEN = stubEvent({ id: "open", cost: 0, abilities: [OPEN_ABILITY.ref] });
/** "Play an ally from your hand, ignoring its resource cost." */
const RUSH_ABILITY = stubAbility("rush.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "playFromHand", player: you, ignoreCost: true, filter: { categories: ["ally"] } }],
});
const RUSH = stubEvent({ id: "rush", cost: 0, abilities: [RUSH_ABILITY.ref] });
const effectDeps: EngineDeps = depsOf(OPEN_ABILITY, RUSH_ABILITY);
const SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});

/** The events of an effect playing a Recruit, with the mission area open. Every prompt is answered by the default pick. */
function rushedRecruit(): { readonly events: readonly GameEvent[]; readonly state: GameState } {
  const base = gameAtFirstTurn({
    cards: [VILLAIN, BLANK, ERRAND, RECRUIT, OPEN, RUSH],
    deps: effectDeps,
    villain: VILLAIN,
    mainScheme: SCHEME,
    encounter: [ERRAND.id, ...copiesOf(BLANK.id, 14)],
    deck: [RECRUIT.id, OPEN.id, RUSH.id].flatMap((id) => copiesOf(id as CardId, 2)),
    scenarioRuleSpecs: RULES,
  });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  state = playFree(state, effectDeps, OPEN.id).state;
  state = giveCard(state, "p1" as never, RECRUIT.id).state;
  const given = giveCard(state, "p1" as never, RUSH.id);
  const applied = sessionApply(
    startSession(given.state),
    { type: "playCard", playerId: "p1" as never, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    effectDeps,
  );
  if (!applied.ok) throw new Error(applied.error.message);
  const driven = driveSession(applied.session, effectDeps);
  return { events: [...applied.events, ...driven.events], state: driven.session.state };
}

/** Whether any prompt the player saw offered the mission area as a place to play the ally. */
const offeredTheArea = (events: readonly GameEvent[]): boolean =>
  events.some(
    (e) =>
      e.type === "choiceRequested" &&
      e.choice.options.some((o) => `${o.optionId} ${o.label}`.toLowerCase().includes(AREA)),
  );

describe("rules check: an ally that an effect plays offers the mission area (MC45 p. 5)", () => {
  it.fails("expected: the player is offered the mission area as well as their own area", () => {
    expect(offeredTheArea(rushedRecruit().events)).toBe(true);
  });

  it("today: the effect plays the ally to the player's own area with no choice of place", () => {
    const { events, state } = rushedRecruit();
    expect(state.scenarioPlayAreas?.[AREA]?.cards.length).toBe(1); // the area is open, with the errand in it
    expect(offeredTheArea(events)).toBe(false);
    const home = state.players[0]!.playArea.filter(
      (id) => state.cardPool[state.instances[id]!.cardId]?.type === "ally",
    );
    expect(home.length).toBeGreaterThan(0);
  });
});
