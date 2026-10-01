import { PLAYABLE_CARDS, type AnyCard } from "@mc/content";
import {
  applyCommand,
  cardsInPlay,
  characterProfile,
  createGame,
  hasKeyword,
  restrictedLimitFor,
  type GameState,
  type InstanceId,
  type PlayerSetup,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "../../playable/index.js";
import { buildCrossHeroDeck } from "../../testing/cross-hero.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
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
import { withForm } from "../../testing/staging.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, "Cards in another hero's deck"): every Venom pack
 * (`vnm`, 20001a-20029) aspect/basic player card that has an ability script — every one whose own `aspect` is not
 * `hero:20001a` (an identity-specific card, RRG 1.8 "Identity-Specific Card", p. 23, only a Venom deck could hold) —
 * played through the engine from a Core hero's own precon instead of Venom's.
 *
 * Covered (11): 20011 Jack Flag (Response after it thwarts, Hero Action ammo shot), 20012 Scare Tactic (Hero Action,
 * confused enemy only), 20013 Making an Entrance (Hero Interrupt on a basic thwart, +2 THW and the conditional
 * heal), 20015 Sonic Rifle (Hero Action, Uses 2), 20016 Star-Lord (ranged, Forced Response deals an encounter card),
 * 20021 Side Holster (extra restricted weapon slot), 20022 Plasma Pistol (Hero Action, Uses 3), 20026 Fusillade
 * (needs a weapon upgrade to exhaust), 20027 "Welcome Aboard" (refused: no Core hero has the guardian trait), 20028
 * Shake it Off (Hero Response, guardian characters only), 20029 Crew Quarters (Alter-Ego Action, alter-ego form
 * only).
 * Skipped: 20014 The Power of Justice (verbatim Core 01062) and 20020 Resourceful (verbatim reprint) are aliased in
 * `../reprints.ts`; 20017-20019 (Energy, Genius, Strength) print no ability; 20023-20025 are the obligation/nemesis
 * cards; 20002-20010 and 20004 are `hero:20001a` signature cards. The pack has no Team-Up card, so there is no
 * "createGame refuses a Team-Up deck" case (RRG 1.8 "Team-Up", p. 43).
 *
 * Seats: justice and basic in Spider-Man/Justice, aggression in She-Hulk/Aggression, leadership in Captain
 * Marvel/Leadership, protection in Black Panther/Protection. Every "Hero Action" card or ability is also checked to
 * be refused in alter-ego form (RRG 1.8 "Hero Action"/"Alter-Ego Action", form restriction).
 *
 * Locked and Loaded (20004) is a Venom signature card (not run here); it prints a plain "Action" (MarvelCDB card text)
 * and is scripted as one, checked in `./venom-kit.test.ts`.
 */

const buildScenario = (players: readonly PlayerSetup[]) =>
  playableScenario("rhino", { seed: 11, players: players as never });

const BY_ID = new Map<string, AnyCard>(PLAYABLE_CARDS.map((c) => [c.id as string, c]));
const cardOf = (state: GameState, id: InstanceId): AnyCard => BY_ID.get(state.instances[id]!.cardId as string)!;
const costOf = (code: string): number => {
  const card = BY_ID.get(code)!;
  return "cost" in card ? card.cost : 0;
};

const SHE_HULK = "core-she-hulk-aggression";
const SPIDER_MAN = "core-spider-man-justice";
const CAP_MARVEL = "core-captain-marvel-leadership";
const BLACK_PANTHER = "core-black-panther-protection";

const toHeroFirst = (state: GameState): GameState =>
  settle(runWith(PLAYABLE_DEPS, state, toHero(P1)), firstLegal, undefined, PLAYABLE_DEPS);

interface OpenOptions {
  readonly alterEgo?: boolean;
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

const iconTotal = (card: AnyCard): number =>
  "resourceIcons" in card ? Object.values(card.resourceIcons).reduce((a, b) => a + (b ?? 0), 0) : 0;
const singleIcon = (card: AnyCard): boolean => iconTotal(card) === 1;

/** Moves `n` single-icon non-resource cards into P1's hand (never `exclude`) and returns their ids, so a payment's
 * size is exactly its value. */
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

/** Accepts the named optional response/interrupt (by ability id), and declines everything else. */
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

/** Pays any `payForCard` with the first offered option, accepts the named response/interrupt, declines the rest. */
const withEvent =
  (ability: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "payForCard") return choice.options.slice(0, 1).map((o) => o.optionId);
    return accepting(ability)(state);
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

const useAbility = (state: GameState, id: InstanceId, ability: string, pick: Picker = firstLegal): GameState =>
  settle(runWith(PLAYABLE_DEPS, state, use(P1, id, ability)), pick, undefined, PLAYABLE_DEPS);

/** Plays `code` (paying its own cost with filler) onto/for P1 in `state`. */
function playPaid(state: GameState, code: string, attach = false, pick: Picker = firstLegal) {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const pay = filler(given.state, costOf(code), [id]);
  const after = playCard(pay.state, id, pay.ids, pick, attach ? identityOf(pay.state) : undefined);
  return { state: after, id };
}

/** Ending the turn discards down to hand size from the front of the hand: keep only the tracked cards. */
function keepOnlyInHand(state: GameState, keep: readonly InstanceId[]): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            hand: p.hand.filter((c) => keep.includes(c)),
            deck: [...p.deck, ...p.hand.filter((c) => !keep.includes(c))],
          }
        : p,
    ),
  };
}

