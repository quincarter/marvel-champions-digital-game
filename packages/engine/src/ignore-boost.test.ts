/**
 * docs/phase7-wave7.md §3.67: an attack whose boost icons and "Boost" abilities are ignored. `RuleSpec ignoreBoost`,
 * applied until the end of the attack by an interrupt to it ("When an enemy attacks, ignore each boost icon and each
 * 'Boost' ability for this attack"). RRG 1.8 "Ignore" (p. 23): the ignored icon or ability is treated "as not being in
 * effect or present". Each boost card is still turned faceup and discarded ("Attack (Enemy Activation)" step 3, p. 8;
 * "Boost, Boost Icon", p. 11), adds 0 and resolves no "Boost" ability. Nothing is canceled ("Cancel", p. 11), so a
 * cancel effect finds nothing to cancel. An icon an amplify icon would add ("Amplify Icon", p. 7) is a boost icon too.
 * The interrupt resolves before step 1 gives the boost card, so the rule covers every boost card of that attack, and
 * it ends with the attack. Distinct from `modifyAttack.noBoost` (`no-boost-activation.test.ts`), which deals no card.
 *
 * Synthetic cards throughout. Villain ATK 2, SCH 1; every attack is undefended unless a test says otherwise.
 */

import { flat, type CardId, type SideSchemeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { defaultPick, giveCards, newGame, RESOURCE, runWith } from "./testing/scenario.js";
import { encounterCardInVillainArea, minionEngagedWith, onTopOfEncounterDeck } from "./testing/wave3.js";
import { auditVillainPhases } from "./villain/audit.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);
const theVillain = { kind: "named", name: "villain" } as const;
const you = { kind: "controller" } as const;
const mainScheme = { kind: "mainScheme" } as const;

const IGNORE: RuleSpec = { kind: "ignoreBoost" };
const ignoreForThisAttack: EffectSpec = { kind: "applyRuleUntil", rule: IGNORE, until: "endOfAttack" };

/** "Hero Interrupt: When an enemy attacks, ignore each boost icon and each 'Boost' ability for this attack." */
const AGILE_ABILITY = stubAbility(
  "agile.interrupt",
  def({ trigger: { kind: "interrupt", forced: false, on: { on: "enemyAttack" } }, effects: [ignoreForThisAttack] }),
);
/** The same sentence on a "(defense)" ability. */
const GUARD_ABILITY = stubAbility(
  "guard.interrupt",
  def({
    trigger: { kind: "interrupt", forced: false, on: { on: "enemyAttack" } },
    label: ["defense"],
    effects: [ignoreForThisAttack],
  }),
);
const AGILE = stubEvent({ id: "agile", cost: 0, abilities: [AGILE_ABILITY.ref] });
const GUARD = stubEvent({ id: "guard", cost: 0, abilities: [GUARD_ABILITY.ref] });

const action = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(id, def({ trigger: { kind: "action" }, effects }));
/** "The villain attacks you." */
const ATTACK_ABILITY = action("attack.action", [{ kind: "enemyAttack", enemies: theVillain, against: you }]);
/** "The villain attacks you. Give the villain 1 additional boost card for that activation." */
const BIG_ATTACK_ABILITY = action("big-attack.action", [
  { kind: "enemyAttack", enemies: theVillain, against: you, extraBoostCards: 1 },
]);
/** "The villain schemes against you." */
const SCHEME_ABILITY = action("scheme.action", [{ kind: "enemyScheme", enemies: theVillain, against: you }]);
/** "Give the villain 1 facedown boost card": dealt outside any activation. */
const GIVE_ABILITY = action("give.action", [{ kind: "giveBoostCard", enemy: theVillain }]);
/** "The goon attacks you." */
const GOON_ATTACK_ABILITY = action("goon-attack.action", [
  { kind: "enemyAttack", enemies: { kind: "named", name: "goon" }, against: you },
]);

/** "When a boost card is turned faceup, cancel its boost icons. If any were canceled this way, draw 1 card." */
const CANCEL_ICONS_ABILITY = stubAbility(
  "cancel-icons.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "boostCardTurnedFaceup" } },
    effects: [
      { kind: "cancelBoostIcons", bind: "icons" },
      {
        kind: "if",
        condition: { kind: "varAtLeast", name: "icons.made", amount: 1 },
        then: [{ kind: "draw", player: you, amount: { kind: "const", value: 1 } }],
      },
    ],
  }),
);
/** The same for the "Boost" ability. */
const CANCEL_ABILITY_ABILITY = stubAbility(
  "cancel-ability.response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "boostCardTurnedFaceup" } },
    effects: [
      { kind: "cancelBoostAbility", bind: "ability" },
      {
        kind: "if",
        condition: { kind: "varAtLeast", name: "ability.made", amount: 1 },
        then: [{ kind: "draw", player: you, amount: { kind: "const", value: 1 } }],
      },
    ],
  }),
);
/** "When a boost card is turned faceup during an attack, the villain schemes against you": an activation inside another. */
const NEST_ABILITY = stubAbility(
  "nest.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "boostCardTurnedFaceup", activation: "attack" } },
    effects: [{ kind: "enemyScheme", enemies: theVillain, against: you }],
  }),
);
/** A standing rule: every enemy's boost icons and "Boost" abilities are ignored. */
const CALM_ABILITY = stubAbility("calm.constant", def({ trigger: { kind: "constant", rules: [IGNORE] }, effects: [] }));
/** The same for minions only. */
const MINIONS_ONLY_ABILITY = stubAbility(
  "minions-only.constant",
  def({
    trigger: { kind: "constant", rules: [{ kind: "ignoreBoost", enemy: { categories: ["minion"] } }] },
    effects: [],
  }),
);

