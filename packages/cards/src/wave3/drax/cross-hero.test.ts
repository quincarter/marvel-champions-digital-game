import { PLAYABLE_CARDS, type AnyCard } from "@mc/content";
import {
  activeEncounterDeck,
  activeVillain,
  applyCommand,
  characterProfile,
  cardsInPlay,
  createGame,
  type GameState,
  type InstanceId,
  type PlayerSetup,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "../../playable/index.js";
import { buildCrossHeroDeck } from "../../testing/cross-hero.js";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { WAVE3_DEPS } from "../index.js";
import { playFromHand, startWave3Game } from "../testing.js";
import { draxScenario, engageMinion } from "./support.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, "Cards in another hero's deck"): every Drax pack
 * (`drax`, 19001a-19033) aspect/basic player card that has an ability script — every one whose own `aspect` is not
 * `hero:19001a` (an identity-specific card, RRG 1.8 "Identity-Specific Card", p. 23, only a Drax deck could hold) —
 * played through the engine from a Core hero's own precon instead of Drax's.
 *
 * Covered: protection 19012 Martyr, 19013 Moondragon, 19015 Deflection, 19016 Hard Knocks, 19017 Leading Blow,
 * 19018 Subdue (Black Panther); aggression 19030 "Bring It!" (She-Hulk); leadership 19032 Regroup (both abilities,
 * Captain Marvel); refused for the guardian gate no Core identity meets (`requiresIdentityTrait`, every Core hero
 * face is Avenger/Soldier/..., none Guardian): 19020 Gamora (basic) and 19031 "Think Fast!" (justice, Spider-Man).
 * Mantis (19002) is Drax's own signature ally (`hero:19001a`, so no Core deck may hold it): asserted refused in a
 * Core deck, and exercised from the Drax stand-in deck to prove its printed plain "Action:" is usable in alter-ego
 * form (it was recently changed from a Hero Action).
 * Skipped: verbatim reprints aliased in `../reprints.ts` — 19014 Counter-Punch (01077), 19019 Indomitable (01082),
 * 19021 Athletic Conditioning (13034), 19033 Enhanced Physique (06034); 19022-19024 Energy, Genius, Strength (no
 * ability script); 19025-19029 are the obligation/nemesis/encounter cards, not player aspect cards. No Drax pack
 * card is a Team-Up card (RRG 1.8 "Team-Up", p. 43), so there is no Team-Up refusal to assert. The pack prints no
 * non-reprint "Response: after you attack" event, so that form check has no card here.
 *
 * Every Core hero face has the Avenger trait and none has Guardian.
 */

const buildScenario = (players: readonly PlayerSetup[]) =>
  playableScenario("rhino", { seed: 11, players: players as never });

const BY_ID = new Map<string, AnyCard>(PLAYABLE_CARDS.map((c) => [c.id as string, c]));
const cardOf = (state: GameState, id: InstanceId): AnyCard => BY_ID.get(state.instances[id]!.cardId as string)!;
const costOf = (code: string): number => {
  const card = BY_ID.get(code)!;
  return "cost" in card && typeof card.cost === "number" ? card.cost : 0;
};

const SHE_HULK = "core-she-hulk-aggression";
const SPIDER_MAN = "core-spider-man-justice";
const CAP_MARVEL = "core-captain-marvel-leadership";
const BLACK_PANTHER = "core-black-panther-protection";
const SHOCKER = "01103"; // ATK 2, HP 3, no keywords

const toHeroFirst = (state: GameState): GameState =>
  settle(runWith(PLAYABLE_DEPS, state, toHero(P1)), firstLegal, undefined, PLAYABLE_DEPS);

interface OpenOptions {
  readonly alterEgo?: boolean;
  /** Extra copies of other cards to seat in the deck (legal in the hero's aspect). */
  readonly extraDeck?: readonly string[];
}

/** Opening state with `code` in P1's hand, seated in `coreHero`'s own precon (`buildCrossHeroDeck`). */
function openHandFor(
  code: string,
  coreHero: string,
  options: OpenOptions = {},
): { readonly state: GameState; readonly id: InstanceId } {
  const seat = buildCrossHeroDeck(PLAYABLE_CARDS, coreHero, code);
  const seated: PlayerSetup = options.extraDeck
    ? { ...seat, deck: [...seat.deck, ...options.extraDeck.map((c) => c as never)] }
    : seat;
  const created = createGame(buildScenario([seated]), PLAYABLE_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
  const ready = options.alterEgo ? opening : toHeroFirst(opening);
  const { state, ids } = moveToHand(ready, P1, code);
  return { state, id: ids[0]! };
}

const singleIcon = (card: AnyCard): boolean =>
  "resourceIcons" in card && Object.values(card.resourceIcons).reduce((a, b) => a + (b ?? 0), 0) === 1;

/** Moves `n` single-icon non-resource cards into P1's hand (never `exclude`) and returns their ids — single-value
 * payment cards, so a payment's size is exactly its value (docs/phase7-wave1-scripting.md "Test conventions"). */
function filler(
  state: GameState,
  n: number,
  exclude: readonly InstanceId[] = [],
): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  const owner = playerOf(state, P1);
  const codes: string[] = [];
  const seen = new Set<InstanceId>(exclude);
  for (const id of [...owner.hand, ...owner.deck]) {
    if (codes.length >= n) break;
    const card = cardOf(state, id);
    if (seen.has(id) || card.type === "resource" || !singleIcon(card)) continue;
    seen.add(id);
    codes.push(card.id as string);
  }
  if (codes.length < n) throw new Error(`only ${codes.length} filler cards found`);
  const probe = moveToHand(state, P1, ...codes);
  const ids = probe.ids.filter((id) => !exclude.includes(id));
  return { state: probe.state, ids };
}

/** Accepts the named optional response/interrupt (by ability id), pays a `payForCard` prompt with whatever hand
 * cards it offers up to the printed cost, and declines everything else. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "payForCard") {
      return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
    }
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Picks `target` at a `chooseTarget` prompt, `firstLegal` otherwise. */
const targeting =
  (target: string, base: Picker = firstLegal): Picker =>
  (state) =>
    state.pendingChoice?.prompt.kind === "chooseTarget" ? [target] : base(state);

const playCard = (
  state: GameState,
  id: InstanceId,
  payment: readonly InstanceId[],
  pick: Picker = firstLegal,
  attachTo?: InstanceId,
): GameState =>
  settle(
    runWith(PLAYABLE_DEPS, state, play(P1, id, payment, attachTo ? { attachToInstanceId: attachTo } : {})),
    pick,
    undefined,
    PLAYABLE_DEPS,
  );

/** Moves `code` to hand and plays it, paying its printed cost with single-icon fillers. */
function playCode(state: GameState, code: string, exclude: readonly InstanceId[] = [], pick: Picker = firstLegal) {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as readonly [InstanceId];
  const pay = filler(given.state, costOf(code), [...exclude, id]);
  return { state: playCard(pay.state, id, pay.ids, pick), id };
}

const basicAttack = (state: GameState, attacker: InstanceId, target: InstanceId, pick: Picker = firstLegal) =>
  settle(
    runWith(PLAYABLE_DEPS, state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: attacker,
      targetInstanceId: target,
    }),
    pick,
    undefined,
    PLAYABLE_DEPS,
  );

