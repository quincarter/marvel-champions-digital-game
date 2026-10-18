/**
 * `RuleSpec reduceDamageTaken` with a live `amount` (docs/phase7-wave11-hero-packs.md, H7 row 61038; §H3.23). "Reduce
 * the amount of damage Echo takes from each enemy attack by your hero's DEF." (Echo, `jj` 61038.)
 *
 * Sources: RRG 1.8 "Indirect Damage" (p. 24); "Modifiers" (p. 29). FFG ruling August 3, 2026 – Ruling 2 (1): Echo
 * reduces indirect damage from an enemy attack, and "up to her remaining HP" is RRG p. 24's assignment cap, read
 * "without accounting for interactions with other abilities", so 3 may be assigned to her 3 hit points and she takes
 * 3 minus the DEF.
 *
 * Synthetic cards, one seat. The stub hero has DEF 2; the stub ally has 3 hit points. The minion's attacks deal
 * indirect damage (`attacksDealIndirectDamage`, Starshark's shape) for 3, all assigned to the ally first.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubMinion, stubSupport, stubVillain } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const HERO_DEF: ValueSpec = { kind: "stat", of: { kind: "identityOf", player: { kind: "controller" } }, stat: "def" };

const SHARK_RULE = stubAbility(
  "shark.constant",
  def({
    trigger: { kind: "constant", rules: [{ kind: "attacksDealIndirectDamage", attacker: { self: true } }] },
    effects: [],
  }),
);
/** Echo's text. */
const ECHO_RULE = stubAbility(
  "echo.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [{ kind: "reduceDamageTaken", target: { self: true }, amount: HERO_DEF, fromAttack: true }],
    },
    effects: [],
  }),
);
/** "Your hero gets +1 DEF." */
const BRACE_RULE = stubAbility(
  "brace.constant",
  def({
    trigger: {
      kind: "constant",
      modifiers: [{ stat: "def", amount: 1, target: { categories: ["identity"], controller: "you" } }],
    },
    effects: [],
  }),
);

const SHARK = stubMinion({ id: "shark", atk: 3, sch: 1, hp: 7, boostIcons: 0, abilities: [SHARK_RULE.ref] });
/** A villain printed with a dashed ATK never attacks, so only the minion's damage counts. */
const QUIET = stubVillain({ id: "quiet", stages: [{ hp: flat(30), atk: 0, sch: 0, dashedStats: ["atk"] }] });
const ECHO = stubAlly({ id: "echo", cost: 0, atk: 1, thw: 1, hp: 3, abilities: [ECHO_RULE.ref] });
/** Control: the same ally without the rule. */
const PLAIN = stubAlly({ id: "plain", cost: 0, atk: 1, thw: 1, hp: 3 });
const BRACE = stubSupport({ id: "brace", cost: 0, abilities: [BRACE_RULE.ref] });

const deps: EngineDeps = depsOf(SHARK_RULE, ECHO_RULE, BRACE_RULE);

/** Hero form, `ally` in play, the shark engaged; `brace` puts the +1 DEF support in play too. */
function start(ally: typeof ECHO, brace = false): { state: GameState; ally: InstanceId; hero: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [SHARK, QUIET, ECHO, PLAIN, BRACE],
    deps,
    villain: QUIET,
    deck: [ECHO.id, PLAIN.id, BRACE.id],
    encounter: [SHARK.id],
  });
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const inPlay = playerCardIntoPlay(heroes, ally.id);
  const braced = brace ? playerCardIntoPlay(inPlay.state, BRACE.id).state : inPlay.state;
  const engaged = minionEngagedWith(braced, SHARK.id);
  return { state: engaged.state, ally: inPlay.id, hero: mustPlayer(engaged.state, P1).identity.instanceId };
}

/** Plays the villain phase, the attack undefended; its indirect damage goes to the ally first, then the identity. */
function villainPhase(state: GameState, ally: InstanceId) {
  const assigned: number[] = [];
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (choice?.prompt.kind !== "assignIndirectDamage") return defaultPick(current);
    const allyFirst = [...choice.options].sort(
      (a, b) => Number(b.optionId.startsWith(`${ally}#`)) - Number(a.optionId.startsWith(`${ally}#`)),
    );
    const picked = allyFirst.slice(0, choice.minSelections).map((option) => option.optionId);
    assigned.push(picked.filter((id) => id.startsWith(`${ally}#`)).length);
    return picked;
  };
  const { session } = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }], pick);
  return { session, state: session.state, assigned };
}

describe("reduceDamageTaken by a live amount: 'by your hero's DEF' (Echo 61038; August 3, 2026 – Ruling 2)", () => {
  it("3 indirect damage from an enemy attack, all assigned to her: she takes 3 - DEF 2 = 1 and stays in play", () => {
    const s = start(ECHO);
    const { state, assigned } = villainPhase(s.state, s.ally);
    // The assignment cap is her remaining hit points, the reduction not counted (RRG p. 24).
    expect(assigned).toEqual([3]);
    expect(mustInstance(state, s.ally).damage).toBe(1);
    expect(mustInstance(state, s.hero).damage).toBe(0);
  });

  it("the amount is read when the damage is taken: with the hero at DEF 3 she takes nothing", () => {
    const s = start(ECHO, true);
    const { state } = villainPhase(s.state, s.ally);
    expect(mustInstance(state, s.ally).damage).toBe(0);
    expect(mustPlayer(state, P1).playArea).toContain(s.ally);
  });

  it("control: the same ally without the rule takes all 3 and is defeated", () => {
    const s = start(PLAIN);
    const { state } = villainPhase(s.state, s.ally);
    expect(mustPlayer(state, P1).discard).toContain(s.ally);
  });

  it("replays to the same state", () => {
    const s = start(ECHO);
    const { session } = villainPhase(s.state, s.ally);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
