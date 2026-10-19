/**
 * docs/phase7-wave11-scenarios.md §S7 E19: `RuleSpec attacksLoseKeywords` scoped by `attacker` ("Bullseye's attacks
 * lose ranged", Deadly Sai 60070). An attack made by a matching character has none of the keywords against anyone,
 * whatever gave them. RRG 1.8 "Lose" (p. 27): "A lost characteristic cannot be regained while the ability causing it to
 * be lost is in effect, even if a new effect would cause the characteristic to be gained." "Ranged" (p. 35) and
 * "Retaliate X" (p. 38); "Piercing" (p. 32) and "Tough" (p. 44). Synthetic cards only.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { defendPreview } from "./defend-preview.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { attackKeywordsOf } from "./keywords.js";
import { mustInstance, mustPlayer } from "./query.js";
import { lostAttackKeywords } from "./rules.js";
import { cardsInPlay } from "./select.js";
import type { AttackKeyword, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubAttachment, stubMainScheme, stubMinion, stubSupport, stubVillain } from "./testing/fixtures.js";
import { runWith, settleUntil } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const HOST: TargetQuery = { hostOfSelf: true };
const constant = (id: string, part: Omit<Extract<AbilityDefinition["trigger"], { kind: "constant" }>, "kind">) =>
  stubAbility(`${id}.constant`, { trigger: { kind: "constant", ...part }, effects: [] });
const attackerLoses = (keywords: readonly AttackKeyword[]): RuleSpec => ({
  kind: "attacksLoseKeywords",
  keywords,
  attacker: HOST,
});

/** "Attached villain's attacks lose ranged." */
const SAI_CONSTANT = constant("sai", { rules: [attackerLoses(["ranged"])] });
const SAI = stubAttachment({ id: "sai", abilities: [SAI_CONSTANT.ref] });
/** "Attached villain's attacks lose piercing." */
const BLUNT_CONSTANT = constant("blunt", { rules: [attackerLoses(["piercing"])] });
const BLUNT = stubAttachment({ id: "blunt", abilities: [BLUNT_CONSTANT.ref] });
/** "Attached character gains retaliate 1." */
const THORNS_CONSTANT = constant("thorns", {
  keywordGrants: [{ keyword: { name: "retaliate", value: 1 }, target: HOST }],
});
const THORNS = stubAttachment({ id: "thorns", abilities: [THORNS_CONSTANT.ref] });
/** "The villain's attacks gain ranged and piercing." (Out Front's shape: a rule naming the attacker.) */
const SCOPE_CONSTANT = constant("scope", {
  rules: [{ kind: "attackKeywords", keywords: ["ranged", "piercing"], attacker: { categories: ["villain"] } }],
});
const SCOPE = stubSupport({ id: "scope", cost: 0, abilities: [SCOPE_CONSTANT.ref] });
/** "Your basic attacks gain ranged." */
const BOW_CONSTANT = constant("bow", {
  rules: [{ kind: "attackKeywords", keywords: ["ranged"], attacker: { categories: ["identity"] }, basicOnly: true }],
});
const BOW = stubSupport({ id: "bow", cost: 0, abilities: [BOW_CONSTANT.ref] });