const boost = (id: string, uncancellable = false) =>
  stubAbility(
    `${id}.boost`,
    def({
      trigger: { kind: "boost" },
      ...(uncancellable ? { uncancellable: true as const } : {}),
      effects: [{ kind: "placeThreat", target: mainScheme, amount: { kind: "const", value: 3 } }],
    }),
  );
/** "[star] Boost: Place 3 threat on the main scheme." */
const STAR_BOOST = boost("star");
/** The same, "This effect cannot be canceled." */
const FIXED_BOOST = boost("fixed", true);

const TWO = stubTreachery({ id: "two", boostIcons: 2 });
const STAR = stubTreachery({ id: "star", boostIcons: 1, abilities: [STAR_BOOST.ref] });
const FIXED = stubTreachery({ id: "fixed", boostIcons: 1, abilities: [FIXED_BOOST.ref] });
const GOON = stubMinion({ id: "goon", atk: 1, sch: 1, hp: 9, boostIcons: 0, keywords: [{ name: "villainous" }] });
/** A side scheme with no text and one amplify icon. */
const VENDETTA: SideSchemeCard = { ...stubSideScheme({ id: "vendetta", startingThreat: 2 }), amplifyIcons: 1 };

const support = (id: string, ability: StubAbility) => stubSupport({ id, cost: 0, abilities: [ability.ref] });
const ATTACK = support("attack", ATTACK_ABILITY);
const BIG_ATTACK = support("big-attack", BIG_ATTACK_ABILITY);
const SCHEME = support("scheme", SCHEME_ABILITY);
const GIVE = support("give", GIVE_ABILITY);
const GOON_ATTACK = support("goon-attack", GOON_ATTACK_ABILITY);
const CANCEL_ICONS = support("cancel-icons", CANCEL_ICONS_ABILITY);
const CANCEL_ABILITY = support("cancel-ability", CANCEL_ABILITY_ABILITY);
const NEST = support("nest", NEST_ABILITY);
const CALM = support("calm", CALM_ABILITY);
const MINIONS_ONLY = support("minions-only", MINIONS_ONLY_ABILITY);
const SUPPORTS = [
  ATTACK,
  BIG_ATTACK,
  SCHEME,
  GIVE,
  GOON_ATTACK,
  CANCEL_ICONS,
  CANCEL_ABILITY,
  NEST,
  CALM,
  MINIONS_ONLY,
];

const deps: EngineDeps = depsOf(
  AGILE_ABILITY,
  GUARD_ABILITY,
  ATTACK_ABILITY,
  BIG_ATTACK_ABILITY,
  SCHEME_ABILITY,
  GIVE_ABILITY,
  GOON_ATTACK_ABILITY,
  CANCEL_ICONS_ABILITY,
  CANCEL_ABILITY_ABILITY,
  NEST_ABILITY,
  CALM_ABILITY,
  MINIONS_ONLY_ABILITY,
  STAR_BOOST,
  FIXED_BOOST,
);

const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const use = (id: InstanceId, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: id,
  abilityId: ability.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});

