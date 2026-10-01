import { PLAYABLE_CARDS } from "@mc/content";
import {
  activeVillain,
  characterProfile,
  createGame,
  remainingHitPoints,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { buildCrossHeroDeck, playFromAnotherHerosDeck } from "../../testing/cross-hero.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  payWith,
  picking,
  play,
  playerOf,
  resourceAbility,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { PLAYABLE_DEPS, playableScenario } from "../../playable/index.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`): every aspect/basic Ms. Marvel pack card (`msm`,
 * 05012-05033, aspect not `hero:05001a`) that has its own ability script, played through the engine from a Core
 * hero's own deck instead of Ms. Marvel's precon. Proof no script quietly assumes "you" is Kamala Khan (RRG 1.8
 * "Identity-Specific Card", p. 23 is why the `hero:05001a` kit cards are out of scope: only her deck can hold them).
 *
 * Covered (11): 05012 Nova, 05014 Preemptive Strike, 05015 Tackle, 05017 Energy Barrier (Black Panther/Protection);
 * 05030 Melee (She-Hulk/Aggression); 05031 Concussive Blow, 05018 Lockjaw, 05023 Endurance, 05024 Enhanced Reflexes,
 * 05033 Down Time (Spider-Man/Justice); 05032 Morale Boost (Captain Marvel/Leadership).
 *
 * Skipped: 05013 Get Behind Me!, 05016 The Power of Protection, 05022 Avengers Mansion (verbatim Core reprints
 * aliased by `../reprints.ts`: 01078, 01079, 01091); 05019 Energy, 05020 Genius, 05021 Strength (reprints of
 * 01088-01090, empty `abilities`). 05025-05029 are obligation/nemesis encounter cards, not player cards.
 */

const buildScenario = (players: Parameters<typeof playableScenario>[1]["players"]) =>
  playableScenario("rhino", { seed: 11, players });

const game = { deps: PLAYABLE_DEPS, cards: PLAYABLE_CARDS, buildScenario };

const BP = "core-black-panther-protection";
const SHE_HULK = "core-she-hulk-aggression";
const SPIDER_MAN = "core-spider-man-justice";
const CAPTAIN_MARVEL = "core-captain-marvel-leadership";

/** Opening state with `cardCode` seated in `coreHeroId`'s deck and in hand (the helper's setup, minus its play). */
function openHandFor(cardCode: string, coreHeroId: string): { readonly state: GameState; readonly id: InstanceId } {
  const setup = buildCrossHeroDeck(PLAYABLE_CARDS, coreHeroId, cardCode);
  const created = createGame(playableScenario("rhino", { seed: 11, players: [setup] }), PLAYABLE_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
  const { state, ids } = moveToHand(opening, P1, cardCode);
  return { state, id: ids[0]! };
}

const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) =>
  runWith(PLAYABLE_DEPS, state, ...commands);
const settled = (state: GameState, pick: Picker = firstLegal) => settle(state, pick, undefined, PLAYABLE_DEPS);
/**
 * Ends the turn and settles the villain phase with the encounter deck stacked [boost card, Advance]: Advance (01186) has
 * no boost icons and its only effect is 1 threat, so the one attack under test is the villain's own, with `boost`
 * dealt to it (a stray second reveal, e.g. a treachery, would attack again and muddy the numbers).
 */
function villainPhase(state: GameState, boost: string, pick: Picker): GameState {
  return settled(run(stackEncounterDeck(state, boost, "01186"), endTurn()), pick);
}

/** Hero form, settling any form-change response (She-Hulk's "Do You Even Lift?" asks for a target). */
const toHeroFirst = (state: GameState): GameState => settled(run(state, toHero(P1)));
const villainOf = (state: GameState) => activeVillain(state).instanceId;
const profile = (state: GameState) => characterProfile(state, identityOf(state), PLAYABLE_DEPS)!;

