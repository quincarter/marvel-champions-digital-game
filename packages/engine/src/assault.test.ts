/**
 * docs/phase7-wave7.md §3.3 and §4.1 Q3: the assault keyword.
 *
 * RRG 1.8 "Assault" (p. 8): "When a character makes a basic thwart against a scheme with the assault keyword, that
 * character uses its ATK instead of its THW.
 * - The assault keyword is equivalent to the following constant ability: 'While a character is making a basic thwart
 *   against this scheme, that character uses its ATK instead of its THW.'
 * - If the thwarting character is an ally, it takes the consequential damage listed under its ATK instead of its THW
 *   after the thwart.
 * - Abilities that increase a character's 'basic power' can be used to increase that character's ATK when that
 *   character thwarts a scheme with assault."
 *
 * §4.1 Q3 (owner decision): a divided basic thwart is one basic thwart, so one that includes any scheme with assault
 * uses ATK for the whole thwart (its shares total ATK), and an ally making it takes its ATK consequential damage.
 *
 * Synthetic cards. The hero has ATK 3, THW 2. The sidekick ally has ATK 4 with 2 consequential damage under it and
 * THW 2 with 1 under it; the careful ally has 0 under its ATK and 3 under its THW. Every scheme starts at 9 threat
 * (the main scheme at 10): an encounter side scheme and a player side scheme with assault, and one of each without.
 */

