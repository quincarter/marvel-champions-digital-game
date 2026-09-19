/**
 * docs/phase7-wave2.md §3.13 onward: the cycle 1 primitives `ability-scripting-engineer` was blocked on
 * (docs/phase7-wave2-scripting.md §6), one test each, with synthetic cards. Engine code never names a card; the card
 * names in the test titles only say which printed text each shape was built for.
 *
 * Sources: RRG 1.8 "Piercing" (p. 32), "Ranged" (p. 35), "Overkill" (p. 31), "Guard" (p. 22), "Tough" (p. 44),
 * "Retaliate X" (p. 37), "Crisis Icon" (p. 14), "Prevent" (p. 34), "Wild Resource" (p. 48), "Cost" (p. 13).
 */

import { flat, trait, type AnyCard, type CardId, type PlayerCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { CardInstance, GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubAlly, stubEnvironment, stubEvent, stubIdentity, stubMainScheme, stubMinion, stubResource, stubSideScheme, stubSupport, stubTreachery, stubUpgrade, stubVillain } from "./testing/fixtures.js";
import { ALLY, expectOk, giveCards, newGame, RESOURCE, runWith, settle } from "./testing/scenario.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const toHero: Command = { type: "changeForm", playerId: p1 };
const endTurn: Command = { type: "endTurn", playerId: p1 };
const play = (id: InstanceId): Command => ({ type: "playCard", playerId: p1, cardInstanceId: id, payment: [], attachToInstanceId: null });
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const SCHEME = stubMainScheme({ id: "scheme", stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0) }] });

const patchInstance = (state: GameState, id: InstanceId, patch: Partial<CardInstance>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...(state.instances[id] as CardInstance), ...patch } },
});
const withTough = (state: GameState, id: InstanceId): GameState => patchInstance(state, id, { statuses: { stunned: 0, confused: 0, tough: 1 } });
const identityOf = (state: GameState) => mustPlayer(state, p1).identity.instanceId;
const damageOn = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;

interface Setup {
  readonly cards?: readonly AnyCard[];
  readonly abilities?: readonly StubAbility[];
  readonly villain?: ReturnType<typeof stubVillain>;
  readonly encounter?: readonly CardId[];
}

function setup({ cards = [], abilities = [], villain, encounter }: Setup): { deps: EngineDeps; state: GameState } {
  const deps = depsOf(...abilities);
  const inDeck = cards.filter((c) => c.type === "event" || c.type === "upgrade" || c.type === "ally" || c.type === "support");
  const state = newGame({
    villain: villain ?? stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 2, sch: 0 }] }),
    mainScheme: SCHEME,
    extraCards: [BLANK, ...cards],
    deck: [...inDeck.flatMap((c) => copies(c.id)), ...copies(RESOURCE.id, 10), ...copies(ALLY.id)],
    encounterDeck: encounter ?? copies(BLANK.id, 20),
    deps,
  });
  return { deps, state };
}

// ---- §3.13 attack keywords granted to one attack -------------------------------------------------------------------