describe("Ms. Marvel pack protection cards, from Black Panther (Protection)'s deck", () => {
  it("05012.nova-interrupt: when an enemy initiates an attack against you, spend an [energy] resource -> 2 damage to it", () => {
    const { state, cardInstanceId: nova } = playFromAnotherHerosDeck("05012", game, {
      coreHero: BP,
      setup: toHeroFirst,
    });
    expect(playerOf(state, P1).playArea).toContain(nova);
    const { state: withEnergy, ids } = moveToHand(state, P1, "01088"); // Energy: produces [energy]
    const energy = ids[0]!;
    const villain = villainOf(withEnergy);
    const hpBefore = remainingHitPoints(withEnergy, villain)!;
    const option = `${nova}:05012.nova-interrupt`;
    const after = villainPhase(withEnergy, "01186", (s) => {
      const prompt = s.pendingChoice?.prompt;
      if (prompt?.kind === "chooseTriggers") return picking(option)(s);
      if (prompt?.kind === "payForAbility" && prompt.instanceId === nova) return [`hand:${energy}`];
      return firstLegal(s);
    });
    // Nova's 2, plus 1 from Black Panther's own printed Retaliate 1 (01040b) after Rhino attacks him.
    expect(remainingHitPoints(after, villain)).toBe(hpBefore - 2 - 1);
    expect(playerOf(after, P1).discard).toContain(energy); // the [energy] resource was spent
  });

  it("05014.preemptive-strike-interrupt: cancels a boost card's icons, then 1 damage to the villain per icon", () => {
    const { state: opened, id: strike } = openHandFor("05014", BP);
    const hero = toHeroFirst(opened);
    const villain = villainOf(hero);
    const hpBefore = remainingHitPoints(hero, villain)!;
    const primed = hero;
    const option = `${strike}:05014.preemptive-strike-interrupt`;
    let used = false;
    const after = villainPhase(primed, "01106", (s) => {
      const prompt = s.pendingChoice?.prompt;
      if (s.pendingChoice?.options.some((o) => o.optionId === option)) {
        used = true;
        return [option];
      }
      if (prompt?.kind === "payForCard" && prompt.instanceId === strike) {
        return s
          .pendingChoice!.options.filter((o) => o.optionId !== `hand:${strike}`)
          .slice(0, 1)
          .map((o) => o.optionId);
      }
      if (prompt?.kind === "discardDownToHandSize") {
        const spare = s.pendingChoice!.options.filter((o) => o.optionId !== strike);
        return spare.slice(0, s.pendingChoice!.minSelections).map((o) => o.optionId);
      }
      return firstLegal(s);
    });
    expect(used).toBe(true);
    expect(playerOf(after, P1).discard).toContain(strike);
    // Preemptive Strike's 1 (one cancelled icon), plus Black Panther's Retaliate 1.
    expect(remainingHitPoints(after, villain)).toBe(hpBefore - 1 - 1);
  });

  it("05015.tackle-action: stuns an enemy, and 3 damage if paid with a [physical] resource", () => {
    const { state: opened, id: tackle } = openHandFor("05015", BP);
    const given = moveToHand(toHeroFirst(opened), P1, "01090"); // Strength: [physical]
    const strength = given.ids[0]!;
    const villain = villainOf(given.state);
    const hpBefore = remainingHitPoints(given.state, villain)!;
    const payment = [strength, ...payWith(given.state, P1, 2, [tackle, strength])];
    const after = settled(run(given.state, play(P1, tackle, payment)));
    expect(after.instances[villain]?.statuses.stunned).toBeGreaterThan(0);
    expect(remainingHitPoints(after, villain)).toBe(hpBefore - 3);
  });

  it("05017.energy-barrier-interrupt: prevents 1 damage to you and deals 1 to an enemy, spending a reflection counter", () => {
    const { state, cardInstanceId: barrier } = playFromAnotherHerosDeck("05017", game, {
      coreHero: BP,
      setup: toHeroFirst,
    });
    expect(inst(state, barrier).counters.reflection).toBe(3);
    const villain = villainOf(state);
    const hpBefore = remainingHitPoints(state, villain)!;
    const option = `${barrier}:05017.energy-barrier-interrupt`;
    const damageBefore = inst(state, identityOf(state)).damage;
    let used = false;
    const after = villainPhase(state, "01186", (s) => {
      if (!used && s.pendingChoice?.options.some((o) => o.optionId === option)) {
        used = true; // once: Rhino's 2 damage would otherwise offer it a second time
        return [option];
      }
      return firstLegal(s);
    });
    expect(inst(after, barrier).counters.reflection).toBe(2);
    expect(inst(after, identityOf(after)).damage).toBe(damageBefore + 1); // Rhino's 2 damage, 1 prevented
    // Energy Barrier's 1, plus Black Panther's Retaliate 1 (01040b) after Rhino attacks him.
    expect(remainingHitPoints(after, villain)).toBe(hpBefore - 1 - 1);
  });
});

describe("Ms. Marvel pack cards, from She-Hulk (Aggression)'s deck", () => {
  it("05030.melee-action: 3 damage to an enemy, then 3 damage to another enemy", () => {
    const { state: opened, id: melee } = openHandFor("05030", SHE_HULK);
    const hero = toHeroFirst(opened);
    // A minion engaged with the hero as the "another enemy" (any minion in the encounter deck).
    const minion = Object.values(hero.instances).find(
      (i) =>
        PLAYABLE_CARDS.find((c) => c.id === i.cardId)?.type === "minion" &&
        Object.values(hero.encounterDecks).some((pile) => pile.deck.includes(i.instanceId)),
    );
    if (!minion) throw new Error("no minion in Rhino's encounter deck");
    const engaged: GameState = {
      ...hero,
      encounterDecks: Object.fromEntries(
        Object.entries(hero.encounterDecks).map(([k, v]) => [
          k,
          { ...v, deck: v.deck.filter((x) => x !== minion.instanceId) },
        ]),
      ),
      players: hero.players.map((p) =>
        p.playerId === P1 ? { ...p, playArea: [...p.playArea, minion.instanceId] } : p,
      ),
      instances: {
        ...hero.instances,
        [minion.instanceId]: { ...minion, faceup: true, engagedWith: P1, controllerId: null },
      },
    };
    const villain = villainOf(engaged);
    const villainBefore = inst(engaged, villain).damage;
    const after = settled(run(engaged, play(P1, melee, payWith(engaged, P1, 3, [melee]))));
    expect(inst(after, villain).damage - villainBefore).toBe(3);
    const minionGone = !playerOf(after, P1).playArea.includes(minion.instanceId);
    expect(minionGone || inst(after, minion.instanceId).damage >= 3).toBe(true);
  });
});