const basicThwart = (state: GameState, thwarter: InstanceId, pick: Picker = firstLegal): GameState =>
  settle(
    runWith(PLAYABLE_DEPS, state, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: thwarter,
      schemeInstanceId: state.mainScheme.instanceId,
    }),
    pick,
    undefined,
    PLAYABLE_DEPS,
  );

/** An alter-ego-form copy of the card in hand is refused ("Hero Action" is hero-form only). */
function expectRefusedInAlterEgo(code: string, coreHero: string): void {
  const { state: ego, id } = openHandFor(code, coreHero, { alterEgo: true });
  const pay = filler(ego, costOf(code), [id]);
  expect(applyCommand(pay.state, play(P1, id, pay.ids), PLAYABLE_DEPS).ok).toBe(false);
}

/** `ability` on an in-play `id` (put there by surgery, attached to the identity when `attach`) is refused in
 * alter-ego form; `counters` keeps the cost payable so the form is the only thing refusing it. */
function expectAbilityRefusedInAlterEgo(
  code: string,
  coreHero: string,
  ability: string,
  counters: Record<string, number> = {},
  attach = true,
): void {
  const { state: ego, id } = openHandFor(code, coreHero, { alterEgo: true });
  const placed: GameState = {
    ...patchInstance(ego, id, { attachedTo: attach ? identityOf(ego) : null, counters }),
    players: ego.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: p.hand.filter((x) => x !== id), playArea: [...p.playArea, id] } : p,
    ),
  };
  expect(applyCommand(placed, use(P1, id, ability), PLAYABLE_DEPS).ok).toBe(false);
}

const villainOf = (state: GameState) => state.villains[0]!.instanceId;

