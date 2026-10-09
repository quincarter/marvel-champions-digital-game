/**
 * `playCard.into` places every player card type that stays in play when played (docs/phase7-wave8.md §3.34): beside
 * the ally and the support, an upgrade and a player side scheme. What a `RuleSpec playDestination` names is the
 * rule's own `cards` query; how each type is placed is its type's.
 *
 * RRG 1.8 "Player Turn" (p. 34): "Play an ally, upgrade, support, or player side scheme card from hand." "Attach To"
 * (p. 8): a card that "uses the phrase 'attach to' … must be attached to … the specified game element as it enters
 * play". "Upgrade" (p. 46): "Most upgrade cards enter play near a player's identity card". "Player Side Scheme" and
 * "Player Side Scheme Limit" (p. 34): it "enters play with an amount of threat on it equal to its starting threat
 * value", and "the number of player side schemes in play at any time is limited". "Event" (p. 18): "the event is not
 * in play".
 *
 * No printed card needs these: synthetic cards and rules only, and the engine names no card.
 */

import { flat, type CardId, type PlayerSideSchemeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { sessionApply, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { locateCard, mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubMainScheme,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { giveCard, RESOURCE } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1 } from "./testing/wave3.js";

const AREA = "depot";
const INTO = { scenarioPlayArea: AREA } as const;
const IN_AREA = { kind: "scenarioPlayArea", name: AREA } as const;

const OPEN_ACTION = stubAbility("open.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "createScenarioPlayArea", name: AREA, closed: true }],
});
const OPEN = stubEvent({ id: "open", cost: 0, abilities: [OPEN_ACTION.ref] });
const FLARE_ACTION = stubAbility("flare.action", { trigger: { kind: "action" }, effects: [] });
const FLARE = stubEvent({ id: "flare", cost: 0, abilities: [FLARE_ACTION.ref] });
const GUARD = stubAlly({ id: "guard", cost: 0, atk: 1, thw: 1, hp: 2 });
/** No "attach to" text: an upgrade that enters play by its player's identity. */
const BADGE = stubUpgrade({ id: "badge", cost: 0 });
/** "Attach to an ally." */
const HARNESS = { ...stubUpgrade({ id: "harness", cost: 0 }), attachesTo: { kind: "ally" as const } };
const playerSideScheme = (id: string, threat: number): PlayerSideSchemeCard => ({
  ...stubSupport({ id, cost: 0 }),
  type: "player_side_scheme",
  startingThreat: flat(threat),
});
const SURVEY = playerSideScheme("survey", 4);
const SWEEP = playerSideScheme("sweep", 3);

const SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const TYRANT = stubVillain({ id: "tyrant", stages: [{ hp: flat(40), atk: 0, sch: 0 }] });
const NOISE = stubTreachery({ id: "noise", boostIcons: 0 });
const deps: EngineDeps = depsOf(OPEN_ACTION, FLARE_ACTION);

/** A rule naming every card asked about here, the event and the resource card (by name) included. */
const EVERYTHING: readonly RuleSpec[] = [
  {
    kind: "playDestination",
    cards: {
      anyOf: [{ categories: ["ally", "upgrade", "sideScheme"] }, { name: FLARE.name }, { name: RESOURCE.name }],
    },
    area: AREA,
  },
];

const playCommand = (id: InstanceId, opts: { into?: boolean; host?: InstanceId } = {}): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: opts.host ?? null,
  ...(opts.into ? { into: INTO } : {}),
});
/** P1 in hero form at their turn with the area open, under `rules`. */
function start(rules: readonly RuleSpec[] = EVERYTHING): GameState {
  const base = gameAtFirstTurn({
    cards: [OPEN, FLARE, GUARD, BADGE, HARNESS, SURVEY, SWEEP, NOISE],
    deps,
    villain: TYRANT,
    mainScheme: SCHEME,
    encounter: copiesOf(NOISE.id, 14),
    deck: [OPEN.id, FLARE.id, GUARD.id, GUARD.id, BADGE.id, HARNESS.id, HARNESS.id, SURVEY.id, SWEEP.id],
    scenarioRuleSpecs: rules,
  });
  const given = giveCard(base, P1, OPEN.id);
  const opened = driveSession(startSession(given.state), deps, [playCommand(given.id)]).session.state;
  return {
    ...opened,
    players: opened.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
}
/** Plays `card` from P1's hand and stops at the first question, if the play asks one. */
function play(state: GameState, card: CardId, opts: { into?: boolean; host?: InstanceId } = {}) {
  const given = giveCard(state, P1, card);
  const result = sessionApply(startSession(given.state), playCommand(given.id, opts), deps);
  if (!result.ok) return { ok: false as const, message: result.error.message, id: given.id, before: given.state };
  return { ok: true as const, id: given.id, state: result.session.state };
}
const mustPlay = (...args: Parameters<typeof play>) => {
  const result = play(...args);
  if (!result.ok) throw new Error(result.message);
  return result;
};
const refusal = (...args: Parameters<typeof play>): string | null => {
  const result = play(...args);
  return result.ok ? null : result.message;
};
const entryFor = (state: GameState, id: InstanceId) => {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(actions.kind);
  return actions.legal.find((entry) => entry.action.kind === "playCard" && entry.action.instanceId === id);
};
const identityOf = (state: GameState) => mustPlayer(state, P1).identity.instanceId;

describe("playCard.into: an upgrade", () => {
  it("with no 'attach to' text is in the area attached to nothing, under no player's control; played as usual it is on its player's identity", () => {
    const state = start();
    const given = giveCard(state, P1, BADGE.id);
    expect(entryFor(given.state, given.id)?.destinations).toEqual([AREA]);
    expect(entryFor(given.state, given.id)?.destinationHosts).toBeUndefined();

    const badge = mustPlay(state, BADGE.id, { into: true });
    expect(locateCard(badge.state, badge.id)).toEqual(IN_AREA);
    expect(mustInstance(badge.state, badge.id)).toMatchObject({ attachedTo: null, controllerId: null, ownerId: P1 });
    expect(cardsInPlay(badge.state)).toContain(badge.id);
    expect(mustInstance(badge.state, identityOf(badge.state)).attachments).not.toContain(badge.id);

    const own = mustPlay(state, BADGE.id);
    expect(mustInstance(own.state, own.id)).toMatchObject({ attachedTo: identityOf(own.state), controllerId: P1 });

    // It has no host to name: a play into the area that names one is refused.
    const guard = mustPlay(state, GUARD.id, { into: true });
    expect(refusal(guard.state, BADGE.id, { into: true, host: guard.id })).toBe(
      "this upgrade has no 'attach to' text: played into that area it is attached to nothing",
    );
  });

  it("with 'attach to' text is attached to a card in the area that its text allows, and to no card outside it", () => {
    const state = start();
    // No ally anywhere: there is nothing to attach it to, in the area or out of it.
    expect(refusal(state, HARNESS.id, { into: true })).toBe("upgrade has no valid host");

    const there = mustPlay(state, GUARD.id, { into: true });
    // An ally in the area only: the card is playable there and nowhere else, on that ally.
    const given = giveCard(there.state, P1, HARNESS.id);
    const only = entryFor(given.state, given.id);
    expect(only).toMatchObject({
      destinations: [AREA],
      destinationHosts: { [AREA]: [there.id] },
      destinationOnly: true,
    });
    expect(only?.example).toMatchObject({ attachToInstanceId: there.id, into: INTO });
    // The rule lets the upgrade be played into the area; without `into` the closed area's ally is no host.
    expect(refusal(there.state, HARNESS.id, { host: there.id })).not.toBeNull();

    const harness = mustPlay(there.state, HARNESS.id, { into: true, host: there.id });
    expect(mustInstance(harness.state, harness.id)).toMatchObject({
      attachedTo: there.id,
      controllerId: null,
      ownerId: P1,
    });
    expect(locateCard(harness.state, harness.id)).toEqual({ kind: "attachment", hostInstanceId: there.id });

    // With an ally of their own as well, each play has its own hosts, and `into` with the wrong one is refused.
    const mine = mustPlay(there.state, GUARD.id);
    const both = giveCard(mine.state, P1, HARNESS.id);
    const entry = entryFor(both.state, both.id);
    expect(entry?.targets).toEqual([mine.id]);
    expect(entry?.destinationHosts).toEqual({ [AREA]: [there.id] });
    expect(entry?.destinationOnly).toBeUndefined();
    expect(refusal(mine.state, HARNESS.id, { into: true, host: mine.id })).toBe(
      "an upgrade played into that area attaches to a card in it",
    );
    expect(mustInstance(mustPlay(mine.state, HARNESS.id, { host: mine.id }).state, mine.id).attachments).toHaveLength(
      1,
    );
  });
});

describe("playCard.into: a player side scheme", () => {
  it("is in the area in place of the villain's play area, with its starting threat and under no player's control", () => {
    const state = start();
    const given = giveCard(state, P1, SURVEY.id);
    expect(entryFor(given.state, given.id)?.destinations).toEqual([AREA]);

    const survey = mustPlay(state, SURVEY.id, { into: true });
    expect(locateCard(survey.state, survey.id)).toEqual(IN_AREA);
    expect(survey.state.villainArea).not.toContain(survey.id);
    expect(mustInstance(survey.state, survey.id)).toMatchObject({ threat: 4, controllerId: null, ownerId: P1 });

    const usual = mustPlay(state, SURVEY.id);
    expect(usual.state.villainArea).toContain(usual.id);
    expect(mustInstance(usual.state, usual.id)).toMatchObject({ threat: 4, controllerId: P1 });
  });

  it("counts against the player side scheme limit there: a second one played makes its player discard one", () => {
    const survey = mustPlay(start(), SURVEY.id, { into: true });
    const sweep = mustPlay(survey.state, SWEEP.id);
    const choice = sweep.state.pendingChoice;
    expect(choice?.prompt).toEqual({ kind: "discardOverPlayerSideSchemeLimit", limit: 1 });
    expect(choice?.options.map((option) => option.optionId).sort()).toEqual([survey.id, sweep.id].sort());

    const settled = driveSession(startSession(sweep.state), deps, [], () => [survey.id]).session.state;
    expect(cardsInPlay(settled)).not.toContain(survey.id);
    expect(mustPlayer(settled, P1).discard).toContain(survey.id);
    expect(mustInstance(settled, sweep.id).threat).toBe(3);
  });
});

describe("playCard.into: a card that does not stay in play", () => {
  it("an event the rule names is refused with its reason and stays in hand; played as usual it resolves", () => {
    const state = start();
    const flare = play(state, FLARE.id, { into: true });
    expect(flare.ok).toBe(false);
    if (!flare.ok) {
      expect(flare.message).toBe("an event is not in play while it resolves, so it is not played into an area");
      expect(locateCard(flare.before, flare.id)).toEqual({ kind: "hand", playerId: P1 });
      expect(entryFor(flare.before, flare.id)?.destinations).toBeUndefined();
    }
    expect(play(state, FLARE.id).ok).toBe(true);
  });

  it("a resource card the rule names is not played at all", () => {
    expect(refusal(start(), RESOURCE.id, { into: true })).toBe("resource cards are discarded to pay costs, not played");
  });
});