/** "Attacks against attached character lose ranged." (target-scoped, for the preview's per-option read.) */
const VEIL_CONSTANT = constant("veil", {
  rules: [{ kind: "attacksLoseKeywords", keywords: ["ranged"], target: HOST }],
});
const VEIL = stubAttachment({ id: "veil", abilities: [VEIL_CONSTANT.ref] });
/** "Your basic attacks gain overkill and ranged." */
const RAM_CONSTANT = constant("ram", {
  rules: [
    {
      kind: "attackKeywords",
      keywords: ["overkill", "ranged"],
      attacker: { categories: ["identity"] },
      basicOnly: true,
    },
  ],
});
const RAM = stubSupport({ id: "ram", cost: 0, abilities: [RAM_CONSTANT.ref] });
/** "Your attacks lose ranged." */
const GROUNDED_CONSTANT = constant("grounded", {
  rules: [{ kind: "attacksLoseKeywords", keywords: ["ranged"], attacker: { categories: ["identity"] } }],
});
const GROUNDED = stubSupport({ id: "grounded", cost: 0, abilities: [GROUNDED_CONSTANT.ref] });
/** "The villain cannot take damage unless the attack has ranged." */
const SKY_CONSTANT = constant("sky", {
  rules: [{ kind: "cannotTakeDamage", target: { categories: ["villain"] }, exceptAttackKeyword: "ranged" }],
});
const SKY = stubSupport({ id: "sky", cost: 0, abilities: [SKY_CONSTANT.ref] });
/** "Your attacks against the villain lose piercing" (both ends), and a malformed rule naming neither end. */
const BOTH_CONSTANT = constant("both", {
  rules: [
    {
      kind: "attacksLoseKeywords",
      keywords: ["piercing"],
      target: { categories: ["villain"] },
      attacker: { categories: ["identity"] },
    },
  ],
});
const BOTH = stubSupport({ id: "both", cost: 0, abilities: [BOTH_CONSTANT.ref] });
const NEITHER_CONSTANT = constant("neither", { rules: [{ kind: "attacksLoseKeywords", keywords: ["ranged"] }] });
const NEITHER = stubSupport({ id: "neither", cost: 0, abilities: [NEITHER_CONSTANT.ref] });

/** ATK 2, ranged printed on the villain itself. */
const MARKSMAN = stubVillain({
  id: "marksman",
  stages: [{ hp: flat(30), atk: 2, sch: 0, keywords: [{ name: "ranged" as const }] }],
});
const PLAIN = stubVillain({ id: "plain", stages: [{ hp: flat(30), atk: 2, sch: 0 }] });
const SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const FILLER = stubMinion({ id: "filler", atk: 0, sch: 0, hp: 9, boostIcons: 0 });
const GRUNT = stubMinion({ id: "grunt", atk: 0, sch: 0, hp: 1, boostIcons: 0 });

const deps: EngineDeps = depsOf(
  SAI_CONSTANT,
  BLUNT_CONSTANT,
  THORNS_CONSTANT,
  SCOPE_CONSTANT,
  BOW_CONSTANT,
  VEIL_CONSTANT,
  RAM_CONSTANT,
  GROUNDED_CONSTANT,
  SKY_CONSTANT,
  BOTH_CONSTANT,
  NEITHER_CONSTANT,
);

const toHero: Command = { type: "changeForm", playerId: P1 };
const endTurn: Command = { type: "endTurn", playerId: P1 };
const heroOf = (state: GameState) => mustPlayer(state, P1).identity.instanceId;
const villainOf = (state: GameState) => state.villains[0]!.instanceId;
const damageOn = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const withTough = (state: GameState, id: InstanceId): GameState => ({
  ...state,
  instances: {
    ...state.instances,
    [id]: { ...mustInstance(state, id), statuses: { ...mustInstance(state, id).statuses, tough: 1 } },
  },
});

/** Attaches an encounter attachment to `to` (surgery: no reveal). */
function attach(state: GameState, card: CardId, to: InstanceId): GameState {
  const id = (Object.keys(state.instances) as InstanceId[]).find(
    (key) => state.instances[key]?.cardId === card && !cardsInPlay(state).includes(key),
  );
  if (!id) throw new Error(`no ${card} out of play`);
  return {
    ...state,
    encounterDecks: Object.fromEntries(
      Object.entries(state.encounterDecks).map(([deckId, piles]) => [
        deckId,
        { ...piles, deck: piles.deck.filter((x) => x !== id) },
      ]),
    ),
    instances: {
      ...state.instances,
      [id]: { ...mustInstance(state, id), faceup: true, attachedTo: to },
      [to]: { ...mustInstance(state, to), attachments: [...mustInstance(state, to).attachments, id] },
    },
  };
}

