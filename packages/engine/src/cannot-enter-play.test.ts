/**
 * docs/phase7-wave8.md §3.43: "[A title] cannot enter play during this game" (`RuleSpec cannotEnterPlay`).
 *
 * MC45 p. 20, scenario 5's Campaign Instructions: "Professor X cannot enter play during this game." RRG 1.8 "'Cannot'"
 * (p. 11): "If an effect uses the word 'cannot,' it is absolute, and cannot be countermanded by other abilities";
 * "Enters Play" (p. 18); "Play, Put into Play" (p. 32).
 *
 * The rule is the scenario's (`GameSetupConfig.scenarioRuleSpecs`), as a campaign passes it: the engine names no card.
 * Synthetic cards only; the title is matched, so two printings with different ids are both covered.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { replay, sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { locateCard, mustPlayer } from "./query.js";
import { cardsInPlay, controllerOf, matchesQuery } from "./select.js";
import type { EffectSpec, Predicate } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMainScheme, stubSideScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCard, RESOURCE } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const AREA = "mission";
const INTO = { scenarioPlayArea: AREA } as const;
const you = { kind: "controller" } as const;

/** The barred title, in two printings: the same name, different card ids. Cost 1, one resource each. */
const MENTOR = stubAlly({ id: "mentor", cost: 1, atk: 1, thw: 2, hp: 3, resources: 1 });
const MENTOR_REPRINT = { ...stubAlly({ id: "mentor-reprint", cost: 1, atk: 1, thw: 2, hp: 3, resources: 1 }) };
const SAME_TITLE = { ...MENTOR_REPRINT, name: MENTOR.name };
/** Any other ally. Cost 1. */
const RECRUIT = stubAlly({ id: "recruit", cost: 1, atk: 1, thw: 1, hp: 2 });

const BARRED: RuleSpec = { kind: "cannotEnterPlay", cards: { categories: ["ally"], name: MENTOR.name } };
const ERRAND = stubSideScheme({ id: "errand", startingThreat: 5, boostIcons: 0 });
const DESTINATION: RuleSpec = { kind: "playDestination", cards: { categories: ["ally"] }, area: AREA };

const action = (id: string, ...effects: EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const OPEN = action(
  "open",
  { kind: "createScenarioPlayArea", name: AREA, closed: true },
  { kind: "putIntoPlay", card: { kind: "find", query: { name: ERRAND.name } }, controller: you, into: INTO },
);
/** "Put each ally in your discard pile into play, then deal 1 damage to the villain." */
const RECALL = action(
  "recall",
  {
    kind: "putIntoPlay",
    card: { kind: "slot", slot: "found" },
    controller: you,
  },
  { kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 1 } },
);
const RECALL_ALL = stubAbility("recall.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "selectCards",
      slot: "found",
      cards: { kind: "zone", zone: "discard", player: you, filter: { categories: ["ally"] } },
    },
    ...RECALL.ability.definition.effects,
  ],
});
/** "Choose an ally in your discard pile that can enter play and put it into play." */
const RESCUE = action(
  "rescue",
  {
    kind: "chooseCards",
    slot: "taken",
    from: { kind: "zone", zone: "discard", player: you, filter: { categories: ["ally"], canEnterPlay: you } },
    chooser: you,
    min: 1,
    max: 1,
  },
  { kind: "putIntoPlay", card: { kind: "slot", slot: "taken" }, controller: you },
);
/** "Play an ally from your hand, ignoring its resource cost." */
const RUSH = action("rush", {
  kind: "playFromHand",
  player: you,
  ignoreCost: true,
  filter: { categories: ["ally"] },
});
const EVENTS = [OPEN, RESCUE, RUSH];

const SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const TYRANT = stubVillain({ id: "tyrant", stages: [{ hp: flat(40), atk: 0, sch: 0 }] });
const NOISE = stubTreachery({ id: "noise", boostIcons: 0 });
const deps: EngineDeps = depsOf(RECALL_ALL, ...EVENTS.map((e) => e.ability));

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const heroForm = (state: GameState): GameState => ({
  ...state,
  players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
});
const villainDamage = (state: GameState) => state.instances[state.villains[0]!.instanceId]!.damage;

