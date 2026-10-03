/**
 * "Hero Interrupt (defense/thwart): When you defend against an attack … that attack removes threat from the main scheme
 * instead of dealing damage" (Determined Defense, `mut_gen` 32189). `modifyAttack.removesThreatFrom`, from an interrupt
 * to the `enemyAttack` in progress or to a defense against it, turns the attack's damage step into a removal of the
 * amount it calculated (RRG 1.8 "Attack (Enemy Activation)" step 4, p. 9: ATK + boost icons, less a basic defense's
 * DEF) from the named scheme. With `thwart` the removal is a thwart by the ability's identity (RRG 1.8 "Labeled
 * Ability", p. 26), so patrol stops it (p. 32); a crisis icon stops it either way (p. 14), and the damage is replaced
 * all the same. Synthetic cards: the villain's ATK is 3, each boost card has 1 boost icon, the hero's DEF is 2 and the
 * main scheme starts with 10 threat.
 */

import { flat, type KeywordInstance } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubIdentity,
  stubMainScheme,
  stubMinion,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { defaultPick, HERO, runWith } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const theVillain = { kind: "named", name: "villain" } as const;
const mainScheme = { kind: "mainScheme" } as const;
const yourHero = { categories: ["hero"], controller: "you" } as const;
const ability = (id: string, definition: AbilityDefinition) => stubAbility(id, def(definition));

/** "Forced Interrupt (defense/thwart): When you defend against an attack, that attack removes threat from the main scheme instead of dealing damage." */
const ON_DEFENSE = ability("on-defense.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "defended", targetIs: yourHero } },
  label: ["defense", "thwart"],
  effects: [{ kind: "modifyAttack", removesThreatFrom: { scheme: mainScheme, thwart: true } }],
});
/** The same change from "When an enemy attacks you": the label makes the hero the defender, not a basic defense. */
const ON_ATTACK = ability("on-attack.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true },
  },
  label: ["defense", "thwart"],
  effects: [{ kind: "modifyAttack", removesThreatFrom: { scheme: mainScheme, thwart: true } }],
});
/** Unlabeled, and not a thwart: the card's own removal. */
const PLAIN = ability("plain.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true },
  },
  effects: [{ kind: "modifyAttack", removesThreatFrom: { scheme: mainScheme } }],
});
/** The same change, offered to a scheme activation, which ignores it. */
const ON_SCHEME = ability("on-scheme.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyScheme", sourceIs: { categories: ["villain"] } } },
  effects: [{ kind: "modifyAttack", removesThreatFrom: { scheme: mainScheme } }],
});
/** "Damage from that attack is dealt to Goon instead of you" on the same attack. */
const MISDIRECT = ability("misdirect.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true },
  },
  effects: [{ kind: "modifyAttack", damageTo: { kind: "named", name: "goon" } }],
});
/** "Forced Response: After your hero defends against an attack and takes no damage, deal 1 damage to the villain." */
const UNFLAPPABLE = ability("unflappable.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "defended", targetIs: yourHero, resultsAtMost: { damage: 0 } },
  },
  effects: [{ kind: "dealDamage", target: theVillain, amount: { kind: "const", value: 1 } }],
});
/** "Forced Response: After you thwart, deal 2 damage to the villain." */
const AFTER_THWART = ability("after-thwart.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "thwart", sourceIs: { categories: ["identity"], controller: "you" } },
  },
  effects: [{ kind: "dealDamage", target: theVillain, amount: { kind: "const", value: 2 } }],
});
/** "Forced Interrupt: When you thwart, that thwart removes 1 additional threat." */
const EXTRA_THREAT = ability("extra-threat.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "thwart", sourceIs: { categories: ["identity"], controller: "you" } },
  },
  effects: [{ kind: "modifyThwart", extraThreat: { kind: "const", value: 1 } }],
});
/** "Action: the villain attacks you." / "Action: the villain schemes." */
const ATTACK_ABILITY = ability("attack.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "enemyAttack", enemies: theVillain, against: { kind: "controller" } }],
});
const SCHEME_ABILITY = ability("scheme.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "enemyScheme", enemies: theVillain }],
});
/** "Boost: Place 5 threat on the main scheme." */
const SURGE_OF_THREAT = ability("advance.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "placeThreat", target: mainScheme, amount: { kind: "const", value: 5 } }],
});

