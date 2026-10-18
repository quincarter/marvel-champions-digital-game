/**
 * "Attacks against attached minion deal 2 additional damage and gain overkill." (Cruisin' for a Bruisin' 62009;
 * docs/phase7-wave11-hero-packs.md §H3.15): `RuleSpec attackKeywords.target` (a keyword attacks gain against the
 * attacked character, the mirror of `attacksLoseKeywords.target`) and `RuleSpec attacksDealExtraDamage` (a constant
 * extra damage for attacks against a matching character, added as `modifyAttack.extraDamage` is). RRG 1.8 "Overkill"
 * (p. 31): excess damage from an attack that defeats a minion is dealt to the villain. Synthetic cards only.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { attackKeywordsOf } from "./keywords.js";
import { mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubAttachment, stubEvent, stubMainScheme, stubMinion, stubVillain } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playFree } from "./testing/wave3.js";

const HOST: TargetQuery = { hostOfSelf: true };
const constant = (id: string, part: Omit<Extract<AbilityDefinition["trigger"], { kind: "constant" }>, "kind">) =>
  stubAbility(`${id}.constant`, { trigger: { kind: "constant", ...part }, effects: [] });

/** "Attacks against attached minion deal 2 additional damage and gain overkill." */
const CRUISER_CONSTANT = constant("cruiser", {
  rules: [
    { kind: "attackKeywords", keywords: ["overkill"], target: HOST },
    { kind: "attacksDealExtraDamage", amount: 2, target: HOST },
  ],
});
const CRUISER = stubAttachment({ id: "cruiser", abilities: [CRUISER_CONSTANT.ref] });
/** "Hero Action (attack): Deal 3 damage to the villain." */
const LANCE_ACTION = stubAbility("lance.action", {
  trigger: { kind: "action" },
  label: ["attack"],
  effects: [{ kind: "attack", target: { kind: "villain" }, amount: { kind: "const", value: 3 } }],
});
const LANCE = stubEvent({ id: "lance", cost: 0, abilities: [LANCE_ACTION.ref] });
const minions: TargetRef = { kind: "each", query: { categories: ["minion"] } };
const dealTo = (target: TargetRef, n: number, additional = false): EffectSpec => ({
  kind: "dealDamage",
  target,
  amount: { kind: "const", value: n },
  ...(additional ? { additional: true } : {}),
});
/** A label-only attack with a rider: "(attack): Deal 2 damage to each minion. … deal 1 additional damage to it." */
const VOLLEY_ACTION = stubAbility("volley.action", {
  trigger: { kind: "action" },
  label: ["attack"],
  effects: [dealTo(minions, 2), dealTo(minions, 1, true)],
});
const VOLLEY = stubEvent({ id: "volley", cost: 0, abilities: [VOLLEY_ACTION.ref] });
/** "The smasher attacks the filler." (an enemy attacking another enemy, Moondragon's shape) */
const SET_ON_ACTION = stubAbility("set-on.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "enemyAttacksEnemy",
      attacker: { kind: "each", query: { name: "smasher" } },
      target: { kind: "each", query: { name: "filler" } },
      bind: "hit",
    },
  ],
});
const SET_ON = stubEvent({ id: "set-on", cost: 0, abilities: [SET_ON_ACTION.ref] });

const VILLAIN = stubVillain({ id: "plain", stages: [{ hp: flat(30), atk: 2, sch: 0 }] });
const SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const BRUTE = stubMinion({ id: "brute", atk: 0, sch: 0, hp: 3, boostIcons: 0 });
const FILLER = stubMinion({ id: "filler", atk: 0, sch: 0, hp: 9, boostIcons: 0 });
const SMASHER = stubMinion({ id: "smasher", atk: 2, sch: 0, hp: 9, boostIcons: 0 });

const deps: EngineDeps = depsOf(CRUISER_CONSTANT, LANCE_ACTION, VOLLEY_ACTION, SET_ON_ACTION);