interface Setup {
  readonly state: GameState;
  /** The supports in play, by card id. */
  readonly cards: Readonly<Record<string, InstanceId>>;
  /** The interrupt event in hand. */
  readonly event: InstanceId;
  readonly villain: InstanceId;
  readonly hero: InstanceId;
  readonly scheme: InstanceId;
}

interface Options {
  /** Encounter cards put on top of the encounter deck, first one on top; the rest of the deck is 2-icon cards. */
  readonly top?: readonly CardId[];
  /** The interrupt event in hand (default: the unlabeled one). */
  readonly event?: typeof AGILE;
  readonly alterEgo?: boolean;
}

/** `inPlay` supports in play, one interrupt event in hand, hero form unless `alterEgo`. */
function setup(inPlay: readonly (typeof ATTACK)[], options: Options = {}): Setup {
  const event = options.event ?? AGILE;
  const top = options.top ?? [];
  const state = newGame({
    villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 2, sch: 1 }] }),
    mainScheme: stubMainScheme({
      id: "main",
      stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
    }),
    extraCards: [TWO, STAR, FIXED, GOON, VENDETTA, AGILE, GUARD, ...SUPPORTS],
    deck: [...inPlay.map((c) => c.id), event.id, ...copies(RESOURCE.id, 20)],
    encounterDeck: [GOON.id, VENDETTA.id, STAR.id, FIXED.id, ...copies(TWO.id, 20)],
    deps,
  });
  const given = giveCards(state, p1, ...inPlay.map((c) => c.id), event.id);
  const ids = given.ids as readonly InstanceId[];
  const supports = ids.slice(0, inPlay.length);
  const ready = runWith(
    deps,
    given.state,
    ...(options.alterEgo ? [] : [{ type: "changeForm", playerId: p1 } as Command]),
    ...supports.map(play),
  );
  // The named cards on top in order, every other non-TWO card sunk to the bottom so a test only meets what it names.
  const deck = activeEncounterDeck(ready).deck;
  const isTwo = (id: InstanceId) => ready.instances[id]?.cardId === TWO.id;
  const sunk: GameState = {
    ...ready,
    encounterDecks: Object.fromEntries(
      Object.entries(ready.encounterDecks).map(([id, piles]) => [
        id,
        piles.deck === deck ? { ...piles, deck: [...deck.filter(isTwo), ...deck.filter((i) => !isTwo(i))] } : piles,
      ]),
    ),
  };
  const stacked = [...top].reverse().reduce((s, card) => onTopOfEncounterDeck(s, card), sunk);
  return {
    state: stacked,
    cards: Object.fromEntries(inPlay.map((c, i) => [c.id, supports[i]!])),
    event: ids[inPlay.length]!,
    villain: Object.values(stacked.instances).find((i) => i.cardId === "villain")!.instanceId,
    hero: mustPlayer(stacked, p1).identity.instanceId,
    scheme: stacked.mainScheme.instanceId,
  };
}

/** Answers every choice by default, except that the interrupt event is played when it is offered (if `answering`). */
const picker =
  (event: InstanceId | null) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (event && choice?.prompt.kind === "chooseTriggers") {
      const option = choice.options.find((o) => o.ref.kind === "ability" && o.ref.instanceId === event);
      if (option) return [option.optionId];
    }
    return defaultPick(state);
  };

function run(s: Setup, commands: readonly Command[], answering = true) {
  return driveSession(startSession(s.state), deps, commands, picker(answering ? s.event : null));
}

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const damageOn = (state: GameState, id: InstanceId) => state.instances[id]!.damage;
const threatOn = (state: GameState, id: InstanceId) => state.instances[id]!.threat;
const handSize = (state: GameState) => mustPlayer(state, p1).hand.length;
const ignoreRules = (state: GameState) =>
  state.lastingEffects.filter((e) => e.kind === "ruleGrant" && e.rule.kind === "ignoreBoost");

