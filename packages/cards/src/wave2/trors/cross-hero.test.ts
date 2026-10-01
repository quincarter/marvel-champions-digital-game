import { CORE_STARTER_DECKS, PLAYABLE_CARDS, type AnyCard, type CardId } from "@mc/content";
import {
  characterProfile,
  createGame,
  hasKeyword,
  remainingHitPoints,
  traitsOf,
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
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  picking,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { encounterCardInVillainArea } from "../../testing/staging.js";
import { forceMinionIntoPlay } from "../../wave1/thor/testing.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, "Cards in another hero's deck"): every The Rise of
 * Red Skull (`trors`) aspect/basic player card that has an ability script, played through the engine from a Core
 * hero's own precon instead of Hawkeye's or Spider-Woman's. Cards whose own `aspect` is `hero:<id>` (RRG 1.8
 * "Identity-Specific Card", p. 23) are not covered here.
 *
 * Covered (14): 04011 Hawkeye, 04012 Black Knight, 04013 Goliath, 04015 Sky Cycle (both abilities), 04016 Team
 * Training, 04017 Ready for Action, 04020 War Machine, 04022 Earth's Mightiest Heroes, 04040 Spider-Girl, 04043
 * Press the Advantage, 04044 Piercing Strike, 04045 Spider-Man, 04047 Skilled Investigator, 04049 Clear the Area.
 * Skipped: 04018 Lead from the Front (verbatim Core 01070), 04019 The Power of Leadership (Core 03018), 04021
 * Avengers Tower (03024), 04041 Combat Training (01057), 04042 Tac Team (01056), 04046 Heroic Intuition (01065),
 * 04048 Interrogation Room (08015), all aliased in `../reprints.ts`; 04014 U.S. Agent prints only the Retaliate
 * keyword (`abilities: []`); 04023-04025 and 04050-04052 are resources with no ability; 04097-04100 (Moon Knight,
 * Shang-Chi, White Tiger, Elektra) and 04155-04162 are campaign-specific (`specificTo`), covered by
 * `campaign-cards.test.ts`.
 *
 * Seats: leadership in Captain Marvel/Leadership, aggression in She-Hulk/Aggression, justice and basic in
 * Spider-Man/Justice (`CORE_HERO_FOR_ASPECT`); 04045 Spider-Man is unique and cannot sit in Core Spider-Man's own
 * deck, so it is seated in a hand-built Captain Marvel/Justice deck.
 */

const SPIDER_MAN = "core-spider-man-justice";
const SHE_HULK = "core-she-hulk-aggression";
const CAP_MARVEL = "core-captain-marvel-leadership";

/** Advance (01186): no boost icons, 1 threat; used as villain-phase filler. Bomb Scare (01109) is a side scheme. */
const ADVANCE = "01186";
const BOMB_SCARE = "01109";

const BY_ID = new Map<string, AnyCard>(PLAYABLE_CARDS.map((c) => [c.id as string, c]));
const cardOf = (state: GameState, id: InstanceId): AnyCard => BY_ID.get(state.instances[id]!.cardId as string)!;

const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) =>
  runWith(PLAYABLE_DEPS, state, ...commands);
const settled = (state: GameState, pick: Picker = firstLegal, stop?: (s: GameState) => boolean) =>
  settle(state, pick, stop, PLAYABLE_DEPS);

const toHeroFirst = (state: GameState): GameState => settled(run(state, toHero(P1)));

/** Opening state with `code` in P1's hand, seated in `coreHero`'s own precon (`buildCrossHeroDeck`). */
function openHandFor(
  code: string,
  coreHero: string,
  options: {
    readonly heroForm?: boolean;
    readonly extraDeck?: readonly string[];
    readonly seat?: PlayerSetup;
  } = {},
): { readonly state: GameState; readonly id: InstanceId } {
  const seat = options.seat ?? buildCrossHeroDeck(PLAYABLE_CARDS, coreHero, code);
  const seated: PlayerSetup = options.extraDeck
    ? { ...seat, deck: [...seat.deck, ...options.extraDeck.map((c) => c as never)] }
    : seat;
  const created = createGame(playableScenario("rhino", { seed: 11, players: [seated] }), PLAYABLE_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
  const ready = options.heroForm === false ? opening : toHeroFirst(opening);
  const { state, ids } = moveToHand(ready, P1, code);
  return { state, id: ids[0]! };
}

/** Moves `n` single-value non-resource cards into P1's hand (never `exclude`) and returns their ids: a payment's
 * size is then exactly its value. */
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
    if (seen.has(id) || card.type === "resource") continue;
    seen.add(id);
    codes.push(card.id as string);
  }
  if (codes.length < n) throw new Error(`only ${codes.length} filler cards found`);
  const probe = moveToHand(state, P1, ...codes);
  return { state: probe.state, ids: probe.ids.filter((id) => !exclude.includes(id)) };
}