import { flat, type AnyCard, type KeywordInstance, type PlayerSideSchemeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession, type GameSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { characterProfile, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubVillain,
} from "./testing/fixtures.js";
import { defaultPick, giveCard, HERO, runWith } from "./testing/scenario.js";
import {
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const n = (value: number) => ({ kind: "const", value }) as const;
const theVillain = { kind: "named", name: "villain" } as const;
const yourIdentity = { categories: ["identity"], controller: "you" } as const;
const yourAllies = { categories: ["ally"], controller: "you" } as const;
const eachAlly = { kind: "each", query: { categories: ["ally"] } } as const;
const ASSAULT: readonly KeywordInstance[] = [{ name: "assault" }];

/** Replaces the default identity card of the same id (the card pool is keyed by id). */
const BRAWLER = stubIdentity({
  id: HERO.id,
  hp: 10,
  atk: 3,
  thw: 2,
  def: 2,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
});
const SIDEKICK = stubAlly({
  id: "sidekick",
  cost: 0,
  atk: 4,
  thw: 2,
  hp: 9,
  consequentialAttack: 2,
  consequentialThwart: 1,
});
/** Nothing printed under its ATK, 3 under its THW. */
const CAREFUL = stubAlly({
  id: "careful",
  cost: 0,
  atk: 2,
  thw: 1,
  hp: 9,
  consequentialAttack: 0,
  consequentialThwart: 3,
});

const FRONT = stubSideScheme({ id: "front", startingThreat: 9, keywords: ASSAULT });
const BACK = stubSideScheme({ id: "back", startingThreat: 9 });
const ALARM = stubSideScheme({ id: "alarm", startingThreat: 9, icons: ["crisis"] });
const playerSideScheme = (id: string, keywords: readonly KeywordInstance[]): PlayerSideSchemeCard => ({
  ...stubSupport({ id, cost: 0 }),
  type: "player_side_scheme",
  startingThreat: flat(9),
  keywords,
});
const RAID = playerSideScheme("raid", ASSAULT);
const ERRAND = playerSideScheme("errand", []);

const PATROLLER = stubMinion({ id: "patroller", atk: 1, sch: 1, hp: 10, keywords: [{ name: "patrol" }] });
const BODYGUARD = stubMinion({ id: "bodyguard", atk: 1, sch: 1, hp: 10, keywords: [{ name: "guard" }] });

const constant = (id: string, trigger: Omit<Extract<AbilityDefinition["trigger"], { kind: "constant" }>, "kind">) =>
  stubAbility(id, def({ trigger: { kind: "constant", ...trigger }, effects: [] }));
/** "Your identity gets +2 THW." / "Your identity gets +1 ATK." */
const THW_UP = constant("thw-up.constant", { modifiers: [{ stat: "thw", amount: 2, target: yourIdentity }] });
const ATK_UP = constant("atk-up.constant", { modifiers: [{ stat: "atk", amount: 1, target: yourIdentity }] });
/** "Each ally you control takes +1 consequential damage after it thwarts." / "… after it attacks." */
const WEARY = constant("weary.constant", {
  modifiers: [{ stat: "consequentialThwart", amount: 1, target: yourAllies }],
});
const ENRAGED = constant("enraged.constant", {
  modifiers: [{ stat: "consequentialAttack", amount: 4, target: yourAllies }],
});
/** "Each ally you control takes 1 less consequential damage from thwarting." / "… from attacking." */
const CUSHION = constant("cushion.constant", {
  rules: [{ kind: "reduceDamageTaken", target: yourAllies, amount: 1, consequential: { from: "thwart" } }],
});
const PADDING = constant("padding.constant", {
  rules: [{ kind: "reduceDamageTaken", target: yourAllies, amount: 1, consequential: { from: "attack" } }],
});
/** Wasp's shape: "may divide their basic thwart among any number of schemes", for the identity and for allies. */
const SPLIT = constant("split.constant", {
  rules: [
    { kind: "divideBasicPower", power: "thwart", target: yourIdentity },
    { kind: "divideBasicPower", power: "thwart", target: yourAllies },
  ],
});

const forced = (id: string, kind: "response" | "interrupt", on: object, effects: readonly EffectSpec[]) =>
  stubAbility(id, def({ trigger: { kind, forced: true, on }, effects: [...effects] } as AbilityDefinition));
const hitVillain = (amount: number): EffectSpec => ({ kind: "dealDamage", target: theVillain, amount: n(amount) });
/** "After you thwart, deal 1 damage to the villain." / "After you attack, deal 16 …": markers, summed on the villain. */
const AFTER_THWART = forced("after-thwart.response", "response", { on: "thwart", sourceIs: yourIdentity }, [
  hitVillain(1),
]);
const AFTER_ATTACK = forced("after-attack.response", "response", { on: "attack", sourceIs: yourIdentity }, [
  hitVillain(16),
]);
/** "After you use a basic thwart power, deal 2 …" / "… a basic attack power, deal 32 …". */
const USED_THWART = forced(
  "used-thwart.response",
  "response",
  { on: "basicPowerUsed", playerIs: "controller", eventIs: { power: "thwart" } },
  [hitVillain(2)],
);
const USED_ATTACK = forced(
  "used-attack.response",
  "response",
  { on: "basicPowerUsed", playerIs: "controller", eventIs: { power: "attack" } },
  [hitVillain(32)],
);
/** Havok's shape, on a thwart: "When an ally thwarts, it takes +1 consequential damage for this thwart." */
const STRAIN = forced("strain.interrupt", "interrupt", { on: "thwart", sourceIs: yourAllies }, [
  { kind: "modifyConsequentialDamage", character: eachAlly, amount: n(1) },
]);

const action = (id: string, effects: readonly EffectSpec[], thwart = false) =>
  stubAbility(
    id,
    def({ trigger: { kind: "action" }, ...(thwart ? { label: ["thwart"] } : {}), effects: [...effects] }),
  );
const nextBasic = { kind: "nextBasicPower", powers: ["attack", "thwart"] } as const;
/** "That ally gets +2 THW and +2 ATK for its next basic thwart or attack action this phase" (Psychic Kicker's shape). */
const KICK = action("kicker.action", [
  { kind: "modifyStatUntil", stat: "thw", amount: n(2), target: eachAlly, until: nextBasic },
  { kind: "modifyStatUntil", stat: "atk", amount: n(2), target: eachAlly, until: nextBasic },
]);
const aSideScheme: EffectSpec = {
  kind: "chooseTarget",
  slot: "scheme",
  query: { categories: ["sideScheme"] },
  chooser: { kind: "controller" },
};
const chosenScheme = { kind: "slot", slot: "scheme" } as const;
/** "Action (thwart): Remove 1 threat from a side scheme." (an event) */
const GADGET_ACTION = action(
  "gadget.action",
  [aSideScheme, { kind: "thwart", target: chosenScheme, amount: n(1) }],
  true,
);
/** "Action (thwart): Remove threat from a side scheme equal to your identity's THW." (a card ability) */
const STUDY_ACTION = action(
  "study.action",
  [
    aSideScheme,
    {
      kind: "thwart",
      target: chosenScheme,
      amount: { kind: "stat", of: { kind: "identityOf", player: { kind: "controller" } }, stat: "thw" },
    },
  ],
  true,
);

const support = (id: string, ability: StubAbility) => stubSupport({ id, cost: 0, abilities: [ability.ref] });
const SUPPORTS = {
  thwUp: support("thw-up", THW_UP),
  atkUp: support("atk-up", ATK_UP),
  weary: support("weary", WEARY),
  enraged: support("enraged", ENRAGED),
  cushion: support("cushion", CUSHION),
  padding: support("padding", PADDING),
  split: support("split", SPLIT),
  afterThwart: support("after-thwart", AFTER_THWART),
  afterAttack: support("after-attack", AFTER_ATTACK),
  usedThwart: support("used-thwart", USED_THWART),
  usedAttack: support("used-attack", USED_ATTACK),
  strain: support("strain", STRAIN),
  kicker: support("kicker", KICK),
  study: support("study", STUDY_ACTION),
} as const;
const GADGET = stubEvent({ id: "gadget", cost: 0, abilities: [GADGET_ACTION.ref] });

const deps: EngineDeps = depsOf(
  THW_UP,
  ATK_UP,
  WEARY,
  ENRAGED,
  CUSHION,
  PADDING,
  SPLIT,
  AFTER_THWART,
  AFTER_ATTACK,
  USED_THWART,
  USED_ATTACK,
  STRAIN,
  KICK,
  GADGET_ACTION,
  STUDY_ACTION,
);

const ENCOUNTER_SCHEMES = { front: FRONT, back: BACK, alarm: ALARM } as const;
const PLAYER_SCHEMES = { raid: RAID, errand: ERRAND } as const;
type SchemeKey = keyof typeof ENCOUNTER_SCHEMES | keyof typeof PLAYER_SCHEMES;

interface Options {
  readonly schemes: readonly SchemeKey[];
  readonly supports?: readonly (keyof typeof SUPPORTS)[];
  readonly ally?: typeof SIDEKICK;
  readonly minion?: typeof PATROLLER;
  /** The main scheme has the keyword itself. */
  readonly mainAssault?: boolean;
  readonly villainRetaliate?: boolean;
  /** A status card on the hero, and on the ally when there is one. */
  readonly status?: "stunned" | "confused";
}

interface Setup {
  readonly state: GameState;
  readonly hero: InstanceId;
  readonly ally: InstanceId;
  readonly main: InstanceId;
  readonly villain: InstanceId;
  readonly scheme: Readonly<Record<SchemeKey, InstanceId>>;
  readonly support: Readonly<Record<keyof typeof SUPPORTS, InstanceId>>;
}

function setup(options: Options): Setup {
  const supports = options.supports ?? [];
  const villain = stubVillain({
    id: "villain",
    stages: [
      { hp: flat(90), atk: 1, sch: 1, keywords: options.villainRetaliate ? [{ name: "retaliate", value: 1 }] : [] },
    ],
  });
  const mainScheme = stubMainScheme({
    id: "scheme",
    stages: [
      {
        startingThreat: flat(10),
        targetThreat: flat(40),
        acceleration: flat(0),
        ...(options.mainAssault ? { keywords: ASSAULT } : {}),
      },
    ],
  });
  const cards: readonly AnyCard[] = [
    BRAWLER,
    SIDEKICK,
    CAREFUL,
    GADGET,
    PATROLLER,
    BODYGUARD,
    ...Object.values(ENCOUNTER_SCHEMES),
    ...Object.values(PLAYER_SCHEMES),
    ...Object.values(SUPPORTS),
  ];
  let state = gameAtFirstTurn({
    cards,
    deps,
    villain,
    mainScheme,
    deck: [
      SIDEKICK.id,
      CAREFUL.id,
      GADGET.id,
      ...Object.values(PLAYER_SCHEMES).map((card) => card.id),
      ...Object.values(SUPPORTS).map((card) => card.id),
    ],
    encounter: [...Object.values(ENCOUNTER_SCHEMES).map((card) => card.id), PATROLLER.id, BODYGUARD.id],
  });
  if (mustPlayer(state, P1).identity.form !== "hero")
    state = runWith(deps, state, { type: "changeForm", playerId: P1 });
  const scheme: Partial<Record<SchemeKey, InstanceId>> = {};
  for (const key of options.schemes) {
    if (key === "raid" || key === "errand") {
      // Surgery: a player side scheme already in play, in the villain's area under its player's control.
      const given = giveCard(state, P1, PLAYER_SCHEMES[key].id);
      state = {
        ...given.state,
        players: given.state.players.map((p) =>
          p.playerId === P1 ? { ...p, hand: p.hand.filter((id) => id !== given.id) } : p,
        ),
        villainArea: [...given.state.villainArea, given.id],
        instances: {
          ...given.state.instances,
          [given.id]: { ...mustInstance(given.state, given.id), controllerId: P1, faceup: true, threat: 9 },
        },
      };
      scheme[key] = given.id;
    } else {
      const placed = encounterCardInVillainArea(state, ENCOUNTER_SCHEMES[key].id, 9);
      state = placed.state;
      scheme[key] = placed.id;
    }
  }
  const support: Partial<Record<keyof typeof SUPPORTS, InstanceId>> = {};
  for (const key of supports) {
    const placed = playerCardIntoPlay(state, SUPPORTS[key].id);
    state = placed.state;
    support[key] = placed.id;
  }
  const ally = playerCardIntoPlay(state, (options.ally ?? SIDEKICK).id);
  state = ally.state;
  if (options.minion) state = minionEngagedWith(state, options.minion.id).state;
  const hero = mustPlayer(state, P1).identity.instanceId;
  if (options.status) {
    for (const id of [hero, ally.id]) {
      const instance = mustInstance(state, id);
      state = {
        ...state,
        instances: {
          ...state.instances,
          [id]: { ...instance, statuses: { ...instance.statuses, [options.status]: 1 } },
        },
      };
    }
  }
  return {
    state,
    hero,
    ally: ally.id,
    main: state.mainScheme.instanceId,
    villain: state.villains[0]!.instanceId,
    scheme: scheme as Record<SchemeKey, InstanceId>,
    support: support as Record<keyof typeof SUPPORTS, InstanceId>,
  };
}

type Share = readonly [scheme: InstanceId, amount: number];
const thwart = (thwarter: InstanceId, scheme: InstanceId, ...shares: readonly Share[]): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
  ...(shares.length > 0 ? { divide: shares.map(([targetInstanceId, amount]) => ({ targetInstanceId, amount })) } : {}),
});
const use = (card: InstanceId, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: card,
  abilityId: ability.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});