describe("Ms. Marvel pack cards, from Spider-Man (Justice)'s deck", () => {
  it("05031.concussive-blow-action: confuses an enemy, and 3 damage if paid with a [physical] resource", () => {
    const { state: opened, id: blow } = openHandFor("05031", SPIDER_MAN);
    const given = moveToHand(toHeroFirst(opened), P1, "01090"); // Strength: [physical]
    const strength = given.ids[0]!;
    const villain = villainOf(given.state);
    const hpBefore = remainingHitPoints(given.state, villain)!;
    const payment = [strength, ...payWith(given.state, P1, 2, [blow, strength])];
    const after = settled(run(given.state, play(P1, blow, payment)));
    expect(after.instances[villain]?.statuses.confused).toBeGreaterThan(0);
    expect(remainingHitPoints(after, villain)).toBe(hpBefore - 3);
  });

  it("05018.lockjaw-constant: may be played from the discard pile during your turn", () => {
    const { state: opened, id: lockjaw } = openHandFor("05018", SPIDER_MAN);
    const inDiscard: GameState = {
      ...opened,
      players: opened.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== lockjaw), discard: [...p.discard, lockjaw] } : p,
      ),
    };
    const hero = toHeroFirst(inDiscard);
    const after = settled(run(hero, play(P1, lockjaw, payWith(hero, P1, 4, [lockjaw]))));
    expect(playerOf(after, P1).playArea).toContain(lockjaw);
    expect(playerOf(after, P1).discard).not.toContain(lockjaw);
  });

  it("05023.endurance-constant: your identity gets +3 hit points", () => {
    const { state, id: endurance } = openHandFor("05023", SPIDER_MAN);
    const before = profile(state).maxHp;
    const after = settled(run(state, play(P1, endurance, payWith(state, P1, 1, [endurance]))));
    expect(playerOf(after, P1).playArea.concat(inst(after, identityOf(after)).attachments ?? [])).toContain(endurance);
    expect(profile(after).maxHp).toBe(before + 3);
  });

  it("05024.enhanced-reflexes-resource: exhaust + remove an energy counter -> an [energy] resource paying for a card", () => {
    const { state, cardInstanceId: reflexes } = playFromAnotherHerosDeck("05024", game, {
      coreHero: SPIDER_MAN,
      setup: toHeroFirst,
    });
    expect(inst(state, reflexes).counters.energy).toBe(3);
    const given = moveToHand(state, P1, "01008"); // Web-Shooter, cost 1, paid only by the resource ability
    const webShooter = given.ids[0]!;
    const after = settled(
      run(
        given.state,
        play(P1, webShooter, [], { abilities: [resourceAbility(reflexes, "05024.enhanced-reflexes-resource")] }),
      ),
    );
    expect(inst(after, identityOf(after)).attachments ?? []).toContain(webShooter);
    expect(inst(after, reflexes).counters.energy).toBe(2);
    expect(inst(after, reflexes).exhausted).toBe(true);
  });

  it("05033.down-time-constant: your alter-ego gets +2 REC", () => {
    const { state, id: downTime } = openHandFor("05033", SPIDER_MAN); // opening form is alter-ego
    const before = profile(state).rec;
    const after = settled(run(state, play(P1, downTime, payWith(state, P1, 1, [downTime]))));
    expect(profile(after).rec).toBe(before + 2);
  });
});

describe("Ms. Marvel pack cards, from Captain Marvel (Leadership)'s deck", () => {
  it("05032.morale-boost-action: the chosen hero gets +1 THW, +1 ATK and +1 DEF until end of round", () => {
    const { state: opened, id: boost } = openHandFor("05032", CAPTAIN_MARVEL);
    const hero = toHeroFirst(opened);
    const before = profile(hero);
    const after = settled(run(hero, play(P1, boost, payWith(hero, P1, 1, [boost]))));
    const now = profile(after);
    expect(now.thw).toBe(before.thw + 1);
    expect(now.atk).toBe(before.atk + 1);
    expect(now.def).toBe(before.def + 1);
  });
});