describe("§3.13 an attack keyword granted to one attack, not to a character", () => {
  const ARROW = trait("ARROW");
  const villainId = (state: GameState) => state.villains[0]?.instanceId as InstanceId;

  /** "Hero Action (attack): deal 3 damage to an enemy. This attack gains <keywords>." */
  const shot = (id: string, keywords: readonly ("piercing" | "ranged" | "overkill")[]) =>
    stubAbility(`${id}.action`, def({
      trigger: { kind: "action", form: "hero" },
      label: ["attack"],
      effects: [{ kind: "attack", target: { kind: "villain" }, amount: { kind: "const", value: 3 }, ...(keywords.length > 0 ? { keywords } : {}) }],
    }));

  const pierceAbility = shot("pierce", ["piercing"]);
  const PIERCE = stubEvent({ id: "pierce", cost: 0, abilities: [pierceAbility.ref] });
  const plainAbility = shot("plain", []);
  const PLAIN = stubEvent({ id: "plain", cost: 0, abilities: [plainAbility.ref] });
  const rangedAbility = shot("snipe", ["ranged"]);
  const SNIPE = stubEvent({ id: "snipe", cost: 0, abilities: [rangedAbility.ref] });

  it("'this attack gains piercing' discards the target's tough card and still deals damage (RRG 1.8 'Piercing', p. 32)", () => {
    const fire = (card: typeof PIERCE, ability: StubAbility) => {
      const { deps, state } = setup({ cards: [card], abilities: [ability] });
      const given = giveCards(state, p1, card.id);
      const hero = runWith(deps, given.state, toHero);
      const tough = withTough(hero, villainId(hero));
      const after = settle(runWith(deps, tough, play(given.ids[0] as InstanceId)), undefined, deps);
      return { damage: damageOn(after, villainId(after)), tough: mustInstance(after, villainId(after)).statuses.tough };
    };
    expect(fire(PIERCE, pierceAbility)).toEqual({ damage: 3, tough: 0 });
    // Without the grant the tough card absorbs it all, which is what makes the grant observable.
    expect(fire(PLAIN, plainAbility)).toEqual({ damage: 0, tough: 0 });
  });

  it("'this attack gains ranged' ignores the target's retaliate (RRG 1.8 'Ranged', p. 35)", () => {
    const fire = (card: typeof SNIPE, ability: StubAbility) => {
      const { deps, state } = setup({
        cards: [card],
        abilities: [ability],
        villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 2, sch: 0, keywords: [{ name: "retaliate", value: 2 }] }] }),
      });
      const given = giveCards(state, p1, card.id);
      const hero = runWith(deps, given.state, toHero);
      const after = settle(runWith(deps, hero, play(given.ids[0] as InstanceId)), undefined, deps);
      return damageOn(after, identityOf(after));
    };
    expect(fire(SNIPE, rangedAbility)).toBe(0);
    expect(fire(PLAIN, plainAbility)).toBe(2);
  });

  it("ranged does not let an attack past a guard minion (RRG 1.8 'Guard', p. 22)", () => {
    const GUARD = stubMinion({ id: "guard", atk: 0, sch: 0, hp: 5, boostIcons: 0, keywords: [{ name: "guard" }] });
    const { deps, state } = setup({ cards: [SNIPE, GUARD], abilities: [rangedAbility], encounter: copies(GUARD.id, 20) });
    const round2 = settle(runWith(deps, state, toHero, endTurn), undefined, deps);
    const given = giveCards(round2, p1, SNIPE.id);
    const after = settle(runWith(deps, given.state, play(given.ids[0] as InstanceId)), undefined, deps);
    // The villain is still shielded: the attack found no legal target and dealt nothing.
    expect(damageOn(after, villainId(after))).toBe(0);
  });

  it("'keywords: [overkill]' spills excess damage exactly as `overkill: true` does (RRG 1.8 'Overkill', p. 31)", () => {
    const MINION = stubMinion({ id: "chaff", atk: 0, sch: 0, hp: 1, boostIcons: 0 });
    const overkillAbility = stubAbility("spill.action", def({
      trigger: { kind: "action", form: "hero" },
      label: ["attack"],
      effects: [{ kind: "attack", target: { kind: "each", query: { categories: ["minion"] } }, amount: { kind: "const", value: 4 }, keywords: ["overkill"] }],
    }));
    const SPILL = stubEvent({ id: "spill", cost: 0, abilities: [overkillAbility.ref] });
    const { deps, state } = setup({ cards: [SPILL, MINION], abilities: [overkillAbility], encounter: copies(MINION.id, 20) });
    const round2 = settle(runWith(deps, state, toHero, endTurn), undefined, deps);
    const given = giveCards(round2, p1, SPILL.id);
    const after = settle(runWith(deps, given.state, play(given.ids[0] as InstanceId)), undefined, deps);
    expect(damageOn(after, villainId(after))).toBe(3);
  });

  it("a constant `attackKeywords` rule grants by the card making the attack ('each of your [Arrow] attacks gain ranged')", () => {
    const bowAbility = stubAbility("bow.constant", def({
      trigger: { kind: "constant", rules: [{ kind: "attackKeywords", keywords: ["ranged"], via: { trait: ARROW, owner: "you" } }] },
      effects: [],
    }));
    const BOW = stubUpgrade({ id: "bow", cost: 0, abilities: [bowAbility.ref] });
    const ARROW_SHOT: PlayerCard = { ...stubEvent({ id: "arrow-shot", cost: 0, abilities: [plainAbility.ref] }), traits: [ARROW] };
    const retaliating = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 2, sch: 0, keywords: [{ name: "retaliate", value: 2 }] }] });
    const fire = (card: PlayerCard, withBow: boolean) => {
      const { deps, state } = setup({ cards: [BOW, ARROW_SHOT, PLAIN], abilities: [bowAbility, plainAbility], villain: retaliating });
      const given = giveCards(state, p1, ...(withBow ? [BOW.id, card.id] : [card.id]));
      let current = runWith(deps, given.state, toHero);
      if (withBow) current = settle(runWith(deps, current, play(given.ids[0] as InstanceId)), undefined, deps);
      const shotId = given.ids[withBow ? 1 : 0] as InstanceId;
      const after = settle(runWith(deps, current, play(shotId)), undefined, deps);
      return damageOn(after, identityOf(after));
    };
    // Only the Arrow event's attack is ranged, and only while the granting upgrade is in play.
    expect(fire(ARROW_SHOT, true)).toBe(0);
    expect(fire(ARROW_SHOT, false)).toBe(2);
    expect(fire(PLAIN, true)).toBe(2);
  });

  it("`modifyAttack.keywords` gives piercing to the enemy attack in progress ('the attack gains piercing')", () => {
    // Printed on the villain stage itself, the way an attachment's "when attached enemy attacks" would be.
    const rifleAbility = stubAbility("rifle.interrupt", def({
      trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", selfIs: "source" } },
      effects: [{ kind: "modifyAttack", keywords: ["piercing"] }],
    }));
    const run = (abilities: readonly StubAbility[]) => {
      const villain = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 2, sch: 0, abilities: abilities.map((a) => a.ref) }] });
      const { deps, state } = setup({ abilities, villain });
      const hero = runWith(deps, state, toHero);
      const tough = withTough(hero, identityOf(hero));
      const after = settle(runWith(deps, tough, endTurn), undefined, deps);
      return { damage: damageOn(after, identityOf(after)), tough: mustInstance(after, identityOf(after)).statuses.tough };
    };
    // The villain attacks for 2. With piercing granted to that attack the tough card is discarded first, so the
    // damage lands; without it the tough card absorbs the whole attack.
    expect(run([rifleAbility])).toEqual({ damage: 2, tough: 0 });
    expect(run([])).toEqual({ damage: 0, tough: 0 });
  });
});