describe("ignoreBoost — 'ignore each boost icon and each Boost ability for this attack'", () => {
  it("control: a 2-icon boost card adds 2, so the attack deals ATK 2 + 2 = 4", () => {
    const s = setup([ATTACK]);
    const { session, events } = run(s, [use(s.cards.attack!, ATTACK_ABILITY)], false);
    expect(of(events, "boostCardFlipped").map((e) => e.boostIcons)).toEqual([2]);
    expect(of(events, "boostIgnored")).toEqual([]);
    expect(damageOn(session.state, s.hero)).toBe(4);
  });

  it("ignored: the card is turned faceup and discarded, adds 0, and the attack deals ATK 2 alone", () => {
    const s = setup([ATTACK]);
    const before = activeEncounterDeck(s.state);
    const { session, events } = run(s, [use(s.cards.attack!, ATTACK_ABILITY)]);
    const [dealt] = of(events, "boostCardDealt");
    expect(dealt).toBeDefined();
    const card = dealt!.instanceId;
    expect(of(events, "boostCardFlipped")).toEqual([
      { type: "boostCardFlipped", enemyInstanceId: s.villain, instanceId: card, boostIcons: 0 },
    ]);
    expect(of(events, "boostIgnored")).toEqual([
      { type: "boostIgnored", enemyInstanceId: s.villain, instanceId: card },
    ]);
    // Ignored, not canceled, and not withheld.
    expect(of(events, "boostCancelled")).toEqual([]);
    expect(of(events, "boostWithheld")).toEqual([]);
    expect(damageOn(session.state, s.hero)).toBe(2);
    const after = activeEncounterDeck(session.state);
    expect(after.deck).toHaveLength(before.deck.length - 1);
    expect(after.discard).toEqual([card, ...before.discard]);
    expect(session.state.instances[s.villain]!.boostCards).toEqual([]);
    expect(session.state.instances[card]!.faceup).toBe(true);
  });

  it("a star 'Boost' ability does not resolve; without the rule it does", () => {
    const control = setup([ATTACK], { top: [STAR.id] });
    const plain = run(control, [use(control.cards.attack!, ATTACK_ABILITY)], false);
    expect(threatOn(plain.session.state, control.scheme)).toBe(3);
    expect(damageOn(plain.session.state, control.hero)).toBe(3);

    const s = setup([ATTACK], { top: [STAR.id] });
    const { session, events } = run(s, [use(s.cards.attack!, ATTACK_ABILITY)]);
    expect(threatOn(session.state, s.scheme)).toBe(0);
    expect(damageOn(session.state, s.hero)).toBe(2);
    expect(of(events, "boostIgnored")).toHaveLength(1);
    expect(of(events, "boostCancelled")).toEqual([]);
    const [star] = of(events, "boostCardFlipped");
    expect(session.state.instances[star!.instanceId]!.cardId).toBe(STAR.id);
    expect(activeEncounterDeck(session.state).discard).toContain(star!.instanceId);
  });

  it("a 'Boost' ability that cannot be canceled is ignored all the same", () => {
    const s = setup([ATTACK], { top: [FIXED.id] });
    const { session, events } = run(s, [use(s.cards.attack!, ATTACK_ABILITY)]);
    expect(threatOn(session.state, s.scheme)).toBe(0);
    expect(damageOn(session.state, s.hero)).toBe(2);
    expect(of(events, "boostIgnored")).toHaveLength(1);
  });

  it("an additional boost card and one waiting facedown from earlier are ignored too", () => {
    const control = setup([GIVE, BIG_ATTACK], { top: [TWO.id, STAR.id, TWO.id] });
    const plain = run(
      control,
      [use(control.cards.give!, GIVE_ABILITY), use(control.cards["big-attack"]!, BIG_ATTACK_ABILITY)],
      false,
    );
    // 2 + (2 + 1 + 2) boost icons, and the star's 3 threat.
    expect(damageOn(plain.session.state, control.hero)).toBe(7);
    expect(threatOn(plain.session.state, control.scheme)).toBe(3);

    const s = setup([GIVE, BIG_ATTACK], { top: [TWO.id, STAR.id, TWO.id] });
    const given = run(s, [use(s.cards.give!, GIVE_ABILITY)]);
    const [held] = given.session.state.instances[s.villain]!.boostCards;
    expect(held).toBeDefined();
    const { session, events } = run({ ...s, state: given.session.state }, [
      use(s.cards["big-attack"]!, BIG_ATTACK_ABILITY),
    ]);
    const flipped = of(events, "boostCardFlipped");
    expect(flipped.map((e) => e.boostIcons)).toEqual([0, 0, 0]);
    expect(flipped[0]!.instanceId).toBe(held);
    expect(of(events, "boostIgnored").map((e) => e.instanceId)).toEqual(flipped.map((e) => e.instanceId));
    expect(damageOn(session.state, s.hero)).toBe(2);
    expect(threatOn(session.state, s.scheme)).toBe(0);
    expect(session.state.instances[s.villain]!.boostCards).toEqual([]);
    const discard = activeEncounterDeck(session.state).discard;
    for (const { instanceId } of flipped) expect(discard).toContain(instanceId);
  });

  it("an amplify icon in play adds nothing to an ignored card; without the rule it adds 1", () => {
    const amplified = (s: Setup): Setup => ({ ...s, state: encounterCardInVillainArea(s.state, VENDETTA.id, 2).state });
    const control = amplified(setup([ATTACK]));
    const plain = run(control, [use(control.cards.attack!, ATTACK_ABILITY)], false);
    expect(of(plain.events, "boostCardFlipped").map((e) => e.boostIcons)).toEqual([3]);
    expect(damageOn(plain.session.state, control.hero)).toBe(5);

    const s = amplified(setup([ATTACK]));
    const { session, events } = run(s, [use(s.cards.attack!, ATTACK_ABILITY)]);
    expect(of(events, "boostCardFlipped").map((e) => e.boostIcons)).toEqual([0]);
    expect(damageOn(session.state, s.hero)).toBe(2);
  });

  it("a 'cancel the boost icons' effect finds nothing to cancel, so what depends on the cancel does not happen", () => {
    const control = setup([ATTACK, CANCEL_ICONS]);
    const hand = handSize(control.state);
    const plain = run(control, [use(control.cards.attack!, ATTACK_ABILITY)], false);
    expect(of(plain.events, "boostCancelled").map((e) => e.scope)).toEqual(["icons"]);
    expect(handSize(plain.session.state)).toBe(hand + 1);
    expect(damageOn(plain.session.state, control.hero)).toBe(2);

    const s = setup([ATTACK, CANCEL_ICONS]);
    const { session, events } = run(s, [use(s.cards.attack!, ATTACK_ABILITY)]);
    expect(of(events, "boostCancelled")).toEqual([]);
    expect(of(events, "boostIgnored")).toHaveLength(1);
    // The event left the hand and nothing was drawn.
    expect(handSize(session.state)).toBe(hand - 1);
    expect(damageOn(session.state, s.hero)).toBe(2);
  });

  it("a 'cancel the Boost ability' effect finds nothing to cancel either", () => {
    const control = setup([ATTACK, CANCEL_ABILITY], { top: [STAR.id] });
    const hand = handSize(control.state);
    const plain = run(control, [use(control.cards.attack!, ATTACK_ABILITY)], false);
    expect(of(plain.events, "boostCancelled").map((e) => e.scope)).toEqual(["ability"]);
    expect(handSize(plain.session.state)).toBe(hand + 1);
    expect(threatOn(plain.session.state, control.scheme)).toBe(0);

    const s = setup([ATTACK, CANCEL_ABILITY], { top: [STAR.id] });
    const { session, events } = run(s, [use(s.cards.attack!, ATTACK_ABILITY)]);
    expect(of(events, "boostCancelled")).toEqual([]);
    expect(handSize(session.state)).toBe(hand - 1);
    expect(threatOn(session.state, s.scheme)).toBe(0);
    expect(damageOn(session.state, s.hero)).toBe(2);
  });

  it("ends with the attack: the next attack turns its boost card up as normal", () => {
    const s = setup([ATTACK]);
    const first = run(s, [use(s.cards.attack!, ATTACK_ABILITY)]);
    expect(damageOn(first.session.state, s.hero)).toBe(2);
    expect(ignoreRules(first.session.state)).toEqual([]);
    const next = run({ ...s, state: first.session.state }, [use(s.cards.attack!, ATTACK_ABILITY)]);
    expect(of(next.events, "boostCardFlipped").map((e) => e.boostIcons)).toEqual([2]);
    expect(of(next.events, "boostIgnored")).toEqual([]);
    expect(damageOn(next.session.state, s.hero)).toBe(2 + 4);
  });

  it("covers that attack only: an activation that begins while it resolves counts its own boost card", () => {
    const s = setup([ATTACK, NEST]);
    const { session, events } = run(s, [use(s.cards.attack!, ATTACK_ABILITY)]);
    // The attack's card is ignored; the scheme begun in its window adds its 2 icons to SCH 1.
    expect(of(events, "boostCardFlipped").map((e) => e.boostIcons)).toEqual([0, 2]);
    expect(of(events, "boostIgnored")).toHaveLength(1);
    expect(threatOn(session.state, s.scheme)).toBe(3);
    expect(damageOn(session.state, s.hero)).toBe(2);
  });

  it("a villainous minion's attack: its boost card is ignored as the villain's is", () => {
    const engaged = (s: Setup) => {
      const minion = minionEngagedWith(s.state, GOON.id);
      return { s: { ...s, state: minion.state }, minion: minion.id };
    };
    const control = engaged(setup([GOON_ATTACK]));
    const plain = run(control.s, [use(control.s.cards["goon-attack"]!, GOON_ATTACK_ABILITY)], false);
    expect(damageOn(plain.session.state, control.s.hero)).toBe(1 + 2);

    const { s, minion } = engaged(setup([GOON_ATTACK]));
    const { session, events } = run(s, [use(s.cards["goon-attack"]!, GOON_ATTACK_ABILITY)]);
    const [dealt] = of(events, "boostCardDealt");
    expect(dealt!.enemyInstanceId).toBe(minion);
    expect(of(events, "boostIgnored")).toEqual([
      { type: "boostIgnored", enemyInstanceId: minion, instanceId: dealt!.instanceId },
    ]);
    expect(damageOn(session.state, s.hero)).toBe(1);
    expect(activeEncounterDeck(session.state).discard).toContain(dealt!.instanceId);
  });

  it("on a '(defense)' ability the hero becomes the defender, and the boost card is still ignored", () => {
    const s = setup([ATTACK], { event: GUARD });
    const { session, events } = run(s, [use(s.cards.attack!, ATTACK_ABILITY)]);
    expect(of(events, "boostIgnored")).toHaveLength(1);
    // The label made the hero the defender as the attack was initiated. Not a basic defense, so DEF is not
    // subtracted (RRG 1.8 "Defend, Defense", p. 15).
    const defended = of(events, "triggerEvent").filter((e) => e.phase === "initiated" && e.event.kind === "defended");
    expect(defended.map((e) => e.event)).toEqual([
      { kind: "defended", defenderInstanceId: s.hero, enemyInstanceId: s.villain, playerId: p1, basic: false },
    ]);
    expect(damageOn(session.state, s.hero)).toBe(2);
  });

  it("as a constant rule it covers every activation, a scheme included", () => {
    const s = setup([ATTACK, SCHEME, CALM], { top: [TWO.id, STAR.id] });
    const { session, events } = run(
      s,
      [use(s.cards.attack!, ATTACK_ABILITY), use(s.cards.scheme!, SCHEME_ABILITY)],
      false,
    );
    expect(of(events, "boostCardFlipped").map((e) => e.boostIcons)).toEqual([0, 0]);
    expect(of(events, "boostIgnored")).toHaveLength(2);
    expect(damageOn(session.state, s.hero)).toBe(2);
    expect(threatOn(session.state, s.scheme)).toBe(1);
  });

  it("a constant rule naming other enemies leaves the villain's boost card alone", () => {
    const s = setup([ATTACK, MINIONS_ONLY]);
    const { session, events } = run(s, [use(s.cards.attack!, ATTACK_ABILITY)], false);
    expect(of(events, "boostIgnored")).toEqual([]);
    expect(damageOn(session.state, s.hero)).toBe(4);
  });

  it("the villain phase: the attack's boost card is dealt, turned faceup and ignored, and the audit is clean", () => {
    const s = setup([]);
    const { session, events } = run(s, [{ type: "endTurn", playerId: p1 }]);
    const dealt = of(events, "boostCardDealt").filter((e) => e.enemyInstanceId === s.villain);
    expect(dealt).toHaveLength(1);
    expect(of(events, "boostIgnored")).toEqual([
      { type: "boostIgnored", enemyInstanceId: s.villain, instanceId: dealt[0]!.instanceId },
    ]);
    expect(damageOn(session.state, s.hero)).toBe(2);
    expect(auditVillainPhases(session.log, deps).violations).toEqual([]);
  });

  it("replays deep-equal", () => {
    const s = setup([GIVE, BIG_ATTACK, ATTACK, CANCEL_ICONS], { top: [TWO.id, STAR.id, TWO.id] });
    const { session } = run(s, [
      use(s.cards.give!, GIVE_ABILITY),
      use(s.cards["big-attack"]!, BIG_ATTACK_ABILITY),
      use(s.cards.attack!, ATTACK_ABILITY),
    ]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