const support = (id: string, stub: typeof ATTACK_ABILITY) => stubSupport({ id, cost: 0, abilities: [stub.ref] });
const CARDS = {
  onDefense: support("on-defense", ON_DEFENSE),
  onAttack: support("on-attack", ON_ATTACK),
  plain: support("plain", PLAIN),
  onScheme: support("on-scheme", ON_SCHEME),
  misdirect: support("misdirector", MISDIRECT),
  unflappable: support("unflappable", UNFLAPPABLE),
  afterThwart: support("after-thwart", AFTER_THWART),
  extraThreat: support("extra-threat", EXTRA_THREAT),
} as const;
const ATTACKER = stubSupport({ id: "attacker", cost: 0, abilities: [ATTACK_ABILITY.ref, SCHEME_ABILITY.ref] });
const ONE_ICON = stubTreachery({ id: "one-icon", boostIcons: 1 });
const ADVANCER = stubTreachery({ id: "advancer", boostIcons: 1, starIcon: true, abilities: [SURGE_OF_THREAT.ref] });
const GOON = stubMinion({ id: "goon", atk: 1, sch: 1, hp: 10 });
const PATROLLER = stubMinion({ id: "patroller", atk: 1, sch: 1, hp: 10, keywords: [{ name: "patrol" }] });

const deps: EngineDeps = depsOf(
  ON_DEFENSE,
  ON_ATTACK,
  PLAIN,
  ON_SCHEME,
  MISDIRECT,
  UNFLAPPABLE,
  AFTER_THWART,
  EXTRA_THREAT,
  ATTACK_ABILITY,
  SCHEME_ABILITY,
  SURGE_OF_THREAT,
);

interface Options {
  readonly inPlay: readonly (keyof typeof CARDS)[];
  readonly crisis?: boolean;
  /** Two stages, the first completing at 12 threat. */
  readonly twoStages?: boolean;
  readonly minion?: typeof GOON;
  readonly villainKeywords?: readonly KeywordInstance[];
  readonly heroKeywords?: readonly KeywordInstance[];
  readonly status?: "tough" | "confused";
  readonly boost?: typeof ONE_ICON;
}

interface Setup {
  readonly state: GameState;
  readonly attacker: InstanceId;
  readonly hero: InstanceId;
  readonly villain: InstanceId;
  readonly minion: InstanceId | null;
}

function setup(options: Options): Setup {
  const villain = stubVillain({
    id: "villain",
    stages: [
      { hp: flat(30), atk: 3, sch: 1, ...(options.villainKeywords ? { keywords: options.villainKeywords } : {}) },
    ],
  });
  const stage = { startingThreat: flat(10), targetThreat: flat(40), acceleration: flat(0) };
  const scheme = stubMainScheme({
    id: "main",
    stages: options.twoStages
      ? [
          { ...stage, targetThreat: flat(12) },
          { ...stage, startingThreat: flat(6) },
        ]
      : [{ ...stage, ...(options.crisis ? { icons: ["crisis"] as const } : {}) }],
  });
  const boost = options.boost ?? ONE_ICON;
  const supports = options.inPlay.map((key) => CARDS[key]);
  let state = gameAtFirstTurn({
    // A hero with keywords replaces the default identity card of the same id (the card pool is keyed by id).
    cards: [
      ...(options.heroKeywords ? [stubIdentity({ ...HERO_SPEC, heroKeywords: options.heroKeywords })] : []),
      ...Object.values(CARDS),
      ATTACKER,
      ONE_ICON,
      ADVANCER,
      GOON,
      PATROLLER,
    ],
    deps,
    villain,
    mainScheme: scheme,
    deck: [ATTACKER.id, ...supports.map((card) => card.id)],
    encounter: [...(options.minion ? [options.minion.id] : []), ...copiesOf(boost.id, 30)],
  });
  const attacker = playerCardIntoPlay(state, ATTACKER.id);
  state = attacker.state;
  for (const card of supports) state = playerCardIntoPlay(state, card.id).state;
  let minion: InstanceId | null = null;
  if (options.minion) {
    const engaged = minionEngagedWith(state, options.minion.id);
    state = engaged.state;
    minion = engaged.id;
  }
  if (mustPlayer(state, P1).identity.form !== "hero")
    state = runWith(deps, state, { type: "changeForm", playerId: P1 });
  const hero = mustPlayer(state, P1).identity.instanceId;
  if (options.status) {
    const h = state.instances[hero]!;
    state = {
      ...state,
      instances: { ...state.instances, [hero]: { ...h, statuses: { ...h.statuses, [options.status]: 1 } } },
    };
  }
  return { state, attacker: attacker.id, hero, villain: activeVillain(state).instanceId, minion };
}
const HERO_SPEC = { id: HERO.id, hp: 10, atk: 2, thw: 2, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 };