// ---- §3.13.2 an OR of aspects ---------------------------------------------------------------------------------------

describe("§3.13 `TargetQuery.anyAspect`: 'an aspect card'", () => {
  const CORE_ASPECTS = ["aggression", "justice", "leadership", "protection"] as const;
  const finesseAbility = stubAbility("finesse.resource", def({
    trigger: { kind: "resource" },
    effects: [],
    generates: 1,
    generatesFor: { anyAspect: CORE_ASPECTS },
  }));
  const FINESSE = stubSupport({ id: "finesse", cost: 0, abilities: [finesseAbility.ref] });
  const inert = (id: string) => stubAbility(`${id}.action`, def({ trigger: { kind: "action", form: "hero" }, effects: [] }));
  const aggroAbility = inert("aggro");
  const AGGRO: PlayerCard = stubEvent({ id: "aggro", cost: 1, aspect: "aggression", abilities: [aggroAbility.ref] });
  const basicAbility = inert("plainbasic");
  const BASIC: PlayerCard = stubEvent({ id: "plainbasic", cost: 1, aspect: "basic", abilities: [basicAbility.ref] });
  const signatureAbility = inert("signature");
  // §1.2: an identity-specific card that also prints an aspect (Spider-Woman's Venom Blast) is an aspect card here.
  const SIGNATURE: PlayerCard = { ...stubEvent({ id: "signature", cost: 1, aspect: "hero:hero", abilities: [signatureAbility.ref] }), printedAspect: "justice" };

  const abilities = [finesseAbility, aggroAbility, basicAbility, signatureAbility];

  it("matches any of the listed aspects, printed aspect included, and nothing else", () => {
    const deps = depsOf(...abilities);
    const base = newGame({
      deps,
      extraCards: [FINESSE, AGGRO, BASIC, SIGNATURE],
      deck: [...copies(RESOURCE.id, 10), ...copies(FINESSE.id), ...copies(AGGRO.id), ...copies(BASIC.id), ...copies(SIGNATURE.id)],
    });
    const hero = runWith(deps, base, toHero);
    const given = giveCards(hero, p1, FINESSE.id, AGGRO.id, BASIC.id, SIGNATURE.id);
    const [finesseId, aggroId, basicId, signatureId] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    const inPlay = expectOk(applyCommand(given.state, play(finesseId), deps));
    const pay = { ability: { instanceId: finesseId, abilityId: finesseAbility.ref.id } };
    const tryPlay = (id: InstanceId) =>
      applyCommand(inPlay, { type: "playCard", playerId: p1, cardInstanceId: id, payment: [pay], attachToInstanceId: null }, deps);
    expect(tryPlay(aggroId).ok).toBe(true);
    expect(tryPlay(signatureId).ok).toBe(true);
    expect(tryPlay(basicId)).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
  });
});

