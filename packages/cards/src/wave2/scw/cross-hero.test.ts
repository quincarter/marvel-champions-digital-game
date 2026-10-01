import { PLAYABLE_CARDS, type AnyCard } from "@mc/content";
import {
  applyCommand,
  characterProfile,
  createGame,
  traitsOf,
  type GameState,
  type InstanceId,
  type PlayerSetup,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "../../playable/index.js";
import { buildCrossHeroDeck } from "../../testing/cross-hero.js";
import {
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
  type Picker,
} from "../../testing/harness.js";
import { encounterCardInVillainArea } from "../../testing/staging.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, "Cards in another hero's deck"): every Scarlet Witch
 * pack (`scw`, 15001a-15031) aspect/basic player card that has an ability script — every one whose own `aspect` is not
 * `hero:15001a` (an identity-specific card, RRG 1.8 "Identity-Specific Card", p. 23, only a Scarlet Witch deck could
 * hold) — played through the engine from a Core hero's own precon instead of Scarlet Witch's.
 *
 * Covered (13): 15010 Speed, 15011 Wiccan, 15012 Crisis Averted, 15013 Multitasking, 15014 Swift Retribution, 15015
 * Turn the Tide, 15019 Spiritual Meditation (refused: Core heroes lack the Mystic trait), 15028 Browbeat, 15029 Last
 * Stand, 15030 Bait and Switch, 15031 Recuperation, 15018 Order and Chaos (refused: Team-Up, RRG 1.8 "Team-Up" p. 43,
 * the deck itself is illegal). Form checks: a printed "Hero Action" is refused in alter-ego form (Crisis Averted,
 * Browbeat, Bait and Switch) and the printed "Alter-Ego Action" (Recuperation) is refused in hero form.
 * Skipped: 15016 The Power of Justice (verbatim Core 01062) and 15017 Heroic Intuition (verbatim Core 01065), both
 * aliased in `../reprints.ts`; 15020-15022 Energy/Genius/Strength print no ability (Core 01088-01090 reprints);
 * 15002-15009 are identity-specific (`hero:15001a`); 15023-15027 are the obligation/nemesis cards.
 *
 * Seats: justice and basic cards in Spider-Man/Justice, aggression in She-Hulk/Aggression, leadership in Captain
 * Marvel/Leadership, protection in Black Panther/Protection (`CORE_HERO_FOR_ASPECT`).
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

/** Advance (01186): no boost icons, 1 threat; villain-phase filler. Bomb Scare (01109) is a side scheme. Hydra
 * Mercenary (01101) is a minion printing exactly 1 boost icon. */
const ADVANCE = "01186";
const BOMB_SCARE = "01109";
const HYDRA_MERCENARY = "01101";

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
const hasMental = (card: AnyCard): boolean => "resourceIcons" in card && (card.resourceIcons.mental ?? 0) > 0;
const singleIcon = (card: AnyCard): boolean => iconTotal(card) === 1;
const singleNonMental = (card: AnyCard): boolean => singleIcon(card) && !hasMental(card);
const singleMental = (card: AnyCard): boolean => singleIcon(card) && hasMental(card);

/** Moves `n` non-resource cards passing `ok` into P1's hand (never `exclude`): single-value payment cards, so a
 * payment's size is exactly its value. */
function filler(
  state: GameState,
  n: number,
  exclude: readonly InstanceId[] = [],
  ok: (card: AnyCard) => boolean = singleIcon,
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

const playCard = (state: GameState, id: InstanceId, payment: readonly InstanceId[], pick: Picker = firstLegal) =>
  settle(runWith(PLAYABLE_DEPS, state, play(P1, id, payment)), pick, undefined, PLAYABLE_DEPS);

const refused = (state: GameState, id: InstanceId, payment: readonly InstanceId[] = []): boolean =>
  !applyCommand(state, play(P1, id, payment), PLAYABLE_DEPS).ok;

const profileOf = (state: GameState, id: InstanceId) => characterProfile(state, id, PLAYABLE_DEPS)!;
const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;

const basicThwart = (state: GameState, thwarter: InstanceId, scheme: InstanceId, pick: Picker = firstLegal) =>
  settle(
    runWith(PLAYABLE_DEPS, state, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: thwarter,
      schemeInstanceId: scheme,
    }),
    pick,
    undefined,
    PLAYABLE_DEPS,
  );

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

/** Plays ally `code` (seated by `extraDeck`), paying its printed cost with fillers, from hero form. */
function playAlly(state: GameState, code: string, exclude: readonly InstanceId[]) {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as readonly [InstanceId];
  const pay = filler(given.state, costOf(code), [...exclude, id]);
  return { state: playCard(pay.state, id, pay.ids), id };
}

describe("Scarlet Witch's justice cards, from Spider-Man (Justice)'s own deck", () => {
  it("15010.speed-response: after Speed thwarts, readies him", () => {
    const { state: opened, id: speed } = openHandFor("15010", SPIDER_MAN);
    const pay = filler(opened, costOf("15010"), [speed]);
    const inPlay = playCard(pay.state, speed, pay.ids);
    const scheme = inPlay.mainScheme.instanceId;
    const threatened = patchInstance(inPlay, scheme, { threat: 10 });
    const declined = basicThwart(threatened, speed, scheme);
    expect(inst(declined, speed).exhausted).toBe(true); // control: without the Response he stays exhausted
    const after = basicThwart(threatened, speed, scheme, accepting("15010.speed-response"));
    expect(inst(after, scheme).threat).toBe(10 - profileOf(inPlay, speed).thw);
    expect(inst(after, speed).exhausted).toBe(false);
  });

  it("15011.wiccan-response: after Wiccan thwarts, discards the top encounter card and deals 1 damage per boost icon", () => {
    const { state: opened, id: wiccan } = openHandFor("15011", SPIDER_MAN);
    const pay = filler(opened, costOf("15011"), [wiccan]);
    const inPlay = playCard(pay.state, wiccan, pay.ids);
    const scheme = inPlay.mainScheme.instanceId;
    const staged = stackEncounterDeck(patchInstance(inPlay, scheme, { threat: 10 }), HYDRA_MERCENARY);
    const villain = villainOf(staged);
    const before = inst(staged, villain).damage;
    const after = basicThwart(staged, wiccan, scheme, accepting("15011.wiccan-response", "enemy"));
    expect(inst(after, villain).damage).toBe(before + 1); // Hydra Mercenary prints 1 boost icon
  });

  it("15012.crisis-averted-action: removes 6 threat from the main scheme; refused in alter-ego form (Hero Action)", () => {
    const { state: opened, id } = openHandFor("15012", SPIDER_MAN);
    const scheme = opened.mainScheme.instanceId;
    const threatened = patchInstance(opened, scheme, { threat: 10 });
    const pay = filler(threatened, costOf("15012"), [id]);
    const after = playCard(pay.state, id, pay.ids);
    expect(inst(after, scheme).threat).toBe(4);
    expect(playerOf(after, P1).discard).toContain(id);

    const { state: ego, id: egoId } = openHandFor("15012", SPIDER_MAN, { alterEgo: true });
    const egoPay = filler(ego, costOf("15012"), [egoId]);
    expect(refused(egoPay.state, egoId, egoPay.ids)).toBe(true);
  });

  it("15013.multitasking-action: removes 2 threat from a scheme, and 2 from a different scheme if paid with [mental]", () => {
    const thwartedTotal = (mental: boolean): number => {
      const { state: opened, id } = openHandFor("15013", SPIDER_MAN);
      const side = encounterCardInVillainArea(opened, BOMB_SCARE, 5);
      const main = side.state.mainScheme.instanceId;
      const threatened = patchInstance(side.state, main, { threat: 10 });
      const pay = filler(threatened, costOf("15013"), [id], mental ? singleMental : singleNonMental);
      const after = playCard(pay.state, id, pay.ids);
      return 10 + 5 - (inst(after, main).threat + inst(after, side.id).threat);
    };
    expect(thwartedTotal(false)).toBe(2);
    expect(thwartedTotal(true)).toBe(4);
  });

  it("15014.swift-retribution-action: the villain schemes, then takes 4 damage", () => {
    const { state: opened, id } = openHandFor("15014", SPIDER_MAN);
    const villain = villainOf(opened);
    const threatBefore = mainThreat(opened);
    const damageBefore = inst(opened, villain).damage;
    const pay = filler(opened, costOf("15014"), [id]);
    const after = playCard(pay.state, id, pay.ids);
    expect(mainThreat(after)).toBeGreaterThan(threatBefore);
    expect(inst(after, villain).damage).toBe(damageBefore + 4);
  });

  // Printed "Response (attack): After your hero thwarts and removes all threat from a scheme" - fires on the hero's
  // thwart (a side scheme defeated), not on the event's own action.
  it("15015.turn-the-tide-response: after your hero thwarts away a scheme's last threat, deals 3 damage to an enemy", () => {
    const { state: opened, id: tide } = openHandFor("15015", SPIDER_MAN);
    const scheme = encounterCardInVillainArea(opened, BOMB_SCARE, 1);
    const villain = villainOf(scheme.state);
    const before = inst(scheme.state, villain).damage;
    const after = basicThwart(
      scheme.state,
      identityOf(scheme.state),
      scheme.id,
      accepting("15015.turn-the-tide-response", "enemy"),
    );
    expect(inst(after, villain).damage).toBe(before + 3);
    expect(playerOf(after, P1).discard).toContain(tide);
  });
});

describe("Scarlet Witch's basic cards, from Spider-Man (Justice)'s own deck", () => {
  // RRG 1.8 "Team-Up" (p. 43): the card cannot be in a deck unless the identity matches a named hero.
  it("15018.order-and-chaos-interrupt: refused, since no Core hero deck may include a Team-Up (Quicksilver and Scarlet Witch) card", () => {
    const seat = buildCrossHeroDeck(PLAYABLE_CARDS, SPIDER_MAN, "15018");
    expect(createGame(buildScenario([seat]), PLAYABLE_DEPS).ok).toBe(false);
  });

  it("15019.spiritual-meditation-action: refused in both forms, since no Core hero identity has the Mystic trait", () => {
    for (const alterEgo of [false, true]) {
      const { state, id } = openHandFor("15019", SPIDER_MAN, { alterEgo });
      expect(traitsOf(state, identityOf(state), PLAYABLE_DEPS).map(String)).not.toContain("MYSTIC");
      expect(refused(state, id)).toBe(true);
    }
  });

  it("15031.recuperation-action: heals damage from your alter-ego equal to REC; refused in hero form (Alter-Ego Action)", () => {
    const { state: opened, id } = openHandFor("15031", SPIDER_MAN, { alterEgo: true });
    const identity = identityOf(opened);
    const hurt = patchInstance(opened, identity, { damage: 6 });
    const rec = profileOf(hurt, identity).rec;
    expect(rec).toBeGreaterThan(0);
    const pay = filler(hurt, costOf("15031"), [id]);
    const after = playCard(pay.state, id, pay.ids);
    expect(inst(after, identity).damage).toBe(Math.max(0, 6 - rec));

    const { state: hero, id: heroId } = openHandFor("15031", SPIDER_MAN);
    const heroPay = filler(hero, costOf("15031"), [heroId]);
    expect(refused(heroPay.state, heroId, heroPay.ids)).toBe(true);
  });
});

describe("Scarlet Witch's aggression card, from She-Hulk (Aggression)'s own deck", () => {
  it("15028.browbeat-action: deals 2 damage plus the villain's stage number (max 3) to the villain; refused in alter-ego form", () => {
    const { state: opened, id } = openHandFor("15028", SHE_HULK);
    const villain = villainOf(opened);
    const stage = 1; // Rhino starts at stage 1
    const before = inst(opened, villain).damage;
    const pay = filler(opened, costOf("15028"), [id]);
    const after = playCard(pay.state, id, pay.ids);
    expect(inst(after, villain).damage).toBe(before + 2 + Math.min(stage, 3));

    const { state: ego, id: egoId } = openHandFor("15028", SHE_HULK, { alterEgo: true });
    const egoPay = filler(ego, costOf("15028"), [egoId]);
    expect(refused(egoPay.state, egoId, egoPay.ids)).toBe(true);
  });
});

describe("Scarlet Witch's leadership card, from Captain Marvel (Leadership)'s own deck", () => {
  it("15029.last-stand-interrupt: an ally you control gets +3 ATK for its attack, then is discarded", () => {
    const { state: opened, id: lastStand } = openHandFor("15029", CAP_MARVEL);
    const owner = playerOf(opened, P1);
    const allyId = [...owner.hand, ...owner.deck].find((id) => {
      const card = cardOf(opened, id);
      return card.type === "ally" && card.cost <= 3 && !card.unique;
    });
    // Seat a cheap non-unique Core Leadership ally from the precon itself; fall back to any ally.
    const allyCode = (allyId ??
      [...owner.hand, ...owner.deck].find((id) => cardOf(opened, id).type === "ally")!) as InstanceId;
    const code = cardOf(opened, allyCode).id as string;
    const { state: withAlly, id: ally } = playAlly(opened, code, [lastStand]);
    const villain = villainOf(withAlly);
    const before = inst(withAlly, villain).damage;
    const atk = profileOf(withAlly, ally).atk;
    const after = basicAttack(withAlly, ally, villain, accepting("15029.last-stand-interrupt"));
    expect(inst(after, villain).damage).toBe(before + atk + 3);
    expect(playerOf(after, P1).discard).toContain(ally);
    expect(playerOf(after, P1).discard).toContain(lastStand);
  });
});

describe("Scarlet Witch's protection card, from Black Panther (Protection)'s own deck", () => {
  it("15030.bait-and-switch-action: the villain attacks you, then removes 4 threat from the main scheme; refused in alter-ego form", () => {
    const { state: opened, id } = openHandFor("15030", BLACK_PANTHER);
    const hero = identityOf(opened);
    const scheme = opened.mainScheme.instanceId;
    const threatened = stackEncounterDeck(patchInstance(opened, scheme, { threat: 10 }), ADVANCE);
    const pay = filler(threatened, costOf("15030"), [id]);
    const after = playCard(pay.state, id, pay.ids);
    expect(inst(after, hero).damage).toBeGreaterThan(0); // the villain's attack landed (declined to defend)
    expect(inst(after, scheme).threat).toBe(6);

    const { state: ego, id: egoId } = openHandFor("15030", BLACK_PANTHER, { alterEgo: true });
    const egoPay = filler(ego, costOf("15030"), [egoId]);
    expect(refused(egoPay.state, egoId, egoPay.ids)).toBe(true);
  });
});