/** P1 in hero form with retaliate 1 (Thorns), against `villain`, with `supports` in play. */
function table(villain = MARKSMAN, supports: readonly { readonly id: CardId }[] = []): GameState {
  let state = gameAtFirstTurn({
    cards: [SAI, BLUNT, THORNS, SCOPE, BOW, VEIL, RAM, GROUNDED, SKY, BOTH, NEITHER, FILLER, GRUNT],
    deps,
    villain,
    mainScheme: SCHEME,
    encounter: [SAI.id, BLUNT.id, THORNS.id, VEIL.id, GRUNT.id, ...copiesOf(FILLER.id, 12)],
    deck: [SCOPE.id, BOW.id, RAM.id, GROUNDED.id, SKY.id, BOTH.id, NEITHER.id],
  });
  for (const support of supports) state = playerCardIntoPlay(state, support.id).state;
  state = runCommands(state, deps, toHero).state;
  return attach(state, THORNS.id, heroOf(state));
}

describe("docs/phase7-wave11-scenarios.md §S7 E19: an attacker's attacks lose a keyword", () => {
  it("the control: a ranged villain ignores the hero's retaliate", () => {
    const run = runCommands(table(), deps, endTurn);
    expect(damageOn(run.state, heroOf(run.state))).toBe(2);
    expect(damageOn(run.state, villainOf(run.state))).toBe(0);
  });

  it("the villain's printed ranged is lost: the hero's retaliate deals its 1 damage", () => {
    const base = table();
    const run = runCommands(attach(base, SAI.id, villainOf(base)), deps, endTurn);
    expect(damageOn(run.state, heroOf(run.state))).toBe(2);
    expect(damageOn(run.state, villainOf(run.state))).toBe(1);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.state);
  });

  it("ranged granted by a rule ('the villain's attacks gain ranged') is lost too: the loss beats the gain", () => {
    const control = table(PLAIN, [SCOPE]);
    expect(damageOn(runCommands(control, deps, endTurn).state, villainOf(control))).toBe(0);
    const run = runCommands(attach(control, SAI.id, villainOf(control)), deps, endTurn);
    expect(damageOn(run.state, villainOf(run.state))).toBe(1);
  });

  it("only the keyword named: the same attack keeps piercing, and losing piercing keeps the tough status card", () => {
    const base = table(PLAIN, [SCOPE]);
    const tough = withTough(base, heroOf(base));
    const sai = runCommands(attach(tough, SAI.id, villainOf(tough)), deps, endTurn);
    expect(of(sai.events, "statusRemoved").map((e) => e.reason)).toContain("piercing");
    expect(damageOn(sai.state, heroOf(sai.state))).toBe(2);

    const blunt = runCommands(attach(tough, BLUNT.id, villainOf(tough)), deps, endTurn);
    expect(of(blunt.events, "statusRemoved").map((e) => e.reason)).not.toContain("piercing");
    expect(damageOn(blunt.state, heroOf(blunt.state))).toBe(0);
    // Ranged is not lost there, so the retaliate is still ignored.
    expect(damageOn(blunt.state, villainOf(blunt.state))).toBe(0);
  });

  it("`attackKeywordsOf` leaves it out with or without an attacked character; other attackers keep it", () => {
    const base = table(MARKSMAN, [BOW]);
    const state = attach(base, SAI.id, villainOf(base));
    const villain = { attackerInstanceId: villainOf(state) };
    expect(attackKeywordsOf(state, deps, villain)).toEqual([]);
    expect(attackKeywordsOf(state, deps, { ...villain, targetInstanceId: heroOf(state) })).toEqual([]);
    expect(attackKeywordsOf(state, deps, { ...villain, keywords: ["ranged"], vars: { ranged: 1 } })).toEqual([]);
    expect(attackKeywordsOf(state, deps, { attackerInstanceId: heroOf(state), basic: true })).toEqual(["ranged"]);
    expect(lostAttackKeywords(state, deps, null, villainOf(state))).toEqual(["ranged"]);
    expect(lostAttackKeywords(state, deps, villainOf(state), heroOf(state))).toEqual([]);
    expect(lostAttackKeywords(state, deps, heroOf(state), null)).toEqual([]);
  });
});