describe("Venom's justice cards, from Spider-Man (Justice)'s own deck", () => {
  // Printed: "Response: After Jack Flag thwarts, place 1 ammo counter on him. Hero Action: Exhaust Jack Flag and
  // remove 1 ammo counter from him → deal 2 damage to an enemy."
  it("20011.jack-flag-response: after Jack Flag thwarts, places 1 ammo counter on him", () => {
    const { state: opened, id } = openHandFor("20011", SPIDER_MAN);
    const pay = filler(opened, costOf("20011"), [id]);
    const played = playCard(pay.state, id, pay.ids);
    expect(playerOf(played, P1).playArea).toContain(id);
    const threatened = patchInstance(played, played.mainScheme.instanceId, { threat: 10 });
    const after = basicThwart(threatened, id, accepting("20011.jack-flag-response"));
    expect(mainThreat(after)).toBe(10 - 2); // Jack Flag's THW 2
    expect(inst(after, id).counters.ammo).toBe(1);
  });

  it("20011.jack-flag-action: a Hero Action, exhaust + spend an ammo counter to deal 2 damage to an enemy; refused in alter-ego form", () => {
    const { state: opened, id } = openHandFor("20011", SPIDER_MAN);
    const pay = filler(opened, costOf("20011"), [id]);
    const played = playCard(pay.state, id, pay.ids);
    const loaded = patchInstance(played, id, { counters: { ammo: 1 }, exhausted: false });
    const villain = villainOf(loaded);
    const used = useAbility(loaded, id, "20011.jack-flag-action");
    expect(inst(used, villain).damage).toBe(inst(loaded, villain).damage + 2);
    expect(inst(used, id).exhausted).toBe(true);
    expect(inst(used, id).counters.ammo ?? 0).toBe(0);
    // Same ally, alter-ego form: Hero Action (RRG 1.8 "Hero Action") cannot be used.
    const ego = withForm(loaded, "alterEgo");
    expect(applyCommand(ego, use(P1, id, "20011.jack-flag-action"), PLAYABLE_DEPS).ok).toBe(false);
  });

  // Printed: "Hero Action: (attack): Deal 3 damage to a confused enemy."
  it("20012.scare-tactic-action: a Hero Action, 3 damage to a confused enemy; refused in alter-ego form", () => {
    const { state: opened, id } = openHandFor("20012", SPIDER_MAN);
    const villain = villainOf(opened);
    const confused = patchInstance(opened, villain, { statuses: { ...inst(opened, villain).statuses, confused: 1 } });
    const pay = filler(confused, costOf("20012"), [id]);
    const after = playCard(pay.state, id, pay.ids);
    expect(inst(after, villain).damage).toBe(inst(confused, villain).damage + 3);
    expect(playerOf(after, P1).discard).toContain(id);
    expectRefusedInAlterEgo("20012", SPIDER_MAN);
  });

  // Printed: "Hero Interrupt: When your hero makes a basic thwart, it gets +2 THW for that thwart. After that thwart
  // ends, if your hero removed all threat from a scheme that way, heal 2 damage from your hero."
  it("20013.making-an-entrance-interrupt: +2 THW on a basic thwart; heals 2 only when it removed all threat", () => {
    const run = (threat: number, accept: boolean) => {
      const { state: opened, id } = openHandFor("20013", SPIDER_MAN);
      const hero = identityOf(opened);
      const pay = filler(opened, costOf("20013"), [id]);
      const staged = keepOnlyInHand(
        patchInstance(patchInstance(pay.state, hero, { damage: 3 }), pay.state.mainScheme.instanceId, { threat }),
        [id, ...pay.ids],
      );
      const after = basicThwart(staged, hero, accept ? withEvent("20013.making-an-entrance-interrupt") : firstLegal);
      if (accept) expect(playerOf(after, P1).discard).toContain(id);
      return {
        thw: characterProfile(staged, hero, PLAYABLE_DEPS)!.thw,
        threat: mainThreat(after),
        damage: inst(after, hero).damage,
      };
    };
    const control = run(2, false);
    expect(control.threat).toBe(2 - control.thw); // Spider-Man's own THW leaves threat on the scheme
    expect(control.threat).toBeGreaterThan(0);
    expect(control.damage).toBe(3);
    const cleared = run(2, true);
    expect(cleared.threat).toBe(0); // THW + 2 clears it
    expect(cleared.damage).toBe(1); // healed 2
    const notCleared = run(10, true);
    expect(notCleared.threat).toBe(10 - (notCleared.thw + 2));
    expect(notCleared.damage).toBe(3); // threat remains: no heal
  });

  // Printed: "Restricted. Uses (2 charge counters). Hero Action: Exhaust Sonic Rifle and remove 1 charge counter
  // from it → confuse an enemy (deal 3 damage to that enemy instead if it is already confused)."
  it("20015.sonic-rifle-action: a Hero Action, confuses an enemy, then deals 3 damage to a confused one; refused in alter-ego form", () => {
    const { state: opened, id } = openHandFor("20015", SPIDER_MAN);
    const pay = filler(opened, costOf("20015"), [id]);
    const armed = playCard(pay.state, id, pay.ids, firstLegal, identityOf(pay.state));
    expect(inst(armed, id).counters.charge).toBe(2);
    const villain = villainOf(armed);
    const first = useAbility(armed, id, "20015.sonic-rifle-action");
    expect(inst(first, villain).statuses.confused).toBeGreaterThan(0);
    expect(inst(first, villain).damage).toBe(inst(armed, villain).damage);
    expect(inst(first, id).counters.charge).toBe(1);
    const readied = patchInstance(first, id, { exhausted: false });
    const second = useAbility(readied, id, "20015.sonic-rifle-action");
    expect(inst(second, villain).damage).toBe(inst(readied, villain).damage + 3);
    expect(inst(second, id).counters.charge ?? 0).toBe(0);
    expectAbilityRefusedInAlterEgo("20015", SPIDER_MAN, "20015.sonic-rifle-action", { charge: 2 });
  });
});

