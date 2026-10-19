/**
 * `EffectSpec enemyAttack.statBonusTiming: "afterInterrupts"`: an "X attacks you. If [condition], X gets +N ATK for this
 * attack" bonus is read when the attack's ATK is set, after the "when X activates / attacks" interrupts, not as the
 * effect that starts the activation resolves. The same for a scheme's SCH and for "X activates against you".
 *
 * Sources: an engine extension (authority tier 5) built on the order of FFG ruling #147, Feb 15 2024
 * (docs/rulings/post-rrg-1-5/09-2024-part-1.md: Weapon Master / Crossbones' Machine Gun). There, the attack is
 * initiated, the Machine Gun's interrupt to it resolves, then Weapon Master's second sentence (its surge check, which
 * does not depend on the attack) reads the board, then the attack resolves. A bonus "for this attack" is read at the
 * same point or later, so it sees what those interrupts changed. RRG 1.8 "Interrupt" (p. 25), "Activation" (p. 6).
 */

import { flat } from "@mc/content";
import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import type { EffectSpec, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCards, newGame, RESOURCE, runWith } from "./testing/scenario.js";

const p1 = playerId("p1");
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);
const theVillain = { kind: "villain" } as const;
const you = { kind: "controller" } as const;
const mark: EffectSpec = { kind: "dealDamage", target: theVillain, amount: { kind: "const", value: 1 } };
/** "+2 if the villain has any damage on it": the condition the interrupts below make true. */
const IF_MARKED: ValueSpec = {
  kind: "conditional",
  if: { kind: "compare", left: { kind: "damage", of: theVillain }, op: "atLeast", right: { kind: "const", value: 1 } },
  then: { kind: "const", value: 2 },
  else: { kind: "const", value: 0 },
};

/** "Forced Interrupt: When the villain activates, deal 1 damage to it." */
const ON_ACTIVATES = stubAbility("activates-mark.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyActivating", targetIs: { categories: ["villain"] } } },
  effects: [mark],
});
/** "Forced Interrupt: When the villain attacks you, deal 1 damage to it." */
const ON_ATTACKS = stubAbility("attacks-mark.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", playerIs: "controller" } },
  effects: [mark],
});

const action = (id: string, effect: EffectSpec) => stubAbility(id, { trigger: { kind: "action" }, effects: [effect] });
const LATE_ATK = action("late-atk.action", {
  kind: "enemyAttack",
  enemies: theVillain,
  against: you,
  atkBonus: IF_MARKED,
  statBonusTiming: "afterInterrupts",
});
const EAGER_ATK = action("eager-atk.action", {
  kind: "enemyAttack",
  enemies: theVillain,
  against: you,
  atkBonus: IF_MARKED,
});
const LATE_SCH = action("late-sch.action", {
  kind: "enemyScheme",
  enemies: theVillain,
  against: you,
  schBonus: IF_MARKED,
  statBonusTiming: "afterInterrupts",
});
const EAGER_SCH = action("eager-sch.action", {
  kind: "enemyScheme",
  enemies: theVillain,
  against: you,
  schBonus: IF_MARKED,
});
const LATE_ACTIVATES = action("late-activates.action", {
  kind: "enemyActivation",
  enemies: theVillain,
  against: you,
  atkBonus: IF_MARKED,
  schBonus: IF_MARKED,
  statBonusTiming: "afterInterrupts",
});

/** "+2 if your identity has any damage on it": the first resolution of a shared attack makes it true. */
const IF_YOU_HURT: ValueSpec = {
  kind: "conditional",
  if: {
    kind: "compare",
    left: { kind: "damage", of: { kind: "identityOf", player: you } },
    op: "atLeast",
    right: { kind: "const", value: 1 },
  },
  then: { kind: "const", value: 2 },
  else: { kind: "const", value: 0 },
};
/** The same attack resolved against each player (`additionalResolution`, Klaw's shape) with a late bonus. */
const SHARED_ATK = action("shared-atk.action", {
  kind: "enemyAttack",
  enemies: theVillain,
  against: { kind: "each" },
  additionalResolution: true,
  atkBonus: IF_YOU_HURT,
  statBonusTiming: "afterInterrupts",
});
/** Separate attacks on each player: each reads its own bonus. */
const EACH_ATK = action("each-atk.action", {
  kind: "enemyAttack",
  enemies: theVillain,
  against: { kind: "each" },
  atkBonus: IF_YOU_HURT,
  statBonusTiming: "afterInterrupts",
});

const ALL = [
  ON_ACTIVATES,
  ON_ATTACKS,
  LATE_ATK,
  EAGER_ATK,
  LATE_SCH,
  EAGER_SCH,
  LATE_ACTIVATES,
  SHARED_ATK,
  EACH_ATK,
] as const;
const SUPPORT = new Map(
  ALL.map((a) => [a, stubSupport({ id: a.ref.id.split(".")[0]!, cost: 0, abilities: [a.ref] })] as const),
);
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const deps: EngineDeps = depsOf(...ALL);

interface Setup {
  readonly state: GameState;
  readonly inPlay: ReadonlyMap<StubAbility, InstanceId>;
}