function start(rules: readonly RuleSpec[] = [BARRED, DESTINATION]): GameState {
  const base = gameAtFirstTurn({
    cards: [ERRAND, MENTOR, SAME_TITLE, RECRUIT, NOISE, RECALL.card, ...EVENTS.map((e) => e.card)],
    deps,
    villain: TYRANT,
    mainScheme: SCHEME,
    encounter: [ERRAND.id, ...copiesOf(NOISE.id, 14)],
    deck: [MENTOR.id, SAME_TITLE.id, RECRUIT.id, RECRUIT.id, RECALL.card.id, ...EVENTS.map((e) => e.card.id)],
    scenarioRuleSpecs: rules,
  });
  return heroForm(playOf(base, OPEN.card.id).state);
}

/** Plays `card` from P1's hand for free (an event of this file). */
function playOf(state: GameState, card: CardId, pick?: (state: GameState) => readonly string[]) {
  const given = giveCard(state, P1, card);
  const { session, events } = driveSession(
    startSession(given.state),
    deps,
    [{ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
    pick,
  );
  return { state: session.state, events, session };
}

/** Tries to play `card` from P1's hand, paying 1 with a resource card (or with `payWith`). */
function play(state: GameState, card: CardId, opts: { into?: boolean; payWith?: InstanceId } = {}) {
  const given = giveCard(state, P1, card);
  let current = given.state;
  let paidWith = opts.payWith;
  if (paidWith === undefined) {
    const resource = giveCard(current, P1, RESOURCE.id);
    current = resource.state;
    paidWith = resource.id;
  }
  const payment: Payment[] = [{ fromHand: paidWith }];
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment,
    attachToInstanceId: null,
    ...(opts.into ? { into: INTO } : {}),
  };
  const result = sessionApply(startSession(current), command, deps);
  if (!result.ok) return { ok: false as const, error: result.error, id: given.id, before: current, paidWith };
  const driven = driveSession(result.session, deps);
  return { ok: true as const, id: given.id, state: driven.session.state, session: driven.session, paidWith };
}

/** Moves P1's copy of `card` to their discard pile (test surgery). */
function inDiscard(state: GameState, card: CardId): { state: GameState; id: InstanceId } {
  const given = giveCard(state, P1, card);
  return {
    id: given.id,
    state: {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: p.hand.filter((id) => id !== given.id), discard: [given.id, ...p.discard] }
          : p,
      ),
    },
  };
}

const playable = (state: GameState, id: InstanceId): boolean => {
  const listed = legalActions(state, P1, deps);
  if (listed.kind !== "turn") throw new Error(listed.kind);
  return listed.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id);
};

describe("§3.43 a card that cannot enter play: playing it", () => {
  it("in hand it is not a legal play to either place, and the refusal comes before any cost: the resource stays in hand", () => {
    for (const printing of [MENTOR.id, SAME_TITLE.id]) {
      for (const into of [false, true]) {
        const tried = play(start(), printing, { into });
        expect(tried.ok, `${printing} into ${into}`).toBe(false);
        if (tried.ok) continue;
        expect(tried.error.code).toBe("no_valid_target");
        expect(tried.error.message).toBe(`${MENTOR.name} cannot enter play during this game`);
        // A refused command changes nothing: both cards are still in hand.
        expect(mustPlayer(tried.before, P1).hand).toEqual(expect.arrayContaining([tried.id, tried.paidWith]));
        expect(playable(tried.before, tried.id)).toBe(false);
      }
    }
  });

  it("another ally is played to either place as always", () => {
    for (const into of [false, true]) {
      const run = play(start(), RECRUIT.id, { into });
      expect(run.ok).toBe(true);
      if (run.ok) expect(cardsInPlay(run.state)).toContain(run.id);
    }
  });

  it("spent as a resource, it works: it pays for another ally and goes to the discard pile", () => {
    const given = giveCard(start(), P1, MENTOR.id);
    const run = play(given.state, RECRUIT.id, { payWith: given.id });
    if (!run.ok) throw new Error(run.error.message);
    expect(cardsInPlay(run.state)).toContain(run.id);
    expect(mustPlayer(run.state, P1).discard).toContain(given.id);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.state);
  });

  it("an effect that plays an ally from hand cannot play it: with only that ally in hand the effect plays nothing", () => {
    const given = giveCard(start(), P1, MENTOR.id);
    const onlyIt: GameState = {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: [given.id], deck: [...p.deck, ...p.hand.filter((id) => id !== given.id)] }
          : p,
      ),
    };
    const rush = giveCard(onlyIt, P1, RUSH.card.id);
    const tried = sessionApply(
      startSession(rush.state),
      { type: "playCard", playerId: P1, cardInstanceId: rush.id, payment: [], attachToInstanceId: null },
      deps,
    );
    const after = tried.ok ? driveSession(tried.session, deps).session.state : rush.state;
    expect(cardsInPlay(after)).not.toContain(given.id);
    expect(mustPlayer(after, P1).hand).toContain(given.id);

    // With another ally beside it, only that one is offered and played.
    const both = giveCard(given.state, P1, RECRUIT.id);
    const offered: string[][] = [];
    const played = playOf(both.state, RUSH.card.id, (s) => {
      const options = s.pendingChoice!.options.map((o) => o.optionId as string);
      offered.push(options);
      return options.includes(both.id) ? [both.id] : [options[0]!];
    });
    expect(offered.flat()).not.toContain(given.id);
    expect(cardsInPlay(played.state)).toContain(both.id);
    expect(cardsInPlay(played.state)).not.toContain(given.id);
  });
});

