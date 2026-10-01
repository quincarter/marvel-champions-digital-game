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
  putOnTopOfDeck,
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
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, "Cards in another hero's deck") for the Core Set's
 * own aspect and basic player cards (01050-01093): each is played through the engine from a Core hero whose precon
 * does NOT ship that aspect's cards, so a script that quietly assumes its precon hero (Spider-Man for Justice, Captain
 * Marvel for Leadership, She-Hulk or Iron Man for Aggression, Black Panther for Protection) is caught.
 *
 * Seats (all legal 40+ card decks, `requireLegalDecks` left on): Justice from She-Hulk, Leadership from Iron Man,
 * Aggression from Black Panther, Protection from Captain Marvel; Basic cards from Iron Man (aggression precon, basic
 * cards are legal anywhere). Each aspect seat is built by hand (`aspectSeat`): the hero's own signature cards, every
 * Core card of the chosen aspect at its deck limit, and the precon's basic cards, because `buildCrossHeroDeck` cannot
 * swap an aspect without dropping under 40 cards (it refuses to backfill).
 *
 * Covered (every Core aspect/basic card with an ability script): justice 01058 Daredevil, 01059 Jessica Jones, 01060
 * For Justice!, 01061 Great Responsibility, 01062 The Power of Justice, 01063 Interrogation Room, 01064 Surveillance
 * Team, 01065 Heroic Intuition; leadership 01066 Hawkeye, 01067 Maria Hill, 01068 Vision, 01069 Get Ready, 01070 Lead
 * from the Front, 01071 Make the Call, 01072 The Power of Leadership, 01073 The Triskelion, 01074 Inspired; aggression
 * 01050 Hulk, 01051 Tigra, 01052 Chase Them Down, 01053 Relentless Assault, 01054 Uppercut, 01055 The Power of
 * Aggression, 01056 Tac Team, 01057 Combat Training; protection 01075 Black Widow, 01076 Luke Cage, 01077
 * Counter-Punch, 01078 Get Behind Me!, 01079 The Power of Protection, 01080 Med Team, 01081 Armored Vest, 01082
 * Indomitable; basic 01083 Mockingbird, 01084 Nick Fury, 01085 Emergency, 01086 First Aid, 01087 Haymaker, 01091
 * Avengers Mansion, 01092 Helicarrier, 01093 Tenacity.
 *
 * Printed ability forms checked against the card text (data `text.printed`) and the script: Hero Action cards (01060,
 * 01053, 01054, 01070, 01087, 01093; and 01078 / 01061 Hero Interrupts) are refused in alter-ego form (RRG 1.8 "Hero
 * Action" / "Hero Interrupt"); plain Action cards and supports (01064, 01056, 01080, 01069, 01071, 01086, 01091,
 * 01092, 01068) are used from alter-ego form, and plain Interrupt 01085 Emergency fires while the villain schemes
 * against an alter-ego.
 *
 * Skipped: 01088-01090 Energy / Genius / Strength (resources with no ability script). 01044 etc. are Black Panther's
 * identity-specific cards, not aspect cards. Not covered by an interaction test: the "Max N per deck / per player"
 * deckbuilding lines (deck-legality tests own those) and 01077's boundary with an undefended attack (no defend, no
 * trigger).
 *
 * RRG 1.8 citations: "Ally Limit" p. 7 (01073), "Defend, Defense" p. 15 (damage checks leave attacks undefended),
 * "Overkill" (01053), "Toughness" (01076), "Stun" (01083), "Form" / "Hero Action" / "Alter-Ego Action" (form checks).
 */

const buildScenario = (players: readonly PlayerSetup[]) =>
  playableScenario("rhino", { seed: 11, players: players as never });

const BY_ID = new Map<string, AnyCard>(PLAYABLE_CARDS.map((c) => [c.id as string, c]));
const cardOf = (state: GameState, id: InstanceId): AnyCard => BY_ID.get(state.instances[id]!.cardId as string)!;
const codeOf = (state: GameState, id: InstanceId): string => state.instances[id]!.cardId as string;
const costOf = (code: string): number => {
  const card = BY_ID.get(code)!;
  return "cost" in card && typeof card.cost === "number" ? card.cost : 0;
};
const iconsOf = (card: AnyCard): Readonly<Record<string, number | undefined>> =>
  "resourceIcons" in card ? (card.resourceIcons as Record<string, number | undefined>) : {};
const iconTotal = (card: AnyCard): number => Object.values(iconsOf(card)).reduce<number>((a, b) => a + (b ?? 0), 0);

const SHE_HULK = "core-she-hulk-aggression";
const IRON_MAN = "core-iron-man-aggression";
const BLACK_PANTHER = "core-black-panther-protection";
const CAP_MARVEL = "core-captain-marvel-leadership";
const SHOCKER = "01103"; // minion: ATK 2, HP 3, no keywords
const ADVANCE = "01186"; // treachery: no boost icons; When Revealed: place 1 threat on the main scheme
const BOMB_SCARE = "01109"; // side scheme
const HYDRA_MERCENARY = "01101"; // minion (Guard)

type Aspect = "justice" | "leadership" | "aggression" | "protection";

/** A legal 40+ card deck of `heroDeckId`'s hero in `aspect`: the hero's signature cards, every Core card of that
 * aspect at its own deck limit (capped at its quantity in the set), and the precon's basic cards. */