/** Villain ATK 1, SCH 1, boost cards with no icons; `abilities`' supports in play, the hero in hero form unless not. */
function setup(form: "hero" | "alterEgo", ...abilities: readonly StubAbility[]): Setup {
  return setupFor(1, form, ...abilities);
}

function setupFor(players: number, form: "hero" | "alterEgo", ...abilities: readonly StubAbility[]): Setup {
  const supports = abilities.map((a) => SUPPORT.get(a as (typeof ALL)[number])!);
  const state = newGame({
    players,
    villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 1, sch: 1 }] }),
    mainScheme: stubMainScheme({
      id: "main",
      stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
    }),
    extraCards: [BLANK, ...SUPPORT.values()],
    deck: [...supports.map((s) => s.id), ...copies(RESOURCE.id, 20)],
    encounterDeck: copies(BLANK.id, 20),
    deps,
  });
  const given = giveCards(state, p1, ...supports.map((s) => s.id));
  const ids = given.ids as readonly InstanceId[];
  const ready = runWith(
    deps,
    given.state,
    ...(form === "hero" ? [{ type: "changeForm", playerId: p1 } as Command] : []),
    ...ids.map((id): Command => ({
      type: "playCard",
      playerId: p1,
      cardInstanceId: id,
      payment: [],
      attachToInstanceId: null,
    })),
  );
  return { state: ready, inPlay: new Map(abilities.map((a, index) => [a, ids[index]!] as const)) };
}

function use(s: Setup, ability: StubAbility) {
  const command: Command = {
    type: "useAbility",
    playerId: p1,
    cardInstanceId: s.inPlay.get(ability)!,
    abilityId: ability.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
    payment: [],
  };
  const { session, events } = driveSession(startSession(s.state), deps, [command], defaultPick);
  return { events, session };
}

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

describe('an activation bonus read after the activation\'s interrupts (`statBonusTiming: "afterInterrupts"`)', () => {
  it("an attack: a 'when the villain activates' interrupt makes the condition true, and the bonus follows it", () => {
    const { events, session } = use(setup("hero", LATE_ATK, ON_ACTIVATES), LATE_ATK);
    expect(of(events, "attackResolved")).toMatchObject([{ baseAtk: 3 }]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("an attack: a 'when the villain attacks you' interrupt (on the attack itself) counts as well", () => {
    const { events } = use(setup("hero", LATE_ATK, ON_ATTACKS), LATE_ATK);
    expect(of(events, "attackResolved")).toMatchObject([{ baseAtk: 3 }]);
  });

  it("with no interrupt the condition is false when the ATK is set: no bonus (control)", () => {
    const { events } = use(setup("hero", LATE_ATK), LATE_ATK);
    expect(of(events, "attackResolved")).toMatchObject([{ baseAtk: 1 }]);
  });

  it("the eager form is unchanged: read as the effect resolves, before the interrupt made it true", () => {
    const { events } = use(setup("hero", EAGER_ATK, ON_ACTIVATES), EAGER_ATK);
    expect(of(events, "attackResolved")).toMatchObject([{ baseAtk: 1 }]);
  });

  it("a scheme: the SCH bonus follows the interrupt the same way; the eager one does not", () => {
    expect(of(use(setup("hero", LATE_SCH, ON_ACTIVATES), LATE_SCH).events, "schemeResolved")).toMatchObject([
      { baseSch: 3 },
    ]);
    expect(of(use(setup("hero", EAGER_SCH, ON_ACTIVATES), EAGER_SCH).events, "schemeResolved")).toMatchObject([
      { baseSch: 1 },
    ]);
  });

  it("'activates against you': an attack in hero form reads atkBonus late, a scheme in alter-ego form schBonus", () => {
    const hero = use(setup("hero", LATE_ACTIVATES, ON_ACTIVATES), LATE_ACTIVATES).events;
    expect(of(hero, "attackResolved")).toMatchObject([{ baseAtk: 3 }]);
    expect(of(hero, "schemeResolved")).toHaveLength(0);
    const alterEgo = use(setup("alterEgo", LATE_ACTIVATES, ON_ACTIVATES), LATE_ACTIVATES).events;
    expect(of(alterEgo, "schemeResolved")).toMatchObject([{ baseSch: 3 }]);
    expect(of(alterEgo, "attackResolved")).toHaveLength(0);
  });

  it("the same attack resolved against two players reads the bonus once, at its first resolution", () => {
    // The first resolution hurts player one's identity (undefended); the second still uses the first reading.
    const { events } = use(setupFor(2, "hero", SHARED_ATK), SHARED_ATK);
    expect(of(events, "attackResolved")).toMatchObject([{ baseAtk: 1 }, { baseAtk: 1 }]);
  });

  it("separate attacks on two players each read their own bonus, after their own interrupts (control)", () => {
    const { events } = use(setupFor(2, "hero", EACH_ATK), EACH_ATK);
    expect(of(events, "attackResolved")).toMatchObject([{ baseAtk: 1 }, { baseAtk: 3 }]);
  });
});