/** Ends P1's turn so the villain phase attacks P1 (an Advance, no boost icons, stacked so the boost card cannot change
 * the damage; `boostCode` overrides it). `defender` null leaves the attack undefended. `initiate` answers the prompts at attack initiation; `defend` those after `defender` is declared. */
function villainAttack(
  state: GameState,
  defender: InstanceId | null,
  initiate: Picker = firstLegal,
  defend: Picker = firstLegal,
  boostCode = "01186",
): GameState {
  const stacked = stackEncounterDeck(state, boostCode);
  const atDefend = settle(
    runWith(PLAYABLE_DEPS, stacked, endTurn(P1)),
    initiate,
    (s) => s.pendingChoice?.prompt.kind === "declareDefender",
    PLAYABLE_DEPS,
  );
  return settle(answer(atDefend, defender ? [defender] : ["decline"], PLAYABLE_DEPS), defend, undefined, PLAYABLE_DEPS);
}

describe("Drax protection cards, from Black Panther (Protection)'s own deck", () => {
  it("19012.martyr-response: after her consequential damage from an attack that defeated an enemy, she gets a tough status card", () => {
    const { state: opened, id: martyr } = openHandFor("19012", BLACK_PANTHER);
    const pay = filler(opened, costOf("19012"), [martyr]);
    const inPlay = playCard(pay.state, martyr, pay.ids);
    expect(cardsInPlay(inPlay)).toContain(martyr);
    const villain = activeVillain(inPlay).instanceId;
    const atk = characterProfile(inPlay, martyr, PLAYABLE_DEPS)!.atk;
    const maxHp = characterProfile(inPlay, villain, PLAYABLE_DEPS)!.maxHp;
    const primed = patchInstance(inPlay, villain, { damage: maxHp - atk });
    const after = basicAttack(primed, martyr, villain, accepting("19012.martyr-response"));
    expect(activeVillain(after).stageIndex).toBe(1); // Rhino I was defeated by her attack
    expect(inst(after, martyr).statuses.tough).toBeGreaterThanOrEqual(1);
    // Control: an attack that defeats nothing gives no tough card.
    const control = basicAttack(inPlay, martyr, villain, accepting("19012.martyr-response"));
    expect(activeVillain(control).stageIndex).toBe(0);
    expect(inst(control, martyr).statuses.tough).toBe(0);
  });

  it("19013.moondragon-action: a plain Action, usable in alter-ego form; exhaust + discard her → a minion attacks another enemy", () => {
    const { state: opened, id: moondragon } = openHandFor("19013", BLACK_PANTHER, { alterEgo: true });
    expect(playerOf(opened, P1).identity.form).toBe("alterEgo");
    const pay = filler(opened, costOf("19013"), [moondragon]);
    const inPlay = playCard(pay.state, moondragon, pay.ids);
    expect(cardsInPlay(inPlay)).toContain(moondragon);
    const staged = engageMinion(inPlay, SHOCKER, "md-shocker");
    const villain = activeVillain(staged).instanceId;
    const atk = characterProfile(staged, "md-shocker" as InstanceId, PLAYABLE_DEPS)!.atk;
    const picker: Picker = (s) => {
      const prompt = s.pendingChoice?.prompt;
      if (prompt?.kind === "chooseTarget" && prompt.slot === "attacker") return ["md-shocker"];
      if (prompt?.kind === "chooseTarget" && prompt.slot === "attacked") return [villain as string];
      return firstLegal(s);
    };
    const after = settle(
      runWith(PLAYABLE_DEPS, staged, use(P1, moondragon, "19013.moondragon-action")),
      picker,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(after, villain).damage).toBe(inst(staged, villain).damage + atk);
    expect(playerOf(after, P1).discard).toContain(moondragon);
  });

  it("19015.deflection-interrupt: an identity taking attack damage prevents up to 5 of it and discards that many cards from the deck", () => {
    const { state: opened, id: deflection } = openHandFor("19015", BLACK_PANTHER);
    const hero = identityOf(opened);
    // Undefended, so the hero's own DEF does not reduce the damage (RRG 1.8 "Defend, Defense", p. 15): Rhino ATK 2 + Bomb
    // Scare's 2 boost icons.
    const control = villainAttack(opened, null, firstLegal, firstLegal, "01109");
    const taken = inst(control, hero).damage;
    expect(taken).toBeGreaterThan(0);
    const prevented = Math.min(5, taken);
    const after = villainAttack(opened, null, firstLegal, accepting("19015.deflection-interrupt"), "01109");
    expect(inst(after, hero).damage).toBe(taken - prevented);
    expect(playerOf(after, P1).discard).toContain(deflection);
    // The event itself, its cost-2 payment, and one deck card per damage prevented are all in the discard pile.
    expect(playerOf(after, P1).discard.length).toBe(playerOf(control, P1).discard.length + 1 + 2 + prevented);
  });

  it("19016.hard-knocks-action: Hero Action, 4 damage to an enemy; your hero gets tough if it defeats the enemy", () => {
    const { state: opened, id } = openHandFor("19016", BLACK_PANTHER);
    const villain = activeVillain(opened).instanceId;
    const pay = filler(opened, costOf("19016"), [id]);
    const hit = playCard(pay.state, id, pay.ids, targeting(villain as string));
    expect(inst(hit, villain).damage).toBe(inst(opened, villain).damage + 4);
    expect(inst(hit, identityOf(hit)).statuses.tough).toBe(0); // the villain survived
    // Defeating an enemy (a 3 HP minion) gives the hero a tough status card.
    const withMinion = engageMinion(pay.state, SHOCKER, "hk-shocker");
    const kill = playCard(withMinion, id, pay.ids, targeting("hk-shocker"));
    expect(playerOf(kill, P1).playArea).not.toContain("hk-shocker");
    expect(inst(kill, identityOf(kill)).statuses.tough).toBe(1);
  });

  it("19016.hard-knocks-action: a Hero Action card is refused in alter-ego form", () => {
    const { state, id } = openHandFor("19016", BLACK_PANTHER, { alterEgo: true });
    const pay = filler(state, costOf("19016"), [id]);
    expect(applyCommand(pay.state, play(P1, id, pay.ids), PLAYABLE_DEPS).ok).toBe(false);
  });

  it("19017.leading-blow-interrupt: on your basic attack, discard the top encounter card → -ATK by its boost icons; ready your hero if it still dealt damage", () => {
    const { state: opened } = openHandFor("19017", BLACK_PANTHER);
    const hero = identityOf(opened);
    const villain = activeVillain(opened).instanceId;
    const deck = activeEncounterDeck(opened);
    const boosted = [...deck.deck, ...deck.discard]
      .map((id) => cardOf(opened, id))
      .find((c) => "boostIcons" in c && c.boostIcons === 1);
    expect(boosted).toBeDefined();
    const stacked = stackEncounterDeck(opened, boosted!.id as string);
    const atk = characterProfile(stacked, hero, PLAYABLE_DEPS)!.atk;
    const control = basicAttack(stacked, hero, villain, firstLegal);
    expect(inst(control, villain).damage).toBe(inst(stacked, villain).damage + atk);
    expect(inst(control, hero).exhausted).toBe(true); // a basic attack exhausts the hero
    const after = basicAttack(stacked, hero, villain, accepting("19017.leading-blow-interrupt"));
    expect(inst(after, villain).damage).toBe(inst(stacked, villain).damage + atk - 1);
    expect(inst(after, hero).exhausted).toBe(false);
    expect(activeEncounterDeck(after).discard.map((id) => after.instances[id]!.cardId)).toContain(boosted!.id);
  });

  it("19018.subdue-interrupt: an enemy that initiates an attack gets -3 ATK for that attack", () => {
    const { state: opened } = openHandFor("19018", BLACK_PANTHER);
    const hero = identityOf(opened);
    // Undefended (no DEF reduction), with a 2-icon boost card so the attack is ATK 2 + 2 = 4, 1 after Subdue's -3.
    const control = villainAttack(opened, null, firstLegal, firstLegal, "01109");
    const taken = inst(control, hero).damage;
    expect(taken).toBeGreaterThan(0);
    const after = villainAttack(opened, null, accepting("19018.subdue-interrupt"), firstLegal, "01109");
    expect(inst(after, hero).damage).toBe(Math.max(0, taken - 3));
  });
});

