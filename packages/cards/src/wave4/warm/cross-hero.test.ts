import { CORE_STARTER_DECKS, cardId, PLAYABLE_CARDS, type AnyCard, type CardId } from "@mc/content";
import {
  activeEncounterDeck,
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
  putOnTopOfDeck,
  resourceAbility,
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
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, "Cards in another hero's deck"): every War Machine
 * pack (`warm`, 23001a-23035) aspect/basic player card that has an ability script — every one whose own `aspect` is
 * not `hero:23001a` (an identity-specific card, RRG 1.8 "Identity-Specific Card", p. 23, only a War Machine deck could
 * hold) — played through the engine from a Core hero's own precon instead of War Machine's.
 *
 * Covered: leadership 23012 Black Panther (response + constant), 23013 Captain Marvel, 23014 Falcon, 23015 Goliath,
 * 23016 Command Team, 23017 Sneak Attack, 23018 Save the Day, 23019 Go Down Swinging, 23020 Make the Call, 23021
 * Innovation (Captain Marvel); basic 23022 Mockingbird, 23023 Quincarrier, 23035 Sidearm (Spider-Man); aggression
 * 23032 As One! (She-Hulk, with a Guardian ally staged); justice 23033 Vigilante Training (Spider-Man, alter-ego
 * form); protection 23034 Stand Together (Black Panther, Guardian ally staged). 23024 Two Against the World is a
 * Team-Up (Iron Man and War Machine) card, so a Core hero's deck holding it is refused (RRG 1.8 "Team-Up", p. 43).
 * Every printed "Hero Action" card is also checked to be refused in alter-ego form (RRG 1.8 "Hero Action" /
 * "Alter-Ego Action"), and 23033's printed "Alter-Ego Action" to be refused in hero form.
 *
 * Skipped: 23025-23027 (Energy, Genius and Strength basic resources) print no ability; 23028-23031 are the
 * obligation/minion/side scheme/treachery encounter cards. 23014, 23015, 23020, 23022, 23023 reprint an earlier card
 * verbatim but the pack scripts them under their own ability ids (`./war-machine-pack-cards.ts`, not aliased in
 * `../reprints.ts`), so they are covered here like any other script. Several tests seat extra copies of other
 * cards (`extraDeck`) because the Core precons hold no suitable ally to stage; that is legal in the seated aspect.
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
const WHIPLASH = "01172"; // ATK 3, HP 4, Retaliate 1

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

/** Moves `code` to hand and plays it, paying its printed cost with single-icon fillers. */
function playCode(state: GameState, code: string, exclude: readonly InstanceId[] = [], pick: Picker = firstLegal) {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as readonly [InstanceId];
  const pay = filler(given.state, costOf(code), [...exclude, id]);
  return { state: playCard(pay.state, id, pay.ids, pick), id };
}

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

/** Ends P1's turn so the villain phase attacks P1 (an Advance, stacked boost that cannot change the damage). `defender`
 * null leaves the attack undefended (no DEF reduction, RRG 1.8 p. 15). `defend` answers the prompts after that. */
function villainAttack(state: GameState, defend: Picker = firstLegal, boostCode = "01186"): GameState {
  const stacked = stackEncounterDeck(state, boostCode);
  const atDefend = settle(
    runWith(PLAYABLE_DEPS, stacked, endTurn(P1)),
    firstLegal,
    (s) => s.pendingChoice?.prompt.kind === "declareDefender",
    PLAYABLE_DEPS,
  );
  const declined = settle(
    runWith(PLAYABLE_DEPS, atDefend, {
      type: "resolveChoice",
      playerId: P1,
      choiceId: atDefend.pendingChoice!.choiceId,
      selectedOptionIds: ["decline"],
    }),
    defend,
    undefined,
    PLAYABLE_DEPS,
  );
  return declined;
}

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