function aspectSeat(heroDeckId: string, aspect: Aspect): PlayerSetup {
  const starter = CORE_STARTER_DECKS.find((deck) => deck.id === heroDeckId)!;
  const own = starter.cards.filter((entry) => {
    const card = BY_ID.get(entry.cardId as string) as { aspect?: string } | undefined;
    return card?.aspect?.startsWith("hero:") || card?.aspect === "basic";
  });
  const aspectCards = PLAYABLE_CARDS.filter(
    (c) => /^01\d{3}$/.test(c.id as string) && "aspect" in c && c.aspect === aspect,
  );
  const deck: CardId[] = [
    ...own.flatMap((entry) => Array.from({ length: entry.quantity }, () => entry.cardId as CardId)),
    ...aspectCards.flatMap((c) => {
      const copies = Math.min("deckLimit" in c ? c.deckLimit : 1, "quantityInSet" in c ? c.quantityInSet : 1);
      return Array.from({ length: copies }, () => c.id as CardId);
    }),
  ];
  expect(deck.length).toBeGreaterThanOrEqual(40);
  return { identityCardId: starter.identityCardId as CardId, aspects: [aspect], deck };
}

const toHeroFirst = (state: GameState): GameState =>
  settle(runWith(PLAYABLE_DEPS, state, toHero(P1)), firstLegal, undefined, PLAYABLE_DEPS);

/** P1's opening state (player phase, round 1), in hero form unless `alterEgo`. */
function openSeat(seat: PlayerSetup, alterEgo = false): GameState {
  const created = createGame(buildScenario([seat]), PLAYABLE_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
  return alterEgo ? opening : toHeroFirst(opening);
}

const SEATS = {
  justice: () => aspectSeat(SHE_HULK, "justice"),
  leadership: () => aspectSeat(IRON_MAN, "leadership"),
  aggression: () => aspectSeat(BLACK_PANTHER, "aggression"),
  protection: () => aspectSeat(CAP_MARVEL, "protection"),
  basic: () => buildCrossHeroDeck(PLAYABLE_CARDS, IRON_MAN, "01083"),
} as const;

/** Opening state with `code` in P1's hand, seated in the matching cross-hero seat (`SEATS`). */
function openHandFor(
  code: string,
  seat: keyof typeof SEATS,
  alterEgo = false,
): { readonly state: GameState; readonly id: InstanceId } {
  const setup = seat === "basic" ? buildCrossHeroDeck(PLAYABLE_CARDS, IRON_MAN, code) : SEATS[seat]();
  const { state, ids } = moveToHand(openSeat(setup, alterEgo), P1, code);
  return { state, id: ids[0]! };
}

interface FillerOptions {
  readonly icon?: string;
  readonly notIcon?: string;
}

/** Moves `n` single-icon non-resource cards into P1's hand and returns their ids, never one that shares a code with an
 * `exclude` card (`moveToHand` resolves by code, so a same-code filler could be the card under test). */
function filler(
  state: GameState,
  n: number,
  exclude: readonly InstanceId[] = [],
  options: FillerOptions = {},
): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  const owner = playerOf(state, P1);
  const banned = new Set(exclude.map((id) => codeOf(state, id)));
  const codes: string[] = [];
  for (const id of [...owner.hand, ...owner.deck]) {
    if (codes.length >= n) break;
    const card = cardOf(state, id);
    const code = card.id as string;
    if (banned.has(code) || card.type === "resource" || iconTotal(card) !== 1) continue;
    if (options.icon && !iconsOf(card)[options.icon]) continue;
    if (options.notIcon && (iconsOf(card)[options.notIcon] || iconsOf(card).wild)) continue;
    codes.push(code);
  }
  if (codes.length < n) throw new Error(`only ${codes.length} filler cards found`);
  const probe = moveToHand(state, P1, ...codes);
  return { state: probe.state, ids: probe.ids };
}

/** Accepts the named optional response/interrupt (by ability id), pays a `payForCard` prompt with whatever hand cards
 * it offers up to the printed cost, picks `target` at a `chooseTarget`, and declines everything else. */