const use = (id: InstanceId, abilityRef = ATTACK_ABILITY): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: id,
  abilityId: abilityRef.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});
/** Declares the hero as the defender (a basic defense) when asked; everything else as `defaultPick`. */
const defending =
  (hero: InstanceId) =>
  (state: GameState): readonly string[] =>
    state.pendingChoice?.prompt.kind === "declareDefender" ? [hero] : defaultPick(state);
const run = (s: Setup, commands: readonly Command[], pick = defaultPick) =>
  driveSession(startSession(s.state), deps, commands, pick);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const damageOf = (state: GameState, id: InstanceId) => state.instances[id]?.damage ?? 0;
const threatOf = (state: GameState) => state.instances[state.mainScheme.instanceId]!.threat;
const triggers = (events: readonly GameEvent[]) => of(events, "triggerEvent").map((e) => e.event);

describe("modifyAttack removesThreatFrom — 'that attack removes threat from the main scheme instead of dealing damage'", () => {
  it("without it, a basic defense takes ATK 3 + 1 boost icon - DEF 2", () => {
    const s = setup({ inPlay: [] });
    const { session } = run(s, [use(s.attacker)], defending(s.hero));
    expect(damageOf(session.state, s.hero)).toBe(2);
    expect(threatOf(session.state)).toBe(10);
  });

  it("from a basic defense: the calculated damage (boost included, less DEF) comes off the main scheme, none is dealt", () => {
    const s = setup({ inPlay: ["onDefense"] });
    const { session, events } = run(s, [use(s.attacker)], defending(s.hero));
    expect(damageOf(session.state, s.hero)).toBe(0);
    expect(threatOf(session.state)).toBe(8);
    expect(of(events, "attackResolved")).toEqual([
      {
        type: "attackResolved",
        enemyInstanceId: s.villain,
        targetInstanceId: s.hero,
        baseAtk: 3,
        boostIcons: 1,
        defenseReduction: 2,
        damageDealt: 0,
        removesThreatFrom: s.state.mainScheme.instanceId,
        threatInstead: 2,
      },
    ]);
    expect(of(events, "damageDealt")).toEqual([]);
    expect(of(events, "damagePrevented")).toEqual([]);
    expect(of(events, "threatRemoved")).toEqual([
      expect.objectContaining({ schemeInstanceId: s.state.mainScheme.instanceId, amount: 2, sourceInstanceId: s.hero }),
    ]);
  });

  it("without a basic defense no DEF is subtracted: the '(defense)' label alone removes ATK + boost", () => {
    const s = setup({ inPlay: ["onAttack"] });
    const { session, events } = run(s, [use(s.attacker)]);
    expect(damageOf(session.state, s.hero)).toBe(0);
    expect(threatOf(session.state)).toBe(6);
    expect(triggers(events)).toContainEqual(
      expect.objectContaining({ kind: "defended", defenderInstanceId: s.hero, basic: false }),
    );
  });

  it("a '(thwart)' removal is a thwart by the identity: 'when you thwart' adds to it and 'after you thwart' answers it", () => {
    const s = setup({ inPlay: ["onAttack", "extraThreat", "afterThwart"] });
    const { session, events } = run(s, [use(s.attacker)]);
    expect(threatOf(session.state)).toBe(5);
    expect(triggers(events)).toContainEqual(
      expect.objectContaining({ kind: "thwart", thwarterInstanceId: s.hero, basic: false }),
    );
    expect(damageOf(session.state, s.villain)).toBe(2);
  });

  it("without `thwart` it is the card's own removal, not a thwart", () => {
    const s = setup({ inPlay: ["plain", "afterThwart"] });
    const { session, events } = run(s, [use(s.attacker)]);
    expect(threatOf(session.state)).toBe(6);
    expect(damageOf(session.state, s.hero)).toBe(0);
    expect(triggers(events).filter((e) => e.kind === "thwart")).toEqual([]);
    expect(damageOf(session.state, s.villain)).toBe(0);
  });

  it("the hero defended and took no damage, and was still attacked (retaliate)", () => {
    const s = setup({ inPlay: ["onDefense", "unflappable"], heroKeywords: [{ name: "retaliate", value: 1 }] });
    const { session, events } = run(s, [use(s.attacker)], defending(s.hero));
    expect(damageOf(session.state, s.hero)).toBe(0);
    // 1 from retaliate, 1 from "after your hero defends and takes no damage".
    expect(damageOf(session.state, s.villain)).toBe(2);
    expect(triggers(events)).toContainEqual(
      expect.objectContaining({ kind: "characterAttacked", attackerInstanceId: s.villain, targetInstanceId: s.hero }),
    );
  });

  it("no damage is dealt, so a tough status card stays, even against piercing, and overkill has no excess", () => {
    const s = setup({
      inPlay: ["onAttack"],
      status: "tough",
      villainKeywords: [{ name: "piercing" }, { name: "overkill" }],
    });
    const { session, events } = run(s, [use(s.attacker)]);
    expect(session.state.instances[s.hero]!.statuses.tough).toBe(1);
    expect(of(events, "damagePrevented")).toEqual([]);
    expect(threatOf(session.state)).toBe(6);
  });

  it("a crisis icon stops the removal (a player card's), and the damage is replaced all the same", () => {
    for (const card of ["onAttack", "plain"] as const) {
      const s = setup({ inPlay: [card], crisis: true });
      const { session, events } = run(s, [use(s.attacker)]);
      expect(threatOf(session.state)).toBe(10);
      expect(damageOf(session.state, s.hero)).toBe(0);
      expect(of(events, "threatRemovalBlocked")).toEqual([
        { type: "threatRemovalBlocked", schemeInstanceId: s.state.mainScheme.instanceId, reason: "crisis" },
      ]);
    }
  });

  it("an engaged patrol minion stops the thwart, not the plain removal (RRG 1.8 'Patrol', p. 32)", () => {
    const thwarting = setup({ inPlay: ["onAttack"], minion: PATROLLER });
    const blocked = run(thwarting, [use(thwarting.attacker)]);
    expect(threatOf(blocked.session.state)).toBe(10);
    expect(damageOf(blocked.session.state, thwarting.hero)).toBe(0);
    expect(of(blocked.events, "threatRemovalBlocked")).toEqual([
      { type: "threatRemovalBlocked", schemeInstanceId: thwarting.state.mainScheme.instanceId, reason: "patrol" },
    ]);

    const plain = setup({ inPlay: ["plain"], minion: PATROLLER });
    expect(threatOf(run(plain, [use(plain.attacker)]).session.state)).toBe(6);
  });

  it("a confused hero's '(defense/thwart)' ability is canceled whole: the confused card goes and the attack deals its damage", () => {
    const s = setup({ inPlay: ["onDefense"], status: "confused" });
    const { session, events } = run(s, [use(s.attacker)], defending(s.hero));
    expect(session.state.instances[s.hero]!.statuses.confused).toBe(0);
    expect(damageOf(session.state, s.hero)).toBe(2);
    expect(threatOf(session.state)).toBe(10);
    expect(of(events, "attackResolved")).toEqual([expect.objectContaining({ damageDealt: 2 })]);
  });

  it("wins over a redirect of the same attack's damage: there is no damage left to redirect", () => {
    const s = setup({ inPlay: ["misdirect", "plain"], minion: GOON });
    const { session } = run(s, [use(s.attacker)]);
    expect(damageOf(session.state, s.minion!)).toBe(0);
    expect(damageOf(session.state, s.hero)).toBe(0);
    expect(threatOf(session.state)).toBe(6);
  });

  it("a main scheme stage a boost ability completed hands the removal to the stage now in play", () => {
    const s = setup({ inPlay: ["onAttack"], twoStages: true, boost: ADVANCER });
    const first = s.state.mainScheme.instanceId;
    const { session, events } = run(s, [use(s.attacker)]);
    expect(session.state.mainScheme.stageIndex).toBe(1);
    const second = session.state.mainScheme.instanceId;
    // Stage 2 starts at 6; the attack's ATK 3 + 1 boost icon comes off it.
    expect(threatOf(session.state)).toBe(2);
    expect(of(events, "attackResolved")).toEqual([
      expect.objectContaining({ removesThreatFrom: second, threatInstead: 4, damageDealt: 0 }),
    ]);
    expect(of(events, "threatRemoved").map((e) => e.schemeInstanceId)).toEqual([second]);
    expect(damageOf(session.state, s.hero)).toBe(0);
    expect(second === first || !session.state.villainArea.includes(first)).toBe(true);
  });

  it("a scheme activation ignores it", () => {
    const s = setup({ inPlay: ["onScheme"] });
    const { session, events } = run(s, [use(s.attacker, SCHEME_ABILITY)]);
    // SCH 1 + 1 boost icon, placed.
    expect(threatOf(session.state)).toBe(12);
    expect(of(events, "threatRemoved")).toEqual([]);
  });

  it("replays deep-equal", () => {
    const s = setup({ inPlay: ["onDefense", "afterThwart"] });
    const { session } = run(s, [use(s.attacker), use(s.attacker)], defending(s.hero));
    expect(threatOf(session.state)).toBeLessThan(10);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
