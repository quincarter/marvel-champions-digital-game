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
import { PLAYABLE_DEPS, playableScenario, playableStarterDeckSetup } from "../../playable/index.js";
import { buildCrossHeroDeck } from "../../testing/cross-hero.js";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  play,
  playerOf,
  resourceAbility,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { forceMinionIntoPlay } from "../thor/testing.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, "Cards in another hero's deck"): every Hulk pack
 * (`hlk`, 10001a-10032) aspect/basic player card that has an ability script — every one whose own `aspect` is not
 * `hero:10001a` (an identity-specific card, RRG 1.8 "Identity-Specific Card", p. 23, only a Hulk deck could hold) —
 * played through the engine from a Core hero's own precon instead of Hulk's (`hlk-aggression`).
 *
 * Covered (12): 10011 Brawn, 10012 Sentry, 10013 She-Hulk, 10014 Drop Kick, 10015 Toe to Toe, 10016 "You'll Pay
 * for That!", 10018 Martial Prowess, 10019 To the Rescue!, 10029 Beat Cop (both abilities), 10030 Inspiring
 * Presence, 10031 Electrostatic Armor, 10032 Resourceful.
 * Skipped: 10017 The Power of Aggression (verbatim Core 01055), 10023 Avengers Mansion (Core 01091) and 10024
 * Helicarrier (Core 01092), all aliased in `../reprints.ts`; 10020-10022 Energy/Genius/Strength print no ability
 * (`abilities: []`); 10025-10028 are the obligation/nemesis/encounter cards, not player aspect cards. 10030's
 * "identity has the Avenger trait" gate cannot be shown refused: every Core hero has the Avenger trait.
 *
 * Seats: aggression cards in She-Hulk/Aggression, justice and basic in Spider-Man/Justice, leadership in Captain
 * Marvel/Leadership, protection in Black Panther/Protection (`CORE_HERO_FOR_ASPECT`).
 */

const buildScenario = (players: readonly PlayerSetup[]) =>
  playableScenario("rhino", { seed: 11, players: players as never });

const BY_ID = new Map<string, AnyCard>(PLAYABLE_CARDS.map((c) => [c.id as string, c]));
const cardOf = (state: GameState, id: InstanceId): AnyCard => BY_ID.get(state.instances[id]!.cardId as string)!;

const SHE_HULK = "core-she-hulk-aggression";
const SPIDER_MAN = "core-spider-man-justice";
const CAP_MARVEL = "core-captain-marvel-leadership";
const BLACK_PANTHER = "core-black-panther-protection";
const IRON_MAN = "core-iron-man-aggression";

/** Leaves any pending choice settled with the villain/first option (She-Hulk's own form-change response, `01019a`,
 * leaves a target choice pending), then changes P1 into hero form. */
const toHeroFirst = (state: GameState): GameState =>
  settle(runWith(PLAYABLE_DEPS, state, toHero(P1)), firstLegal, undefined, PLAYABLE_DEPS);