const accepting =
  (wanted: readonly string[], target?: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "payForCard") {
      return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
    }
    if (target && choice.prompt.kind === "chooseTarget" && choice.options.some((o) => o.optionId === target)) {
      return [target];
    }
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Picks the option of any prompt whose id is `id` or whose label matches `label`; `base` otherwise. */
const choosing =
  (pattern: string | RegExp, base: Picker = firstLegal): Picker =>
  (state) => {
    const hit = state.pendingChoice?.options.find((o) =>
      typeof pattern === "string" ? o.optionId === pattern : pattern.test(o.label),
    );
    return hit ? [hit.optionId] : base(state);
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

/** Plays the card `openHandFor` seated, paying its printed cost with fillers. */
function playOpened(opened: { state: GameState; id: InstanceId }, pick: Picker = firstLegal, attachTo?: InstanceId) {
  const code = codeOf(opened.state, opened.id);
  const pay = filler(opened.state, costOf(code), [opened.id]);
  return { state: playCard(pay.state, opened.id, pay.ids, pick, attachTo), before: pay.state };
}

/** Moves `code` to hand and plays it, paying its printed cost with fillers. */
function playCode(state: GameState, code: string, exclude: readonly InstanceId[] = [], pick: Picker = firstLegal) {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const pay = filler(given.state, costOf(code), [...exclude, id]);
  return { state: playCard(pay.state, id, pay.ids, pick), id };
}

const useAbility = (state: GameState, id: InstanceId, ability: string, pick: Picker = firstLegal, payment = []) =>
  settle(runWith(PLAYABLE_DEPS, state, use(P1, id, ability, payment)), pick, undefined, PLAYABLE_DEPS);

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

interface PhaseOptions {
  /** Encounter cards stacked on top: the villain's boost card first, then P1's own encounter card. */
  readonly stack?: readonly string[];
  /** Defender declared against the villain's attack; null (default) leaves it undefended (no DEF, RRG 1.8 p. 15). */
  readonly defender?: InstanceId | null;
  /** Answers every prompt of the phase (the attack's initiation, then the encounter reveals) unless overridden. */
  readonly pick?: Picker;
  readonly initiate?: Picker;
  readonly defend?: Picker;
}

/** Ends P1's turn and runs the villain phase. An attack against a hero is left undefended unless `defender` is set
 * (a hero's DEF would reduce the damage a test reads). Against an alter-ego the villain schemes instead. */
function villainPhase(state: GameState, options: PhaseOptions = {}): GameState {
  const { stack = [ADVANCE], defender = null, pick = firstLegal } = options;
  const { initiate = pick, defend = pick } = options;
  const stacked = stackEncounterDeck(state, ...stack);
  const atDefend = settle(
    runWith(PLAYABLE_DEPS, stacked, endTurn(P1)),
    initiate,
    (s) => s.pendingChoice?.prompt.kind === "declareDefender",
    PLAYABLE_DEPS,
  );
  if (atDefend.pendingChoice?.prompt.kind !== "declareDefender")
    return settle(atDefend, defend, undefined, PLAYABLE_DEPS);
  return settle(answer(atDefend, defender ? [defender] : ["decline"], PLAYABLE_DEPS), defend, undefined, PLAYABLE_DEPS);
}

/** A card staged straight into P1's play area (test-only surgery). */
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

const profile = (state: GameState, id: InstanceId) => characterProfile(state, id, PLAYABLE_DEPS)!;
const villainOf = (state: GameState): InstanceId => activeVillain(state).instanceId;
const heroOf = (state: GameState): InstanceId => identityOf(state);
const withThreat = (state: GameState, threat: number): GameState =>
  patchInstance(state, state.mainScheme.instanceId, { threat });

/** A state at the start of round 2 with Bomb Scare (a side scheme) in play, P1 in hero form. */
function withSideScheme(opened: GameState): GameState {
  const after = villainPhase(opened, { stack: [ADVANCE, BOMB_SCARE] });
  expect(instancesOf(after, BOMB_SCARE).length).toBeGreaterThan(0);
  return after;
}

/** "The Power of X" (doubles resources while paying for an X-aspect card): one resource card pays a cost-`cost` card
 * of its aspect, but is only worth 1 resource for a basic card of the same cost (RRG 1.8 "Resource"). */
function powerOf(aspect: Aspect, power: string, aspectCode: string, controlCode: string) {
  const cost = costOf(aspectCode);
  expect(costOf(controlCode)).toBe(cost);
  const opened = openHandFor(aspectCode, aspect);
  const withPower = moveToHand(opened.state, P1, power);
  const powerId = withPower.ids[0]!;
  const control = moveToHand(withPower.state, P1, controlCode);
  const controlId = control.ids[0]!;
  const pay = filler(control.state, cost - 2, [opened.id, powerId, controlId]);
  const payment = [powerId, ...pay.ids];
  expect(refused(pay.state, controlId, payment)).toBe(true);
  const after = playCard(pay.state, opened.id, payment);
  expect([...cardsInPlay(after), ...playerOf(after, P1).discard]).toContain(opened.id); // events are spent, not kept
  expect(playerOf(after, P1).discard).toContain(powerId);
}

/** An exhausted-defender villain attack: the hero defends, so "after your hero defends" responses trigger. */
function defendedAttack(state: GameState, defend: Picker): GameState {
  return villainPhase(state, { defender: heroOf(state), defend });
}

describe("Justice cards, from She-Hulk's deck", () => {
  it("01058.daredevil-response: after Daredevil thwarts, deals 1 damage to an enemy", () => {
    const opened = openHandFor("01058", "justice");
    const { state: inPlay, before } = playOpened(opened);
    const villain = villainOf(inPlay);
    const threatened = withThreat(inPlay, 5);
    const after = settle(
      runWith(PLAYABLE_DEPS, threatened, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: opened.id,
        schemeInstanceId: threatened.mainScheme.instanceId,
      }),
      accepting(["01058.daredevil-response"], villain as string),
      undefined,
      PLAYABLE_DEPS,
    );
    expect(mainThreat(after)).toBeLessThan(5);
    expect(inst(after, villain).damage).toBe(inst(before, villain).damage + 1);
  });

  it("01059.jessica-jones-constant: +1 THW for each side scheme in play", () => {
    const sideScheme = withSideScheme(openSeat(SEATS.justice()));
    const given = moveToHand(sideScheme, P1, "01059");
    const { state: after, id } = playCode(given.state, "01059");
    const printed = (BY_ID.get("01059") as { thw: number }).thw;
    expect(cardsInPlay(after)).toContain(id);
    expect(profile(after, id).thw).toBe(printed + instancesOf(after, BOMB_SCARE).length);
  });

  it("01060.for-justice-action: Hero Action; removes 3 threat, 4 when paid with a [mental] resource", () => {
    const opened = openHandFor("01060", "justice");
    const primed = withThreat(opened.state, 9);
    const plain = filler(primed, 2, [opened.id], { notIcon: "mental" });
    expect(mainThreat(playCard(plain.state, opened.id, plain.ids))).toBe(6);
    const mental = filler(primed, 1, [opened.id], { icon: "mental" });
    const other = filler(mental.state, 1, [opened.id, ...mental.ids], { notIcon: "mental" });
    expect(mainThreat(playCard(other.state, opened.id, [...mental.ids, ...other.ids]))).toBe(5);
  });

  it("01060.for-justice-action: a Hero Action is refused in alter-ego form", () => {
    const opened = openHandFor("01060", "justice", true);
    const pay = filler(opened.state, 2, [opened.id]);
    expect(refused(pay.state, opened.id, pay.ids)).toBe(true);
  });

  it("01061.great-responsibility-interrupt: Hero Interrupt; threat that would be placed on a scheme is taken as damage", () => {
    const opened = openHandFor("01061", "justice");
    const hero = heroOf(opened.state);
    const control = villainPhase(opened.state, { stack: [ADVANCE, ADVANCE] });
    const after = villainPhase(opened.state, {
      stack: [ADVANCE, ADVANCE],
      pick: accepting(["01061.great-responsibility-interrupt"]),
    });
    expect(playerOf(after, P1).discard).toContain(opened.id);
    expect(mainThreat(after)).toBeLessThan(mainThreat(control));
    expect(inst(after, hero).damage).toBeGreaterThan(inst(control, hero).damage);
  });

  it("01061.great-responsibility-interrupt: a Hero Interrupt is refused in alter-ego form (never offered)", () => {
    const opened = openHandFor("01061", "justice", true);
    const after = villainPhase(opened.state, {
      stack: [ADVANCE, ADVANCE],
      pick: accepting(["01061.great-responsibility-interrupt"]),
    });
    expect(playerOf(after, P1).discard).not.toContain(opened.id);
    expect(playerOf(after, P1).hand).toContain(opened.id);
  });

  it("01062.the-power-of-justice-constant: one resource pays 2 for a Justice card, but only 1 for a basic card", () => {
    powerOf("justice", "01062", "01060", "01087");
  });

  it("01063.interrogation-room-response: after you defeat a minion, exhausts to remove 1 threat from a scheme", () => {
    const opened = openHandFor("01063", "justice");
    const { state: withRoom } = playOpened(opened);
    const staged = withThreat(engageMinion(withRoom, SHOCKER, "ir-shocker"), 5);
    const primed = patchInstance(staged, "ir-shocker" as InstanceId, { damage: 2 });
    const after = basicAttack(
      primed,
      heroOf(primed),
      "ir-shocker" as InstanceId,
      accepting(["01063.interrogation-room-response"]),
    );
    expect(playerOf(after, P1).playArea).not.toContain("ir-shocker");
    expect(inst(after, opened.id).exhausted).toBe(true);
    expect(mainThreat(after)).toBe(4);
  });

  it("01064.surveillance-team-action: plain Action, used from alter-ego form; spends a snoop counter, removes 1 threat", () => {
    const opened = openHandFor("01064", "justice", true);
    expect(playerOf(opened.state, P1).identity.form).toBe("alterEgo");
    const { state: inPlay } = playOpened(opened);
    expect(inst(inPlay, opened.id).counters.snoop).toBe(3);
    const primed = withThreat(inPlay, 5);
    const before = mainThreat(primed);
    const after = useAbility(primed, opened.id, "01064.surveillance-team-action");
    expect(mainThreat(after)).toBe(before - 1);
    expect(inst(after, opened.id).counters.snoop).toBe(2);
    expect(inst(after, opened.id).exhausted).toBe(true);
  });

  it("01065.heroic-intuition-constant: your hero gets +1 THW", () => {
    const opened = openHandFor("01065", "justice");
    const hero = heroOf(opened.state);
    const before = profile(opened.state, hero).thw;
    const { state: after } = playOpened(opened, firstLegal, hero);
    expect(inst(after, opened.id).attachedTo).toBe(hero);
    expect(profile(after, hero).thw).toBe(before + 1);
  });
});

