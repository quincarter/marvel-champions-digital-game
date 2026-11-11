/**
 * `RuleSpec reduceDamageTaken` with its positive attack filters, `onlyUndefended` and `onlyAttacker`: the engine side of
 * Agile X, a custom-content keyword defined by its reminder text, "reduce damage taken from undefended villain and
 * villainous attacks by X" (Night Thrasher's Battle Board; the author confirmed it reaches undefended attacks only;
 * docs/custom-content-packs.md §6: a custom card's own text is the authority, then the RRG).
 *
 * Sources: RRG 1.8 "Attack (Enemy Activation)" (pp. 8-9; step 2, no defender: the attack is undefended), "Undefended"
 * (p. 46), "Villainous" (p. 47), "Modifiers" (p. 29).
 *
 * Synthetic cards, one seat. The stub hero has DEF 2 and 10 hit points; the encounter deck's cards have no boost icons,
 * so an attack deals the attacker's ATK. A support carries "your hero gets agile 1" in the DSL's shape.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubMinion, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const VILLAIN_OR_VILLAINOUS: TargetQuery = { anyOf: [{ categories: ["villain"] }, { withKeyword: "villainous" }] };

/** "Your hero gains agile 1": the shape `agile(1, …)` builds in `@mc/cards`. */
const AGILE_RULE = stubAbility(
  "agile.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [
        {
          kind: "reduceDamageTaken",
          target: { categories: ["hero"], controller: "you" },
          amount: 1,
          fromAttack: true,
          onlyUndefended: true,
          onlyAttacker: VILLAIN_OR_VILLAINOUS,
        },
      ],
    },
    effects: [],
  }),
);
const AGILE = stubSupport({ id: "agile", cost: 0, abilities: [AGILE_RULE.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const VILLAIN = stubVillain({ id: "big-bad", stages: [{ hp: flat(30), atk: 4, sch: 0 }] });
/** A villain printed with a dashed ATK never attacks, so only the minion's damage counts. */
const QUIET = stubVillain({ id: "quiet", stages: [{ hp: flat(30), atk: 0, sch: 0, dashedStats: ["atk"] }] });
const THUG = stubMinion({ id: "thug", atk: 3, sch: 1, hp: 7, boostIcons: 0 });
const BRUTE = stubMinion({ id: "brute", atk: 3, sch: 1, hp: 7, boostIcons: 0, keywords: [{ name: "villainous" }] });
/** A 1-ATK villain, for the tough status card. */
const JAB = stubVillain({ id: "jab", stages: [{ hp: flat(30), atk: 1, sch: 0 }] });
/** "Its attacks deal indirect damage" (Starshark's shape), on a villainous minion. */
const SHARK_RULE = stubAbility(
  "shark.constant",
  def({
    trigger: { kind: "constant", rules: [{ kind: "attacksDealIndirectDamage", attacker: { self: true } }] },
    effects: [],
  }),
);
const SHARK = stubMinion({
  id: "shark",
  atk: 3,
  sch: 1,
  hp: 7,
  boostIcons: 0,
  keywords: [{ name: "villainous" }],
  abilities: [SHARK_RULE.ref],
});
/** Boost: "Deal 1 damage to the defending character." (Energy Projectiles' shape.) */
const PROJECTILE_BOOST = stubAbility(
  "projectile.boost",
  def({
    trigger: { kind: "boost" },
    effects: [{ kind: "dealDamage", target: { kind: "defendingCharacter" }, amount: { kind: "const", value: 1 } }],
  }),
);
const PROJECTILE = stubTreachery({ id: "projectile", boostIcons: 0, abilities: [PROJECTILE_BOOST.ref] });
const FRAIL = stubAlly({ id: "frail", cost: 0, atk: 1, thw: 1, hp: 1 });

const deps: EngineDeps = depsOf(AGILE_RULE, SHARK_RULE, PROJECTILE_BOOST);

interface Setup {
  readonly villain?: typeof VILLAIN;
  readonly minion?: typeof THUG;
  readonly agile?: boolean;
  /** Every boost card is a projectile instead of a blank. */
  readonly projectiles?: boolean;
  /** A 1-hit-point ally in play. */
  readonly ally?: boolean;
  /** The hero has a tough status card. */
  readonly tough?: boolean;
}

/** Hero form, the support in play (unless `agile: false`), the minion engaged when given. */
function start(setup: Setup): { state: GameState; hero: InstanceId; ally: InstanceId | null } {
  const villain = setup.villain ?? VILLAIN;
  const base = gameAtFirstTurn({
    cards: [AGILE, BLANK, VILLAIN, QUIET, THUG, BRUTE, JAB, SHARK, PROJECTILE, FRAIL],
    deps,
    villain,
    deck: [AGILE.id, FRAIL.id],
    encounter: [
      ...copiesOf((setup.projectiles ? PROJECTILE : BLANK).id, 20),
      ...(setup.minion ? [setup.minion.id] : []),
    ],
  });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  if (setup.agile !== false) state = playerCardIntoPlay(state, AGILE.id).state;
  if (setup.minion) state = minionEngagedWith(state, setup.minion.id).state;
  let ally: InstanceId | null = null;
  if (setup.ally) {
    const put = playerCardIntoPlay(state, FRAIL.id);
    state = put.state;
    ally = put.id;
  }
  const hero = mustPlayer(state, P1).identity.instanceId;
  if (setup.tough) {
    const instance = mustInstance(state, hero);
    state = {
      ...state,
      instances: { ...state.instances, [hero]: { ...instance, statuses: { ...instance.statuses, tough: 1 } } },
    };
  }
  return { state, hero, ally };
}

/** Ends p1's turn and plays the villain phase; the hero defends when `defend`, else every attack is undefended. */
function villainPhase(state: GameState, hero: InstanceId, defend: boolean | InstanceId = false) {
  const defender = defend === true ? hero : defend;
  const pick = (current: GameState): readonly string[] =>
    defender && current.pendingChoice?.prompt.kind === "declareDefender" ? [defender] : defaultPick(current);
  const { session } = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }], pick);
  return session;
}

