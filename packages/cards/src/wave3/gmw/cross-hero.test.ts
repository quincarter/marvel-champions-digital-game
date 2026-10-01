import { PLAYABLE_CARDS, type AnyCard } from "@mc/content";
import {
  activeEncounterDeck,
  applyCommand,
  characterProfile,
  cardsInPlay,
  createGame,
  keywordTotal,
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
  instancesOf,
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
import { forceMinionIntoPlay } from "../../wave1/thor/testing.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, "Cards in another hero's deck"): every The Galaxy's
 * Most Wanted (`gmw`, 16001a-16177) aspect/basic player card that has an ability script — every one whose own
 * `aspect` is not `hero:<id>` (an identity-specific card, RRG 1.8 "Identity-Specific Card", p. 23, only its own hero's
 * deck could hold) and that is not campaign/scenario-specific — played through the engine from a Core hero's own
 * precon instead of Groot's or Rocket Raccoon's.
 *
 * Covered: protection 16012 Starhawk, 16014 Fighting Fit, 16016 Dauntless, 16017 Hard to Ignore (Black Panther);
 * aggression 16040 Bug, 16043 Looking for Trouble, 16045 Follow Through, 16046 Hand Cannon (She-Hulk); basic 16024
 * Deft Focus (Spider-Man); refused for the guardian gate no Core identity meets (`requiresIdentityTrait`): 16019
 * Rocket Raccoon, 16047 Groot, 16052 Booster Boots; refused as Team-Up cards no Core deck may hold (RRG 1.8
 * "Team-Up", p. 43): 16020 and 16048 Flora and Fauna.
 * Skipped: verbatim reprints aliased in `../reprints.ts` — 16013 Desperate Defense (09015), 16015 The Power of
 * Protection (01079), 16018 Indomitable (01082), 16041 Chase Them Down (01052), 16042 Into the Fray (13013), 16044
 * Relentless Assault (01053); 16021-16023 / 16049-16051 Energy, Genius, Strength (no ability script); 16142 Milano
 * and 16150-16177 (scenario- / campaign-specific `specificTo` market and ship cards).
 *
 * Every Core hero face has the Avenger trait and none has Guardian. Black Panther's hero side has Retaliate 1.
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
const BLACK_PANTHER = "core-black-panther-protection";

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

/** Accepts the named optional response/interrupt (by ability id), and pays/declines everything else. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

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

/** Plays `code` (a card already seated in the deck) paying its printed cost with fillers. */
function playExtra(
  state: GameState,
  code: string,
  exclude: readonly InstanceId[],
  attachTo?: InstanceId,
): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as readonly [InstanceId];
  const pay = filler(given.state, costOf(code), [...exclude, id]);
  return { state: playCard(pay.state, id, pay.ids, firstLegal, attachTo), id };
}