describe("Leadership cards, from Iron Man's deck", () => {
  it("01066.hawkeye: enters play with 4 arrow counters; after a minion enters play, removes one → 2 damage to it", () => {
    const opened = openHandFor("01066", "leadership");
    const { state: inPlay } = playOpened(opened);
    expect(inst(inPlay, opened.id).counters.arrow).toBe(4);
    const after = villainPhase(inPlay, {
      stack: [ADVANCE, HYDRA_MERCENARY],
      defend: accepting(["01066.hawkeye-response"]),
    });
    const minion = instancesOf(after, HYDRA_MERCENARY).find((i) => cardsInPlay(after).includes(i));
    expect(minion).toBeDefined();
    expect(inst(after, minion!).damage).toBe(2);
    expect(inst(after, opened.id).counters.arrow).toBe(3);
  });

  it("01067.maria-hill-response: after she enters play, each player draws 1 card", () => {
    const opened = openHandFor("01067", "leadership");
    const pay = filler(opened.state, 2, [opened.id]);
    const handBefore = playerOf(pay.state, P1).hand.length;
    const after = playCard(pay.state, opened.id, pay.ids, accepting(["01067.maria-hill-response"]));
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 1 - 2 + 1);
  });

  it("01068.vision-action: plain Action, used from alter-ego form; spend [energy] → +2 ATK or THW; once per round", () => {
    const opened = openHandFor("01068", "leadership", true);
    expect(playerOf(opened.state, P1).identity.form).toBe("alterEgo");
    const { state: inPlay } = playOpened(opened);
    const energy = filler(inPlay, 2, [opened.id], { icon: "energy" });
    const base = profile(energy.state, opened.id);
    const after = settle(
      runWith(PLAYABLE_DEPS, energy.state, use(P1, opened.id, "01068.vision-action", [{ fromHand: energy.ids[0]! }])),
      choosing(/ATK/),
      undefined,
      PLAYABLE_DEPS,
    );
    expect(profile(after, opened.id).atk).toBe(base.atk + 2);
    expect(profile(after, opened.id).thw).toBe(base.thw);
    // "Limit once per round": a second use is refused.
    expect(
      applyCommand(after, use(P1, opened.id, "01068.vision-action", [{ fromHand: energy.ids[1]! }]), PLAYABLE_DEPS).ok,
    ).toBe(false);
  });

  it("01069.get-ready-action: plain Action, played from alter-ego form; readies an ally", () => {
    const opened = openHandFor("01069", "leadership", true);
    const { state: withAlly, id: ally } = playCode(opened.state, "01067", [opened.id]);
    const tired = patchInstance(withAlly, ally, { exhausted: true });
    const { state: after } = playOpened({ state: tired, id: opened.id }, choosing(ally as string));
    expect(inst(after, ally).exhausted).toBe(false);
    expect(playerOf(after, P1).discard).toContain(opened.id);
  });

  it("01070.lead-from-the-front-action: Hero Action; each of that player's characters gets +1 THW and +1 ATK", () => {
    const opened = openHandFor("01070", "leadership");
    const { state: withAlly, id: ally } = playCode(opened.state, "01067", [opened.id]);
    const hero = heroOf(withAlly);
    const before = { hero: profile(withAlly, hero), ally: profile(withAlly, ally) };
    const { state: after } = playOpened({ state: withAlly, id: opened.id });
    expect(profile(after, hero).thw).toBe(before.hero.thw + 1);
    expect(profile(after, hero).atk).toBe(before.hero.atk + 1);
    expect(profile(after, ally).thw).toBe(before.ally.thw + 1);
    expect(profile(after, ally).atk).toBe(before.ally.atk + 1);
  });

  it("01070.lead-from-the-front-action: a Hero Action is refused in alter-ego form", () => {
    const opened = openHandFor("01070", "leadership", true);
    const pay = filler(opened.state, 2, [opened.id]);
    expect(refused(pay.state, opened.id, pay.ids)).toBe(true);
  });

  it("01071.make-the-call-action: plain Action from alter-ego; pay an ally's printed cost → put it into play from any discard", () => {
    const opened = openHandFor("01071", "leadership", true);
    const given = moveToHand(opened.state, P1, "01067"); // Maria Hill, cost 2
    const allyId = given.ids[0]!;
    const discarded = moveToDiscard(given.state, P1, "01067");
    const pay = filler(discarded.state, 2, [opened.id, allyId]);
    const handBefore = playerOf(pay.state, P1).hand.length;
    const after = settle(
      runWith(PLAYABLE_DEPS, pay.state, play(P1, opened.id, pay.ids, { costChoices: { ally: [allyId] } })),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(playerOf(after, P1).playArea).toContain(allyId);
    expect(inst(after, allyId).controllerId).toBe(P1);
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 1 - 2);
  });

  it("01072.the-power-of-leadership-constant: one resource pays 2 for a Leadership card, but only 1 for a basic card", () => {
    powerOf("leadership", "01072", "01070", "01087");
  });

  it("01073.the-triskelion-constant: raises the ally limit by 1 (RRG 1.8 'Ally Limit', p. 7)", () => {
    const opened = openHandFor("01073", "leadership");
    const allyCount = (s: GameState) => playerOf(s, P1).playArea.filter((i) => cardOf(s, i).type === "ally").length;
    const staged = ["01067", "01066", "01083"].reduce((s, code) => injectIntoPlay(s, code).state, opened.state);
    expect(allyCount(staged)).toBe(3);
    // Without The Triskelion a fourth ally forces one of them out (the limit is 3).
    const control = playCode(staged, "01068", [opened.id]);
    expect(allyCount(control.state)).toBe(3);
    // With it, all four stay.
    const { state: withTriskelion } = playOpened({ state: staged, id: opened.id });
    const fourth = playCode(withTriskelion, "01068", [opened.id]);
    expect(allyCount(fourth.state)).toBe(4);
  });

  it("01074.inspired-constant: attached ally gets +1 THW and +1 ATK", () => {
    const opened = openHandFor("01074", "leadership");
    const { state: withAlly, id: ally } = playCode(opened.state, "01067", [opened.id]);
    const before = profile(withAlly, ally);
    const { state: after } = playOpened({ state: withAlly, id: opened.id }, firstLegal, ally);
    expect(inst(after, opened.id).attachedTo).toBe(ally);
    expect(profile(after, ally).thw).toBe(before.thw + 1);
    expect(profile(after, ally).atk).toBe(before.atk + 1);
  });
});