describe("Venom's basic cards, from Spider-Man (Justice)'s own deck", () => {
  // Printed: "[star] Star-Lord's attacks gain ranged. Forced Response: After Star-Lord enters play under your
  // control, deal yourself 1 facedown encounter card."
  it("20016.star-lord-forced-response: entering play deals you a facedown encounter card; his attacks gain ranged", () => {
    const { state: opened, id } = openHandFor("20016", SPIDER_MAN);
    const pay = filler(opened, costOf("20016"), [id]);
    const before = playerOf(pay.state, P1).dealtEncounter.length;
    const after = playCard(pay.state, id, pay.ids);
    expect(playerOf(after, P1).playArea).toContain(id);
    expect(playerOf(after, P1).dealtEncounter.length).toBe(before + 1);
    expect(hasKeyword(after, id, "ranged", PLAYABLE_DEPS)).toBe(true);
  });

  // Printed: "Play under any player's control. Max 1 per player. You can control 1 additional weapon upgrade that
  // has the restricted keyword."
  it("20021.side-holster-constant: +1 restricted weapon upgrade slot while it is in play", () => {
    const { state: opened, id } = openHandFor("20021", SPIDER_MAN, { extraDeck: ["20022"] });
    const pistol = moveToHand(opened, P1, "20022").ids[0]!;
    const withPistol = moveToHand(opened, P1, "20022").state;
    const held = [pistol, pistol, pistol, pistol];
    const base = restrictedLimitFor(withPistol, PLAYABLE_DEPS, P1, held);
    const after = playCard(withPistol, id, []);
    expect(cardsInPlay(after)).toContain(id);
    expect(restrictedLimitFor(after, PLAYABLE_DEPS, P1, held)).toBe(base + 1);
  });

  // Printed: "Restricted. Uses (3 charge counters). Hero Action: Exhaust Plasma Pistol and remove 1 charge counter
  // from it → deal 1 damage to an enemy."
  it("20022.plasma-pistol-action: a Hero Action, exhaust + spend a charge to deal 1 damage to an enemy; refused in alter-ego form", () => {
    const { state: opened, id } = openHandFor("20022", SPIDER_MAN);
    const pay = filler(opened, costOf("20022"), [id]);
    const armed = playCard(pay.state, id, pay.ids, firstLegal, identityOf(pay.state));
    expect(inst(armed, id).counters.charge).toBe(3);
    const villain = villainOf(armed);
    const used = useAbility(armed, id, "20022.plasma-pistol-action");
    expect(inst(used, villain).damage).toBe(inst(armed, villain).damage + 1);
    expect(inst(used, id).counters.charge).toBe(2);
    expect(inst(used, id).exhausted).toBe(true);
    expectAbilityRefusedInAlterEgo("20022", SPIDER_MAN, "20022.plasma-pistol-action", { charge: 3 });
  });

  // Printed: "Play under any player's control. Max 1 per player. Alter-Ego Action: Exhaust Crew Quarters → heal 1
  // damage from an alter-ego." A plain support: playable in alter-ego form; its ability is alter-ego form only.
  it("20029.crew-quarters-action: an Alter-Ego Action, heals 1 damage from an alter-ego; refused in hero form", () => {
    const { state: ego, id } = openHandFor("20029", SPIDER_MAN, { alterEgo: true });
    const hero = identityOf(ego);
    const hurt = patchInstance(ego, hero, { damage: 3 });
    const pay = filler(hurt, costOf("20029"), [id]);
    const played = playCard(pay.state, id, pay.ids);
    expect(playerOf(played, P1).playArea).toContain(id);
    const used = useAbility(played, id, "20029.crew-quarters-action");
    expect(inst(used, hero).damage).toBe(2);
    expect(inst(used, id).exhausted).toBe(true);
    const inHeroForm = withForm(played, { heroForm: 0 });
    expect(applyCommand(inHeroForm, use(P1, id, "20029.crew-quarters-action"), PLAYABLE_DEPS).ok).toBe(false);
  });
});