function withMinion(state: GameState, code: string): { state: GameState; minion: InstanceId } {
  const minion = instancesOf(state, code)[0]!;
  return { state: forceMinionIntoPlay(state, minion, P1), minion };
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

/** Ends P1's turn so the villain phase attacks P1 (an Advance on top of the encounter deck keeps the boost card
 * from changing the damage), stops at the defender prompt, declares `defender`, and settles with `pick`. */
function defendVillainAttack(state: GameState, defender: InstanceId, pick: Picker = firstLegal): GameState {
  const stacked = stackEncounterDeck(state, "01186");
  const atDefend = settle(
    runWith(PLAYABLE_DEPS, stacked, endTurn(P1)),
    firstLegal,
    (s) => s.pendingChoice?.prompt.kind === "declareDefender",
    PLAYABLE_DEPS,
  );
  return settle(answer(atDefend, [defender], PLAYABLE_DEPS), pick, undefined, PLAYABLE_DEPS);
}

describe("GMW protection cards, from Black Panther (Protection)'s own deck", () => {
  it("16012.starhawk-interrupt: when he takes damage exactly equal to his remaining hit points, returns to hand", () => {
    const { state: opened, id: starhawk } = openHandFor("16012", BLACK_PANTHER);
    const pay = filler(opened, costOf("16012"), [starhawk]);
    const inPlay = playCard(pay.state, starhawk, pay.ids);
    expect(cardsInPlay(inPlay)).toContain(starhawk);
    // Control: undamaged Starhawk defends and takes the villain's whole attack; measure that damage.
    const control = defendVillainAttack(inPlay, starhawk);
    const taken = inst(control, starhawk).damage;
    expect(taken).toBeGreaterThan(0);
    expect(cardsInPlay(control)).toContain(starhawk);
    // Exactly lethal: remaining hit points equal the damage about to land, so the interrupt returns him instead.
    const hp = (BY_ID.get("16012") as { hp: number }).hp;
    const primed = patchInstance(inPlay, starhawk, { damage: hp - taken });
    const after = defendVillainAttack(primed, starhawk, accepting("16012.starhawk-interrupt"));
    expect(playerOf(after, P1).hand).toContain(starhawk);
    expect(cardsInPlay(after)).not.toContain(starhawk);
  });

  it("16014.fighting-fit-action: Hero Action, 2 damage to the villain, 5 while your hero is undamaged", () => {
    const { state: opened, id } = openHandFor("16014", BLACK_PANTHER);
    const villain = opened.villains[0]!.instanceId;
    const pay = filler(opened, costOf("16014"), [id]);
    const healthy = playCard(pay.state, id, pay.ids);
    expect(inst(healthy, villain).damage).toBe(inst(opened, villain).damage + 5);
    const hero = identityOf(opened);
    const hurt = patchInstance(pay.state, hero, { damage: 1 });
    const after = playCard(hurt, id, pay.ids);
    expect(inst(after, villain).damage).toBe(inst(opened, villain).damage + 2);
  });

  it("16014.fighting-fit-action: a Hero Action card is refused in alter-ego form", () => {
    const { state, id } = openHandFor("16014", BLACK_PANTHER, { alterEgo: true });
    const pay = filler(state, costOf("16014"), [id]);
    expect(applyCommand(pay.state, play(P1, id, pay.ids), PLAYABLE_DEPS).ok).toBe(false);
  });

  it("16016.dauntless-constant: your hero gains Retaliate 1 only while undamaged", () => {
    const { state: opened, id: dauntless } = openHandFor("16016", BLACK_PANTHER);
    const hero = identityOf(opened);
    const printed = keywordTotal(opened, hero, "retaliate", PLAYABLE_DEPS); // Black Panther's own Retaliate 1
    const pay = filler(opened, costOf("16016"), [dauntless]);
    const after = playCard(pay.state, dauntless, pay.ids, firstLegal, hero);
    expect(cardsInPlay(after)).toContain(dauntless);
    expect(keywordTotal(after, hero, "retaliate", PLAYABLE_DEPS)).toBe(printed + 1);
    const hurt = patchInstance(after, hero, { damage: 1 });
    expect(keywordTotal(hurt, hero, "retaliate", PLAYABLE_DEPS)).toBe(printed);
  });

  it("16017.hard-to-ignore-response: after your hero defends and takes no damage, exhausts → removes 1 threat from the main scheme", () => {
    const { state: opened, id: upgrade } = openHandFor("16017", BLACK_PANTHER);
    const hero = identityOf(opened);
    const pay = filler(opened, costOf("16017"), [upgrade]);
    const armed = playCard(pay.state, upgrade, pay.ids, firstLegal, hero);
    expect(inst(armed, upgrade).attachedTo).toBe(hero);
    // A tough status prevents the whole attack: the hero takes no damage (RRG 1.8 "Status Cards: Tough").
    const toughened = patchInstance(armed, hero, { statuses: { ...inst(armed, hero).statuses, tough: 1 } });
    const withResponse = defendVillainAttack(toughened, hero, accepting("16017.hard-to-ignore-response"));
    const declined = defendVillainAttack(toughened, hero, firstLegal);
    expect(inst(withResponse, hero).damage).toBe(0);
    expect(inst(withResponse, upgrade).exhausted).toBe(true);
    expect(inst(declined, upgrade).exhausted).toBe(false);
    const scheme = withResponse.mainScheme.instanceId;
    expect(inst(withResponse, scheme).threat).toBe(inst(declined, scheme).threat - 1);
  });
});

describe("GMW aggression cards, from She-Hulk (Aggression)'s own deck", () => {
  it("16040.bug-response: after your hero makes a basic attack, heals 1 damage from Bug", () => {
    const { state: opened, id: bug } = openHandFor("16040", SHE_HULK);
    const pay = filler(opened, costOf("16040"), [bug]);
    const inPlay = playCard(pay.state, bug, pay.ids);
    const hurt = patchInstance(inPlay, bug, { damage: 1 });
    const hero = identityOf(hurt);
    const villain = hurt.villains[0]!.instanceId;
    const after = basicAttack(hurt, hero, villain, accepting("16040.bug-response"));
    expect(inst(after, bug).damage).toBe(0);
  });

  it("16043.looking-for-trouble-action: puts the first discarded minion into play engaged with you, then removes 3 threat", () => {
    const { state: opened, id } = openHandFor("16043", SHE_HULK);
    const threatened = patchInstance(opened, opened.mainScheme.instanceId, { threat: 20 });
    const stacked = stackEncounterDeck(threatened, "01101");
    const minion = activeEncounterDeck(stacked).deck[0]!;
    expect(stacked.instances[minion]!.cardId).toBe("01101");
    const after = playCard(stacked, id, []);
    expect(cardsInPlay(after)).toContain(minion);
    expect(inst(after, minion).engagedWith).toBe(P1);
    expect(inst(after, after.mainScheme.instanceId).threat).toBe(17);
  });

  it("16043.looking-for-trouble-action: a Hero Action card is refused in alter-ego form", () => {
    const { state, id } = openHandFor("16043", SHE_HULK, { alterEgo: true });
    expect(applyCommand(state, play(P1, id, []), PLAYABLE_DEPS).ok).toBe(false);
  });

  it("16046.hand-cannon-interrupt: on your basic attack, exhaust + remove a charge → +2 ATK and overkill", () => {
    const { state: opened, id: cannon } = openHandFor("16046", SHE_HULK);
    const pay = filler(opened, costOf("16046"), [cannon]);
    const armed = playCard(pay.state, cannon, pay.ids, firstLegal, identityOf(pay.state));
    expect(inst(armed, cannon).counters.charge).toBe(3);
    const { state: staged, minion } = withMinion(armed, "01101");
    const hp = (BY_ID.get("01101") as { hp: number }).hp;
    const primed = patchInstance(staged, minion, { damage: hp - 1 });
    const hero = identityOf(primed);
    const villain = primed.villains[0]!.instanceId;
    const atk = characterProfile(primed, hero, PLAYABLE_DEPS)!.atk;
    const control = basicAttack(primed, hero, minion, firstLegal);
    const baseExcess = inst(control, villain).damage - inst(primed, villain).damage; // no overkill: nothing spills
    expect(baseExcess).toBe(0);
    const after = basicAttack(primed, hero, minion, accepting("16046.hand-cannon-interrupt"));
    expect(cardsInPlay(after)).not.toContain(minion);
    expect(inst(after, cannon).counters.charge).toBe(2);
    expect(inst(after, cannon).exhausted).toBe(true);
    // +2 ATK on a 1-remaining minion, with overkill: the excess goes to the villain.
    expect(inst(after, villain).damage).toBe(inst(primed, villain).damage + (atk + 2 - 1));
  });

  it("16045.follow-through-interrupt: your hero's attack that deals excess damage deals 1 more", () => {
    // Hand Cannon's overkill (+2 ATK) is what spills excess onto the villain, so it is observable; the control run
    // has the same Hand Cannon attack without Follow Through in play.
    const attackWith = (followThrough: boolean): { villainDamage: number; hero: InstanceId; atk: number } => {
      const { state: opened, id: cannon } = openHandFor("16046", SHE_HULK, { extraDeck: ["16045"] });
      const pay = filler(opened, costOf("16046"), [cannon]);
      const hero = identityOf(pay.state);
      const withCannon = playCard(pay.state, cannon, pay.ids, firstLegal, hero);
      let ready = withCannon;
      if (followThrough) {
        const played = playExtra(withCannon, "16045", [cannon], hero);
        expect(inst(played.state, played.id).attachedTo).toBe(hero);
        ready = played.state;
      }
      const { state: staged, minion } = withMinion(ready, "01101");
      const hp = (BY_ID.get("01101") as { hp: number }).hp;
      const primed = patchInstance(staged, minion, { damage: hp - 1 });
      const villain = primed.villains[0]!.instanceId;
      const after = basicAttack(primed, hero, minion, accepting("16046.hand-cannon-interrupt"));
      return {
        villainDamage: inst(after, villain).damage - inst(primed, villain).damage,
        hero,
        atk: characterProfile(primed, hero, PLAYABLE_DEPS)!.atk,
      };
    };
    const control = attackWith(false);
    expect(control.villainDamage).toBe(control.atk + 2 - 1);
    expect(attackWith(true).villainDamage).toBe(control.villainDamage + 1);
  });
});

describe("GMW basic cards, from Spider-Man (Justice)'s own deck", () => {
  it("16024.deft-focus-action: Hero Action, exhaust → the next superpower card you play this turn costs 1 less", () => {
    const { state: opened, id: focus } = openHandFor("16024", SPIDER_MAN);
    const pay = filler(opened, costOf("16024"), [focus]);
    const hero = identityOf(pay.state);
    const armed = playCard(pay.state, focus, pay.ids, firstLegal, hero);
    // Spider-Man's own Swinging Web Kick (01005): a cost 3 Hero Action (attack) with the SUPERPOWER trait.
    const given = moveToHand(armed, P1, "01005");
    const [power] = given.ids as readonly [InstanceId];
    expect(
      ("traits" in BY_ID.get("01005")! ? (BY_ID.get("01005") as { traits: readonly unknown[] }).traits : []).map(
        String,
      ),
    ).toContain("SUPERPOWER");
    const spare = filler(given.state, 3, [focus, power]);
    const twoCards = [spare.ids[0]!, spare.ids[1]!];
    expect(applyCommand(spare.state, play(P1, power, twoCards), PLAYABLE_DEPS).ok).toBe(false); // cost 3, 2 paid
    const used = settle(
      runWith(PLAYABLE_DEPS, spare.state, use(P1, focus, "16024.deft-focus-action", [])),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(used, focus).exhausted).toBe(true);
    expect(applyCommand(used, play(P1, power, twoCards), PLAYABLE_DEPS).ok).toBe(true); // cost 3 - 1 = 2
  });

  it("16024.deft-focus-action: a Hero Action ability can't be used in alter-ego form", () => {
    const { state: opened, id: focus } = openHandFor("16024", SPIDER_MAN, { alterEgo: true });
    // Seat the upgrade on the alter-ego without playing it (upgrades are hero-form-only to play as well).
    const attached = patchInstance(opened, focus, { attachedTo: identityOf(opened) });
    const inPlay = {
      ...attached,
      players: attached.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: p.hand.filter((x) => x !== focus), playArea: [...p.playArea, focus] } : p,
      ),
    };
    expect(applyCommand(inPlay, use(P1, focus, "16024.deft-focus-action", []), PLAYABLE_DEPS).ok).toBe(false);
  });
});

describe("GMW cards no Core hero's deck can play or hold", () => {
  // Printed "Play only if your identity has the guardian trait": no Core hero (Avenger, Soldier, ...) or alter-ego
  // has it, so each is refused in either form.
  for (const code of ["16019", "16047", "16052"]) {
    it(`${code}: refused in a Core hero's deck (Play only if your identity has the guardian trait)`, () => {
      for (const alterEgo of [false, true]) {
        const { state, id } = openHandFor(code, SPIDER_MAN, { alterEgo });
        const pay = filler(state, costOf(code), [id]);
        expect(applyCommand(pay.state, play(P1, id, pay.ids), PLAYABLE_DEPS).ok).toBe(false);
      }
    });
  }

  // RRG 1.8 "Team-Up" (p. 43): a Team-Up card can't be in a deck unless the identity matches one of its names.
  for (const code of ["16020", "16048"]) {
    it(`${code}.flora-and-fauna-action: refused, since no Core hero deck may include a Team-Up (Groot and Rocket Raccoon) card`, () => {
      const seat = buildCrossHeroDeck(PLAYABLE_CARDS, SPIDER_MAN, code);
      expect(createGame(buildScenario([seat]), PLAYABLE_DEPS).ok).toBe(false);
    });
  }
});