describe("Aggression cards, from Black Panther's deck", () => {
  /** Hulk in play, with `top` as the top card of his deck, attacking the villain. */
  function hulkAttacks(top: string) {
    const opened = openHandFor("01050", "aggression");
    const { state: inPlay } = playOpened(opened);
    const villain = villainOf(inPlay);
    const stacked = putOnTopOfDeck(inPlay, P1, top);
    const baseline = inst(stacked.state, villain).damage;
    const after = basicAttack(stacked.state, opened.id, villain, accepting([], villain as string));
    return { after, hulk: opened.id, villain, baseline, milled: stacked.ids[0]!, atk: profile(inPlay, opened.id).atk };
  }

  it("01050.hulk-forced-response: after he attacks, a [physical] top card deals 2 damage to an enemy", () => {
    const { after, hulk, villain, baseline, milled, atk } = hulkAttacks("01054"); // Uppercut: [physical]
    expect(playerOf(after, P1).discard).toContain(milled);
    expect(inst(after, villain).damage).toBe(baseline + atk + 2); // his own attack, then the [physical] result
    expect(cardsInPlay(after)).toContain(hulk);
  });

  it("01050.hulk-forced-response: a [mental] top card discards Hulk", () => {
    const { after, hulk } = hulkAttacks("01052"); // Chase Them Down: [mental]
    expect(cardsInPlay(after)).not.toContain(hulk);
    expect(playerOf(after, P1).discard).toContain(hulk);
  });

  it("01051.tigra-response: after she attacks and defeats a minion, heals 1 damage from her", () => {
    const opened = openHandFor("01051", "aggression");
    const { state: inPlay } = playOpened(opened);
    const staged = engageMinion(inPlay, SHOCKER, "tg-shocker");
    const primed = patchInstance(patchInstance(staged, "tg-shocker" as InstanceId, { damage: 2 }), opened.id, {
      damage: 1,
    });
    const target = "tg-shocker" as InstanceId;
    // RRG 1.8 "Consequential Damage": her 1 consequential damage lands after her triggered abilities resolve, so the
    // declined control ends at 1 + 1 = 2 and the response's heal leaves her at 0 + 1 = 1.
    const control = basicAttack(primed, opened.id, target);
    expect(playerOf(control, P1).playArea).not.toContain("tg-shocker");
    expect(inst(control, opened.id).damage).toBe(2);
    const after = basicAttack(primed, opened.id, target, accepting(["01051.tigra-response"]));
    expect(inst(after, opened.id).damage).toBe(1);
  });

  it("01052.chase-them-down-response: after your hero attacks and defeats an enemy, removes 2 threat from a scheme", () => {
    const opened = openHandFor("01052", "aggression");
    const staged = withThreat(engageMinion(opened.state, SHOCKER, "ct-shocker"), 6);
    const primed = patchInstance(staged, "ct-shocker" as InstanceId, { damage: 2 });
    const after = basicAttack(
      primed,
      heroOf(primed),
      "ct-shocker" as InstanceId,
      accepting(["01052.chase-them-down-response"]),
    );
    expect(playerOf(after, P1).discard).toContain(opened.id);
    expect(mainThreat(after)).toBe(4);
    // Control: declined, no threat removed.
    expect(mainThreat(basicAttack(primed, heroOf(primed), "ct-shocker" as InstanceId))).toBe(6);
  });

  it("01053.relentless-assault-action: Hero Action; 5 damage to a minion, overkill only if paid with [physical]", () => {
    const opened = openHandFor("01053", "aggression");
    const staged = engageMinion(opened.state, SHOCKER, "ra-shocker");
    const villain = villainOf(staged);
    const target = choosing("ra-shocker");
    const physical = filler(staged, 1, [opened.id], { icon: "physical" });
    const other = filler(physical.state, 1, [opened.id, ...physical.ids], { notIcon: "physical" });
    const withOverkill = playCard(other.state, opened.id, [...physical.ids, ...other.ids], target);
    expect(playerOf(withOverkill, P1).playArea).not.toContain("ra-shocker");
    expect(inst(withOverkill, villain).damage).toBe(inst(staged, villain).damage + 2); // 5 - 3 HP excess
    const plain = filler(staged, 2, [opened.id], { notIcon: "physical" });
    const withoutOverkill = playCard(plain.state, opened.id, plain.ids, target);
    expect(inst(withoutOverkill, villain).damage).toBe(inst(staged, villain).damage);
  });

  it("01053.relentless-assault-action: a Hero Action is refused in alter-ego form", () => {
    const opened = openHandFor("01053", "aggression", true);
    const pay = filler(engageMinion(opened.state, SHOCKER, "ra2"), 2, [opened.id]);
    expect(refused(pay.state, opened.id, pay.ids)).toBe(true);
  });

  it("01054.uppercut-action: Hero Action; 5 damage to an enemy", () => {
    const opened = openHandFor("01054", "aggression");
    const villain = villainOf(opened.state);
    const pay = filler(opened.state, 3, [opened.id]);
    const after = playCard(pay.state, opened.id, pay.ids, choosing(villain as string));
    expect(inst(after, villain).damage).toBe(inst(opened.state, villain).damage + 5);
  });

  it("01054.uppercut-action: a Hero Action is refused in alter-ego form", () => {
    const opened = openHandFor("01054", "aggression", true);
    const pay = filler(opened.state, 3, [opened.id]);
    expect(refused(pay.state, opened.id, pay.ids)).toBe(true);
  });

  it("01055.the-power-of-aggression-constant: one resource pays 2 for an Aggression card, but only 1 for a basic card", () => {
    powerOf("aggression", "01055", "01057", "01087");
  });

  it("01056.tac-team-action: plain Action, used from alter-ego form; spends an attack counter → 2 damage to an enemy", () => {
    const opened = openHandFor("01056", "aggression", true);
    const { state: inPlay } = playOpened(opened);
    expect(inst(inPlay, opened.id).counters.attack).toBe(3);
    const villain = villainOf(inPlay);
    const after = useAbility(inPlay, opened.id, "01056.tac-team-action", choosing(villain as string));
    expect(inst(after, villain).damage).toBe(inst(inPlay, villain).damage + 2);
    expect(inst(after, opened.id).counters.attack).toBe(2);
    expect(inst(after, opened.id).exhausted).toBe(true);
  });

  it("01057.combat-training-constant: your hero gets +1 ATK", () => {
    const opened = openHandFor("01057", "aggression");
    const hero = heroOf(opened.state);
    const before = profile(opened.state, hero).atk;
    const { state: after } = playOpened(opened, firstLegal, hero);
    expect(profile(after, hero).atk).toBe(before + 1);
  });
});

