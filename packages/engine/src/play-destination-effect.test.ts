/**
 * An ally that an effect plays has the same choice of place as one played from hand (`EffectSpec playFromHand` under
 * `RuleSpec playDestination`).
 *
 * Official rules. MC45 p. 5: "While a [MISSION] side scheme is in play, when a player plays an ally, they must choose:
 * either play that ally into their game area per the normal rules of the game, or play it into the mission area." RRG
 * 1.8 "Play, Put Into Play" (p. 32): "Some abilities cause cards to be put into play. This bypasses the need to pay
 * the card's cost as well as any restrictions or prohibitions regarding playing that card. A card that is put into
 * play enters play in its controller's play area" and "A card that is put into play is not considered to have been
 * played."
 *
 * Owner decision, 2026-10-08 (docs/phase7-wave8.md §4.1 row 60, rules check M16): an effect that says "play an ally"
 * must offer the mission-area destination choice; "put into play" does not. Owner answer Q32 keeps one effect to the
 * player's own area (`playFromHand.ownAreaOnly`): a play whose effect goes on to use the card as its player's own.
 *
 * The command path is `play-destination.test.ts`; the reduction that reads the destination is
 * `cost-reduction-by-destination.test.ts`. Synthetic cards only: the rule is the scenario's, and the engine names no
 * card.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import { PLAY_TO_OWN_AREA, playDestinationOfOption, playToAreaOption } from "./choices.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { controllerOf } from "./select.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubMainScheme,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { defaultPick, giveCard, RESOURCE } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1 } from "./testing/wave3.js";

const AREA = "mission";
const INTO = { scenarioPlayArea: AREA } as const;
const THERE = { inScenarioPlayArea: AREA } as const;
const n = (value: number): ValueSpec => ({ kind: "const", value });
const you = { kind: "controller" } as const;

const ERRAND = stubSideScheme({ id: "errand", startingThreat: 5, boostIcons: 0 });
const RULES: readonly RuleSpec[] = [
  {
    kind: "playDestination",
    cards: { categories: ["ally"] },
    area: AREA,
    while: { kind: "exists", query: { categories: ["sideScheme"], ...THERE } },
  },
];
const RECRUIT = stubAlly({ id: "recruit", cost: 0, atk: 1, thw: 1, hp: 2 });
const VETERAN = stubAlly({ id: "veteran", cost: 3, atk: 2, thw: 1, hp: 3 });
/** "Forced Response: After you play an ally, deal 1 damage to the villain." Proof that it was a play. */
const DRUM_RESPONSE = stubAbility("drum.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "cardPlayed", playerIs: "controller", targetIs: { categories: ["ally"] } },
  },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: n(1) }],
});
const DRUM = stubSupport({ id: "drum", cost: 0, abilities: [DRUM_RESPONSE.ref] });

const action = (id: string, ...effects: EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const find = (name: string): TargetRef => ({ kind: "find", query: { name } });
const anAlly = { categories: ["ally"] } as const;
const OPEN = action(
  "open",
  { kind: "createScenarioPlayArea", name: AREA, closed: true },
  { kind: "putIntoPlay", card: find(ERRAND.name), controller: you, into: INTO },
);
/** "Remove the side scheme at the mission from the game": the rule's condition ends. */
const CLOSE = action("close", {
  kind: "moveCards",
  cards: { kind: "ref", ref: { kind: "each", query: { categories: ["sideScheme"], ...THERE } } },
  to: "removedFromGame",
});
/** "Play an ally from your hand, ignoring its resource cost." */
const RUSH = action("rush", { kind: "playFromHand", player: you, ignoreCost: true, filter: anAlly });
/** "Play an ally from your hand, reducing its resource cost by 1." */
const HIRE = action("hire", { kind: "playFromHand", player: you, costReduction: n(1), filter: anAlly });
/** The same play by an effect that then uses the ally as its player's own (owner answer Q32). */
const DRAFT = action("draft", {
  kind: "playFromHand",
  player: you,
  ignoreCost: true,
  filter: anAlly,
  ownAreaOnly: true,
});
/** "Put an ally from your hand into play": an effect that does not play it. */
const MUSTER = action("muster", {
  kind: "putIntoPlay",
  card: { kind: "find", query: { name: RECRUIT.name }, owner: you },
  controller: you,
});
/** "Reduce the cost of the next ally played to the mission this phase by 2." */
const BRIEF = action("brief", {
  kind: "reduceNextCardCost",
  player: you,
  amount: n(2),
  duration: "phase",
  cardFilter: anAlly,
  into: INTO,
  anyPlayer: true,
});
const EVENTS = [OPEN, CLOSE, RUSH, HIRE, DRAFT, MUSTER, BRIEF];

const SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const TYRANT = stubVillain({ id: "tyrant", stages: [{ hp: flat(40), atk: 0, sch: 0 }] });
const NOISE = stubTreachery({ id: "noise", boostIcons: 0 });
const deps: EngineDeps = depsOf(DRUM_RESPONSE, ...EVENTS.map((e) => e.ability));

type Card = { readonly card: { readonly id: CardId } };
type Place = "own" | "area";
const areaCards = (state: GameState) => state.scenarioPlayAreas?.[AREA]?.cards ?? [];
const villainDamage = (state: GameState) => mustInstance(state, state.villains[0]!.instanceId).damage;
const reductions = (state: GameState) => state.lastingEffects.filter((e) => e.kind === "costReduction");
const playOf = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});