interface OpenOptions {
  readonly alterEgo?: boolean;
  /** Extra copies of other cards to seat in the deck (legal in the hero's aspect). */
  readonly extraDeck?: readonly string[];
  /** A second seat (P2), for a minion engaged with someone else. */
  readonly otherSeat?: string;
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
  const players = options.otherSeat ? [seated, playableStarterDeckSetup(options.otherSeat)] : [seated];
  const created = createGame(buildScenario(players), PLAYABLE_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
  const ready = options.alterEgo ? opening : toHeroFirst(opening);
  const { state, ids } = moveToHand(ready, P1, code);
  return { state, id: ids[0]! };
}

/** Moves `n` non-resource cards passing `ok` into P1's hand (never `exclude`) and returns their ids — single-value
 * payment cards, so a payment's size is exactly its value (docs/phase7-wave1-scripting.md "Test conventions"). */
function filler(
  state: GameState,
  n: number,
  exclude: readonly InstanceId[] = [],
  ok: (card: AnyCard) => boolean = () => true,
): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  const owner = playerOf(state, P1);
  const codes: string[] = [];
  const seen = new Set<InstanceId>(exclude);
  for (const id of [...owner.hand, ...owner.deck]) {
    if (codes.length >= n) break;
    const card = cardOf(state, id);
    if (seen.has(id) || card.type === "resource" || !ok(card)) continue;
    seen.add(id);
    codes.push(card.id as string);
  }
  if (codes.length < n) throw new Error(`only ${codes.length} filler cards found`);
  // `moveToHand` takes the first hand-or-deck copy of each code that it has not already returned.
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

/** Plays `id` paying with exactly `payment`, settling every prompt with `pick`. */
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

/** Puts a copy of core minion `code` (an Rhino-scenario encounter card) in play engaged with `player`. */
function withMinion(state: GameState, code: string, player = P1): { state: GameState; minion: InstanceId } {
  const minion = instancesOf(state, code)[0]!;
  return { state: forceMinionIntoPlay(state, minion, player), minion };
}

const iconsOf = (card: AnyCard): Readonly<Record<string, number>> =>
  "resourceIcons" in card ? (card.resourceIcons as Readonly<Record<string, number>>) : {};
/** A single-value [physical]-only payment card: exactly one [physical] icon and nothing else. */
const physicalOnly = (card: AnyCard): boolean => {
  const icons = iconsOf(card);
  return (icons.physical ?? 0) === 1 && Object.entries(icons).every(([k, v]) => k === "physical" || !v);
};
/** A single-value payment card with no [physical] icon at all. */
const noPhysical = (card: AnyCard): boolean => !(iconsOf(card).physical ?? 0);

// She-Hulk (10013) is a unique ally matching She-Hulk's own identity, so she is seated in Iron Man (Aggression).
describe("Hulk pack aggression cards, from She-Hulk (Aggression)'s own deck", () => {
  it("10011.brawn-response: after Brawn attacks, removes 1 threat from a scheme", () => {
    const { state: opened, id: brawn } = openHandFor("10011", SHE_HULK);
    const pay = filler(opened, 3, [brawn]);
    const played = playCard(pay.state, brawn, pay.ids);
    expect(playerOf(played, P1).playArea).toContain(brawn);
    const staged = patchInstance(played, played.mainScheme.instanceId, { threat: 5 });
    const villain = activeVillain(staged).instanceId;
    const after = settle(
      runWith(PLAYABLE_DEPS, staged, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: brawn,
        targetInstanceId: villain,
      }),
      accepting("10011.brawn-response"),
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(after, villain).damage).toBeGreaterThan(inst(staged, villain).damage);
    expect(inst(after, after.mainScheme.instanceId).threat).toBe(4);
  });

  it("10012.sentry-forced-response: after Sentry enters play, you are dealt 1 encounter card", () => {
    const { state: opened, id: sentry } = openHandFor("10012", SHE_HULK);
    // A known card on top, so the dealt card is identifiable, not just a shorter deck.
    const stacked = stackEncounterDeck(opened, "01101");
    const mercenary = activeEncounterDeck(stacked).deck[0]!;
    expect(inst(stacked, mercenary).cardId).toBe("01101");
    const pay = filler(stacked, 4, [sentry]);
    const after = playCard(pay.state, sentry, pay.ids);
    expect(playerOf(after, P1).playArea).toContain(sentry);
    // The dealt card waits face down in the player's dealt-encounter zone (revealed in the next villain phase).
    expect(playerOf(after, P1).dealtEncounter).toEqual([mercenary]);
    expect(activeEncounterDeck(after).deck).not.toContain(mercenary);
  });

  it("10013.she-hulk-constant: She-Hulk gets +1 ATK for each damage token on her", () => {
    const { state: opened, id: sheHulk } = openHandFor("10013", IRON_MAN);
    const pay = filler(opened, 4, [sheHulk]);
    const played = playCard(pay.state, sheHulk, pay.ids);
    expect(characterProfile(played, sheHulk, PLAYABLE_DEPS)!.atk).toBe(1);
    const damaged = patchInstance(played, sheHulk, { damage: 3 });
    expect(characterProfile(damaged, sheHulk, PLAYABLE_DEPS)!.atk).toBe(4);
  });

  it("10014.drop-kick-action: deals 4 damage; paid with only [physical] it also stuns the enemy and draws 1", () => {
    const { state: opened, id: dropKick } = openHandFor("10014", SHE_HULK);
    const villain = activeVillain(opened).instanceId;
    const before = inst(opened, villain).damage;

    const phys = filler(opened, 3, [dropKick], physicalOnly);
    const handBefore = playerOf(phys.state, P1).hand.length;
    const stunned = playCard(phys.state, dropKick, phys.ids);
    expect(inst(stunned, villain).damage).toBe(before + 4);
    expect(inst(stunned, villain).statuses.stunned).toBe(1);
    expect(playerOf(stunned, P1).hand.length).toBe(handBefore - 1 - 3 + 1);

    const mixed = filler(opened, 3, [dropKick], noPhysical);
    const handMixed = playerOf(mixed.state, P1).hand.length;
    const plain = playCard(mixed.state, dropKick, mixed.ids);
    expect(inst(plain, villain).damage).toBe(before + 4);
    expect(inst(plain, villain).statuses.stunned).toBe(0);
    expect(playerOf(plain, P1).hand.length).toBe(handMixed - 1 - 3);
  });

  it("10015.toe-to-toe-action: the chosen enemy attacks you, then takes 5 damage", () => {
    const { state: opened, id } = openHandFor("10015", SHE_HULK);
    const villain = activeVillain(opened).instanceId;
    const identity = identityOf(opened);
    const pay = filler(opened, 1, [id]);
    const after = playCard(pay.state, id, pay.ids);
    expect(inst(after, villain).damage).toBe(inst(opened, villain).damage + 5);
    expect(inst(after, identity).damage).toBeGreaterThan(inst(opened, identity).damage); // undefended attack landed
  });

  it("10016.youll-pay-for-that-response: after the villain attacks you, removes 1 threat per damage taken (max 5)", () => {
    const { state: opened, id: pay4 } = openHandFor("10016", SHE_HULK, { extraDeck: ["10015"] });
    const given = moveToHand(opened, P1, "10015");
    const [toeToToe] = given.ids as readonly [InstanceId];
    const staged = patchInstance(given.state, given.state.mainScheme.instanceId, { threat: 20 });
    const identity = identityOf(staged);
    const cost = filler(staged, 2, [pay4, toeToToe]);
    const midPlay = runWith(PLAYABLE_DEPS, cost.state, play(P1, toeToToe, [cost.ids[0]!]));
    const atDefend = settle(
      midPlay,
      firstLegal,
      (s) => s.pendingChoice?.prompt.kind === "declareDefender",
      PLAYABLE_DEPS,
    );
    const declined = answer(atDefend, ["decline"], PLAYABLE_DEPS); // undefended: the attack deals damage
    const threatBefore = inst(declined, declined.mainScheme.instanceId).threat;
    const damageTaken = inst(declined, identity).damage - inst(staged, identity).damage;
    expect(damageTaken).toBeGreaterThan(0);
    const triggered = answer(declined, [`${pay4}:10016.youll-pay-for-that-response`], PLAYABLE_DEPS);
    const paid = answer(triggered, [`hand:${cost.ids[1]!}`], PLAYABLE_DEPS);
    const after = settle(paid, firstLegal, undefined, PLAYABLE_DEPS);
    expect(inst(after, after.mainScheme.instanceId).threat).toBe(threatBefore - Math.min(damageTaken, 5));
  });

  it("10018.martial-prowess-resource: generates a [physical] resource for an Attack event only", () => {
    const { state: opened, id: prowess } = openHandFor("10018", SHE_HULK, { extraDeck: ["10014", "10019"] });
    const given = moveToHand(opened, P1, "10014"); // Drop Kick: an Attack event, cost 3
    const [dropKick] = given.ids as readonly [InstanceId];
    const pay = filler(given.state, 2, [prowess, dropKick]);
    const armed = playCard(pay.state, prowess, pay.ids);
    expect(inst(armed, prowess).attachedTo).toBeTruthy();
    const villain = activeVillain(armed).instanceId;
    const others = filler(armed, 2, [prowess, dropKick]);
    const after = settle(
      runWith(
        PLAYABLE_DEPS,
        others.state,
        play(P1, dropKick, others.ids, { abilities: [resourceAbility(prowess, "10018.martial-prowess-resource")] }),
      ),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(after, prowess).exhausted).toBe(true);
    expect(inst(after, villain).damage).toBe(inst(armed, villain).damage + 4);

    // Not an Attack event (To the Rescue! is a Thwart event): the resource may not pay for it.
    const rescue = moveToHand(others.state, P1, "10019");
    const refused = applyCommand(
      rescue.state,
      play(P1, rescue.ids[0]!, [], { abilities: [resourceAbility(prowess, "10018.martial-prowess-resource")] }),
      PLAYABLE_DEPS,
    );
    expect(refused.ok).toBe(false);
  });
});