describe("Protection cards, from Captain Marvel's deck", () => {
  it("01075.black-widow-interrupt: when an encounter card is revealed, exhaust + spend [mental] → cancel it, reveal another", () => {
    const opened = openHandFor("01075", "protection");
    const { state: inPlay } = playOpened(opened);
    const stack = [ADVANCE, HYDRA_MERCENARY, ADVANCE];
    const control = villainPhase(inPlay, { stack });
    expect(instancesOf(control, HYDRA_MERCENARY).some((i) => cardsInPlay(control).includes(i))).toBe(true);
    const mental = filler(inPlay, 1, [opened.id], { icon: "mental" });
    const after = villainPhase(mental.state, {
      stack,
      pick: (s) => {
        // Her cost is a [mental] resource: pay it with the mental card moved to hand.
        if (s.pendingChoice?.prompt.kind === "payForAbility") return [`hand:${mental.ids[0]!}`];
        return accepting(["01075.black-widow-interrupt"])(s);
      },
    });
    expect(inst(after, opened.id).exhausted).toBe(true);
    expect(instancesOf(after, HYDRA_MERCENARY).some((i) => cardsInPlay(after).includes(i))).toBe(false);
    // "Then, reveal another card": the second Advance (The villain schemes) resolves, which the control never reveals.
    expect(mainThreat(after)).toBeGreaterThan(mainThreat(control));
  });

  it("01076.luke-cage: Toughness, enters play with a tough status card", () => {
    const opened = openHandFor("01076", "protection");
    const { state: after } = playOpened(opened);
    expect(inst(after, opened.id).statuses.tough).toBe(1);
  });

  it("01077.counter-punch-response: after your hero defends against an enemy attack, deals damage equal to your hero's ATK", () => {
    const opened = openHandFor("01077", "protection");
    const villain = villainOf(opened.state);
    const atk = profile(opened.state, heroOf(opened.state)).atk;
    const after = defendedAttack(opened.state, accepting(["01077.counter-punch-response"], villain as string));
    expect(playerOf(after, P1).discard).toContain(opened.id);
    expect(inst(after, villain).damage).toBe(inst(opened.state, villain).damage + atk);
  });

  it("01078.get-behind-me-interrupt: Hero Interrupt; cancels a treachery's When Revealed, the villain attacks you instead", () => {
    const opened = openHandFor("01078", "protection");
    const hero = heroOf(opened.state);
    const stack = [ADVANCE, ADVANCE];
    const control = villainPhase(opened.state, { stack });
    const pay = filler(opened.state, 1, [opened.id]);
    const after = villainPhase(pay.state, { stack, pick: accepting(["01078.get-behind-me-interrupt"]) });
    expect(playerOf(after, P1).discard).toContain(opened.id);
    expect(mainThreat(after)).toBeLessThan(mainThreat(control)); // Advance's "The villain schemes" was cancelled
    expect(inst(after, hero).damage).toBeGreaterThan(inst(control, hero).damage); // and the villain attacked again
  });

  it("01078.get-behind-me-interrupt: a Hero Interrupt is never offered in alter-ego form", () => {
    const opened = openHandFor("01078", "protection", true);
    const after = villainPhase(opened.state, {
      stack: [ADVANCE, ADVANCE],
      pick: accepting(["01078.get-behind-me-interrupt"]),
    });
    expect(playerOf(after, P1).discard).not.toContain(opened.id);
  });

  it("01079.the-power-of-protection-constant: one resource pays 2 for a Protection card, but only 1 for a basic card", () => {
    // Med Team (cost 3) vs. Mockingbird (basic, cost 3): the doubled resource plus one more card covers only the former.
    powerOf("protection", "01079", "01080", "01083");
  });

  it("01080.med-team-action: plain Action, used from alter-ego form; spends a counter → heal 2 from a friendly character", () => {
    const opened = openHandFor("01080", "protection", true);
    const { state: inPlay } = playOpened(opened);
    expect(inst(inPlay, opened.id).counters.medical).toBe(3);
    const hero = heroOf(inPlay);
    const hurt = patchInstance(inPlay, hero, { damage: 3 });
    const after = useAbility(hurt, opened.id, "01080.med-team-action", choosing(hero as string));
    expect(inst(after, hero).damage).toBe(1);
    expect(inst(after, opened.id).counters.medical).toBe(2);
  });

  it("01081.armored-vest-constant: your hero gets +1 DEF", () => {
    const opened = openHandFor("01081", "protection");
    const hero = heroOf(opened.state);
    const before = profile(opened.state, hero).def;
    const { state: after } = playOpened(opened, firstLegal, hero);
    expect(profile(after, hero).def).toBe(before + 1);
  });

  it("01082.indomitable-response: after your hero defends, discard it → ready your hero", () => {
    const opened = openHandFor("01082", "protection");
    const hero = heroOf(opened.state);
    const { state: inPlay } = playOpened(opened, firstLegal, hero);
    const control = defendedAttack(inPlay, firstLegal);
    expect(inst(control, hero).exhausted).toBe(true); // defending exhausts; heroes only ready at the end of the player phase
    const after = defendedAttack(inPlay, accepting(["01082.indomitable-response"]));
    expect(inst(after, hero).exhausted).toBe(false);
    expect(playerOf(after, P1).discard).toContain(opened.id);
  });
});