/** Answers the place question with `place`, pays a `spendResources` prompt with resource cards, else the default. */
const picking =
  (place: Place) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.options.some((option) => playDestinationOfOption(option.optionId) !== undefined))
      return [place === "own" ? PLAY_TO_OWN_AREA : playToAreaOption(AREA)];
    if (choice.prompt.kind === "spendResources") {
      const { generic } = choice.prompt.requirement;
      return choice.options
        .filter((o) => o.ref.kind === "card" && state.instances[o.ref.instanceId]?.cardId === RESOURCE.id)
        .slice(0, generic)
        .map((o) => o.optionId);
    }
    return defaultPick(state);
  };

function playFree(state: GameState, card: Card): GameState {
  const given = giveCard(state, P1, card.card.id);
  return runCommandsPicking(given.state, deps, defaultPick, playOf(given.id)).state;
}

/** P1 in hero form at their turn with the area open (its scheme in it unless `closed`) and `inPlay` under control. */
function start(options: { readonly closed?: boolean } = {}): GameState {
  const base = gameAtFirstTurn({
    cards: [ERRAND, RECRUIT, VETERAN, DRUM, NOISE, ...EVENTS.map((e) => e.card)],
    deps,
    villain: TYRANT,
    mainScheme: SCHEME,
    encounter: [ERRAND.id, ...copiesOf(NOISE.id, 14)],
    deck: [RECRUIT.id, RECRUIT.id, VETERAN.id, VETERAN.id, DRUM.id, ...EVENTS.map((e) => e.card.id)],
    scenarioRuleSpecs: RULES,
  });
  const hero = (state: GameState): GameState => ({
    ...state,
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  });
  const opened = playFree(hero(base), OPEN);
  return options.closed ? playFree(opened, CLOSE) : opened;
}

/** P1's hand is exactly these cards: the rest go to the bottom of the deck. */
function handOf(state: GameState, ids: readonly InstanceId[]): GameState {
  const seat = mustPlayer(state, P1);
  const rest = seat.hand.filter((id) => !ids.includes(id));
  return {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [...ids], deck: [...p.deck, ...rest] } : p)),
  };
}

/**
 * P1 holds `ally`, `resources` resource cards and the effect's card, and nothing else; the effect is played and every
 * prompt answered by `picking(place)`.
 */
function byEffect(state: GameState, effect: Card, ally: CardId, place: Place, resources = 0) {
  const given = giveCard(state, P1, ally);
  let current = given.state;
  const paid: InstanceId[] = [];
  for (let i = 0; i < resources; i++) {
    const resource = giveCard(current, P1, RESOURCE.id, paid);
    current = resource.state;
    paid.push(resource.id);
  }
  const card = giveCard(current, P1, effect.card.id);
  const run = runCommandsPicking(
    handOf(card.state, [given.id, ...paid, card.id]),
    deps,
    picking(place),
    playOf(card.id),
  );
  const asked = run.events.flatMap((e) =>
    e.type === "choiceRequested" && e.choice.options.some((o) => playDestinationOfOption(o.optionId) !== undefined)
      ? [e.choice]
      : [],
  );
  const spent = paid.filter((id) => mustPlayer(run.state, P1).discard.includes(id)).length;
  return { ...run, ally: given.id, asked, spent };
}
const where = (state: GameState, id: InstanceId): Place | "elsewhere" =>
  areaCards(state).includes(id) ? "area" : mustPlayer(state, P1).playArea.includes(id) ? "own" : "elsewhere";
const entered = (events: readonly GameEvent[], id: InstanceId): boolean =>
  events.some((e) => e.type === "triggerEvent" && e.event.kind === "cardEntersPlay" && e.event.instanceId === id);