// ---- §3.13.3 a cost requiring a wild resource ------------------------------------------------------------------------

describe("§3.13 `ResourceRequirement.wild`: 'spend a [wild] resource'", () => {
  const rifleAbility = stubAbility("rifle.action", def({
    trigger: { kind: "action", form: "hero" },
    cost: { resources: { wild: 1 } },
    effects: [{ kind: "addCounters", target: { kind: "self" }, counterType: "used", amount: { kind: "const", value: 1 } }],
  }));
  const RIFLE = stubSupport({ id: "rifle", cost: 0, abilities: [rifleAbility.ref] });
  const WILD = stubResource({ id: "wild-res", icons: 1 });
  const PHYSICAL = stubResource({ id: "phys-res", icons: 0, produces: { physical: 1 } });

  it("is paid by a wild resource and never by a typed one (RRG 1.8 'Wild Resource', p. 48)", () => {
    const deps = depsOf(rifleAbility);
    const base = newGame({
      deps,
      extraCards: [RIFLE, WILD, PHYSICAL],
      deck: [...copies(RESOURCE.id, 6), ...copies(RIFLE.id), ...copies(WILD.id, 6), ...copies(PHYSICAL.id, 6)],
    });
    const hero = runWith(deps, base, toHero);
    const given = giveCards(hero, p1, RIFLE.id, WILD.id, PHYSICAL.id);
    const [rifleId, wildId, physId] = given.ids as [InstanceId, InstanceId, InstanceId];
    const inPlay = expectOk(applyCommand(given.state, play(rifleId), deps));
    const use = (payFrom: InstanceId) =>
      applyCommand(inPlay, { type: "useAbility", playerId: p1, cardInstanceId: rifleId, abilityId: rifleAbility.ref.id, payment: [{ fromHand: payFrom }] }, deps);
    expect(use(wildId).ok).toBe(true);
    // A physical resource pays any *typed* slot's shortfall, but can never be declared a wild resource.
    expect(use(physId)).toMatchObject({ ok: false, error: { code: "insufficient_resources" } });
  });
});

// ---- §3.13.4 prevent all damage from this attack ---------------------------------------------------------------------