describe("§S7 E19 where the loss is read besides the attack itself", () => {
  /** The table parked on the villain attack's defend prompt; `vars` are put on the attack's event frame. */
  const atDefense = (state: GameState, vars: Record<string, number> = {}): GameState => {
    const parked = settleUntil(runWith(deps, state, endTurn), "declareDefender", deps);
    const attack = parked.stack.find((frame) => frame.kind === "enemyAttack");
    if (attack?.kind !== "enemyAttack" || !attack.eventFrameId)
      throw new Error("expected an attack with an event frame");
    return {
      ...parked,
      stack: parked.stack.map((frame) =>
        frame.frameId === attack.eventFrameId && frame.kind === "event"
          ? { ...frame, vars: { ...frame.vars, ...vars } }
          : frame,
      ),
    };
  };
  /** The retaliate the preview shows for declining: the hero is attacked and survives the ATK 2 hit. */
  const retaliateShown = (state: GameState): readonly number[] => {
    const decline = defendPreview(state, deps)!.find((option) => option.defenderInstanceId === null)!;
    return decline.bands.map((band) => band.retaliateToAttacker);
  };

  it("the defend preview: a ranged villain whose attacks lose ranged takes the hero's retaliate 1", () => {
    const base = table();
    expect(retaliateShown(atDefense(base))).toEqual([0]);
    expect(retaliateShown(atDefense(attach(base, SAI.id, villainOf(base))))).toEqual([1]);
  });

  it("the defend preview reads ranged granted in the attack's vars, and a loss against the attacked character", () => {
    const base = table(PLAIN);
    expect(retaliateShown(atDefense(base))).toEqual([1]);
    expect(retaliateShown(atDefense(base, { ranged: 1 }))).toEqual([0]);
    expect(retaliateShown(atDefense(attach(base, SAI.id, villainOf(base)), { ranged: 1 }))).toEqual([1]);
    expect(retaliateShown(atDefense(attach(base, VEIL.id, heroOf(base)), { ranged: 1 }))).toEqual([1]);
  });

  it("an overkill spill from an attacker whose attacks lose ranged does not have ranged", () => {
    // ATK 2 with overkill and ranged against a 1-hit-point minion: 1 spills to a villain only ranged damage reaches.
    const run = (supports: readonly { readonly id: CardId }[]) => {
      const base = table(PLAIN, [RAM, SKY, ...supports]);
      const grunt = minionEngagedWith(base, GRUNT.id);
      return runCommands(grunt.state, deps, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: heroOf(grunt.state),
        targetInstanceId: grunt.id,
      });
    };
    const control = run([]);
    expect(of(control.events, "overkillSpilled")).toHaveLength(1);
    expect(damageOn(control.state, villainOf(control.state))).toBe(1);
    const grounded = run([GROUNDED]);
    expect(of(grounded.events, "overkillSpilled")).toHaveLength(1);
    expect(damageOn(grounded.state, villainOf(grounded.state))).toBe(0);
  });

  it("a rule naming both ends applies only when both match; a rule naming neither strips nothing", () => {
    const state = table(MARKSMAN, [BOTH, NEITHER]);
    const hero = heroOf(state);
    const villain = villainOf(state);
    expect(lostAttackKeywords(state, deps, villain, hero)).toEqual(["piercing"]);
    expect(lostAttackKeywords(state, deps, villain, villain)).toEqual([]);
    expect(lostAttackKeywords(state, deps, hero, hero)).toEqual([]);
    expect(lostAttackKeywords(state, deps, villain, null)).toEqual([]);
    expect(lostAttackKeywords(state, deps, null, hero)).toEqual([]);
    expect(attackKeywordsOf(state, deps, { attackerInstanceId: villain, targetInstanceId: hero })).toEqual(["ranged"]);
  });
});