describe("Basic cards, from Iron Man's deck", () => {
  it("01083.mockingbird-response: after she enters play, stuns an enemy", () => {
    const opened = openHandFor("01083", "basic");
    const villain = villainOf(opened.state);
    const { state: after } = playOpened(opened, accepting(["01083.mockingbird-response"], villain as string));
    expect(inst(after, villain).statuses.stunned).toBe(1);
  });

  it("01084.nick-fury-forced-response: forced choice on entering play; discarded at the end of the round", () => {
    const opened = openHandFor("01084", "basic");
    const pay = filler(opened.state, 4, [opened.id]);
    const handBefore = playerOf(pay.state, P1).hand.length;
    const inPlay = playCard(pay.state, opened.id, pay.ids, choosing(/Draw 3/));
    expect(playerOf(inPlay, P1).hand.length).toBe(handBefore - 1 - 4 + 3);
    expect(cardsInPlay(inPlay)).toContain(opened.id);
    const ended = villainPhase(inPlay);
    expect(playerOf(ended, P1).discard).toContain(opened.id);
    expect(cardsInPlay(ended)).not.toContain(opened.id);
  });

  it("01085.emergency-interrupt: plain Interrupt; when the villain schemes against an alter-ego, reduces the threat by 1", () => {
    const opened = openHandFor("01085", "basic", true);
    const control = villainPhase(opened.state, { stack: [ADVANCE] });
    const after = villainPhase(opened.state, { stack: [ADVANCE], pick: accepting(["01085.emergency-interrupt"]) });
    expect(playerOf(after, P1).discard).toContain(opened.id);
    expect(mainThreat(after)).toBe(mainThreat(control) - 1);
  });

  it("01086.first-aid-action: plain Action, played from alter-ego form; heals 2 damage from any character", () => {
    const opened = openHandFor("01086", "basic", true);
    const identity = heroOf(opened.state);
    const hurt = patchInstance(opened.state, identity, { damage: 3 });
    const { state: after } = playOpened({ state: hurt, id: opened.id }, choosing(identity as string));
    expect(inst(after, identity).damage).toBe(1);
  });

  it("01087.haymaker-action: Hero Action; 3 damage to an enemy", () => {
    const opened = openHandFor("01087", "basic");
    const villain = villainOf(opened.state);
    const { state: after, before } = playOpened(opened, choosing(villain as string));
    expect(inst(after, villain).damage).toBe(inst(before, villain).damage + 3);
  });

  it("01087.haymaker-action: a Hero Action is refused in alter-ego form", () => {
    const opened = openHandFor("01087", "basic", true);
    const pay = filler(opened.state, 2, [opened.id]);
    expect(refused(pay.state, opened.id, pay.ids)).toBe(true);
  });

  it("01091.avengers-mansion-action: plain Action, used from alter-ego form; exhaust → a chosen player draws 1", () => {
    const opened = openHandFor("01091", "basic", true);
    const { state: inPlay } = playOpened(opened);
    const handBefore = playerOf(inPlay, P1).hand.length;
    const after = useAbility(inPlay, opened.id, "01091.avengers-mansion-action");
    expect(playerOf(after, P1).hand.length).toBe(handBefore + 1);
    expect(inst(after, opened.id).exhausted).toBe(true);
  });

  it("01092.helicarrier-action: plain Action, used from alter-ego form; the next card played this phase costs 1 less", () => {
    const opened = openHandFor("01092", "basic", true);
    const { state: inPlay } = playOpened(opened);
    const used = useAbility(inPlay, opened.id, "01092.helicarrier-action");
    const given = moveToHand(used, P1, "01086"); // First Aid, cost 1: free after the discount
    const firstAid = given.ids[0]!;
    const after = playCard(given.state, firstAid, [], choosing(heroOf(given.state) as string));
    expect(playerOf(after, P1).discard).toContain(firstAid);
  });

  it("01093.tenacity-action: Hero Action; spend a [physical] resource and discard this card → ready your hero", () => {
    const opened = openHandFor("01093", "basic");
    const hero = heroOf(opened.state);
    const { state: inPlay } = playOpened(opened, firstLegal, hero);
    const tired = patchInstance(inPlay, hero, { exhausted: true });
    const physical = filler(tired, 1, [opened.id], { icon: "physical" });
    const after = useAbility(physical.state, opened.id, "01093.tenacity-action", firstLegal, [
      { fromHand: physical.ids[0]! },
    ] as never);
    expect(inst(after, hero).exhausted).toBe(false);
    expect(playerOf(after, P1).discard).toContain(opened.id);
  });

  it("01093.tenacity-action: the Hero Action ability is refused from alter-ego form", () => {
    const opened = openHandFor("01093", "basic", true);
    const { state: inPlay } = playOpened(opened, firstLegal, heroOf(opened.state));
    const physical = filler(inPlay, 1, [opened.id], { icon: "physical" });
    expect(
      applyCommand(
        physical.state,
        use(P1, opened.id, "01093.tenacity-action", [{ fromHand: physical.ids[0]! }]),
        PLAYABLE_DEPS,
      ).ok,
    ).toBe(false);
  });
});