const run = (state: GameState, ...commands: readonly Command[]) =>
  driveSession(startSession(state), deps, commands, defaultPick);
const refusal = (state: GameState, command: Command): string | null => {
  const result = applyCommand(state, command, deps);
  return result.ok ? null : result.error.message;
};
const threat = (state: GameState, id: InstanceId) => mustInstance(state, id).threat;
const damage = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;
function expectReplay(session: GameSession): void {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("assault: a basic thwart against a scheme with the keyword uses ATK (RRG 1.8 'Assault', p. 8)", () => {
  it("a hero (ATK 3, THW 2) removes 3 from an assault scheme and 2 from a scheme without it", () => {
    const s = setup({ schemes: ["front", "back"] });
    const assaulted = run(s.state, thwart(s.hero, s.scheme.front));
    expect(threat(assaulted.session.state, s.scheme.front)).toBe(6);
    expect(damage(assaulted.session.state, s.hero)).toBe(0);
    expectReplay(assaulted.session);
    const plain = run(s.state, thwart(s.hero, s.scheme.back));
    expect(threat(plain.session.state, s.scheme.back)).toBe(7);
  });

  it("an ally (ATK 4 over 2, THW 2 over 1) removes 4 and takes 2 against assault; 2 and 1 without it", () => {
    const s = setup({ schemes: ["front", "back"] });
    const assaulted = run(s.state, thwart(s.ally, s.scheme.front));
    expect(threat(assaulted.session.state, s.scheme.front)).toBe(5);
    expect(damage(assaulted.session.state, s.ally)).toBe(2);
    expectReplay(assaulted.session);
    const plain = run(s.state, thwart(s.ally, s.scheme.back));
    expect(threat(plain.session.state, s.scheme.back)).toBe(7);
    expect(damage(plain.session.state, s.ally)).toBe(1);
  });

  it("an ally with nothing under its ATK and 3 under its THW takes none against assault, 3 without it", () => {
    const s = setup({ schemes: ["front", "back"], ally: CAREFUL });
    const assaulted = run(s.state, thwart(s.ally, s.scheme.front)).session.state;
    expect(threat(assaulted, s.scheme.front)).toBe(7);
    expect(damage(assaulted, s.ally)).toBe(0);
    const plain = run(s.state, thwart(s.ally, s.scheme.back)).session.state;
    expect(threat(plain, s.scheme.back)).toBe(8);
    expect(damage(plain, s.ally)).toBe(3);
  });

  it("a player side scheme with assault behaves as an encounter one does, and one without it uses THW", () => {
    // One player side scheme at a time: the limit is one with a single player (RRG 1.8 p. 34).
    const s = setup({ schemes: ["raid"] });
    const hero = run(s.state, thwart(s.hero, s.scheme.raid)).session.state;
    expect(threat(hero, s.scheme.raid)).toBe(6);
    const ally = run(s.state, thwart(s.ally, s.scheme.raid)).session.state;
    expect(threat(ally, s.scheme.raid)).toBe(5);
    expect(damage(ally, s.ally)).toBe(2);
    const p = setup({ schemes: ["errand"] });
    const plain = run(p.state, thwart(p.hero, p.scheme.errand), thwart(p.ally, p.scheme.errand)).session.state;
    expect(threat(plain, p.scheme.errand)).toBe(5);
    expect(damage(plain, p.ally)).toBe(1);
  });

  it("a main scheme with assault: 3 by the hero, 4 and 2 consequential damage by the ally", () => {
    const s = setup({ schemes: [], mainAssault: true });
    const after = run(s.state, thwart(s.hero, s.main), thwart(s.ally, s.main)).session.state;
    expect(threat(after, s.main)).toBe(3);
    expect(damage(after, s.ally)).toBe(2);
  });
});

describe("assault: which modifiers count", () => {
  it("'+2 THW' does not help against assault (3) and does without it (4)", () => {
    const s = setup({ schemes: ["front", "back"], supports: ["thwUp"] });
    expect(characterProfile(s.state, s.hero, deps)).toMatchObject({ atk: 3, thw: 4 });
    expect(threat(run(s.state, thwart(s.hero, s.scheme.front)).session.state, s.scheme.front)).toBe(6);
    expect(threat(run(s.state, thwart(s.hero, s.scheme.back)).session.state, s.scheme.back)).toBe(5);
  });

  it("'+1 ATK' helps against assault (4) and not without it (2)", () => {
    const s = setup({ schemes: ["front", "back"], supports: ["atkUp"] });
    expect(characterProfile(s.state, s.hero, deps)).toMatchObject({ atk: 4, thw: 2 });
    expect(threat(run(s.state, thwart(s.hero, s.scheme.front)).session.state, s.scheme.front)).toBe(5);
    expect(threat(run(s.state, thwart(s.hero, s.scheme.back)).session.state, s.scheme.back)).toBe(7);
  });

  it("'+2 THW and +2 ATK for its next basic thwart or attack': the ATK half applies to an assault thwart (4 + 2)", () => {
    const s = setup({ schemes: ["front", "back"], supports: ["kicker"] });
    const kicked = run(s.state, use(s.support.kicker, KICK)).session.state;
    const assaulted = run(kicked, thwart(s.ally, s.scheme.front));
    expect(threat(assaulted.session.state, s.scheme.front)).toBe(3);
    // The thwart was its next basic power: both bonuses are spent on it.
    expect(assaulted.session.state.lastingEffects).toEqual([]);
    expect(characterProfile(assaulted.session.state, s.ally, deps)).toMatchObject({ atk: 4, thw: 2 });
    expectReplay(assaulted.session);
    // Without assault the THW half applies instead: 2 + 2.
    expect(threat(run(kicked, thwart(s.ally, s.scheme.back)).session.state, s.scheme.back)).toBe(5);
  });

  // The printed value comes from under ATK; a standing change to it is keyed to what the ally did, which is thwart.
  it("'+1 consequential damage after it thwarts' adds to the ATK number (2 + 1); 'after it attacks' does not", () => {
    const weary = setup({ schemes: ["front"], supports: ["weary"] });
    expect(damage(run(weary.state, thwart(weary.ally, weary.scheme.front)).session.state, weary.ally)).toBe(3);
    const enraged = setup({ schemes: ["front"], supports: ["enraged"] });
    expect(damage(run(enraged.state, thwart(enraged.ally, enraged.scheme.front)).session.state, enraged.ally)).toBe(2);
  });

  it("it is consequential damage from thwarting: '1 less from thwarting' makes 1, '1 less from attacking' leaves 2", () => {
    const cushion = setup({ schemes: ["front"], supports: ["cushion"] });
    expect(damage(run(cushion.state, thwart(cushion.ally, cushion.scheme.front)).session.state, cushion.ally)).toBe(1);
    const padding = setup({ schemes: ["front"], supports: ["padding"] });
    expect(damage(run(padding.state, thwart(padding.ally, padding.scheme.front)).session.state, padding.ally)).toBe(2);
  });

  it("'+1 consequential damage for this thwart' on an ally with 0 under its ATK makes 1, not its THW number plus 1", () => {
    const s = setup({ schemes: ["front", "back"], ally: CAREFUL, supports: ["strain"] });
    expect(damage(run(s.state, thwart(s.ally, s.scheme.front)).session.state, s.ally)).toBe(1);
    expect(damage(run(s.state, thwart(s.ally, s.scheme.back)).session.state, s.ally)).toBe(4);
  });
});

describe("assault: it is still a thwart, and not an attack", () => {
  const listeners = ["afterThwart", "afterAttack", "usedThwart", "usedAttack"] as const;

  it("'after you thwart' and 'after you use a basic thwart' fire; the attack ones do not", () => {
    const s = setup({ schemes: ["front"], supports: listeners });
    const after = run(s.state, thwart(s.hero, s.scheme.front)).session.state;
    expect(threat(after, s.scheme.front)).toBe(6);
    // 1 (after you thwart) + 2 (basic thwart used); 16 and 32 are the attack markers.
    expect(damage(after, s.villain)).toBe(3);
  });

  it("retaliate on the villain does not trigger", () => {
    const s = setup({ schemes: ["front"], villainRetaliate: true });
    const after = run(s.state, thwart(s.hero, s.scheme.front), thwart(s.ally, s.scheme.front)).session.state;
    expect(threat(after, s.scheme.front)).toBe(2);
    expect(damage(after, s.hero)).toBe(0);
    expect(damage(after, s.ally)).toBe(2);
  });

  it("an engaged guard minion stops the attack on the villain, not the assault thwart", () => {
    const s = setup({ schemes: ["front"], minion: BODYGUARD });
    expect(
      refusal(s.state, { type: "basicAttack", playerId: P1, attackerInstanceId: s.hero, targetInstanceId: s.villain }),
    ).toBe("a guard minion blocks attacks against the villain");
    expect(threat(run(s.state, thwart(s.hero, s.scheme.front)).session.state, s.scheme.front)).toBe(6);
  });

  it("a stunned character still makes it, and keeps its stunned status card", () => {
    const s = setup({ schemes: ["front"], status: "stunned" });
    const after = run(s.state, thwart(s.hero, s.scheme.front), thwart(s.ally, s.scheme.front)).session.state;
    expect(threat(after, s.scheme.front)).toBe(2);
    expect(mustInstance(after, s.hero).statuses.stunned).toBe(1);
    expect(mustInstance(after, s.ally).statuses.stunned).toBe(1);
    expect(damage(after, s.ally)).toBe(2);
  });

  it("a confused character does not: the status card replaces the thwart, with no threat removed and no damage", () => {
    const s = setup({ schemes: ["front"], status: "confused", supports: listeners });
    const after = run(s.state, thwart(s.hero, s.scheme.front), thwart(s.ally, s.scheme.front)).session.state;
    expect(threat(after, s.scheme.front)).toBe(9);
    for (const id of [s.hero, s.ally]) {
      expect(mustInstance(after, id).statuses.confused).toBe(0);
      expect(mustInstance(after, id).exhausted).toBe(true);
    }
    expect(damage(after, s.ally)).toBe(0);
    expect(damage(after, s.villain)).toBe(0);
  });

  it("patrol stops it against a main scheme with assault, exactly as it stops any thwart", () => {
    const s = setup({ schemes: [], mainAssault: true, minion: PATROLLER });
    const blocked = "a minion with patrol engaged with you blocks thwarting the main scheme";
    expect(refusal(s.state, thwart(s.hero, s.main))).toBe(blocked);
    expect(refusal(s.state, thwart(s.ally, s.main))).toBe(blocked);
  });

  it("a crisis icon stops it against a main scheme with assault; the assault side scheme can still be thwarted", () => {
    const s = setup({ schemes: ["alarm", "front"], mainAssault: true });
    expect(refusal(s.state, thwart(s.hero, s.main))).toBe("a crisis icon blocks thwarting the main scheme");
    expect(threat(run(s.state, thwart(s.hero, s.scheme.front)).session.state, s.scheme.front)).toBe(6);
  });
});

describe("assault: a thwart that is not a basic thwart uses the amount its ability states", () => {
  it("an event's 'remove 1 threat' removes 1 from an assault scheme", () => {
    const s = setup({ schemes: ["front"] });
    const given = giveCard(s.state, P1, GADGET.id);
    const after = run(given.state, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    }).session.state;
    expect(threat(after, s.scheme.front)).toBe(8);
    expect(mustInstance(after, s.hero).exhausted).toBe(false);
  });

  it("a card ability's 'remove threat equal to your THW' removes THW 2, not ATK 3", () => {
    const s = setup({ schemes: ["front"], supports: ["study"] });
    const after = run(s.state, use(s.support.study, STUDY_ACTION)).session.state;
    expect(threat(after, s.scheme.front)).toBe(7);
  });
});