describe("Drax aggression cards, from She-Hulk (Aggression)'s own deck", () => {
  const withBringIt = (alterEgo: boolean) => openHandFor("19030", SHE_HULK, { alterEgo, extraDeck: ["19030"] });

  it("19030.bring-it-action: Hero Action, draw 1 card for each minion engaged with you; max 1 per phase", () => {
    const { state: opened, id: first } = withBringIt(false);
    const both = moveToHand(opened, P1, "19030", "19030");
    const second = both.ids.find((id) => id !== first)!;
    const staged = engageMinion(engageMinion(both.state, SHOCKER, "bi-a"), SHOCKER, "bi-b");
    const handBefore = playerOf(staged, P1).hand.length;
    const after = playCard(staged, first, []);
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 1 + 2);
    // "Max 1 per phase" (data `playRestrictions.maxPerPhase`): the second copy is refused this phase.
    expect(applyCommand(after, play(P1, second, []), PLAYABLE_DEPS).ok).toBe(false);
  });

  it("19030.bring-it-action: a Hero Action card is refused in alter-ego form", () => {
    const { state, id } = withBringIt(true);
    expect(applyCommand(state, play(P1, id, []), PLAYABLE_DEPS).ok).toBe(false);
  });
});

describe("Drax leadership cards, from Captain Marvel (Leadership)'s own deck", () => {
  /** Regroup in play plus a cheap ally of Captain Marvel's own deck, with one hit point left. */
  function regroupAndAlly() {
    const { state: opened, id: regroup } = openHandFor("19032", CAP_MARVEL);
    const owner = playerOf(opened, P1);
    const allyId = [...owner.hand, ...owner.deck].find((id) => {
      const c = cardOf(opened, id);
      return c.type === "ally" && costOf(c.id as string) <= 3 && !(c.id as string).startsWith("19");
    });
    expect(allyId).toBeDefined();
    const allyCode = cardOf(opened, allyId!).id as string;
    const pay1 = filler(opened, costOf("19032"), [regroup]);
    const withRegroup = playCard(pay1.state, regroup, pay1.ids);
    expect(cardsInPlay(withRegroup)).toContain(regroup);
    const { state: withAlly, id: ally } = playCode(withRegroup, allyCode, [regroup]);
    expect(cardsInPlay(withAlly)).toContain(ally);
    const hp = (cardOf(withAlly, ally) as { hp: number }).hp;
    return { state: patchInstance(withAlly, ally, { damage: hp - 1 }), regroup, ally };
  }

  it("19032.regroup-interrupt: an ally defeated by an enemy attack returns to its owner's hand instead of being discarded", () => {
    const { state, ally } = regroupAndAlly();
    const control = villainAttack(state, ally);
    expect(playerOf(control, P1).hand).not.toContain(ally);
    const after = villainAttack(state, ally, firstLegal, accepting("19032.regroup-interrupt"));
    expect(playerOf(after, P1).hand).toContain(ally);
    expect(playerOf(after, P1).discard).not.toContain(ally);
    expect(cardsInPlay(after)).not.toContain(ally);
  });

  it("19032.regroup-forced-interrupt: when the round ends, discard Regroup", () => {
    const { state, regroup } = regroupAndAlly();
    const hero = identityOf(state);
    const after = villainAttack(state, hero);
    expect(playerOf(after, P1).discard).toContain(regroup);
    expect(cardsInPlay(after)).not.toContain(regroup);
  });
});