describe("reduceDamageTaken onlyUndefended + onlyAttacker (Agile X: undefended villain and villainous attacks)", () => {
  it("an undefended villain attack for 4 deals 3 to an agile 1 hero", () => {
    const s = start({});
    const session = villainPhase(s.state, s.hero);
    expect(mustInstance(session.state, s.hero).damage).toBe(3);
  });

  it("control: without the rule the same attack deals 4", () => {
    const s = start({ agile: false });
    const session = villainPhase(s.state, s.hero);
    expect(mustInstance(session.state, s.hero).damage).toBe(4);
  });

  it("a defended villain attack is not reduced: 4 ATK - 2 DEF = 2", () => {
    const s = start({});
    const session = villainPhase(s.state, s.hero, true);
    expect(mustInstance(session.state, s.hero).damage).toBe(2);
  });

  it("an undefended attack by a minion without villainous is not reduced", () => {
    const s = start({ villain: QUIET, minion: THUG });
    const session = villainPhase(s.state, s.hero);
    expect(mustInstance(session.state, s.hero).damage).toBe(3);
  });

  it("an undefended attack by a villainous minion is reduced", () => {
    const s = start({ villain: QUIET, minion: BRUTE });
    const session = villainPhase(s.state, s.hero);
    expect(mustInstance(session.state, s.hero).damage).toBe(2);
  });

  it("tough: an undefended 1-ATK villain attack is reduced to 0, so the hero keeps the tough card (RRG 1.8 FAQ p. 58)", () => {
    const s = start({ villain: JAB, tough: true });
    const session = villainPhase(s.state, s.hero);
    expect(mustInstance(session.state, s.hero).statuses.tough).toBe(1);
    expect(mustInstance(session.state, s.hero).damage).toBe(0);
    // Control: without agile the 1 damage is dealt, and the tough card prevents it and is discarded.
    const control = start({ villain: JAB, tough: true, agile: false });
    const after = villainPhase(control.state, control.hero);
    expect(mustInstance(after.state, control.hero).statuses.tough).toBe(0);
    expect(mustInstance(after.state, control.hero).damage).toBe(0);
  });

  it("a defending ally defeated by the boost leaves the attack undefended (RRG 1.8 p. 9 step 5): reduced", () => {
    const s = start({ projectiles: true, ally: true });
    const session = villainPhase(s.state, s.hero, s.ally!);
    expect(mustPlayer(session.state, P1).playArea).not.toContain(s.ally);
    expect(mustInstance(session.state, s.hero).damage).toBe(3);
    const control = start({ projectiles: true, ally: true, agile: false });
    const after = villainPhase(control.state, control.hero, control.ally!);
    expect(mustInstance(after.state, control.hero).damage).toBe(4);
  });

  it("an undefended villainous attack dealt as indirect damage is reduced on the hero's share", () => {
    const s = start({ villain: QUIET, minion: SHARK });
    const session = villainPhase(s.state, s.hero);
    expect(mustInstance(session.state, s.hero).damage).toBe(2);
    const control = start({ villain: QUIET, minion: SHARK, agile: false });
    expect(mustInstance(villainPhase(control.state, control.hero).state, control.hero).damage).toBe(3);
  });

  it("replays to the same state", () => {
    const s = start({});
    const session = villainPhase(s.state, s.hero);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