describe("§3.13 `modifyAttack.preventAllDamage`: 'prevent all damage from that attack'", () => {
  const guardianAbility = stubAbility("guardian.interrupt", def({
    // "Interrupt: When the villain initiates an attack against you → prevent all damage from that attack."
    trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack" } },
    effects: [{ kind: "modifyAttack", preventAllDamage: true }],
  }));
  const GUARDIAN = stubAlly({ id: "guardian", cost: 0, atk: 1, thw: 1, hp: 5, abilities: [guardianAbility.ref] });

  /** One full villain phase, with or without the interrupting ally in play. */
  const villainPhase = (withGuardian: boolean, options: { readonly tough?: boolean } = {}) => {
    const abilities = withGuardian ? [guardianAbility] : [];
    const { deps, state } = setup({ cards: [GUARDIAN], abilities });
    const hero = runWith(deps, state, toHero);
    let current = hero;
    if (withGuardian) {
      const given = giveCards(current, p1, GUARDIAN.id);
      current = settle(runWith(deps, given.state, play(given.ids[0] as InstanceId)), undefined, deps);
    }
    if (options.tough) current = withTough(current, identityOf(current));
    const after = settle(runWith(deps, current, endTurn), undefined, deps);
    return {
      damage: damageOn(after, identityOf(after)),
      tough: mustInstance(after, identityOf(after)).statuses.tough,
    };
  };

  it("survives attack initiation, the defender step and the defense arithmetic, and stops the damage", () => {
    expect(villainPhase(true).damage).toBe(0);
    expect(villainPhase(false).damage).toBe(2);
  });

  it("does not spend a tough status card, because prevented damage is never taken (RRG 1.8 'Prevent', p. 34)", () => {
    // Without the flag, the tough card absorbs the attack and is discarded; with it, the card is still there.
    expect(villainPhase(true, { tough: true })).toEqual({ damage: 0, tough: 1 });
    expect(villainPhase(false, { tough: true })).toEqual({ damage: 0, tough: 0 });
  });

  it("covers only the attack's own damage, not indirect damage dealt by a card effect during it", () => {
    // A treachery's Boost ability deals 1 damage to the attacked hero. That is not damage "from the attack".
    const boostAbility = stubAbility("sting.boost", def({
      trigger: { kind: "boost" },
      effects: [{ kind: "dealDamage", target: { kind: "identityOf", player: { kind: "firstPlayer" } }, amount: { kind: "const", value: 1 } }],
    }));
    const STING = stubTreachery({ id: "sting", boostIcons: 0, abilities: [boostAbility.ref] });
    const { deps, state } = setup({ cards: [GUARDIAN, STING], abilities: [guardianAbility, boostAbility], encounter: copies(STING.id, 20) });
    const hero = runWith(deps, state, toHero);
    const given = giveCards(hero, p1, GUARDIAN.id);
    const withAlly = settle(runWith(deps, given.state, play(given.ids[0] as InstanceId)), undefined, deps);
    const after = settle(runWith(deps, withAlly, endTurn), undefined, deps);
    expect(damageOn(after, identityOf(after))).toBe(1);
  });
});

// ---- §3.13.5 ignoring crisis icons ------------------------------------------------------------------------------------

describe("§3.13 `thwart.ignoreCrisis`: 'ignoring any crisis icons in play'", () => {
  const CRISIS = stubSideScheme({ id: "crisis-scheme", startingThreat: 3, icons: ["crisis"], boostIcons: 0 });
  const arrow = (id: string, ignoreCrisis: boolean) =>
    stubAbility(`${id}.action`, def({
      trigger: { kind: "action", form: "hero" },
      label: ["thwart"],
      effects: [{ kind: "thwart", target: { kind: "mainScheme" }, amount: { kind: "const", value: 3 }, ...(ignoreCrisis ? { ignoreCrisis: true } : {}) }],
    }));
  const cableAbility = arrow("cable", true);
  const CABLE = stubEvent({ id: "cable", cost: 0, abilities: [cableAbility.ref] });
  const plainAbility = arrow("plain-thwart", false);
  const PLAIN_THWART = stubEvent({ id: "plain-thwart", cost: 0, abilities: [plainAbility.ref] });

  const threatRemoved = (card: typeof CABLE, ability: StubAbility) => {
    const { deps, state } = setup({ cards: [card, CRISIS], abilities: [ability], encounter: copies(CRISIS.id, 20) });
    // Round 2 so the crisis side scheme is in play from the villain phase's encounter card.
    const round2 = settle(runWith(deps, state, toHero, endTurn), undefined, deps);
    const before = mustInstance(round2, round2.mainScheme.instanceId).threat;
    const given = giveCards(round2, p1, card.id);
    const after = settle(runWith(deps, given.state, play(given.ids[0] as InstanceId)), undefined, deps);
    return before - mustInstance(after, after.mainScheme.instanceId).threat;
  };

  it("steps over the crisis check for that one removal only (RRG 1.8 'Crisis Icon', p. 14)", () => {
    expect(threatRemoved(CABLE, cableAbility)).toBe(3);
    expect(threatRemoved(PLAIN_THWART, plainAbility)).toBe(0);
  });
});

// ---- §3.13.6 a referenced card's printed resource icons ---------------------------------------------------------------