describe("Venom's aggression card, from She-Hulk (Aggression)'s own deck", () => {
  // Printed: "Hero Action (attack): Exhaust a weapon upgrade you control → deal 5 damage to an enemy."
  it("20026.fusillade-action: a Hero Action, exhausts a weapon upgrade you control to deal 5 damage; refused without one and in alter-ego form", () => {
    const { state: opened, id } = openHandFor("20026", SHE_HULK, { extraDeck: ["20022"] });
    const hero = identityOf(opened);
    // Without a weapon upgrade in play the cost cannot be paid.
    const noWeaponPay = filler(opened, costOf("20026"), [id]);
    expect(applyCommand(noWeaponPay.state, play(P1, id, noWeaponPay.ids), PLAYABLE_DEPS).ok).toBe(false);

    const pistolPlayed = playPaid(opened, "20022", true);
    const pistol = pistolPlayed.id;
    expect(inst(pistolPlayed.state, pistol).attachedTo).toBe(hero);
    const pay = filler(pistolPlayed.state, costOf("20026"), [id, pistol]);
    const villain = villainOf(pay.state);
    const after = playCard(pay.state, id, pay.ids);
    expect(inst(after, villain).damage).toBe(inst(pay.state, villain).damage + 5);
    expect(inst(after, pistol).exhausted).toBe(true);
    expect(playerOf(after, P1).discard).toContain(id);

    // Alter-ego form, same weapon in play: refused.
    const ego = withForm(pay.state, "alterEgo");
    expect(applyCommand(ego, play(P1, id, pay.ids), PLAYABLE_DEPS).ok).toBe(false);
  });
});

describe("Venom's leadership card, from Captain Marvel (Leadership)'s own deck", () => {
  // Printed: "Play only if your identity has the guardian trait. Max 1 per round." Every Core hero face has the
  // Avenger trait and none has Guardian, so the card is refused in either form.
  it("20027.welcome-aboard-action: refused in either form without the guardian trait", () => {
    for (const alterEgo of [false, true]) {
      const { state, id } = openHandFor("20027", CAP_MARVEL, { alterEgo });
      const pay = filler(state, costOf("20027"), [id]);
      expect(applyCommand(pay.state, play(P1, id, pay.ids), PLAYABLE_DEPS).ok).toBe(false);
    }
  });
});

describe("Venom's protection card, from Black Panther (Protection)'s own deck", () => {
  // Printed: "Hero Response: After a guardian character takes any amount of damage from an attack, give that
  // character a tough status card." Black Panther is not a guardian; Star-Lord (basic ally, GUARDIAN) is.
  it("20028.shake-it-off-response: after a guardian ally takes attack damage, it gets a tough status; a non-guardian hero does not", () => {
    const { state: opened, id } = openHandFor("20028", BLACK_PANTHER, { extraDeck: ["20016"] });
    const hero = identityOf(opened);
    const ally = playPaid(opened, "20016").state; // Star-Lord, a GUARDIAN ally
    const starLord = playerOf(ally, P1).playArea.find((c) => cardOf(ally, c).id === ("20016" as never))!;
    const pay = filler(ally, costOf("20028"), [id, starLord]);
    // Rhino's attack (ATK 2, no boost icons from two Advance cards) is defended by Star-Lord (3 HP) and survives.
    const staged = stackEncounterDeck(keepOnlyInHand(pay.state, [id, ...pay.ids]), "01186", "01186");
    const reached = settle(
      runWith(PLAYABLE_DEPS, staged, endTurn()),
      firstLegal,
      (s) => s.pendingChoice?.prompt.kind === "declareDefender",
      PLAYABLE_DEPS,
    );
    expect(reached.pendingChoice?.prompt.kind).toBe("declareDefender");
    const defendWith = (who: InstanceId, accept: boolean): GameState =>
      settle(
        reached,
        (s) =>
          s.pendingChoice?.prompt.kind === "declareDefender"
            ? [who]
            : accept
              ? withEvent("20028.shake-it-off-response")(s)
              : firstLegal(s),
        (s) => accept && (inst(s, who).statuses.tough ?? 0) > 0,
        PLAYABLE_DEPS,
      );
    const guarded = defendWith(starLord, true);
    expect(inst(guarded, starLord).damage).toBeGreaterThan(0);
    expect(inst(guarded, starLord).statuses.tough ?? 0).toBeGreaterThan(0);
    expect(playerOf(guarded, P1).discard).toContain(id);
    // Black Panther (no guardian trait) taking the same attack: the response is never offered.
    const bp = defendWith(hero, false);
    expect(inst(bp, hero).statuses.tough ?? 0).toBe(0);
    expect(playerOf(bp, P1).hand).toContain(id);
  });
});