describe("Drax cards no Core hero's deck can play or hold", () => {
  // Printed "Play only if your identity has the guardian trait": no Core hero or alter-ego has it, so each is
  // refused in either form.
  for (const code of ["19020", "19031"]) {
    it(`${code}: refused in a Core hero's deck (Play only if your identity has the guardian trait)`, () => {
      for (const alterEgo of [false, true]) {
        const { state, id } = openHandFor(code, SPIDER_MAN, { alterEgo });
        const pay = filler(state, costOf(code), [id]);
        expect(applyCommand(pay.state, play(P1, id, pay.ids), PLAYABLE_DEPS).ok).toBe(false);
      }
    });
  }

  // RRG 1.8 "Identity-Specific Card" (p. 23): a `hero:19001a` card is legal only in Drax's deck.
  it("19002: Mantis is Drax's own signature ally, so a Core hero's deck holding it is refused", () => {
    const seat = buildCrossHeroDeck(PLAYABLE_CARDS, SPIDER_MAN, "19002");
    expect(createGame(buildScenario([seat]), PLAYABLE_DEPS).ok).toBe(false);
  });
});

describe("Mantis's printed plain Action, from the Drax stand-in deck (alter-ego form)", () => {
  const draxVsRhino = () => startWave3Game(draxScenario("rhino", { seed: 1 }));

  it("19002.mantis-action: a plain 'Action:' is usable in alter-ego form (exhaust, 1 damage to her → heal 3 from an identity)", () => {
    const start = draxVsRhino();
    expect(playerOf(start, P1).identity.form).toBe("alterEgo");
    const { state: withMantis, id: mantis } = playFromHand(start, "19002", 2);
    expect(cardsInPlay(withMantis)).toContain(mantis);
    expect(playerOf(withMantis, P1).identity.form).toBe("alterEgo");
    const identity = identityOf(withMantis);
    const damaged = patchInstance(withMantis, identity, { damage: 4 });
    const used = settle(
      runWith(WAVE3_DEPS, damaged, use(P1, mantis, "19002.mantis-action")),
      targeting(identity as string),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(used, mantis).exhausted).toBe(true);
    expect(inst(used, mantis).damage).toBe(1);
    expect(inst(used, identity).damage).toBe(1);
  });

  it('control: a printed "Hero Action:" ("Fight Me, Coward!" 19003) is refused in the same alter-ego form', () => {
    const { state, id } = (() => {
      const given = moveToHand(draxVsRhino(), P1, "19003");
      return { state: given.state, id: given.ids[0]! };
    })();
    expect(applyCommand(state, play(P1, id, []), WAVE3_DEPS).ok).toBe(false);
  });
});