describe("§3.43 a card that cannot enter play: put into play by an effect", () => {
  it("the effect does nothing to it and it stays in the discard pile; the other ally enters play and the rest resolves", () => {
    const barred = inDiscard(start(), MENTOR.id);
    const other = inDiscard(barred.state, RECRUIT.id);
    const run = playOf(other.state, RECALL.card.id);
    expect(locateCard(run.state, barred.id)).toEqual({ kind: "discard", playerId: P1 });
    expect(cardsInPlay(run.state)).toContain(other.id);
    expect(controllerOf(run.state, other.id)).toBe(P1);
    expect(of(run.events, "putIntoPlayRefused")).toEqual([
      { type: "putIntoPlayRefused", instanceId: barred.id, playerId: P1, reason: "cannotEnterPlay" },
    ]);
    expect(of(run.events, "uniqueEntryBlocked")).toHaveLength(0);
    expect(villainDamage(run.state)).toBe(1);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.state);
  });

  it("an effect that puts an ally from the discard pile into play cannot choose it (`canEnterPlay`)", () => {
    const barred = inDiscard(start(), SAME_TITLE.id);
    const other = inDiscard(barred.state, RECRUIT.id);
    const offered: string[][] = [];
    const run = playOf(other.state, RESCUE.card.id, (s) => {
      const options = s.pendingChoice!.options.map((o) => o.optionId as string);
      offered.push(options);
      return [options[0]!];
    });
    expect(offered).toEqual([[other.id]]);
    expect(cardsInPlay(run.state)).toContain(other.id);
    expect(locateCard(run.state, barred.id)).toEqual({ kind: "discard", playerId: P1 });
    const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };
    expect(matchesQuery(other.state, barred.id, { categories: ["ally"] }, context)).toBe(true);
    expect(matchesQuery(other.state, barred.id, { categories: ["ally"], canEnterPlay: you }, context)).toBe(false);
  });

  it("a card already in play is not touched by the rule: it is about entering", () => {
    const there = playerCardIntoPlay(start(), MENTOR.id);
    const run = playOf(there.state, RECALL.card.id);
    expect(cardsInPlay(run.state)).toContain(there.id);
    expect(of(run.events, "putIntoPlayRefused")).toHaveLength(0);
  });
});

describe("§3.43 the rule is the game's, not the card's", () => {
  it("the same deck in a game without the rule: playable to either place, and an effect puts it into play", () => {
    const state = start([DESTINATION]);
    for (const into of [false, true]) {
      const run = play(state, MENTOR.id, { into });
      expect(run.ok, `into ${into}`).toBe(true);
    }
    const barred = inDiscard(state, MENTOR.id);
    const run = playOf(barred.state, RECALL.card.id);
    expect(cardsInPlay(run.state)).toContain(barred.id);
  });

  it("`while`: the rule holds only while its condition does", () => {
    const whileScheme: Predicate = { kind: "exists", query: { categories: ["sideScheme"], inScenarioPlayArea: AREA } };
    const never: Predicate = { kind: "not", of: whileScheme };
    expect(play(start([{ ...BARRED, while: whileScheme }, DESTINATION]), MENTOR.id).ok).toBe(false);
    expect(play(start([{ ...BARRED, while: never }, DESTINATION]), MENTOR.id).ok).toBe(true);
  });
});