describe("§3.13 `ValueSpec totalPrintedResources`: 'the number of printed resources on that card'", () => {
  const archerAbility = stubAbility("archer.action", def({
    // "Action: Exhaust this ally and discard 1 card from your hand → deal X damage to an enemy, where X is the
    // number of printed resources on that card." The cost's own `discard` slot is the ref.
    trigger: { kind: "action" },
    cost: { exhaustSelf: true, discardFromHand: { min: 1, max: 1 } },
    effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "totalPrintedResources", cards: { kind: "slot", slot: "discard" } } }],
  }));
  const ARCHER = stubAlly({ id: "archer", cost: 0, atk: 1, thw: 1, hp: 3, abilities: [archerAbility.ref] });
  const TWO_ICONS = stubEvent({ id: "two-icons", cost: 0, resourceIcons: { physical: 1, mental: 1 } });
  const NO_ICONS = stubEvent({ id: "no-icons", cost: 0, resourceIcons: {} });

  const damageFor = (discarded: typeof TWO_ICONS) => {
    const deps = depsOf(archerAbility);
    const base = newGame({
      deps,
      extraCards: [ARCHER, TWO_ICONS, NO_ICONS],
      deck: [...copies(RESOURCE.id, 8), ...copies(ARCHER.id), ...copies(TWO_ICONS.id), ...copies(NO_ICONS.id)],
    });
    const hero = runWith(deps, base, toHero);
    const given = giveCards(hero, p1, ARCHER.id, discarded.id);
    const [archerId, discardId] = given.ids as [InstanceId, InstanceId];
    const inPlay = settle(runWith(deps, given.state, play(archerId)), undefined, deps);
    const after = settle(
      runWith(deps, inPlay, {
        type: "useAbility",
        playerId: p1,
        cardInstanceId: archerId,
        abilityId: archerAbility.ref.id,
        payment: [],
        costChoices: { discard: [discardId] },
      }),
      undefined,
      deps,
    );
    return damageOn(after, after.villains[0]?.instanceId as InstanceId);
  };

  it("counts the printed icons on a card already discarded to pay the ability's own cost (RRG 1.8 'Printed', p. 35)", () => {
    expect(damageFor(TWO_ICONS)).toBe(2);
    expect(damageFor(NO_ICONS)).toBe(0);
  });
});

// ---- §3.13.7 the player who defeated this scheme -----------------------------------------------------------------------

describe("§3.13 `PlayerRef defeatingPlayer`: 'the player who defeated this scheme'", () => {
  const p2 = playerId("p2");
  const revengeAbility = stubAbility("revenge.when-defeated", def({
    // "When Defeated: <the villain acts> against the player who defeated this scheme."
    trigger: { kind: "whenDefeated" },
    effects: [{ kind: "dealDamage", target: { kind: "identityOf", player: { kind: "defeatingPlayer" } }, amount: { kind: "const", value: 1 } }],
  }));
  const REVENGE = stubSideScheme({ id: "revenge", startingThreat: 1, boostIcons: 0, abilities: [revengeAbility.ref] });

  it("is the player who removed the last threat, not the first player", () => {
    const deps = depsOf(revengeAbility);
    const start = newGame({
      players: 2,
      deps,
      extraCards: [BLANK, REVENGE],
      mainScheme: SCHEME,
      encounterDeck: copies(REVENGE.id, 20),
      deck: [...copies(RESOURCE.id, 12), ...copies(ALLY.id, 4)],
    });
    expect(start.firstPlayerId).toBe(p1);
    // Round 1: both heroes take their turn, then the villain phase deals each player a copy of the side scheme.
    const round2 = settle(
      runWith(
        deps,
        start,
        { type: "changeForm", playerId: p1 },
        { type: "endTurn", playerId: p1 },
        { type: "changeForm", playerId: p2 },
        { type: "endTurn", playerId: p2 },
      ),
      undefined,
      deps,
    );
    // The first player token passed at the end of the villain phase, so p2 is now the first player and goes first.
    expect(round2.firstPlayerId).toBe(p2);
    const afterP2 = settle(runWith(deps, round2, { type: "endTurn", playerId: p2 }), undefined, deps);
    const scheme = afterP2.villainArea.find((id) => afterP2.instances[id]?.cardId === REVENGE.id) as InstanceId;
    const p1Identity = mustPlayer(afterP2, p1).identity.instanceId;
    const damageBefore = damageOn(afterP2, p1Identity);
    // p1 defeats the scheme while p2 holds the first player token: the damage must follow p1.
    const after = settle(
      runWith(deps, afterP2, { type: "basicThwart", playerId: p1, thwarterInstanceId: p1Identity, schemeInstanceId: scheme }),
      undefined,
      deps,
    );
    expect(damageOn(after, p1Identity) - damageBefore).toBe(1);
    expect(damageOn(after, mustPlayer(after, p2).identity.instanceId)).toBe(damageOn(afterP2, mustPlayer(afterP2, p2).identity.instanceId));
  });
});