/** Accepts the named optional response/interrupt (by ability id), pays/declines everything else. */
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
): GameState => settled(run(state, play(P1, id, payment, attachTo ? { attachToInstanceId: attachTo } : {})), pick);

/** Plays `code` (cost `cost`, paid with `cost` filler cards) in `state`, returning the new state and its id. */
function playExtra(
  state: GameState,
  code: string,
  cost: number,
  pick: Picker = firstLegal,
  attachTo?: InstanceId,
): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const pay = filler(given.state, cost, [id]);
  return { state: playCard(pay.state, id, pay.ids, pick, attachTo), id };
}

/** Captain Marvel's identity and own cards with Spider-Man's precon justice and basic cards, plus `code`: a legal
 * Justice deck for a card (Spider-Man 04045) that Core Spider-Man's own deck cannot hold. */
function justiceCaptainMarvel(code: string): PlayerSetup {
  const decks = new Map(CORE_STARTER_DECKS.map((d) => [d.id as string, d]));
  const cap = decks.get(CAP_MARVEL)!;
  const spider = decks.get(SPIDER_MAN)!;
  const isOwn = (id: string) =>
    String(BY_ID.get(id) && (BY_ID.get(id) as { aspect?: string }).aspect).startsWith("hero:");
  const entries = [
    ...cap.cards.filter((e) => isOwn(e.cardId as string)),
    ...spider.cards.filter((e) => !isOwn(e.cardId as string)),
  ];
  const deck = entries.flatMap((e) => Array.from({ length: e.quantity }, () => e.cardId as CardId));
  return { identityCardId: cap.identityCardId as CardId, aspects: ["justice"], deck: [...deck, code as CardId] };
}

const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const toughen = (state: GameState, id: InstanceId): GameState =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, tough: 1 } });
const printedResources = (card: AnyCard): number =>
  "resourceIcons" in card ? Object.values(card.resourceIcons).reduce((sum, n) => sum + (n ?? 0), 0) : 0;