describe("Hulk pack basic cards, from Spider-Man (Justice)'s own deck", () => {
  it("10019.to-the-rescue-action: removes 2 threat from a scheme", () => {
    const { state: opened, id } = openHandFor("10019", SPIDER_MAN);
    const staged = patchInstance(opened, opened.mainScheme.instanceId, { threat: 5 });
    const pay = filler(staged, 2, [id]);
    const after = playCard(pay.state, id, pay.ids);
    expect(mainThreat(after)).toBe(3);
  });

  it("10032.resourceful-resource: discarding Resourceful generates a [wild] resource", () => {
    const { state: opened, id: resourceful } = openHandFor("10032", SPIDER_MAN);
    const pay = filler(opened, 1, [resourceful]);
    const inPlay = playCard(pay.state, resourceful, pay.ids);
    expect(inst(inPlay, resourceful).attachedTo).toBeTruthy();
    const given = moveToHand(inPlay, P1, "01008"); // Web-Shooter, cost 1, paid only by the resource ability
    const [webShooter] = given.ids as readonly [InstanceId];
    const after = settle(
      runWith(
        PLAYABLE_DEPS,
        given.state,
        play(P1, webShooter, [], { abilities: [resourceAbility(resourceful, "10032.resourceful-resource")] }),
      ),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(cardsInPlay(after)).toContain(webShooter);
    expect(playerOf(after, P1).discard).toContain(resourceful);
  });
});

describe("Hulk pack justice card, from Spider-Man (Justice)'s own deck", () => {
  it("10029.beat-cop-action: Exhaust Beat Cop to move 1 threat from a scheme onto Beat Cop", () => {
    const { state: opened, id: beatCop } = openHandFor("10029", SPIDER_MAN);
    const pay = filler(opened, 3, [beatCop]);
    const played = playCard(pay.state, beatCop, pay.ids);
    const staged = patchInstance(played, played.mainScheme.instanceId, { threat: 5 });
    const after = settle(
      runWith(PLAYABLE_DEPS, staged, use(P1, beatCop, "10029.beat-cop-action")),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(mainThreat(after)).toBe(4);
    expect(inst(after, beatCop).threat).toBe(1);
    expect(inst(after, beatCop).exhausted).toBe(true);
  });

  it("10029.beat-cop-action-2: Exhaust and discard Beat Cop to deal 1 damage to a minion per threat on it", () => {
    const { state: opened, id: beatCop } = openHandFor("10029", SPIDER_MAN);
    const pay = filler(opened, 3, [beatCop]);
    const played = playCard(pay.state, beatCop, pay.ids);
    const { state, minion } = withMinion(played, "01102"); // Sandman, 4 HP
    const staged = patchInstance(state, beatCop, { threat: 3 });
    const before = inst(staged, minion).damage;
    const after = settle(
      runWith(PLAYABLE_DEPS, staged, use(P1, beatCop, "10029.beat-cop-action-2")),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(playerOf(after, P1).discard).toContain(beatCop);
    expect(inst(after, minion).damage).toBe(before + 3);
  });

  // RRG 1.8 "Action" (p. 5) puts no form on a plain "Action:" ability; only "Hero Action" /
  // "Alter-Ego Action" are form-gated. Beat Cop prints plain "Action:" on both abilities.
  it("10029.beat-cop-action: plain 'Action:' is usable in alter-ego form too", () => {
    const { state: opened, id: beatCop } = openHandFor("10029", SPIDER_MAN, { alterEgo: true });
    const pay = filler(opened, 3, [beatCop]);
    const played = playCard(pay.state, beatCop, pay.ids);
    const staged = patchInstance(played, played.mainScheme.instanceId, { threat: 5 });
    const after = settle(
      runWith(PLAYABLE_DEPS, staged, use(P1, beatCop, "10029.beat-cop-action")),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(mainThreat(after)).toBe(4);
  });
});

describe("Hulk pack leadership card, from Captain Marvel (Leadership)'s own deck", () => {
  it("10030.inspiring-presence-action: heals 1 damage from an ally and readies it", () => {
    const { state: opened, id } = openHandFor("10030", CAP_MARVEL);
    const owner = playerOf(opened, P1);
    const allyId = [...owner.hand, ...owner.deck].find((c) => {
      const card = cardOf(opened, c);
      return card.type === "ally" && card.cost <= 3;
    });
    if (!allyId) throw new Error("no cheap ally in the Captain Marvel deck");
    const ally = cardOf(opened, allyId);
    if (ally.type !== "ally") throw new Error("not an ally");
    const given = moveToHand(opened, P1, ally.id as string);
    const [allyInstance] = given.ids as readonly [InstanceId];
    const pay = filler(given.state, ally.cost, [id, allyInstance]);
    const inPlay = playCard(pay.state, allyInstance, pay.ids);
    const hurt = patchInstance(inPlay, allyInstance, { damage: 1, exhausted: true });
    const cost = filler(hurt, 1, [id, allyInstance]);
    const after = playCard(cost.state, id, cost.ids);
    expect(inst(after, allyInstance).damage).toBe(0);
    expect(inst(after, allyInstance).exhausted).toBe(false);
  });
});

describe("Hulk pack protection card, from Black Panther (Protection)'s own deck", () => {
  it("10031.electrostatic-armor-response: after you defend, deals 1 damage to the attacking character", () => {
    const { state: opened, id: armor } = openHandFor("10031", BLACK_PANTHER);
    const pay = filler(opened, 1, [armor]);
    const armed = playCard(pay.state, armor, pay.ids);
    expect(inst(armed, armor).attachedTo).toBe(identityOf(armed));
    const identity = identityOf(armed);
    const villain = activeVillain(armed).instanceId;
    const stackedAdvance = stackEncounterDeck(armed, "01186");
    const defend = (state: GameState, pick: Picker): GameState => {
      const atDefend = settle(
        runWith(PLAYABLE_DEPS, state, endTurn(P1)),
        firstLegal,
        (s) => s.pendingChoice?.prompt.kind === "declareDefender",
        PLAYABLE_DEPS,
      );
      return settle(answer(atDefend, [identity], PLAYABLE_DEPS), pick, undefined, PLAYABLE_DEPS);
    };
    const withResponse = defend(stackedAdvance, accepting("10031.electrostatic-armor-response"));
    // Control: the same defense declining the response. Black Panther's own Retaliate 1 is common to both runs.
    const declined = defend(stackedAdvance, firstLegal);
    expect(inst(withResponse, villain).damage).toBe(inst(declined, villain).damage + 1);
  });
});
