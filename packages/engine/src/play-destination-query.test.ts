/**
 * `playCard.into` honors `RuleSpec playDestination.cards` as a query (code review, Piece 10b; docs/phase7-wave8.md
 * §3.34): which cards may be played into an in-play scenario area is the rule's to say, card by card. What the rule
 * cannot do is have a play put a card into an area when that card does not stay in play (an event; RRG 1.8 "Event",
 * p. 18: "the event is not in play"). Each type that does stay is in `play-destination-types.test.ts`.
 *
 * Sources: MC45 p. 5; RRG 1.8 "Play, Put into Play" (p. 32). Synthetic cards and rules; the engine names no card.
 */

import { flat, trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { sessionApply, startSession } from "./engine.js";
import { legalActions } from "./legal.js";
import { locateCard, mustPlayer } from "./query.js";
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
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1 } from "./testing/wave3.js";

const AREA = "depot";
const INTO = { scenarioPlayArea: AREA } as const;

const OPEN_ACTION = stubAbility("open.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "createScenarioPlayArea", name: AREA, closed: true }],
});
const OPEN = stubEvent({ id: "open", cost: 0, abilities: [OPEN_ACTION.ref] });
const CRATE = stubSupport({ id: "crate", cost: 0 });
const TOOL = stubSupport({ id: "tool", cost: 0, traits: [trait("gear")] });
const GUARD = stubAlly({ id: "guard", cost: 0, atk: 1, thw: 1, hp: 2 });
const BADGE = stubUpgrade({ id: "badge", cost: 0 });
const SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const TYRANT = stubVillain({ id: "tyrant", stages: [{ hp: flat(40), atk: 0, sch: 0 }] });
const NOISE = stubTreachery({ id: "noise", boostIcons: 0 });
const deps: EngineDeps = depsOf(OPEN_ACTION);

const playCommand = (id: Parameters<typeof locateCard>[1], into: boolean): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
  ...(into ? { into: INTO } : {}),
});
/** P1 in hero form at their turn with the area open, under `rules`. */
function start(rules: readonly RuleSpec[]): GameState {
  const base = gameAtFirstTurn({
    cards: [OPEN, CRATE, TOOL, GUARD, BADGE, NOISE],
    deps,
    villain: TYRANT,
    mainScheme: SCHEME,
    encounter: copiesOf(NOISE.id, 14),
    deck: [OPEN.id, CRATE.id, TOOL.id, GUARD.id, BADGE.id],
    scenarioRuleSpecs: rules,
  });
  const given = giveCard(base, P1, OPEN.id);
  const opened = driveSession(startSession(given.state), deps, [playCommand(given.id, false)]).session.state;
  return {
    ...opened,
    players: opened.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
}
function play(state: GameState, card: CardId, into: boolean) {
  const given = giveCard(state, P1, card);
  const result = sessionApply(startSession(given.state), playCommand(given.id, into), deps);
  if (!result.ok) return { ok: false as const, message: result.error.message, id: given.id, before: given.state };
  return { ok: true as const, id: given.id, state: driveSession(result.session, deps).session.state };
}
const destinationsOf = (state: GameState, id: Parameters<typeof locateCard>[1]) => {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(actions.kind);
  return actions.legal.find((entry) => entry.action.kind === "playCard" && entry.action.instanceId === id)
    ?.destinations;
};

describe("playCard.into reads the rule's `cards` query", () => {
  it("a rule that names supports sends a support there, and an ally has no such destination", () => {
    const state = start([{ kind: "playDestination", cards: { categories: ["support"] }, area: AREA }]);
    const crate = play(state, CRATE.id, true);
    if (!crate.ok) throw new Error(crate.message);
    expect(locateCard(crate.state, crate.id)).toEqual({ kind: "scenarioPlayArea", name: AREA });
    expect(mustPlayer(crate.state, P1).playArea).not.toContain(crate.id);

    const guard = play(state, GUARD.id, true);
    expect(guard.ok).toBe(false);
    if (!guard.ok) {
      expect(guard.message).toBe("that card cannot be played into that area right now");
      expect(destinationsOf(guard.before, guard.id)).toBeUndefined();
    }
  });

  it("a query narrower than a card type is read card by card: only the support with the trait", () => {
    const state = start([
      { kind: "playDestination", cards: { categories: ["support"], trait: trait("gear") }, area: AREA },
    ]);
    const tool = giveCard(state, P1, TOOL.id);
    expect(destinationsOf(tool.state, tool.id)).toEqual([AREA]);
    expect(play(state, TOOL.id, true).ok).toBe(true);
    expect(play(state, CRATE.id, true).ok).toBe(false);
  });

  it("a rule that names a card which does not stay in play is refused for it, not played elsewhere", () => {
    const state = start([
      {
        kind: "playDestination",
        cards: { anyOf: [{ categories: ["upgrade"] }, { name: OPEN.name }] },
        area: AREA,
      },
    ]);
    const open = play(state, OPEN.id, true);
    expect(open.ok).toBe(false);
    if (!open.ok) {
      expect(open.message).toBe("an event is not in play while it resolves, so it is not played into an area");
      expect(locateCard(open.before, open.id)).toEqual({ kind: "hand", playerId: P1 });
      expect(destinationsOf(open.before, open.id)).toBeUndefined();
    }
    // Played as usual it resolves as an event does.
    expect(play(state, OPEN.id, false).ok).toBe(true);
    // The upgrade the same rule names stays in play, so it has the destination.
    const badge = play(state, BADGE.id, true);
    expect(badge.ok && locateCard(badge.state, badge.id)).toEqual({ kind: "scenarioPlayArea", name: AREA });
  });
});