describe("The Rise of Red Skull's leadership cards, from Captain Marvel (Leadership)'s own deck", () => {
  it("04011.hawkeye-action: exhausts and discards a card from hand to deal damage equal to its printed resources", () => {
    const { state: opened, id: hawkeye } = openHandFor("04011", CAP_MARVEL);
    const pay = filler(opened, 2, [hawkeye]);
    const withHawkeye = playCard(pay.state, hawkeye, pay.ids);
    // Any hand card that prints resources: the damage is exactly their total.
    const fodder = playerOf(withHawkeye, P1).hand.find(
      (id) => id !== hawkeye && printedResources(cardOf(withHawkeye, id)) > 0,
    )!;
    const x = printedResources(cardOf(withHawkeye, fodder));
    expect(x).toBeGreaterThan(0);
    const villain = villainOf(withHawkeye);
    const after = settled(
      run(withHawkeye, use(P1, hawkeye, "04011.hawkeye-action", [], { discard: [fodder] })),
      picking(villain),
    );
    expect(inst(after, hawkeye).exhausted).toBe(true);
    expect(playerOf(after, P1).discard).toContain(fodder);
    expect(inst(after, villain).damage).toBe(x);
  });

  it("04012.black-knight-constant: his basic attack gains piercing (discards a tough card and still deals damage)", () => {
    const { state: opened, id: knight } = openHandFor("04012", CAP_MARVEL);
    const pay = filler(opened, 3, [knight]);
    const withKnight = playCard(pay.state, knight, pay.ids);
    expect(hasKeyword(withKnight, knight, "piercing", PLAYABLE_DEPS)).toBe(true);
    const villain = villainOf(withKnight);
    const toughened = toughen(withKnight, villain);
    const after = settled(
      run(toughened, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: knight,
        targetInstanceId: villain,
      }),
    );
    // RRG 1.8 "Piercing" (p. 32): the tough status is discarded first and the attack's damage still lands.
    expect(inst(after, villain).statuses.tough).toBe(0);
    expect(inst(after, villain).damage).toBe(characterProfile(withKnight, knight, PLAYABLE_DEPS)!.atk);
  });

  it("04013.goliath-action: +4 ATK until end of phase, then he is discarded at the end of the phase", () => {
    const { state: opened, id: goliath } = openHandFor("04013", CAP_MARVEL);
    const pay = filler(opened, 4, [goliath]);
    const withGoliath = playCard(pay.state, goliath, pay.ids);
    const base = characterProfile(withGoliath, goliath, PLAYABLE_DEPS)!.atk;
    const boosted = settled(run(withGoliath, use(P1, goliath, "04013.goliath-action")));
    expect(characterProfile(boosted, goliath, PLAYABLE_DEPS)!.atk).toBe(base + 4);
    const stacked = stackEncounterDeck(boosted, ADVANCE, ADVANCE);
    const after = settled(run(stacked, endTurn()), firstLegal, (s) => s.step.phase === "player" && !s.pendingChoice);
    expect(playerOf(after, P1).discard).toContain(goliath);
    expect(playerOf(after, P1).playArea).not.toContain(goliath);
  });

  it("04015.sky-cycle-constant + -action: the attached Avenger ally gains Aerial, and exhausting Sky Cycle readies it", () => {
    const { state: opened, id: cycle } = openHandFor("04015", CAP_MARVEL, { extraDeck: ["04012"] });
    const knight = playExtra(opened, "04012", 3);
    const pay = filler(knight.state, 1, [cycle, knight.id]);
    const attached = playCard(pay.state, cycle, pay.ids, firstLegal, knight.id);
    expect(inst(attached, cycle).attachedTo).toBe(knight.id);
    expect(traitsOf(attached, knight.id, PLAYABLE_DEPS).map(String)).toContain("AERIAL");
    const tired = patchInstance(attached, knight.id, { exhausted: true });
    const after = settled(run(tired, use(P1, cycle, "04015.sky-cycle-action")));
    expect(inst(after, knight.id).exhausted).toBe(false);
    expect(inst(after, cycle).exhausted).toBe(true);
  });

  it("04016.team-training-constant: each ally you control gets +1 hit point", () => {
    const { state: opened, id: training } = openHandFor("04016", CAP_MARVEL, { extraDeck: ["04012"] });
    const knight = playExtra(opened, "04012", 3);
    const before = remainingHitPoints(knight.state, knight.id, PLAYABLE_DEPS)!;
    const pay = filler(knight.state, 2, [training, knight.id]);
    const after = playCard(pay.state, training, pay.ids);
    expect(playerOf(after, P1).playArea).toContain(training);
    expect(remainingHitPoints(after, knight.id, PLAYABLE_DEPS)).toBe(before + 1);
  });

  it("04017.ready-for-action-action: gives an ally you control a tough status card", () => {
    const { state: opened, id: ready } = openHandFor("04017", CAP_MARVEL, { extraDeck: ["04012"] });
    const knight = playExtra(opened, "04012", 3);
    expect(inst(knight.state, knight.id).statuses.tough).toBe(0);
    const pay = filler(knight.state, 1, [ready, knight.id]);
    const after = playCard(pay.state, ready, pay.ids);
    expect(inst(after, knight.id).statuses.tough).toBe(1);
    expect(playerOf(after, P1).discard).toContain(ready);
  });
});

describe("The Rise of Red Skull's basic cards, from Spider-Man (Justice)'s own deck", () => {
  it("04020.war-machine-constant: enters play tough (Toughness) and his basic attack gains ranged", () => {
    const { state: opened, id: warMachine } = openHandFor("04020", SPIDER_MAN);
    const pay = filler(opened, 4, [warMachine]);
    const after = playCard(pay.state, warMachine, pay.ids);
    expect(inst(after, warMachine).statuses.tough).toBe(1);
    expect(hasKeyword(after, warMachine, "ranged", PLAYABLE_DEPS)).toBe(true);
  });

  it("04022.earths-mightiest-heroes-action: exhaust an Avenger you control to ready another Avenger you control", () => {
    const { state: opened, id: event } = openHandFor("04022", SPIDER_MAN, { extraDeck: ["04020"] });
    const warMachine = playExtra(opened, "04020", 4);
    const identity = identityOf(warMachine.state);
    expect(traitsOf(warMachine.state, identity, PLAYABLE_DEPS).map(String)).toContain("AVENGER");
    // War Machine is the exhausted one to be readied; the (ready) hero is the only legal exhaust cost.
    const tired = patchInstance(warMachine.state, warMachine.id, { exhausted: true });
    const after = playCard(tired, event, []);
    expect(inst(after, identity).exhausted).toBe(true);
    expect(inst(after, warMachine.id).exhausted).toBe(false);
  });
});