/** Codes of up to `n` distinct allies in P1's own precon (hand + deck), cheapest first, cost at most `maxCost`. */
function preconAllies(state: GameState, n: number, maxCost = 3): string[] {
  const owner = playerOf(state, P1);
  const codes = new Set<string>();
  for (const id of [...owner.hand, ...owner.deck]) {
    const c = cardOf(state, id);
    if (c.type === "ally" && !(c.id as string).startsWith("23") && costOf(c.id as string) <= maxCost) {
      codes.add(c.id as string);
    }
  }
  const sorted = [...codes].sort((a, b) => costOf(a) - costOf(b));
  expect(sorted.length).toBeGreaterThanOrEqual(n);
  return sorted.slice(0, n);
}

/** Picks `id` at any prompt that offers it (a chooseCards / chooseTarget option), `base` otherwise. */
const choosing =
  (id: string, base: Picker = firstLegal): Picker =>
  (state) =>
    state.pendingChoice?.options.some((o) => o.optionId === id) ? [id] : base(state);

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

describe("War Machine leadership cards, from Captain Marvel (Leadership)'s own deck", () => {
  it("23012.black-panther-response: after entering play, attaches a leadership event from the discard pile to him facedown", () => {
    const opened = openHandFor("23012", CAP_MARVEL);
    const { state: withDiscard, id: event } = discardALeadershipEvent(opened.state);
    const { state: after } = playOpened(
      { state: withDiscard, id: opened.id },
      choosing(event, accepting("23012.black-panther-response")),
    );
    expect(cardsInPlay(after)).toContain(opened.id);
    expect(inst(after, event).attachedTo).toBe(opened.id);
    expect(inst(after, opened.id).attachments).toContain(event);
    expect(playerOf(after, P1).discard).not.toContain(event);
  });

  it("23012.black-panther-constant: the attached event can be played as if it were in hand", () => {
    const opened = openHandFor("23012", CAP_MARVEL);
    const { state: withDiscard, id: event } = discardALeadershipEvent(opened.state);
    const { state: inPlay } = playOpened(
      { state: withDiscard, id: opened.id },
      choosing(event, accepting("23012.black-panther-response")),
    );
    expect(inst(inPlay, event).attachedTo).toBe(opened.id);
    const code = inPlay.instances[event]!.cardId as string;
    const pay = filler(inPlay, costOf(code), [event]);
    const result = applyCommand(pay.state, play(P1, event, pay.ids), PLAYABLE_DEPS);
    expect(result.ok).toBe(true);
  });

  it("23013: Captain Marvel the ally is unique, so Captain Marvel's own deck cannot hold her", () => {
    // RRG 1.8 "Unique" (p. 44): a deck cannot include a unique card matching its own identity.
    const seat = buildCrossHeroDeck(PLAYABLE_CARDS, CAP_MARVEL, "23013");
    expect(createGame(buildScenario([seat]), PLAYABLE_DEPS).ok).toBe(false);
  });

  it("23013.captain-marvel-response: mills 4; one energy resource deals 3 damage to an enemy, two also stun it", () => {
    // Played from Spider-Man's own identity and signature cards seated with the Core leadership precon's aspect cards
    // (the only Core leadership list), so a Core hero other than Captain Marvel holds her.
    const spider = CORE_STARTER_DECKS.find((d) => d.id === SPIDER_MAN)!;
    const cap = CORE_STARTER_DECKS.find((d) => d.id === CAP_MARVEL)!;
    const entries = (deck: typeof spider, keep: (aspect: string) => boolean) =>
      deck.cards.filter((e) => {
        const c = BY_ID.get(e.cardId as string)!;
        return "aspect" in c && keep(c.aspect);
      });
    const list = [
      ...entries(spider, (a) => a.startsWith("hero:")),
      ...entries(cap, (a) => a === "leadership" || a === "basic"),
    ].flatMap((e) => Array.from({ length: e.quantity }, () => e.cardId as CardId));
    const seat: PlayerSetup = {
      identityCardId: spider.identityCardId as CardId,
      aspects: ["leadership"],
      deck: [...list, "23013" as CardId],
    };
    const run = (energy: number) => {
      const created = createGame(buildScenario([seat]), PLAYABLE_DEPS);
      if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
      const opening = toHeroFirst(settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS));
      const opened = moveToHand(opening, P1, "23013");
      const id = opened.ids[0]!;
      const pay = filler(opened.state, costOf("23013"), [id]);
      const owner = playerOf(pay.state, P1);
      const isEnergy = (i: InstanceId) => {
        const c = cardOf(pay.state, i);
        return "resourceIcons" in c && (c.resourceIcons.energy ?? 0) > 0;
      };
      const energyIds = owner.deck.filter(isEnergy).slice(0, energy);
      const plainIds = owner.deck.filter((i) => !isEnergy(i)).slice(0, 4 - energy);
      expect(energyIds.length).toBe(energy);
      const codes = [...energyIds, ...plainIds].map((i) => cardOf(pay.state, i).id as string);
      const stacked = putOnTopOfDeck(pay.state, P1, ...codes).state;
      const villain = activeVillain(stacked).instanceId;
      const after = playCard(
        stacked,
        id,
        pay.ids,
        targetingSlots({ enemy: villain as string }, accepting("23013.captain-marvel-response")),
      );
      expect(cardsInPlay(after)).toContain(id);
      return { after, villain };
    };
    const none = run(0);
    expect(inst(none.after, none.villain).damage).toBe(0);
    const one = run(1);
    expect(inst(one.after, one.villain).damage).toBe(3);
    expect(inst(one.after, one.villain).statuses.stunned).toBe(0);
    const two = run(2);
    expect(inst(two.after, two.villain).damage).toBe(3);
    expect(inst(two.after, two.villain).statuses.stunned).toBe(1);
  });

  it("23014.falcon-response: after entering play, removes 1 threat from a scheme per treachery in the top 3 encounter cards", () => {
    const opened = openHandFor("23014", CAP_MARVEL);
    const deck = activeEncounterDeck(opened.state);
    const typed = (type: string) =>
      [...deck.deck, ...deck.discard].map((id) => cardOf(opened.state, id)).filter((c) => c.type === type);
    const [t1, t2] = typed("treachery");
    const [other] = typed("minion");
    expect(t1 && t2 && other).toBeTruthy();
    const stacked = patchInstance(
      stackEncounterDeck(opened.state, t1!.id as string, t2!.id as string, other!.id as string),
      opened.state.mainScheme.instanceId,
      { threat: 6 },
    );
    const { state: after } = playOpened({ state: stacked, id: opened.id }, accepting("23014.falcon-response"));
    expect(mainThreat(after)).toBe(4);
  });

  it("23015.goliath-action: +4 ATK until end of phase, max once per phase, then he is discarded at the end of the phase", () => {
    const opened = openHandFor("23015", CAP_MARVEL);
    const { state: inPlay } = playOpened(opened);
    const base = characterProfile(inPlay, opened.id, PLAYABLE_DEPS)!.atk;
    const buffed = settle(
      runWith(PLAYABLE_DEPS, inPlay, use(P1, opened.id, "23015.goliath-action")),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(characterProfile(buffed, opened.id, PLAYABLE_DEPS)!.atk).toBe(base + 4);
    expect(applyCommand(buffed, use(P1, opened.id, "23015.goliath-action"), PLAYABLE_DEPS).ok).toBe(false);
    const ended = villainAttack(buffed);
    expect(playerOf(ended, P1).discard).toContain(opened.id);
    expect(cardsInPlay(ended)).not.toContain(opened.id);
  });

  it("23016.command-team-action: exhaust + remove a command counter to ready an ally", () => {
    const opened = openHandFor("23016", CAP_MARVEL);
    const [ALLY] = preconAllies(opened.state, 1) as [string];
    const { state: withTeam } = playOpened(opened);
    const { state: withAlly, id: ally } = playCode(withTeam, ALLY, [opened.id]);
    const exhausted = patchInstance(withAlly, ally, { exhausted: true });
    const before = inst(exhausted, opened.id).counters.command;
    expect(before).toBe(3);
    const after = settle(
      runWith(PLAYABLE_DEPS, exhausted, use(P1, opened.id, "23016.command-team-action")),
      targetingSlots({ ally: ally as string }),
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(after, ally).exhausted).toBe(false);
    expect(inst(after, opened.id).exhausted).toBe(true);
    expect(inst(after, opened.id).counters.command).toBe(2);
  });

  it("23017.sneak-attack-action: puts an ally sharing a trait with your identity into play, discarded at end of phase", () => {
    const opened = openHandFor("23017", CAP_MARVEL, { extraDeck: ["23015"] });
    const goliath = moveToHand(opened.state, P1, "23015");
    const goliathId = goliath.ids[0]!;
    const pay = filler(goliath.state, costOf("23017"), [opened.id, goliathId]);
    const after = playCard(pay.state, opened.id, pay.ids, choosing(goliathId));
    expect(playerOf(after, P1).playArea).toContain(goliathId);
    const ended = villainAttack(after);
    expect(playerOf(ended, P1).discard).toContain(goliathId);
    expect(cardsInPlay(ended)).not.toContain(goliathId);
  });

  it("23018.save-the-day-action: Hero Action; discard an ally you control, remove threat from a scheme equal to its printed cost", () => {
    const opened = openHandFor("23018", CAP_MARVEL);
    const [ALLY] = preconAllies(opened.state, 1) as [string];
    const { state: withAlly, id: ally } = playCode(opened.state, ALLY, [opened.id]);
    const primed = patchInstance(withAlly, withAlly.mainScheme.instanceId, { threat: 8 });
    const pay = filler(primed, costOf("23018"), [opened.id, ally]);
    const after = playCard(pay.state, opened.id, pay.ids, targetingSlots({ ally: ally as string }));
    expect(playerOf(after, P1).discard).toContain(ally);
    expect(mainThreat(after)).toBe(8 - costOf(ALLY));
  });

  it("23018.save-the-day-action: a Hero Action card is refused in alter-ego form", () => {
    const { state, id } = openHandFor("23018", CAP_MARVEL, { alterEgo: true });
    const pay = filler(state, costOf("23018"), [id]);
    expect(refused(pay.state, id, pay.ids)).toBe(true);
  });

  it("23019.go-down-swinging-action: Hero Action; discard an ally you control, deal damage to an enemy equal to its printed cost", () => {
    const opened = openHandFor("23019", CAP_MARVEL);
    const [ALLY] = preconAllies(opened.state, 1) as [string];
    const { state: withAlly, id: ally } = playCode(opened.state, ALLY, [opened.id]);
    const villain = activeVillain(withAlly).instanceId;
    const pay = filler(withAlly, costOf("23019"), [opened.id, ally]);
    const after = playCard(
      pay.state,
      opened.id,
      pay.ids,
      targetingSlots({ ally: ally as string, enemy: villain as string }),
    );
    expect(playerOf(after, P1).discard).toContain(ally);
    expect(inst(after, villain).damage).toBe(costOf(ALLY));
  });

  it("23019.go-down-swinging-action: a Hero Action card is refused in alter-ego form", () => {
    const { state, id } = openHandFor("23019", CAP_MARVEL, { alterEgo: true });
    expect(refused(state, id, [])).toBe(true);
  });

  it("23020.make-the-call-action: pay the printed cost of an ally in any discard pile, put it into play under your control", () => {
    const opened = openHandFor("23020", CAP_MARVEL);
    const [ALLY] = preconAllies(opened.state, 1) as [string];
    const given = moveToHand(opened.state, P1, ALLY);
    const allyId = given.ids[0]!;
    const discarded = moveToDiscard(given.state, P1, ALLY);
    expect(discarded.id).toBe(allyId);
    // Pay with hand cards already there (the filler could re-pick a copy of the discarded ally's own code).
    const payIds = playerOf(discarded.state, P1)
      .hand.filter(
        (id) =>
          id !== opened.id &&
          singleIcon(cardOf(discarded.state, id)) &&
          cardOf(discarded.state, id).type !== "resource",
      )
      .slice(0, costOf(ALLY));
    expect(payIds.length).toBe(costOf(ALLY));
    const pay = { state: discarded.state, ids: payIds };
    const handBefore = playerOf(pay.state, P1).hand.length;
    const after = settle(
      runWith(PLAYABLE_DEPS, pay.state, play(P1, opened.id, pay.ids, { costChoices: { ally: [allyId] } })),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(playerOf(after, P1).playArea).toContain(allyId);
    expect(inst(after, allyId).controllerId).toBe(P1);
    // The ally's printed cost was paid from hand, plus the event itself leaving it.
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 1 - costOf(ALLY));
  });

  it("23021.innovation-response: after you spend this card, heal 1 damage from an ally you control", () => {
    const opened = openHandFor("23021", CAP_MARVEL);
    const [ALLY, ALLY2] = preconAllies(opened.state, 2) as [string, string];
    const { state: withAlly, id: ally } = playCode(opened.state, ALLY, [opened.id]);
    const damaged = patchInstance(withAlly, ally, { damage: 1 });
    const second = moveToHand(damaged, P1, ALLY2);
    const secondId = second.ids[0]!;
    const pay = filler(second.state, 2, [opened.id, ally, secondId]);
    const after = playCard(pay.state, secondId, [opened.id, ...pay.ids], accepting("23021.innovation-response"));
    expect(playerOf(after, P1).playArea).toContain(secondId);
    expect(inst(after, ally).damage).toBe(0);
  });
});

