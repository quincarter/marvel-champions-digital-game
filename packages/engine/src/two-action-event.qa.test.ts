/**
 * QA: an event with two Action abilities, each gated by a `while` on a form ("Action: If you are in alter-ego form,
 * draw 1 card. / Action: If you are in hero form, draw 3 cards." as two separate abilities). Synthetic cards.
 *
 * Source: RRG 1.8 "Event" (p. 18): "If an event has more than one triggered ability on it, the player playing it
 * chooses one of those abilities to trigger when playing that event." So the play is legal when at least one of its
 * abilities can be used now, and only the ability that matches resolves. RRG "Initiating Abilities" (p. 24): play
 * restrictions are checked at step 2, before the cost is determined and paid.
 *
 * Engine sites under test: `eventActionToPlay` (actions.ts) picks the one Action ability usable now, and legality, cost
 * and `while` are read from it; `resolve/play-card.ts` stage "abilities" resolves only `frame.triggeredAbilityId`, as
 * it always has for a response or interrupt event. Before that fix the first Action ability alone decided legality and
 * every Action ability resolved. The choice between two usable abilities is in `event-ability-choice.test.ts`.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustPlayer } from "./query.js";
import type { Predicate } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCards, newGame, RESOURCE, runWith } from "./testing/scenario.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);
const toHero: Command = { type: "changeForm", playerId: p1 };
const inForm = (form: "hero" | "alterEgo"): Predicate => ({ kind: "form", player: { kind: "controller" }, form });
const never: Predicate = { kind: "and", of: [inForm("hero"), inForm("alterEgo")] };
const draw = (value: number) =>
  [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value } }] as const;

const ALTER_EGO_ABILITY = stubAbility(
  "duo.action",
  def({ trigger: { kind: "action", while: inForm("alterEgo") }, effects: [...draw(1)] }),
);
const HERO_ABILITY = stubAbility(
  "duo.hero-action",
  def({ trigger: { kind: "action", while: inForm("hero") }, effects: [...draw(3)] }),
);
const DUO = stubEvent({ id: "duo", cost: 0, abilities: [ALTER_EGO_ABILITY.ref, HERO_ABILITY.ref] });

const NEVER_A = stubAbility("nope.action", def({ trigger: { kind: "action", while: never }, effects: [...draw(1)] }));
const NEVER_B = stubAbility(
  "nope.hero-action",
  def({ trigger: { kind: "action", while: never }, effects: [...draw(3)] }),
);
const NOPE = stubEvent({ id: "nope", cost: 0, abilities: [NEVER_A.ref, NEVER_B.ref] });

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

function setup(): { deps: EngineDeps; state: GameState } {
  const deps = depsOf(ALTER_EGO_ABILITY, HERO_ABILITY, NEVER_A, NEVER_B);
  const state = newGame({
    villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] }),
    mainScheme: stubMainScheme({
      id: "scheme",
      stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
    }),
    extraCards: [BLANK, DUO, NOPE],
    deck: [...copies(DUO.id), ...copies(NOPE.id), ...copies(RESOURCE.id, 20)],
    encounterDeck: copies(BLANK.id, 20),
    deps,
  });
  return { deps, state };
}

const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const isPlayOf = (id: InstanceId) => (a: { action: { kind: string } }) =>
  a.action.kind === "playCard" && "instanceId" in a.action && a.action.instanceId === id;
const handSize = (state: GameState): number => mustPlayer(state, p1).hand.length;

/** Hand size after playing `code` from `state`: the event leaves the hand (-1), and each card drawn adds 1. */
function playAndMeasure(deps: EngineDeps, state: GameState, code: string): { ok: boolean; delta: number } {
  const given = giveCards(state, p1, code);
  const id = given.ids[0] as InstanceId;
  const before = handSize(given.state);
  const result = applyCommand(given.state, play(id), deps);
  if (!result.ok) return { ok: false, delta: 0 };
  return { ok: true, delta: handSize(runWith(deps, given.state, play(id))) - before };
}

describe("an event with two form-gated Action abilities (RRG Event p. 18)", () => {
  it("alter-ego form: playable (the first ability's `while` holds)", () => {
    const { deps, state } = setup();
    expect(playAndMeasure(deps, state, "duo").ok).toBe(true);
  });

  it("alter-ego form: the hero-form ability must not also resolve (net hand change exactly 0)", () => {
    const { deps, state } = setup();
    expect(playAndMeasure(deps, state, "duo").delta).toBe(0);
  });

  it("hero form: playable, and only the hero ability resolves (draw 3, net +2 after the event leaves hand)", () => {
    const { deps, state } = setup();
    const hero = runWith(deps, state, toHero);
    expect(playAndMeasure(deps, hero, "duo")).toEqual({ ok: true, delta: 2 });
  });

  it("hero form: legalActions lists the play as legal", () => {
    const { deps, state } = setup();
    const hero = runWith(deps, state, toHero);
    const given = giveCards(hero, p1, "duo");
    const actions = legalActions(given.state, p1, deps);
    if (actions.kind !== "turn") throw new Error(`expected the player's turn, got ${actions.kind}`);
    expect(actions.legal.some(isPlayOf(given.ids[0] as InstanceId))).toBe(true);
  });

  it("neither ability's condition holds: not playable in either form, and not listed as legal", () => {
    const { deps, state } = setup();
    for (const form of ["alterEgo", "hero"] as const) {
      const at = form === "hero" ? runWith(deps, state, toHero) : state;
      expect(playAndMeasure(deps, at, "nope").ok).toBe(false);
      const given = giveCards(at, p1, "nope");
      const actions = legalActions(given.state, p1, deps);
      if (actions.kind !== "turn") throw new Error(`expected the player's turn, got ${actions.kind}`);
      expect(actions.legal.some(isPlayOf(given.ids[0] as InstanceId))).toBe(false);
    }
  });
});