// ---- §3.13.8 a limit counted per aspect --------------------------------------------------------------------------------

describe("§3.13 `AbilityLimit.per`: 'limit once per round for each aspect'", () => {
  const CORE_ASPECTS = ["aggression", "justice", "leadership", "protection"] as const;
  const agilityAbility = stubAbility("agility.interrupt", def({
    // "Interrupt: When you play an aspect card, … (limit once per round for each aspect.)" (Superhuman Agility 04031a)
    trigger: { kind: "interrupt", forced: true, on: { on: "cardBeingPlayed", sourceIs: { anyAspect: CORE_ASPECTS } } },
    limit: { count: 1, period: "round", per: "aspectOfEventCard" },
    effects: [{ kind: "addCounters", target: { kind: "identityOf", player: { kind: "controller" } }, counterType: "agility", amount: { kind: "const", value: 1 } }],
  }));
  const JESSICA = stubIdentity({
    id: "jessica",
    hp: 12,
    atk: 2,
    thw: 2,
    def: 2,
    rec: 3,
    heroHandSize: 6,
    alterEgoHandSize: 6,
    heroAbilities: [agilityAbility.ref],
  });
  const inert = (id: string) => stubAbility(`${id}.action`, def({ trigger: { kind: "action", form: "hero" }, effects: [] }));
  const aggro1 = inert("aggro1");
  const AGGRO1 = stubEvent({ id: "aggro1", cost: 0, aspect: "aggression", abilities: [aggro1.ref] });
  const aggro2 = inert("aggro2");
  const AGGRO2 = stubEvent({ id: "aggro2", cost: 0, aspect: "aggression", abilities: [aggro2.ref] });
  const justice1 = inert("justice1");
  const JUSTICE1 = stubEvent({ id: "justice1", cost: 0, aspect: "justice", abilities: [justice1.ref] });

  const countersAfter = (...cards: readonly CardId[]) => {
    const deps = depsOf(agilityAbility, aggro1, aggro2, justice1);
    const base = newGame({
      identity: JESSICA,
      deps,
      extraCards: [AGGRO1, AGGRO2, JUSTICE1],
      deck: [...copies(RESOURCE.id, 8), ...copies(AGGRO1.id), ...copies(AGGRO2.id), ...copies(JUSTICE1.id)],
    });
    let current = runWith(deps, base, toHero);
    for (const card of cards) {
      const given = giveCards(current, p1, card);
      current = settle(runWith(deps, given.state, play(given.ids[0] as InstanceId)), undefined, deps);
    }
    return mustInstance(current, identityOf(current)).counters.agility ?? 0;
  };

  it("keeps one count per aspect, so a second card of the same aspect is blocked and another aspect is not", () => {
    expect(countersAfter(AGGRO1.id)).toBe(1);
    expect(countersAfter(AGGRO1.id, AGGRO2.id)).toBe(1);
    expect(countersAfter(AGGRO1.id, JUSTICE1.id)).toBe(2);
  });
});

// ---- §3.13.9 a string field on the triggering event -------------------------------------------------------------------

describe("§3.13 `EventPattern.eventIs`: 'after a player changes to hero form'", () => {
  const watcherAbility = stubAbility("watcher.response", def({
    // A *villain* ability reacting to any player, with no `playerIs` scoping; "they" is `eventPlayer`.
    trigger: { kind: "response", forced: true, on: { on: "formChanged", eventIs: { to: "hero" } } },
    effects: [{ kind: "dealDamage", target: { kind: "identityOf", player: { kind: "eventPlayer" } }, amount: { kind: "const", value: 1 } }],
  }));

  it("matches only the form change the pattern names, for any player", () => {
    // ATK 0 so the villain phase between the two form changes adds no damage of its own.
    const villain = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0, abilities: [watcherAbility.ref] }] });
    const { deps, state } = setup({ abilities: [watcherAbility], villain });
    const hero = settle(runWith(deps, state, toHero), undefined, deps);
    expect(damageOn(hero, identityOf(hero))).toBe(1);
    // Next round, changing back to alter-ego carries `to: "alterEgo"` and does not match.
    const round2 = settle(runWith(deps, hero, endTurn), undefined, deps);
    const back = settle(runWith(deps, round2, { type: "changeForm", playerId: p1 }), undefined, deps);
    expect(damageOn(back, identityOf(back))).toBe(1);
  });
});

