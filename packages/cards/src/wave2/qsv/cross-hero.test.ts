import { PLAYABLE_CARDS, type AnyCard } from "@mc/content";
import {
  applyCommand,
  cardsInPlay,
  characterProfile,
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
import { forceMinionIntoPlay } from "../../wave1/thor/testing.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, "Cards in another hero's deck"): every Quicksilver
 * pack (`qsv`, 14001a-14032) aspect/basic player card that has an ability script — every one whose own `aspect` is
 * not `hero:14001a` (an identity-specific card, RRG 1.8 "Identity-Specific Card", p. 23, only a Quicksilver deck
 * could hold) — played through the engine from a Core hero's own precon instead of Quicksilver's.
 *
 * Covered (12): 14012 Multiple Man, 14013 Warlock (a plain "Action:" is usable in alter-ego form), 14014 Never
 * Back Down, 14015 Side Step (with and without an [energy] payment), 14017 Nerves of Steel, 14022 Adrenaline Rush,
 * 14023 Civic Duty (both "Hero Action:" upgrades: usable in hero form only), 14029 Brute Force (piercing and its
 * Forced Response), 14030 Sense of Justice, 14031 United We Stand (Avenger gate and hero-only), 14032 Beat 'Em Up
 * (hero-only), 14018 Order and Chaos (refused: Team-Up, RRG 1.8 "Team-Up" p. 43, the deck itself is illegal).
 * Skipped: 14016 Armored Vest (verbatim Core 01081, aliased in `../reprints.ts`); 14019 Energy, 14020 Genius,
 * 14021 Strength (verbatim Core 01075-01077 reprints, and print no ability); 14024-14028 are the obligation/nemesis
 * cards, not player aspect cards. Every other 14xxx card is aspect `hero:14001a`.
 *
 * Seats: protection cards in Black Panther/Protection, justice and basic in Spider-Man/Justice, aggression in
 * She-Hulk/Aggression, leadership in Captain Marvel/Leadership (`CORE_HERO_FOR_ASPECT`). Black Panther's hero side
 * has Retaliate 1, so defense tests compare deltas rather than asserting an absolute villain damage.
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

const iconTotal = (card: AnyCard): number =>
  "resourceIcons" in card ? Object.values(card.resourceIcons).reduce((a, b) => a + (b ?? 0), 0) : 0;
const hasIcon = (card: AnyCard, icon: "energy" | "mental" | "physical"): boolean =>
  "resourceIcons" in card && (card.resourceIcons[icon] ?? 0) > 0;
const singleIcon = (card: AnyCard): boolean => iconTotal(card) === 1;
const singleNonEnergy = (card: AnyCard): boolean => singleIcon(card) && !hasIcon(card, "energy");

/** Moves `n` non-resource cards passing `ok` into P1's hand (never `exclude`) and returns their ids — single-value
 * payment cards, so a payment's size is exactly its value (docs/phase7-wave1-scripting.md "Test conventions"). */
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

/** Takes as many options as a prompt allows for card/target choices ("up to X"), `firstLegal` otherwise. */
const takingMax: Picker = (state) => {
  const choice = state.pendingChoice;
  if (!choice) return [];
  const kind = choice.prompt.kind;
  return kind === "chooseTarget" || kind === "chooseCards"
    ? choice.options.slice(0, choice.maxSelections).map((o) => o.optionId)
    : firstLegal(state);
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

const useAbility = (state: GameState, id: InstanceId, ability: string, pay: readonly InstanceId[] = []): GameState =>
  settle(
    runWith(PLAYABLE_DEPS, state, use(P1, id, ability, pay.map((fromHand) => ({ fromHand })) as never)),
    firstLegal,
    undefined,
    PLAYABLE_DEPS,
  );

const profileOf = (state: GameState, id: InstanceId) => characterProfile(state, id, PLAYABLE_DEPS)!;

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

/** Returns every other hand card to the bottom of the deck: ending the turn discards down to hand size (the first
 * cards in hand go), which would otherwise throw away the payment card a defense test is tracking. */
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

/**
 * Hero-form state to the declare-defender prompt of Rhino's villain-phase attack. The boost card is `boost` (Crowd
 * Control, 01108: 2 boost icons, so Rhino's attack is 2 + 2 = 4), and Advance (01186, no icons) is P1's own encounter
 * card, so nothing else perturbs the attack.
 */
function atDefenderPrompt(state: GameState, boost = "01108"): GameState {
  const stacked = stackEncounterDeck(state, boost, "01186");
  return settle(
    runWith(PLAYABLE_DEPS, stacked, endTurn()),
    firstLegal,
    (s) => s.pendingChoice?.prompt.kind === "declareDefender",
    PLAYABLE_DEPS,
  );
}

/** Pays any `payForCard` with the given option (matching by suffix) and accepts the named response/interrupt. */
const defendingWith =
  (ability: string, payOptionSuffix?: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "payForCard") {
      const wanted = payOptionSuffix ? choice.options.filter((o) => o.optionId.endsWith(payOptionSuffix)) : [];
      return (wanted.length > 0 ? wanted : choice.options).slice(0, 1).map((o) => o.optionId);
    }
    return accepting(ability)(state);
  };

describe("Quicksilver's protection cards, from Black Panther (Protection)'s own deck", () => {
  it("14012.multiple-man-response: after Multiple Man enters play, searches deck and hand for copies and puts them into play", () => {
    const seated = buildCrossHeroDeck(PLAYABLE_CARDS, BLACK_PANTHER, "14012").deck.filter((c) => c === "14012").length;
    const extra = Array.from({ length: 3 - seated }, () => "14012");
    const { state: opened, id } = openHandFor("14012", BLACK_PANTHER, { extraDeck: extra });
    const pay = filler(opened, costOf("14012"), [id]);
    const pick: Picker = (state) =>
      state.pendingChoice?.prompt.kind === "chooseCards"
        ? takingMax(state)
        : accepting("14012.multiple-man-response")(state);
    const after = playCard(pay.state, id, pay.ids, pick);
    const inPlay = playerOf(after, P1).playArea.filter((c) => inst(after, c).cardId === "14012");
    // The played copy's Response finds a second, whose own Response (it also entered play) finds the third.
    expect(inPlay).toHaveLength(3);
  });

  it("14013.warlock-action: a plain Action, usable in alter-ego form; spends a [mental] resource to heal up to 2 damage from Warlock", () => {
    const { state: opened, id: warlock } = openHandFor("14013", BLACK_PANTHER, { alterEgo: true });
    const mental = filler(opened, 1, [warlock], (c) => singleIcon(c) && hasIcon(c, "mental"));
    const pay = filler(mental.state, costOf("14013"), [warlock, ...mental.ids]);
    const inPlay = playCard(pay.state, warlock, pay.ids);
    expect(cardsInPlay(inPlay)).toContain(warlock);
    const hurt = patchInstance(inPlay, warlock, { damage: 3 });
    const after = useAbility(hurt, warlock, "14013.warlock-action", mental.ids);
    expect(inst(after, warlock).damage).toBe(1); // healed 2 of 3
    expect(playerOf(after, P1).hand).not.toContain(mental.ids[0]); // the [mental] card was spent
  });

  it("14014.never-back-down-interrupt: +2 DEF for the attack; when no damage is taken, the attacking enemy is stunned", () => {
    const { state: opened, id } = openHandFor("14014", BLACK_PANTHER);
    const pay = filler(opened, 1, [id]);
    const villain = pay.state.villains[0]!.instanceId;
    const reached = atDefenderPrompt(keepOnlyInHand(pay.state, [id, ...pay.ids]));
    const hero = identityOf(reached);
    const before = inst(reached, hero).damage;
    // Control: defending with no event. Rhino's ATK 2 + 2 boost = 4 against Black Panther's DEF 2 deals 2.
    const bare = settle(answer(reached, [hero], PLAYABLE_DEPS), firstLegal, undefined, PLAYABLE_DEPS);
    expect(inst(bare, hero).damage).toBe(before + 2);
    expect(inst(bare, villain).statuses.stunned).toBe(0);
    // With the event: DEF 2 + 2 = 4 absorbs the whole attack, so Rhino is stunned.
    const after = settle(
      answer(reached, [hero], PLAYABLE_DEPS),
      defendingWith("14014.never-back-down-interrupt", id),
      undefined,
      PLAYABLE_DEPS,
    );
    expect(playerOf(after, P1).discard).toContain(id);
    expect(inst(after, hero).damage).toBe(before);
    expect(inst(after, villain).statuses.stunned).toBeGreaterThan(0);
  });

  it("14015.side-step-interrupt: prevents 3 damage; deals 1 damage to the attacker only when paid with an [energy] resource", () => {
    const damageFor = (energy: boolean) => {
      const { state: opened, id } = openHandFor("14015", BLACK_PANTHER);
      const pay = filler(opened, 1, [id], energy ? (c) => singleIcon(c) && hasIcon(c, "energy") : singleNonEnergy);
      const villain = pay.state.villains[0]!.instanceId;
      const reached = atDefenderPrompt(keepOnlyInHand(pay.state, [id, ...pay.ids]));
      const hero = identityOf(reached);
      const heroBefore = inst(reached, hero).damage;
      const villainBefore = inst(reached, villain).damage;
      // Undefended: 2 + 2 boost = 4 damage; Side Step prevents 3, leaving 1.
      const after = settle(
        answer(reached, ["decline"], PLAYABLE_DEPS),
        defendingWith("14015.side-step-interrupt", pay.ids[0]),
        undefined,
        PLAYABLE_DEPS,
      );
      expect(playerOf(after, P1).discard).toContain(id);
      expect(inst(after, hero).damage).toBe(heroBefore + 1);
      return inst(after, villain).damage - villainBefore;
    };
    // Black Panther's own Retaliate 1 hits Rhino in both runs; only the [energy] payment adds the card's 1 damage.
    expect(damageFor(true) - damageFor(false)).toBe(1);
  });

  it("14017.nerves-of-steel-resource: exhausts to generate an [energy] resource toward a Defense event", () => {
    const { state: opened, id: nerves } = openHandFor("14017", BLACK_PANTHER, { extraDeck: ["14015"] });
    const pay = filler(opened, costOf("14017"), [nerves]);
    const inPlay = playCard(pay.state, nerves, pay.ids);
    expect(cardsInPlay(inPlay)).toContain(nerves);
    const given = moveToHand(inPlay, P1, "14015");
    const [sideStep] = given.ids as [InstanceId];
    const reached = atDefenderPrompt(keepOnlyInHand(given.state, [sideStep]));
    const after = settle(
      answer(reached, ["decline"], PLAYABLE_DEPS),
      defendingWith("14015.side-step-interrupt", `ability:${nerves}:14017.nerves-of-steel-resource`),
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(after, nerves).exhausted).toBe(true);
    expect(playerOf(after, P1).discard).toContain(sideStep);
  });
});

describe("Quicksilver's basic cards, from Spider-Man (Justice)'s own deck", () => {
  it("14022.adrenaline-rush-action: a Hero Action, +1 ATK until end of phase after discarding itself; not usable in alter-ego form", () => {
    const { state: opened, id } = openHandFor("14022", SPIDER_MAN);
    const hero = identityOf(opened);
    const before = profileOf(opened, hero).atk;
    const pay = filler(opened, costOf("14022"), [id]);
    const played = playCard(pay.state, id, pay.ids, firstLegal, hero);
    expect(inst(played, id).attachedTo).toBe(hero);
    const used = useAbility(played, id, "14022.adrenaline-rush-action");
    expect(profileOf(used, hero).atk).toBe(before + 1);
    expect(playerOf(used, P1).discard).toContain(id);

    const { state: ego, id: egoId } = openHandFor("14022", SPIDER_MAN, { alterEgo: true });
    const egoPay = filler(ego, costOf("14022"), [egoId]);
    const egoPlayed = playCard(egoPay.state, egoId, egoPay.ids, firstLegal, identityOf(ego));
    expect(inst(egoPlayed, egoId).attachedTo).toBe(identityOf(ego));
    const refused = applyCommand(egoPlayed, use(P1, egoId, "14022.adrenaline-rush-action"), PLAYABLE_DEPS);
    expect(refused.ok).toBe(false);
  });

  it("14023.civic-duty-action: a Hero Action, +1 THW until end of phase after discarding itself; not usable in alter-ego form", () => {
    const { state: opened, id } = openHandFor("14023", SPIDER_MAN);
    const hero = identityOf(opened);
    const before = profileOf(opened, hero).thw;
    const pay = filler(opened, costOf("14023"), [id]);
    const played = playCard(pay.state, id, pay.ids, firstLegal, hero);
    expect(inst(played, id).attachedTo).toBe(hero);
    const used = useAbility(played, id, "14023.civic-duty-action");
    expect(profileOf(used, hero).thw).toBe(before + 1);
    expect(playerOf(used, P1).discard).toContain(id);

    const { state: ego, id: egoId } = openHandFor("14023", SPIDER_MAN, { alterEgo: true });
    const egoPay = filler(ego, costOf("14023"), [egoId]);
    const egoPlayed = playCard(egoPay.state, egoId, egoPay.ids, firstLegal, identityOf(ego));
    expect(inst(egoPlayed, egoId).attachedTo).toBe(identityOf(ego));
    const refused = applyCommand(egoPlayed, use(P1, egoId, "14023.civic-duty-action"), PLAYABLE_DEPS);
    expect(refused.ok).toBe(false);
  });

  it("14032.beat-em-up-action: a Hero Action, deals 1 damage to the villain and each minion engaged with you; refused in alter-ego form", () => {
    const { state: opened, id } = openHandFor("14032", SPIDER_MAN);
    const minion = instancesOf(opened, "01101")[0]!;
    const staged = forceMinionIntoPlay(opened, minion, P1);
    const villain = staged.villains[0]!.instanceId;
    const pay = filler(staged, costOf("14032"), [id]);
    const after = playCard(pay.state, id, pay.ids);
    expect(playerOf(after, P1).discard).toContain(id);
    expect(inst(after, villain).damage).toBe(inst(staged, villain).damage + 1);
    expect(inst(after, minion).damage).toBe(inst(staged, minion).damage + 1);

    const { state: ego, id: egoId } = openHandFor("14032", SPIDER_MAN, { alterEgo: true });
    const egoPay = filler(ego, costOf("14032"), [egoId]);
    expect(applyCommand(egoPay.state, play(P1, egoId, egoPay.ids), PLAYABLE_DEPS).ok).toBe(false);
  });

  // RRG 1.8 "Team-Up" (p. 43): "You cannot include this card in your deck unless your alter-ego or hero title matches
  // name 1 or name 2." Order and Chaos (Quicksilver and Scarlet Witch) is not a card a Core deck may hold at all.
  it("14018.order-and-chaos-interrupt: refused, since no Core hero deck may include a Team-Up (Quicksilver and Scarlet Witch) card", () => {
    const seat = buildCrossHeroDeck(PLAYABLE_CARDS, SPIDER_MAN, "14018");
    const created = createGame(buildScenario([seat]), PLAYABLE_DEPS);
    expect(created.ok).toBe(false);
  });
});

describe("Quicksilver's aggression card, from She-Hulk (Aggression)'s own deck", () => {
  // Printed: "Your hero gets +1 ATK. Your basic attacks gain piercing. (Discard any tough status cards from the target
  // before dealing damage.) Forced Response: After you make a basic attack, discard Brute Force." RRG 1.8
  // "Piercing" (keyword, tough removed before damage).
  it("14029.brute-force-constant / forced-response: +1 ATK, the basic attack ignores tough, then Brute Force is discarded", () => {
    const { state: opened, id } = openHandFor("14029", SHE_HULK);
    const hero = identityOf(opened);
    const baseAtk = profileOf(opened, hero).atk;
    const pay = filler(opened, costOf("14029"), [id]);
    const armed = playCard(pay.state, id, pay.ids, firstLegal, hero);
    expect(inst(armed, id).attachedTo).toBe(hero);
    expect(profileOf(armed, hero).atk).toBe(baseAtk + 1);
    const villain = armed.villains[0]!.instanceId;
    const toughVillain = patchInstance(armed, villain, {
      statuses: { ...inst(armed, villain).statuses, tough: 1 },
    });
    const before = inst(toughVillain, villain).damage;
    const after = basicAttack(toughVillain, hero, villain);
    expect(inst(after, villain).statuses.tough).toBe(0);
    expect(inst(after, villain).damage).toBe(before + baseAtk + 1);
    expect(playerOf(after, P1).discard).toContain(id);
    expect(inst(after, id).attachedTo).toBeFalsy();
  });
});

describe("Quicksilver's justice card, from Spider-Man (Justice)'s own deck", () => {
  it("14030.sense-of-justice-resource: exhausts to generate a [mental] resource toward a Thwart event (For Justice! removes 4 threat)", () => {
    const { state: opened, id: sense } = openHandFor("14030", SPIDER_MAN);
    const pay = filler(opened, costOf("14030"), [sense]);
    const inPlay = playCard(pay.state, sense, pay.ids);
    expect(cardsInPlay(inPlay)).toContain(sense);
    const given = moveToHand(inPlay, P1, "01060"); // For Justice!: cost 2, Thwart, 4 threat if paid with [mental]
    const [forJustice] = given.ids as [InstanceId];
    const threatened = patchInstance(given.state, given.state.mainScheme.instanceId, { threat: 20 });
    const other = filler(threatened, 1, [forJustice, sense]);
    const played = settle(
      runWith(
        PLAYABLE_DEPS,
        other.state,
        play(P1, forJustice, other.ids, { abilities: [resourceAbility(sense, "14030.sense-of-justice-resource")] }),
      ),
      takingMax,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(played, sense).exhausted).toBe(true);
    expect(playerOf(played, P1).discard).toContain(forJustice);
    expect(mainThreat(played)).toBe(16);
  });
});

describe("Quicksilver's leadership card, from Captain Marvel (Leadership)'s own deck", () => {
  it("14031.united-we-stand-action: a Hero Action, heals 1 damage from up to X (villain stage) friendly characters; refused in alter-ego form", () => {
    const { state: opened, id } = openHandFor("14031", CAP_MARVEL);
    const hero = identityOf(opened);
    const hurt = patchInstance(opened, hero, { damage: 3 });
    const after = playCard(hurt, id, [], takingMax);
    expect(playerOf(after, P1).discard).toContain(id);
    expect(inst(after, hero).damage).toBe(2); // villain stage 1: one character healed for 1

    // Carol Danvers has neither the Avenger trait nor a hero form: both of the card's gates refuse it.
    const { state: ego, id: egoId } = openHandFor("14031", CAP_MARVEL, { alterEgo: true });
    expect(applyCommand(ego, play(P1, egoId, []), PLAYABLE_DEPS).ok).toBe(false);
  });
});