describe("War Machine basic cards, from Spider-Man (Justice)'s own deck", () => {
  it("23022.mockingbird-response: after entering play, stuns an enemy", () => {
    const opened = openHandFor("23022", SPIDER_MAN);
    const villain = activeVillain(opened.state).instanceId;
    const { state: after } = playOpened(opened, accepting("23022.mockingbird-response"));
    expect(inst(after, villain).statuses.stunned).toBe(1);
  });

  it("23023.quincarrier-resource: playable by an Avenger identity; exhausts to generate a wild resource", () => {
    const opened = openHandFor("23023", SPIDER_MAN);
    const [ALLY] = preconAllies(opened.state, 1) as [string];
    const { state: inPlay } = playOpened(opened);
    expect(cardsInPlay(inPlay)).toContain(opened.id);
    // Pay a precon ally with Quincarrier (1 wild) plus single-icon fillers for the rest of its cost.
    const given = moveToHand(inPlay, P1, ALLY);
    const bird = given.ids[0]!;
    const pay = filler(given.state, costOf(ALLY) - 1, [opened.id, bird]);
    const after = settle(
      runWith(
        PLAYABLE_DEPS,
        pay.state,
        play(P1, bird, pay.ids, { abilities: [resourceAbility(opened.id, "23023.quincarrier-resource")] }),
      ),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(playerOf(after, P1).playArea).toContain(bird);
    expect(inst(after, opened.id).exhausted).toBe(true);
  });

  it("23023: Play only if your identity has the Avenger trait; refused for Peter Parker (Genius) in alter-ego form", () => {
    const { state, id } = openHandFor("23023", SPIDER_MAN, { alterEgo: true });
    const pay = filler(state, costOf("23023"), [id]);
    expect(refused(pay.state, id, pay.ids)).toBe(true);
  });

  it("23024: a Team-Up (Iron Man and War Machine) card, so a Core hero's deck holding it is refused", () => {
    // RRG 1.8 "Team-Up" (p. 43): a Team-Up card can only be in a deck whose identity matches one of its names.
    const seat = buildCrossHeroDeck(PLAYABLE_CARDS, SPIDER_MAN, "23024");
    expect(createGame(buildScenario([seat]), PLAYABLE_DEPS).ok).toBe(false);
  });

  it("23035.sidearm-constant: attached ally gets +1 ATK and its attacks gain ranged (ignoring Retaliate); max 1 per ally", () => {
    const opened = openHandFor("23035", SPIDER_MAN, { extraDeck: ["23035"] });
    const [ALLY] = preconAllies(opened.state, 1) as [string];
    const { state: withAlly, id: ally } = playCode(opened.state, ALLY, [opened.id]);
    const baseAtk = characterProfile(withAlly, ally, PLAYABLE_DEPS)!.atk;
    // Control: the ally's basic attack on a Retaliate 1 minion takes retaliate damage.
    const control = basicAttack(engageMinion(withAlly, WHIPLASH, "sa-whip"), ally, "sa-whip" as InstanceId);
    expect(inst(control, ally).damage).toBe(1);
    const pay = filler(withAlly, costOf("23035"), [opened.id, ally]);
    const equipped = playCard(pay.state, opened.id, pay.ids, firstLegal, ally);
    expect(inst(equipped, opened.id).attachedTo).toBe(ally);
    expect(characterProfile(equipped, ally, PLAYABLE_DEPS)!.atk).toBe(baseAtk + 1);
    const ranged = basicAttack(engageMinion(equipped, WHIPLASH, "sa-whip"), ally, "sa-whip" as InstanceId);
    expect(inst(ranged, "sa-whip" as InstanceId).damage).toBe(baseAtk + 1);
    expect(inst(ranged, ally).damage).toBe(0);
    // Max 1 per ally: a second Sidearm onto the same ally is refused.
    const second = moveToHand(equipped, P1, "23035");
    const secondId = second.ids.find((id) => id !== opened.id)!;
    const pay2 = filler(second.state, costOf("23035"), [opened.id, ally, secondId]);
    const attempt = applyCommand(pay2.state, play(P1, secondId, pay2.ids, { attachToInstanceId: ally }), PLAYABLE_DEPS);
    expect(attempt.ok).toBe(false);
  });
});

describe("War Machine aggression card, from She-Hulk (Aggression)'s own deck", () => {
  it("23032.as-one-action: Hero Action (attack); exhaust an avenger and a guardian → damage equal to their combined ATK, with overkill", () => {
    const opened = openHandFor("23032", SHE_HULK);
    const hero = identityOf(opened.state);
    const { state: withGamora, id: gamora } = injectIntoPlay(opened.state, GAMORA);
    const heroAtk = characterProfile(withGamora, hero, PLAYABLE_DEPS)!.atk;
    const gamoraAtk = characterProfile(withGamora, gamora, PLAYABLE_DEPS)!.atk;
    const villain = activeVillain(withGamora).instanceId;
    const pay = filler(withGamora, costOf("23032"), [opened.id]);
    const hit = playCard(pay.state, opened.id, pay.ids, targetingSlots({ enemy: villain as string }));
    expect(inst(hit, villain).damage).toBe(heroAtk + gamoraAtk);
    expect(inst(hit, hero).exhausted).toBe(true);
    expect(inst(hit, gamora).exhausted).toBe(true);
    // Overkill (RRG 1.8 "Overkill", p. 31): excess damage over a minion's remaining HP also hits the villain.
    const withMinion = engageMinion(pay.state, SHOCKER, "ao-shocker");
    const kill = playCard(withMinion, opened.id, pay.ids, targetingSlots({ enemy: "ao-shocker" }));
    expect(playerOf(kill, P1).playArea).not.toContain("ao-shocker");
    expect(inst(kill, villain).damage).toBe(heroAtk + gamoraAtk - 3);
  });

  it("23032.as-one-action: cannot be used without a guardian character to exhaust (Alliance cost)", () => {
    const opened = openHandFor("23032", SHE_HULK);
    const pay = filler(opened.state, costOf("23032"), [opened.id]);
    expect(refused(pay.state, opened.id, pay.ids)).toBe(true);
  });

  it("23032.as-one-action: a Hero Action card is refused in alter-ego form", () => {
    const { state, id } = openHandFor("23032", SHE_HULK, { alterEgo: true });
    const { state: withGamora } = injectIntoPlay(state, GAMORA);
    const pay = filler(withGamora, costOf("23032"), [id]);
    expect(refused(pay.state, id, pay.ids)).toBe(true);
  });
});

describe("War Machine justice card, from Spider-Man (Justice)'s own deck", () => {
  it("23033.vigilante-training-action: Alter-Ego Action; exhaust + remove a training counter, shuffle a justice event from the discard pile into the deck", () => {
    const opened = openHandFor("23033", SPIDER_MAN, { alterEgo: true });
    expect(playerOf(opened.state, P1).identity.form).toBe("alterEgo");
    const { state: inPlay } = playOpened(opened);
    expect(cardsInPlay(inPlay)).toContain(opened.id);
    const owner = playerOf(inPlay, P1);
    const eventId = [...owner.hand, ...owner.deck].find((id) => {
      const c = cardOf(inPlay, id);
      return c.type === "event" && "aspect" in c && c.aspect === "justice";
    })!;
    expect(eventId).toBeDefined();
    const { state: discarded } = moveToDiscard(inPlay, P1, cardOf(inPlay, eventId).id as string);
    const used = settle(
      runWith(PLAYABLE_DEPS, discarded, use(P1, opened.id, "23033.vigilante-training-action")),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(playerOf(used, P1).discard).not.toContain(eventId);
    expect(playerOf(used, P1).deck).toContain(eventId);
    expect(inst(used, opened.id).exhausted).toBe(true);
    expect(inst(used, opened.id).counters.training).toBe(1);
  });

  it("23033.vigilante-training-action: an Alter-Ego Action is refused in hero form", () => {
    const opened = openHandFor("23033", SPIDER_MAN);
    expect(playerOf(opened.state, P1).identity.form).toBe("hero");
    const { state: inPlay } = playOpened(opened);
    const owner = playerOf(inPlay, P1);
    const eventId = [...owner.hand, ...owner.deck].find((id) => {
      const c = cardOf(inPlay, id);
      return c.type === "event" && "aspect" in c && c.aspect === "justice";
    })!;
    const { state: discarded } = moveToDiscard(inPlay, P1, cardOf(inPlay, eventId).id as string);
    expect(applyCommand(discarded, use(P1, opened.id, "23033.vigilante-training-action"), PLAYABLE_DEPS).ok).toBe(
      false,
    );
  });
});

describe("War Machine protection card, from Black Panther (Protection)'s own deck", () => {
  it("23034.stand-together-interrupt: prevents all damage from an attack and deals that much to the attacker, exhausting an avenger and a guardian", () => {
    const opened = openHandFor("23034", BLACK_PANTHER);
    const hero = identityOf(opened.state);
    const villain = activeVillain(opened.state).instanceId;
    const { state: withGamora, id: gamora } = injectIntoPlay(opened.state, GAMORA);
    // Undefended with a 2-icon boost card (Bomb Scare) so the attack is Rhino ATK + 2 and the hero's DEF is not applied.
    const control = villainAttack(withGamora, firstLegal, "01109");
    const taken = inst(control, hero).damage;
    expect(taken).toBeGreaterThan(0);
    // Black Panther's own Retaliate 1 hurts Rhino after the attack in both runs, so measure against the control.
    const retaliated = inst(control, villain).damage;
    const pay: Picker = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "payForCard")
        return choice.options.map((o) => o.optionId).slice(0, choice.maxSelections);
      return accepting("23034.stand-together-interrupt")(state);
    };
    const after = villainAttack(withGamora, pay, "01109");
    expect(inst(after, hero).damage).toBe(0);
    expect(inst(after, villain).damage).toBe(retaliated + taken);
    expect(inst(after, hero).exhausted).toBe(true);
    expect(inst(after, gamora).exhausted).toBe(true);
    expect(playerOf(after, P1).discard).toContain(opened.id);
  });
});