describe("assault: a divided basic thwart (§4.1 Q3)", () => {
  it("one assault scheme and one without: the hero divides ATK 3, and a division of THW 2 is refused", () => {
    const s = setup({ schemes: ["front", "back"], supports: ["split", "afterThwart", "afterAttack"] });
    const { front, back } = s.scheme;
    const divided = run(s.state, thwart(s.hero, front, [front, 1], [back, 2]));
    expect(threat(divided.session.state, front)).toBe(8);
    expect(threat(divided.session.state, back)).toBe(7);
    // One "after you thwart" per scheme thwarted (FAQ "Wasp (#1C)", p. 61), and no "after you attack".
    expect(damage(divided.session.state, s.villain)).toBe(2);
    expectReplay(divided.session);
    expect(refusal(s.state, thwart(s.hero, front, [front, 1], [back, 1]))).toBe("the shares must total 3");
    // The command's own scheme being the one without assault changes nothing.
    const reversed = run(s.state, thwart(s.hero, back, [back, 1], [front, 2])).session.state;
    expect([threat(reversed, back), threat(reversed, front)]).toEqual([8, 7]);
    expect(refusal(s.state, thwart(s.hero, back, [back, 1], [front, 1]))).toBe("the shares must total 3");
  });

  it("an ally dividing it across an assault scheme and one without divides ATK 4 and takes 2", () => {
    const s = setup({ schemes: ["front", "back"], supports: ["split"] });
    const { front, back } = s.scheme;
    const divided = run(s.state, thwart(s.ally, front, [front, 3], [back, 1]));
    expect(threat(divided.session.state, front)).toBe(6);
    expect(threat(divided.session.state, back)).toBe(8);
    expect(damage(divided.session.state, s.ally)).toBe(2);
    expectReplay(divided.session);
    expect(refusal(s.state, thwart(s.ally, front, [front, 1], [back, 1]))).toBe("the shares must total 4");
  });

  it("'+2 THW' does not enlarge it and '+1 ATK' does", () => {
    const s = setup({ schemes: ["front", "back"], supports: ["split", "thwUp", "atkUp"] });
    const { front, back } = s.scheme;
    expect(characterProfile(s.state, s.hero, deps)).toMatchObject({ atk: 4, thw: 4 });
    const lone = setup({ schemes: ["front", "back"], supports: ["split", "thwUp"] });
    expect(
      refusal(lone.state, thwart(lone.hero, lone.scheme.front, [lone.scheme.front, 2], [lone.scheme.back, 2])),
    ).toBe("the shares must total 3");
    const after = run(s.state, thwart(s.hero, front, [front, 2], [back, 2])).session.state;
    expect([threat(after, front), threat(after, back)]).toEqual([7, 7]);
  });

  it("an encounter and a player side scheme, both with assault: ATK", () => {
    const s = setup({ schemes: ["front", "raid"], supports: ["split"] });
    const after = run(s.state, thwart(s.hero, s.scheme.front, [s.scheme.front, 2], [s.scheme.raid, 1])).session.state;
    expect([threat(after, s.scheme.front), threat(after, s.scheme.raid)]).toEqual([7, 8]);
  });

  it("two schemes without assault are unchanged: the hero divides THW 2, the ally THW 2 and takes 1", () => {
    const s = setup({ schemes: ["back", "errand"], supports: ["split"] });
    const { back, errand } = s.scheme;
    expect(refusal(s.state, thwart(s.hero, back, [back, 2], [errand, 1]))).toBe("the shares must total 2");
    const after = run(
      s.state,
      thwart(s.hero, back, [back, 1], [errand, 1]),
      thwart(s.ally, back, [back, 1], [errand, 1]),
    ).session.state;
    expect([threat(after, back), threat(after, errand)]).toEqual([7, 7]);
    expect(damage(after, s.ally)).toBe(1);
  });

  it("a confused character's divided thwart with an assault scheme removes nothing", () => {
    const s = setup({ schemes: ["front", "back"], supports: ["split"], status: "confused" });
    const { front, back } = s.scheme;
    const after = run(s.state, thwart(s.ally, front, [front, 3], [back, 1])).session.state;
    expect([threat(after, front), threat(after, back)]).toEqual([9, 9]);
    expect(mustInstance(after, s.ally).statuses.confused).toBe(0);
    expect(damage(after, s.ally)).toBe(0);
  });

  it("patrol stops a divided thwart that includes the main scheme, whatever stat it uses", () => {
    const s = setup({ schemes: ["front"], supports: ["split"], minion: PATROLLER });
    expect(refusal(s.state, thwart(s.hero, s.scheme.front, [s.scheme.front, 2], [s.main, 1]))).toBe(
      "a minion with patrol engaged with you blocks thwarting the main scheme",
    );
  });
});
