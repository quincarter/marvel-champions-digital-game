import { CORE_STARTER_DECKS, cardId, PLAYABLE_CARDS, type AnyCard, type CardId } from "@mc/content";
import {
  activeVillain,
  applyCommand,
  characterProfile,
  cardsInPlay,
  createGame,
  type CardInstance,
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
import { moveToDiscard } from "../../testing/staging.js";
import { engageMinion } from "../../wave3/drax/support.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, "Cards in another hero's deck"): every Valkyrie
 * pack (`valk`, 25001a-25036) aspect/basic player card that has an ability script — every one whose own `aspect` is
 * not `hero:25001a` (an identity-specific card, RRG 1.8 "Identity-Specific Card", p. 23, only a Valkyrie deck could
 * hold) — played through the engine from a Core hero's own precon instead of Valkyrie's.
 *
 * Covered: aggression 25013 Thor, 25014 Throg, 25015 Angela, 25016 Hall of Heroes, 25017 Combat Training, 25018
 * Quick Strike, 25019 Smash the Problem, 25020 The Best Defense..., 25021 Audacity, 25022 The Power of Aggression
 * (all from She-Hulk); basic 25023 The Bifrost, 25024 Godlike Stamina (Play only if your identity has the asgard
 * trait, which no Core hero face has, so both are asserted refused), 25036 Cosmic Alliance (Spider-Man, Gamora
 * injected as the guardian character); justice 25033 Problem Solvers (Spider-Man, Gamora as the guardian);
 * leadership 25034 Leadership Training (Captain Marvel, alter-ego form); protection 25035 Anticipation (Black
 * Panther). Every printed "Hero Action" / "Hero Interrupt" / "Hero Response" form is also checked to be refused or
 * not offered in alter-ego form, and the printed "Alter-Ego Action" cards (25016, 25034) to be refused in hero form
 * (RRG 1.8 "Hero Action" / "Alter-Ego Action").
 *
 * Skipped: 25001a-25012 are identity-specific (Valkyrie's own hero set); 25025-25027 (Energy, Genius and Strength
 * basic resources) print no ability; 25028-25032 are the obligation/minion/side scheme/attachment encounter cards.
 * 25016, 25017 and 25022 reprint an earlier card verbatim but the pack scripts them under its own ability ids
 * (`./valkyrie-pack-cards.ts`, not aliased in `../reprints.ts`), so they are covered here like any other script.
 * No Valkyrie aspect or basic card is a Team-Up card, so there is no "refused at createGame" case.
 *
 * Every Core hero face has the Avenger trait and none has Guardian; the Guardian partner for the Alliance cards is
 * Gamora (nebu 22002), injected into play.
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

/** `buildCrossHeroDeck`, falling back for a verbatim reprint of a card the precon already holds (Combat Training,
 * The Power of Aggression): that helper drops the precon's same-titled copies and cannot refill the deck, so here the
 * precon's own copies are swapped for the pack's reprint instead (same title, same count, still a legal deck). */
function seatFor(code: string, coreHero: string): PlayerSetup {
  try {
    return buildCrossHeroDeck(PLAYABLE_CARDS, coreHero, code);
  } catch {
    const starter = CORE_STARTER_DECKS.find((deck) => deck.id === coreHero)!;
    const name = (BY_ID.get(code) as { name: string }).name;
    const deck = starter.cards.flatMap((entry) => {
      const card = BY_ID.get(entry.cardId as string) as { name?: string } | undefined;
      const id = (card?.name === name ? code : entry.cardId) as CardId;
      return Array.from({ length: entry.quantity }, () => id);
    });
    return { identityCardId: starter.identityCardId as CardId, aspects: starter.aspects, deck };
  }
}

/** Opening state with `code` in P1's hand, seated in `coreHero`'s own precon (`buildCrossHeroDeck`). */
function openHandFor(
  code: string,
  coreHero: string,
  options: OpenOptions = {},
): { readonly state: GameState; readonly id: InstanceId } {
  const seat = seatFor(code, coreHero);
  const seated: PlayerSetup = options.extraDeck
    ? { ...seat, deck: [...seat.deck, ...options.extraDeck.map((c) => c as never)] }
    : seat;
  const config = buildScenario([seated]);
  const created = createGame(options.extraDeck ? { ...config, requireLegalDecks: false } : config, PLAYABLE_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
  const ready = options.alterEgo ? opening : toHeroFirst(opening);
  const { state, ids } = moveToHand(ready, P1, code);
  return { state, id: ids[0]! };
}

const singleIcon = (card: AnyCard): boolean =>
  "resourceIcons" in card && Object.values(card.resourceIcons).reduce((a, b) => a + (b ?? 0), 0) === 1;

/** Moves `n` single-icon non-resource cards into P1's hand (never `exclude`) and returns their ids — single-value
 * payment cards, so a payment's size is exactly its value. */
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

/** Answers a `chooseTarget` prompt by its slot name from `bySlot`, `base` otherwise. */
const targetingSlots =
  (bySlot: Readonly<Record<string, string>>, base: Picker = firstLegal): Picker =>
  (state) => {
    const prompt = state.pendingChoice?.prompt;
    if (prompt?.kind === "chooseTarget" && bySlot[prompt.slot as string] !== undefined) {
      return [bySlot[prompt.slot as string]!];
    }
    return base(state);
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

/** Plays the card seated in hand by `openHandFor` (printed cost paid with fillers). */
function playOpened(opened: { state: GameState; id: InstanceId }, pick: Picker = firstLegal, attachTo?: InstanceId) {
  const code = opened.state.instances[opened.id]!.cardId as string;
  const pay = filler(opened.state, costOf(code), [opened.id]);
  return { state: playCard(pay.state, opened.id, pay.ids, pick, attachTo), before: pay.state };
}

const refused = (state: GameState, id: InstanceId, payment: readonly InstanceId[]): boolean =>
  !applyCommand(state, play(P1, id, payment), PLAYABLE_DEPS).ok;

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

/** A card staged straight into a play area / hand (test-only surgery), the `war-machine-pack-cards.test.ts` idiom. */
function injectIntoPlay(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const id = `synthetic-${code}` as InstanceId;
  const instance: CardInstance = {
    instanceId: id,
    cardId: cardId(code),
    ownerId: P1,
    controllerId: P1,
    home: { kind: "player" },
    faceup: true,
    exhausted: false,
    damage: 0,
    threat: 0,
    statuses: { stunned: 0, confused: 0, tough: 0 },
    counters: {},
    attachedTo: null,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: null,
    flipped: false,
  };
  return {
    id,
    state: {
      ...state,
      instances: { ...state.instances, [id]: instance },
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
    },
  };
}

const GAMORA = "22002"; // Guardian ally (nebu)

/** Moves the deck's first leadership event (cheapest) to P1's discard pile. */
function discardALeadershipEvent(state: GameState): { readonly state: GameState; readonly id: InstanceId } {
  const owner = playerOf(state, P1);
  const events = [...owner.hand, ...owner.deck]
    .filter((id) => {
      const c = cardOf(state, id);
      // Not Make the Call (01071): it needs an ally chosen in a discard pile, so it cannot be played blind.
      return c.type === "event" && "aspect" in c && c.aspect === "leadership" && (c.id as string) !== "01071";
    })
    .sort((a, b) => costOf(cardOf(state, a).id as string) - costOf(cardOf(state, b).id as string));
  expect(events.length).toBeGreaterThan(0);
  return moveToDiscard(state, P1, cardOf(state, events[0]!).id as string);
}

const ENERGY = "25025"; // Valkyrie pack's Basic Energy resource (no ability)

describe("Valkyrie aggression cards, from She-Hulk (Aggression)'s own deck", () => {
  it("25013: Thor enters with the tough status (Toughness)", () => {
    const opened = openHandFor("25013", SHE_HULK);
    const { state: after } = playOpened(opened);
    expect(cardsInPlay(after)).toContain(opened.id);
    expect(inst(after, opened.id).statuses.tough).toBe(1);
  });

  it("25013.thor-interrupt: spending an energy resource resolves his attack against every minion engaged with that player", () => {
    const run = (accept: boolean) => {
      const opened = openHandFor("25013", SHE_HULK, { extraDeck: [ENERGY] });
      const { state: inPlay } = playOpened(opened);
      const given = moveToHand(inPlay, P1, ENERGY);
      const withEnergy = given.state;
      // Pays the interrupt's "spend a [energy] resource" cost with that Energy card.
      const spendEnergy: Picker = (state) =>
        state.pendingChoice?.prompt.kind === "payForAbility"
          ? [`hand:${given.ids[0]!}`]
          : accepting("25013.thor-interrupt")(state);
      const twoMinions = engageMinion(engageMinion(withEnergy, SHOCKER, "thor-a"), SHOCKER, "thor-b");
      const after = basicAttack(twoMinions, opened.id, "thor-a" as InstanceId, accept ? spendEnergy : firstLegal);
      return playerOf(after, P1).playArea;
    };
    // Thor's ATK 3 kills a 3 HP Shocker outright; declining the interrupt only reaches the declared target.
    const declined = run(false);
    expect(declined).not.toContain("thor-a");
    expect(declined).toContain("thor-b");
    const accepted = run(true);
    expect(accepted).not.toContain("thor-a");
    expect(accepted).not.toContain("thor-b");
  });

  it("25014.throg-response: gets a tough status card if you are engaged with a minion, none otherwise", () => {
    const opened = openHandFor("25014", SHE_HULK);
    const calm = playOpened(opened, accepting("25014.throg-response")).state;
    expect(inst(calm, opened.id).statuses.tough).toBe(0);
    const engaged = engageMinion(opened.state, SHOCKER, "throg-minion");
    const { state: after } = playOpened({ state: engaged, id: opened.id }, accepting("25014.throg-response"));
    expect(inst(after, opened.id).statuses.tough).toBe(1);
  });

  it("25015.angela-forced-response: puts a minion from the top 10 of the encounter deck into play engaged with you", () => {
    const opened = openHandFor("25015", SHE_HULK);
    const stacked = stackEncounterDeck(opened.state, SHOCKER);
    // The prompt lists the minions among the top 10 by instance id; pick the Shocker.
    const pickShocker: Picker = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind !== "chooseCards") return firstLegal(state);
      return choice.options.filter((o) => o.label === "Shocker").map((o) => o.optionId);
    };
    const { state: after } = playOpened({ state: stacked, id: opened.id }, pickShocker);
    expect(playerOf(after, P1).playArea).toContain(opened.id);
    const engagedMinions = playerOf(after, P1).playArea.filter((id) => cardOf(after, id).type === "minion");
    expect(engagedMinions.length).toBe(1);
    expect(inst(after, engagedMinions[0]!).engagedWith).toBe(P1);
  });

  it("25015.angela-forced-response: with no minion in the encounter deck, Angela is discarded", () => {
    const opened = openHandFor("25015", SHE_HULK);
    const deckId = Object.keys(opened.state.encounterDecks)[0]!;
    const pile = opened.state.encounterDecks[deckId]!;
    const isMinion = (id: InstanceId) => cardOf(opened.state, id).type === "minion";
    const stripped: GameState = {
      ...opened.state,
      encounterDecks: {
        ...opened.state.encounterDecks,
        [deckId]: {
          deck: pile.deck.filter((id) => !isMinion(id)),
          discard: [...pile.discard, ...pile.deck.filter(isMinion)],
        },
      },
    };
    const { state: after } = playOpened({ state: stripped, id: opened.id });
    expect(playerOf(after, P1).discard).toContain(opened.id);
    expect(cardsInPlay(after)).not.toContain(opened.id);
  });

  it("25016.hall-of-heroes-response: after you defeat a minion, places a glory counter on it", () => {
    const opened = openHandFor("25016", SHE_HULK);
    const { state: inPlay } = playOpened(opened);
    const staged = engageMinion(inPlay, SHOCKER, "hall-minion");
    const hurt = patchInstance(staged, "hall-minion" as InstanceId, { damage: 2 });
    const after = basicAttack(
      hurt,
      identityOf(hurt),
      "hall-minion" as InstanceId,
      accepting("25016.hall-of-heroes-response"),
    );
    expect(playerOf(after, P1).playArea).not.toContain("hall-minion");
    expect(inst(after, opened.id).counters.glory).toBe(1);
  });

  it("25016.hall-of-heroes-action: an Alter-Ego Action; exhaust and remove 3 glory counters to draw 3, refused in hero form", () => {
    const opened = openHandFor("25016", SHE_HULK, { alterEgo: true });
    expect(playerOf(opened.state, P1).identity.form).toBe("alterEgo");
    const { state: inPlay } = playOpened(opened);
    const primed = patchInstance(inPlay, opened.id, { counters: { glory: 3 } });
    const before = playerOf(primed, P1).hand.length;
    const used = settle(
      runWith(PLAYABLE_DEPS, primed, use(P1, opened.id, "25016.hall-of-heroes-action")),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(playerOf(used, P1).hand.length).toBe(before + 3);
    expect(inst(used, opened.id).exhausted).toBe(true);
    expect(inst(used, opened.id).counters.glory ?? 0).toBe(0);
    // Hero form: refused.
    const hero = openHandFor("25016", SHE_HULK);
    const { state: heroInPlay } = playOpened(hero);
    const heroPrimed = patchInstance(heroInPlay, hero.id, { counters: { glory: 3 } });
    expect(applyCommand(heroPrimed, use(P1, hero.id, "25016.hall-of-heroes-action"), PLAYABLE_DEPS).ok).toBe(false);
  });

  it("25017.combat-training-constant: attached to your hero, +1 ATK; max 1 per player", () => {
    const opened = openHandFor("25017", SHE_HULK, { extraDeck: ["25017"] });
    const hero = identityOf(opened.state);
    const base = characterProfile(opened.state, hero, PLAYABLE_DEPS)!.atk;
    const { state: after } = playOpened(opened, firstLegal, hero);
    expect(inst(after, opened.id).attachedTo).toBe(hero);
    expect(characterProfile(after, hero, PLAYABLE_DEPS)!.atk).toBe(base + 1);
    const second = moveToHand(after, P1, "25017");
    const secondId = second.ids.find((id) => id !== opened.id)!;
    const pay = filler(second.state, costOf("25017"), [opened.id, secondId]);
    expect(applyCommand(pay.state, play(P1, secondId, pay.ids, { attachToInstanceId: hero }), PLAYABLE_DEPS).ok).toBe(
      false,
    );
  });

  it("25018.quick-strike-action: Hero Action; deals damage to an enemy equal to your ATK, refused in alter-ego form", () => {
    const opened = openHandFor("25018", SHE_HULK);
    const hero = identityOf(opened.state);
    const atk = characterProfile(opened.state, hero, PLAYABLE_DEPS)!.atk;
    const villain = activeVillain(opened.state).instanceId;
    const { state: after } = playOpened(opened, targetingSlots({ enemy: villain as string }));
    expect(inst(after, villain).damage).toBe(atk);
    expect(playerOf(after, P1).discard).toContain(opened.id);
    const ego = openHandFor("25018", SHE_HULK, { alterEgo: true });
    const pay = filler(ego.state, costOf("25018"), [ego.id]);
    expect(refused(pay.state, ego.id, pay.ids)).toBe(true);
  });

  it("25019.smash-the-problem-action: Hero Action; exhaust your hero to remove threat equal to your ATK, refused in alter-ego form", () => {
    const opened = openHandFor("25019", SHE_HULK);
    const hero = identityOf(opened.state);
    const atk = characterProfile(opened.state, hero, PLAYABLE_DEPS)!.atk;
    const primed = patchInstance(opened.state, opened.state.mainScheme.instanceId, { threat: 8 });
    const { state: after } = playOpened({ state: primed, id: opened.id });
    expect(mainThreat(after)).toBe(8 - atk);
    expect(inst(after, hero).exhausted).toBe(true);
    const ego = openHandFor("25019", SHE_HULK, { alterEgo: true });
    const pay = filler(ego.state, costOf("25019"), [ego.id]);
    expect(refused(pay.state, ego.id, pay.ids)).toBe(true);
  });

  it("25020.the-best-defense-interrupt: Hero Interrupt; the defending hero reduces the attack by its ATK (3) instead of its DEF (2)", () => {
    const defendWith = (accept: boolean): number => {
      const opened = openHandFor("25020", SHE_HULK);
      const hero = identityOf(opened.state);
      const pick: Picker = (state) => {
        if (state.pendingChoice?.prompt.kind === "declareDefender") return [hero];
        return accept ? accepting("25020.the-best-defense-interrupt")(state) : firstLegal(state);
      };
      const after = settle(
        runWith(PLAYABLE_DEPS, stackEncounterDeck(opened.state, "01109"), endTurn(P1)),
        pick,
        undefined,
        PLAYABLE_DEPS,
      );
      return inst(after, hero).damage;
    };
    const plain = defendWith(false);
    const swapped = defendWith(true);
    expect(plain).toBeGreaterThan(0);
    expect(swapped).toBe(plain - 1);
  });

  it("25020.the-best-defense-interrupt: a Hero Interrupt is not offered to an alter-ego defender", () => {
    const opened = openHandFor("25020", SHE_HULK, { alterEgo: true });
    const hero = identityOf(opened.state);
    let offered = false;
    const pick: Picker = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "declareDefender") return [hero];
      if (choice?.options.some((o) => o.optionId.includes("25020"))) offered = true;
      return firstLegal(state);
    };
    settle(
      runWith(PLAYABLE_DEPS, stackEncounterDeck(opened.state, "01109"), endTurn(P1)),
      pick,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(offered).toBe(false);
  });

  it("25021.audacity-response: Hero Response; after you spend this card, deals 1 damage to the villain", () => {
    const opened = openHandFor("25021", SHE_HULK, { extraDeck: ["25016"] });
    const villain = activeVillain(opened.state).instanceId;
    const target = moveToHand(opened.state, P1, "25016");
    const pay = filler(target.state, 1, [opened.id, ...target.ids]);
    const after = playCard(pay.state, target.ids[0]!, [opened.id, ...pay.ids], accepting("25021.audacity-response"));
    expect(playerOf(after, P1).playArea).toContain(target.ids[0]!);
    expect(inst(after, villain).damage).toBe(1);
  });

  it("25021.audacity-response: a Hero Response does not trigger when spent in alter-ego form", () => {
    const opened = openHandFor("25021", SHE_HULK, { alterEgo: true, extraDeck: ["25016"] });
    const villain = activeVillain(opened.state).instanceId;
    const target = moveToHand(opened.state, P1, "25016");
    const pay = filler(target.state, 1, [opened.id, ...target.ids]);
    const after = playCard(pay.state, target.ids[0]!, [opened.id, ...pay.ids], accepting("25021.audacity-response"));
    expect(playerOf(after, P1).playArea).toContain(target.ids[0]!);
    expect(inst(after, villain).damage).toBe(0);
  });

  it("25022.the-power-of-aggression-constant: doubles its resource while paying for an Aggression card only", () => {
    const opened = openHandFor("25022", SHE_HULK, { extraDeck: ["25018", "25036"] });
    // Quick Strike (Aggression, cost 2) is paid with this one card alone (1 resource, doubled to 2).
    const strike = moveToHand(opened.state, P1, "25018");
    expect(applyCommand(strike.state, play(P1, strike.ids[0]!, [opened.id]), PLAYABLE_DEPS).ok).toBe(true);
    // Cosmic Alliance (Basic, cost 3) is not doubled: this card plus one filler is only 2 resources.
    const alliance = moveToHand(opened.state, P1, "25036");
    const pay = filler(alliance.state, 1, [opened.id, ...alliance.ids]);
    expect(refused(pay.state, alliance.ids[0]!, [opened.id, ...pay.ids])).toBe(true);
  });
});

describe("Valkyrie basic cards, from Spider-Man (Justice)'s own deck", () => {
  it("25023: The Bifrost is refused (Play only if your identity has the asgard trait) in either form", () => {
    const hero = openHandFor("25023", SPIDER_MAN);
    const heroPay = filler(hero.state, costOf("25023"), [hero.id]);
    expect(refused(heroPay.state, hero.id, heroPay.ids)).toBe(true);
    const ego = openHandFor("25023", SPIDER_MAN, { alterEgo: true });
    const egoPay = filler(ego.state, costOf("25023"), [ego.id]);
    expect(refused(egoPay.state, ego.id, egoPay.ids)).toBe(true);
  });

  it("25024: Godlike Stamina is refused (Play only if your identity has the asgard trait) in either form", () => {
    const hero = openHandFor("25024", SPIDER_MAN);
    expect(refused(hero.state, hero.id, [])).toBe(true);
    const ego = openHandFor("25024", SPIDER_MAN, { alterEgo: true });
    expect(refused(ego.state, ego.id, [])).toBe(true);
  });

  it("25036.cosmic-alliance-action: Hero Action; readies an avenger and a guardian character", () => {
    const opened = openHandFor("25036", SPIDER_MAN);
    const hero = identityOf(opened.state);
    const { state: withGamora, id: gamora } = injectIntoPlay(opened.state, GAMORA);
    const tired = patchInstance(patchInstance(withGamora, gamora, { exhausted: true }), hero, { exhausted: true });
    const { state: after } = playOpened({ state: tired, id: opened.id });
    expect(inst(after, hero).exhausted).toBe(false);
    expect(inst(after, gamora).exhausted).toBe(false);
  });

  it("25036.cosmic-alliance-action: a Hero Action card is refused in alter-ego form", () => {
    const { state, id } = openHandFor("25036", SPIDER_MAN, { alterEgo: true });
    const { state: withGamora } = injectIntoPlay(state, GAMORA);
    const pay = filler(withGamora, costOf("25036"), [id]);
    expect(refused(pay.state, id, pay.ids)).toBe(true);
  });
});

describe("Valkyrie justice card, from Spider-Man (Justice)'s own deck", () => {
  it("25033.problem-solvers-action: Hero Action; exhaust an avenger and a guardian to remove their combined THW from each scheme", () => {
    const opened = openHandFor("25033", SPIDER_MAN);
    const hero = identityOf(opened.state);
    const { state: withGamora, id: gamora } = injectIntoPlay(opened.state, GAMORA);
    const thw =
      characterProfile(withGamora, hero, PLAYABLE_DEPS)!.thw + characterProfile(withGamora, gamora, PLAYABLE_DEPS)!.thw;
    const primed = patchInstance(withGamora, withGamora.mainScheme.instanceId, { threat: 9 });
    const { state: after } = playOpened({ state: primed, id: opened.id });
    expect(mainThreat(after)).toBe(9 - thw);
    expect(inst(after, hero).exhausted).toBe(true);
    expect(inst(after, gamora).exhausted).toBe(true);
  });

  it("25033.problem-solvers-action: cannot be played without a guardian character to exhaust (Alliance cost)", () => {
    const opened = openHandFor("25033", SPIDER_MAN);
    const pay = filler(opened.state, costOf("25033"), [opened.id]);
    expect(refused(pay.state, opened.id, pay.ids)).toBe(true);
  });

  it("25033.problem-solvers-action: a Hero Action card is refused in alter-ego form", () => {
    const { state, id } = openHandFor("25033", SPIDER_MAN, { alterEgo: true });
    const { state: withGamora } = injectIntoPlay(state, GAMORA);
    const pay = filler(withGamora, costOf("25033"), [id]);
    expect(refused(pay.state, id, pay.ids)).toBe(true);
  });
});

describe("Valkyrie leadership card, from Captain Marvel (Leadership)'s own deck", () => {
  it("25034.leadership-training-constant: Alter-Ego Action; exhaust and remove a training counter to shuffle a leadership event from the discard pile into the deck", () => {
    const opened = openHandFor("25034", CAP_MARVEL, { alterEgo: true });
    expect(playerOf(opened.state, P1).identity.form).toBe("alterEgo");
    const { state: inPlay } = playOpened(opened);
    expect(inst(inPlay, opened.id).counters.training).toBe(2);
    const { state: discarded, id: event } = discardALeadershipEvent(inPlay);
    const used = settle(
      runWith(PLAYABLE_DEPS, discarded, use(P1, opened.id, "25034.leadership-training-constant")),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(playerOf(used, P1).discard).not.toContain(event);
    expect(playerOf(used, P1).deck).toContain(event);
    expect(inst(used, opened.id).exhausted).toBe(true);
    expect(inst(used, opened.id).counters.training).toBe(1);
  });

  it("25034.leadership-training-constant: an Alter-Ego Action is refused in hero form", () => {
    const opened = openHandFor("25034", CAP_MARVEL);
    expect(playerOf(opened.state, P1).identity.form).toBe("hero");
    const { state: inPlay } = playOpened(opened);
    const { state: discarded } = discardALeadershipEvent(inPlay);
    expect(applyCommand(discarded, use(P1, opened.id, "25034.leadership-training-constant"), PLAYABLE_DEPS).ok).toBe(
      false,
    );
  });
});

describe("Valkyrie protection card, from Black Panther (Protection)'s own deck", () => {
  it("25035: attaches to your hero (an upgrade)", () => {
    const opened = openHandFor("25035", BLACK_PANTHER);
    const hero = identityOf(opened.state);
    const { state: attached } = playOpened(opened, firstLegal, hero);
    expect(inst(attached, opened.id).attachedTo).toBe(hero);
  });

  // A revealed minion's engagement shares the reveal's own interrupt window (RRG 1.8 "Engage", p. 18; "Triggering
  // Condition", p. 45), so a Hero Interrupt "When you engage a minion" is offered at the villain phase's reveal.
  it("25035.anticipation-interrupt: Hero Interrupt; when you engage a minion, discard it to ready your hero", () => {
    const opened = openHandFor("25035", BLACK_PANTHER);
    const hero = identityOf(opened.state);
    const { state: attached } = playOpened(opened, firstLegal, hero);
    const tired = patchInstance(attached, hero, { exhausted: true });
    const after = settle(
      runWith(PLAYABLE_DEPS, stackEncounterDeck(tired, "01186", "01101"), endTurn(P1)),
      accepting("25035.anticipation-interrupt"),
      undefined,
      PLAYABLE_DEPS,
    );
    expect(playerOf(after, P1).discard).toContain(opened.id);
  });
});