describe("row 60 (M16): an ally an effect plays is offered the mission area (MC45 p. 5)", () => {
  it("the question: one `chooseOption` naming both places, asked of the player playing, about the card", () => {
    const run = byEffect(start(), RUSH, RECRUIT.id, "own");
    expect(run.asked).toHaveLength(1);
    const [choice] = run.asked;
    expect(choice).toMatchObject({
      playerId: P1,
      prompt: { kind: "chooseOption" },
      minSelections: 1,
      maxSelections: 1,
    });
    expect(choice?.options).toEqual([
      { optionId: PLAY_TO_OWN_AREA, label: "Play recruit to your area", ref: { kind: "card", instanceId: run.ally } },
      {
        optionId: playToAreaOption(AREA),
        label: "Play recruit to the mission",
        ref: { kind: "card", instanceId: run.ally },
      },
    ]);
    expect(playDestinationOfOption(PLAY_TO_OWN_AREA)).toBeNull();
    expect(playDestinationOfOption(playToAreaOption(AREA))).toBe(AREA);
    expect(playDestinationOfOption("0")).toBeUndefined();
  });

  it("their own area: the ally is theirs, as before", () => {
    const run = byEffect(start(), RUSH, RECRUIT.id, "own");
    expect(where(run.state, run.ally)).toBe("own");
    expect(controllerOf(run.state, run.ally)).toBe(P1);
    expect(run.state.stack).toEqual([]);
  });

  it("the mission: it enters play there under no player's control, and it was played", () => {
    const drum = giveCard(start(), P1, DRUM.id);
    const withDrum = runCommandsPicking(drum.state, deps, defaultPick, playOf(drum.id)).state;
    const run = byEffect(withDrum, RUSH, RECRUIT.id, "area");
    expect(where(run.state, run.ally)).toBe("area");
    expect(controllerOf(run.state, run.ally)).toBeNull();
    expect(entered(run.events, run.ally)).toBe(true);
    // "After you play an ally" answers it: the effect played the card (RRG 1.8 p. 32).
    expect(villainDamage(run.state)).toBe(1);
    expect(run.state.stack).toEqual([]);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.state);
  });

  it("an effect that charges a cost charges it for the place picked: the reduction by destination applies at the mission and is used up", () => {
    const briefed = playFree(start(), BRIEF);
    expect(reductions(briefed)).toHaveLength(1);
    // Cost 3, less the effect's 1: 2 in the player's own area, and the reduction for the mission is left waiting.
    const home = byEffect(briefed, HIRE, VETERAN.id, "own", 3);
    expect(where(home.state, home.ally)).toBe("own");
    expect(home.spent).toBe(2);
    expect(reductions(home.state)).toHaveLength(1);
    // At the mission the other 2 come off as well: nothing to pay, and the reduction is spent.
    const away = byEffect(briefed, HIRE, VETERAN.id, "area", 3);
    expect(where(away.state, away.ally)).toBe("area");
    expect(away.spent).toBe(0);
    expect(reductions(away.state)).toHaveLength(0);
  });

  it("payable in one place only, it is played there with no question; payable in neither, it is not a card the effect can play", () => {
    const briefed = playFree(start(), BRIEF);
    // No resource in hand: 2 short in the player's own area, free at the mission.
    const only = byEffect(briefed, HIRE, VETERAN.id, "own");
    expect(only.asked).toEqual([]);
    expect(where(only.state, only.ally)).toBe("area");
    expect(reductions(only.state)).toHaveLength(0);
    // Without the reduction neither place can be paid for: nothing is played.
    const neither = byEffect(start(), HIRE, VETERAN.id, "own");
    expect(neither.asked).toEqual([]);
    expect(where(neither.state, neither.ally)).toBe("elsewhere");
    expect(mustPlayer(neither.state, P1).hand).toContain(neither.ally);
  });

  it("'put into play' is not a play: no question, and the ally goes to the player's own area (RRG 1.8 p. 32)", () => {
    const run = byEffect(start(), MUSTER, RECRUIT.id, "area");
    expect(run.asked).toEqual([]);
    expect(where(run.state, run.ally)).toBe("own");
    expect(controllerOf(run.state, run.ally)).toBe(P1);
  });

  it("an effect marked `ownAreaOnly` plays to the player's own area with no question (owner answer Q32)", () => {
    const run = byEffect(start(), DRAFT, RECRUIT.id, "area");
    expect(run.asked).toEqual([]);
    expect(where(run.state, run.ally)).toBe("own");
  });

  it("with no rule in force (no scheme in the area) there is nothing to ask", () => {
    const run = byEffect(start({ closed: true }), RUSH, RECRUIT.id, "area");
    expect(run.asked).toEqual([]);
    expect(where(run.state, run.ally)).toBe("own");
  });
});