const heroOf = (state: GameState) => mustPlayer(state, P1).identity.instanceId;
const villainOf = (state: GameState) => state.villains[0]!.instanceId;
const damageOn = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;
const basicAttack = (state: GameState, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: heroOf(state),
  targetInstanceId: target,
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

/** P1 in hero form (ATK 2) with a 3-hit-point minion engaged. */
function table(): { readonly state: GameState; readonly brute: InstanceId } {
  const state = gameAtFirstTurn({
    cards: [CRUISER, LANCE, VOLLEY, SET_ON, BRUTE, FILLER, SMASHER],
    deps,
    villain: VILLAIN,
    mainScheme: SCHEME,
    encounter: [CRUISER.id, BRUTE.id, SMASHER.id, ...copiesOf(FILLER.id, 12)],
    deck: [LANCE.id, VOLLEY.id, SET_ON.id],
  });
  const hero = runCommands(state, deps, { type: "changeForm", playerId: P1 }).state;
  const brute = minionEngagedWith(hero, BRUTE.id);
  return { state: brute.state, brute: brute.id };
}

describe("docs/phase7-wave11-hero-packs.md §H3.15: attacks against a character deal extra damage and gain a keyword", () => {
  it("the control: a basic attack 2 on the 3-hit-point minion deals 2, and it stays in play", () => {
    const { state, brute } = table();
    const run = runCommands(state, deps, basicAttack(state, brute));
    expect(damageOn(run.state, brute)).toBe(2);
    expect(damageOn(run.state, villainOf(run.state))).toBe(0);
  });

  it("with the attachment: 4 dealt, the minion is defeated and 1 spills to the villain (overkill)", () => {
    const { state: base, brute } = table();
    const state = attach(base, CRUISER.id, brute);
    const run = runCommands(state, deps, basicAttack(state, brute));
    expect(cardsInPlay(run.state)).not.toContain(brute);
    expect(damageOn(run.state, villainOf(run.state))).toBe(1);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.state);
  });

  it("only against that character: the same basic attack on another minion deals 2 and has no overkill", () => {
    const { state: base, brute } = table();
    const other = minionEngagedWith(attach(base, CRUISER.id, brute), FILLER.id);
    const run = runCommands(other.state, deps, basicAttack(other.state, other.id));
    expect(damageOn(run.state, other.id)).toBe(2);
    expect(damageOn(run.state, brute)).toBe(0);
    expect(
      attackKeywordsOf(run.state, deps, { attackerInstanceId: heroOf(run.state), targetInstanceId: other.id }),
    ).toEqual([]);
  });

  it("an attack made by a card's ability: 3 + 2 dealt to the villain the attachment is on", () => {
    const { state: base } = table();
    const control = giveCard(base, P1, LANCE.id);
    const play = (state: GameState, id: InstanceId): Command => ({
      type: "playCard",
      playerId: P1,
      cardInstanceId: id,
      payment: [],
      attachToInstanceId: null,
    });
    expect(damageOn(runCommands(control.state, deps, play(control.state, control.id)).state, villainOf(base))).toBe(3);
    const given = giveCard(attach(base, CRUISER.id, villainOf(base)), P1, LANCE.id);
    const run = runCommands(given.state, deps, play(given.state, given.id));
    expect(damageOn(run.state, villainOf(run.state))).toBe(5);
  });

  it("a label-only (attack) ability's damage instruction: +2 once on the attached minion, the additional damage not raised", () => {
    const { state: base, brute } = table();
    // Every minion is dealt the volley: the filler (9 hit points) carries the attachment, and the unattached brute
    // (3) takes 2 + 1 and is defeated either way.
    const filler = minionEngagedWith(base, FILLER.id);
    const control = playFree(filler.state, deps, VOLLEY.id);
    expect(damageOn(control.state, filler.id)).toBe(3);
    const run = playFree(attach(filler.state, CRUISER.id, filler.id), deps, VOLLEY.id);
    expect(damageOn(run.state, filler.id)).toBe(5);
    expect(cardsInPlay(run.state)).not.toContain(brute);
  });

  it("an enemy's attack on another enemy: the smasher's 2 ATK deals 4 to the attached filler", () => {
    const { state: base } = table();
    const smasher = minionEngagedWith(base, SMASHER.id);
    const filler = minionEngagedWith(smasher.state, FILLER.id);
    const control = playFree(filler.state, deps, SET_ON.id);
    expect(damageOn(control.state, filler.id)).toBe(2);
    const run = playFree(attach(filler.state, CRUISER.id, filler.id), deps, SET_ON.id);
    expect(damageOn(run.state, filler.id)).toBe(4);
    expect(damageOn(run.state, smasher.id)).toBe(0);
  });

  it("`attackKeywordsOf` adds a target-scoped keyword only when it is given that character", () => {
    const { state: base, brute } = table();
    const state = attach(base, CRUISER.id, brute);
    const attack = { attackerInstanceId: heroOf(state), basic: true };
    expect(attackKeywordsOf(state, deps, attack)).toEqual([]);
    expect(attackKeywordsOf(state, deps, { ...attack, targetInstanceId: brute })).toEqual(["overkill"]);
  });

  it("not read for an enemy's attack on a hero (62009 only attaches to minions): the villain's 2 ATK deals 2", () => {
    const { state: base } = table();
    const state = attach(base, CRUISER.id, heroOf(base));
    const run = runCommands(state, deps, { type: "endTurn", playerId: P1 });
    expect(damageOn(run.state, heroOf(run.state))).toBe(2);
  });
});