describe("The Rise of Red Skull's aggression cards, from She-Hulk (Aggression)'s own deck", () => {
  it("04040.spider-girl-response: after she is played, stuns and confuses a minion", () => {
    const { state: opened, id: girl } = openHandFor("04040", SHE_HULK);
    const minion = instancesOf(opened, "01101")[0]!; // Hydra Mercenary from the Rhino encounter deck
    const withMinion = forceMinionIntoPlay(opened, minion, P1);
    const pay = filler(withMinion, 2, [girl]);
    const after = playCard(pay.state, girl, pay.ids, accepting("04040.spider-girl-response"));
    expect(inst(after, minion).statuses.stunned).toBeGreaterThan(0);
    expect(inst(after, minion).statuses.confused).toBeGreaterThan(0);
  });

  it("04043.press-the-advantage-action: deals 2 damage and draws 1 card only if the enemy is stunned or confused", () => {
    const attackOnce = (stunned: boolean) => {
      const { state: opened, id } = openHandFor("04043", SHE_HULK);
      const villain = villainOf(opened);
      const staged = stunned
        ? patchInstance(opened, villain, { statuses: { ...inst(opened, villain).statuses, stunned: 1 } })
        : opened;
      const pay = filler(staged, 1, [id]);
      const handBefore = playerOf(pay.state, P1).hand.length;
      const after = playCard(pay.state, id, pay.ids, picking(villain));
      return {
        damage: inst(after, villain).damage,
        handDelta: playerOf(after, P1).hand.length - handBefore,
      };
    };
    const plain = attackOnce(false);
    const stunned = attackOnce(true);
    expect(plain.damage).toBe(2);
    expect(stunned.damage).toBe(2);
    // The event and its payment leave hand (-2); the stunned enemy additionally draws 1.
    expect(plain.handDelta).toBe(-2);
    expect(stunned.handDelta).toBe(-1);
  });

  it("04044.piercing-strike-action: deals 3 damage and the attack gains piercing (discards a tough card, damage still lands)", () => {
    const { state: opened, id } = openHandFor("04044", SHE_HULK);
    const villain = villainOf(opened);
    const toughened = toughen(opened, villain);
    const pay = filler(toughened, 2, [id]);
    const after = playCard(pay.state, id, pay.ids, picking(villain));
    expect(inst(after, villain).statuses.tough).toBe(0);
    expect(inst(after, villain).damage).toBe(3);
  });
});

describe("The Rise of Red Skull's justice cards, from Spider-Man (Justice)'s own deck", () => {
  it("04045.spider-man-response: after he is played, removes 3 per-hero threat from a side scheme", () => {
    // Spider-Man (Peter Parker) is unique and matches Core Spider-Man's own identity, so the justice deck is seated
    // under Captain Marvel instead (RRG 1.8 Appendix I deck-building: one aspect plus basic).
    const { state: opened, id: spiderMan } = openHandFor("04045", SPIDER_MAN, { seat: justiceCaptainMarvel("04045") });
    const scheme = encounterCardInVillainArea(opened, BOMB_SCARE, 5);
    const pay = filler(scheme.state, 5, [spiderMan]);
    const after = playCard(pay.state, spiderMan, pay.ids, accepting("04045.spider-man-response"));
    expect(playerOf(after, P1).playArea).toContain(spiderMan);
    expect(inst(after, scheme.id).threat).toBe(2); // one hero: 3 per hero is 3
  });

  it("04047.skilled-investigator-response: after a side scheme is defeated, exhausts to draw 1 card", () => {
    const { state: opened, id: investigator } = openHandFor("04047", SPIDER_MAN);
    const withCard = playCard(opened, investigator, []);
    const identity = identityOf(withCard);
    const scheme = encounterCardInVillainArea(withCard, BOMB_SCARE, 1);
    const handBefore = playerOf(scheme.state, P1).hand.length;
    const after = settled(
      run(scheme.state, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme.id,
      }),
      accepting("04047.skilled-investigator-response"),
    );
    expect(inst(after, investigator).exhausted).toBe(true);
    expect(playerOf(after, P1).hand.length).toBe(handBefore + 1);
  });

  it("04049.clear-the-area-action: removes 2 threat; draws 1 card only if that removes the last threat", () => {
    const thwartOnce = (threat: number) => {
      const { state: opened, id } = openHandFor("04049", SPIDER_MAN);
      const scheme = encounterCardInVillainArea(opened, BOMB_SCARE, threat);
      const pay = filler(scheme.state, 1, [id]);
      const handBefore = playerOf(pay.state, P1).hand.length;
      const after = playCard(pay.state, id, pay.ids, picking(scheme.id));
      return {
        threat: inst(after, scheme.id).threat,
        handDelta: playerOf(after, P1).hand.length - handBefore,
      };
    };
    const notLast = thwartOnce(3);
    const last = thwartOnce(2);
    expect(notLast.threat).toBe(1);
    expect(notLast.handDelta).toBe(-2);
    expect(last.threat).toBe(0);
    expect(last.handDelta).toBe(-1);
  });
});