// ---- §3.13.10 "when a card enters play" as an interrupt, and "each other" --------------------------------------------

describe("§3.13 an Interrupt on a card entering play, and `TargetQuery.excluding`", () => {
  it("runs before the entering card's own enter-play keywords, unlike a Response", () => {
    // The ability counts how many tough status cards the entering ally already has. As an interrupt that is 0
    // (toughness has not resolved yet); as a response it is 1.
    const countAbility = (kind: "interrupt" | "response") =>
      stubAbility(`watch.${kind}`, def({
        trigger: { kind, forced: true, on: { on: "cardEntersPlay", targetIs: { categories: ["ally"] } } },
        effects: [
          {
            kind: "addCounters",
            target: { kind: "identityOf", player: { kind: "controller" } },
            counterType: "seen",
            amount: { kind: "count", query: { categories: ["ally"], hasStatus: "tough" } },
          },
        ],
      }));
    const seen = (kind: "interrupt" | "response") => {
      const ability = countAbility(kind);
      const TOUGH_ALLY = stubAlly({ id: "tough-ally", cost: 0, atk: 1, thw: 1, hp: 3, keywords: [{ name: "toughness" }] });
      const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [ability.ref] });
      const deps = depsOf(ability);
      const base = newGame({
        deps,
        extraCards: [TOUGH_ALLY, WATCHER],
        deck: [...copies(RESOURCE.id, 8), ...copies(TOUGH_ALLY.id), ...copies(WATCHER.id)],
      });
      const hero = runWith(deps, base, toHero);
      const given = giveCards(hero, p1, WATCHER.id, TOUGH_ALLY.id);
      const [watcherId, allyId] = given.ids as [InstanceId, InstanceId];
      let current = settle(runWith(deps, given.state, play(watcherId)), undefined, deps);
      current = settle(runWith(deps, current, play(allyId)), undefined, deps);
      return mustInstance(current, identityOf(current)).counters.seen ?? 0;
    };
    expect(seen("interrupt")).toBe(0);
    expect(seen("response")).toBe(1);
  });

  it("`excluding` leaves the triggering card out of 'each other card in play'", () => {
    // "Forced Interrupt: When an environment enters play, discard each other environment card in play."
    const purgeAbility = stubAbility("purge.interrupt", def({
      trigger: { kind: "interrupt", forced: true, on: { on: "cardEntersPlay", targetIs: { categories: ["environment"] } } },
      effects: [{ kind: "discardFromPlay", target: { kind: "each", query: { categories: ["environment"], excluding: { kind: "eventTarget" } } } }],
    }));
    const FIELD = stubEnvironment({ id: "field", abilities: [] });
    const SCHEME_STAGE = stubMainScheme({
      id: "purge-scheme",
      stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0), abilities: [purgeAbility.ref] }],
    });
    const deps = depsOf(purgeAbility);
    const state = newGame({
      villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] }),
      mainScheme: SCHEME_STAGE,
      extraCards: [BLANK, FIELD],
      deck: [...copies(RESOURCE.id, 12)],
      encounterDeck: copies(FIELD.id, 20),
      deps,
    });
    // Two villain phases reveal two environments; the second's entry discards the first, never itself.
    const round2 = settle(runWith(deps, state, toHero, endTurn), undefined, deps);
    const inPlayAfterOne = round2.villainArea.filter((id) => round2.instances[id]?.cardId === FIELD.id);
    expect(inPlayAfterOne).toHaveLength(1);
    const round3 = settle(runWith(deps, round2, endTurn), undefined, deps);
    expect(round3.villainArea.filter((id) => round3.instances[id]?.cardId === FIELD.id)).toHaveLength(1);
  });
});
