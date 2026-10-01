import { CORE_STARTER_DECKS, cardId, PLAYABLE_CARDS, type AnyCard, type CardId } from "@mc/content";
import {
  activeVillain,
  applyCommand,
  characterProfile,
  cardsInPlay,
  createGame,
  printedResources,
  type CardInstance,
  type GameState,
  type InstanceId,
  type PlayerSetup,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "../../playable/index.js";
import { buildCrossHeroDeck } from "../../testing/cross-hero.js";
import {
  applyOk,
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
import { moveToDiscard } from "../../testing/staging.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, "Cards in another hero's deck"): every Vision pack
 * (`vision`, 26001a-26036) aspect/basic player card that has an ability script — every one whose own `aspect` is not
 * `hero:26001a` (an identity-specific card, RRG 1.8 "Identity-Specific Card", p. 23, only a Vision deck could hold) —
 * played through the engine from a Core hero's own precon instead of Vision's.
 *
 * Covered: protection 26013 Jocasta (response + constant), 26014 Protector, 26015 Victor Mancha, 26016 Flow Like
 * Water, 26018 Defiance, 26021 Preservation (hero form heals; alter-ego form does not) — all from Black Panther;
 * basic 26022 Machine Man (attack and thwart), 26024 Reboot (hero and alter-ego form), 26036 Meditation (Spider-Man,
 * alter-ego form; refused in hero form); aggression 26033 Assault Training (She-Hulk; Alter-Ego Action, refused in hero
 * form); justice 26034 Chance Encounter (Spider-Man, attached to a side scheme, refused on the main scheme);
 * leadership 26035 Joining Forces (Captain Marvel, with an Avenger and a Guardian ally in hand; Hero Action, refused
 * in alter-ego form). Jocasta, Victor Mancha and Joining Forces' extra allies are seated as extra deck copies
 * (`extraDeck`, deck legality relaxed) because the Core precons hold no Android or Guardian ally.
 *
 * Skipped: 26017 Indomitable, 26019 Side Step, 26020 Get Behind Me! and 26023 Avengers Mansion are verbatim reprints
 * aliased in `../reprints.ts` (their scripts are the earlier cards' own, tested with those); 26025-26027 (Energy,
 * Genius and Strength basic resources) print no ability; 26028-26032 are the obligation/minion/side scheme/treachery
 * encounter cards. The pack has no Team-Up card and no card with a trait gate that a Core hero fails.
 *
 * Also covered: 26013.jocasta-constant, playing Defiance (attached by her response) from Jocasta during an attack.
 *
 * Not covered: Protector's once-per-round limit.
 *
 * Every Core hero face has the Avenger trait; none has Android or Guardian.
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

const toHeroFirst = (state: GameState): GameState =>
  settle(runWith(PLAYABLE_DEPS, state, toHero(P1)), firstLegal, undefined, PLAYABLE_DEPS);

interface OpenOptions {
  readonly alterEgo?: boolean;
  /** Extra copies of other cards to seat in the deck (legal in the hero's aspect). */
  readonly extraDeck?: readonly string[];
}

/** `buildCrossHeroDeck`, falling back for a verbatim reprint of a card the precon already holds: the precon's own
 * same-titled copies are swapped for the pack's reprint instead (same title, same count, still a legal deck). */
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

/** Ends P1's turn and plays the villain attack out, collecting every event. `defender` declares that character as
 * the defender; null leaves the attack undefended (no DEF reduction, RRG 1.8 p. 15). `pick` answers every other
 * prompt. The stacked boost card (default an Advance that cannot change the damage) is revealed for the attack. */
function runAttack(
  state: GameState,
  opts: { defender?: InstanceId; pick?: Picker; boost?: string } = {},
): { readonly state: GameState; readonly events: readonly { type: string; [key: string]: unknown }[] } {
  const pick = opts.pick ?? firstLegal;
  let current = runWith(PLAYABLE_DEPS, stackEncounterDeck(state, opts.boost ?? "01186"), endTurn(P1));
  const events: { type: string; [key: string]: unknown }[] = [];
  for (let guard = 0; current.pendingChoice && !current.outcome && guard < 200; guard++) {
    const choice = current.pendingChoice;
    const selected = choice.prompt.kind === "declareDefender" ? [opts.defender ?? "decline"] : pick(current);
    const result = applyOk(
      current,
      { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: selected },
      PLAYABLE_DEPS,
    );
    current = result.state;
    events.push(...(result.events as never[]));
  }
  return { state: current, events };
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

/** Picks `id` at any prompt that offers it (a chooseCards / chooseTarget option), `base` otherwise. */
const choosing =
  (id: string, base: Picker = firstLegal): Picker =>
  (state) =>
    state.pendingChoice?.options.some((o) => o.optionId === id) ? [id] : base(state);

/** Codes of up to `n` distinct allies in P1's own precon (hand + deck), cheapest first, cost at most `maxCost`. */
function preconAllies(state: GameState, n: number, maxCost = 3): string[] {
  const owner = playerOf(state, P1);
  const codes = new Set<string>();
  for (const id of [...owner.hand, ...owner.deck]) {
    const c = cardOf(state, id);
    if (c.type === "ally" && !(c.id as string).startsWith("26") && costOf(c.id as string) <= maxCost) {
      codes.add(c.id as string);
    }
  }
  const sorted = [...codes].sort((a, b) => costOf(a) - costOf(b));
  expect(sorted.length).toBeGreaterThanOrEqual(n);
  return sorted.slice(0, n);
}

const ANDROID = "26015"; // Victor Mancha: Android, Avenger ally (cost 2, HP 4)
const JOCASTA = "26013";
const GUARDIAN = "22002"; // Gamora, Guardian ally (nebu)

const damagePrevented = (events: readonly { type: string; [key: string]: unknown }[]): number =>
  events.filter((e) => e.type === "damagePrevented").reduce((sum, e) => sum + (e.amount as number), 0);

describe("Vision protection cards, from Black Panther (Protection)'s own deck", () => {
  it("26013.jocasta-response: after entering play, attaches a chosen Defense event from the discard pile facedown", () => {
    const opened = openHandFor(JOCASTA, BLACK_PANTHER, { extraDeck: ["26018"] });
    const { state: withDiscard, id: event } = moveToDiscard(opened.state, P1, "26018"); // Defiance, Defense trait
    const { state: after } = playOpened(
      { state: withDiscard, id: opened.id },
      choosing(event, accepting("26013.jocasta-response")),
    );
    expect(cardsInPlay(after)).toContain(opened.id);
    expect(inst(after, event).attachedTo).toBe(opened.id);
    expect(inst(after, opened.id).attachments).toContain(event);
    expect(inst(after, event).faceup).toBe(false);
    expect(playerOf(after, P1).discard).not.toContain(event);
  });

  it("26013.jocasta-constant: the event attached to Jocasta can be played from there, during an attack against you", () => {
    const opened = openHandFor(JOCASTA, BLACK_PANTHER, { extraDeck: ["26018"] });
    const hero = identityOf(opened.state);
    const { state: withDiscard, id: event } = moveToDiscard(opened.state, P1, "26018");
    const { state: withJocasta } = playOpened(
      { state: withDiscard, id: opened.id },
      choosing(event, accepting("26013.jocasta-response")),
    );
    expect(inst(withJocasta, event).attachedTo).toBe(opened.id);
    const { state, events } = runAttack(withJocasta, {
      defender: hero,
      pick: accepting("26018.defiance-interrupt"),
      boost: "01109",
    });
    expect(events).toContainEqual(expect.objectContaining({ type: "boostCancelled", scope: "discarded" }));
    expect(playerOf(state, P1).discard).toContain(event);
    expect(inst(state, opened.id).attachments).not.toContain(event);
    // Control: the same attack with Defiance still in the discard pile offers no Defiance.
    const control = runAttack(withDiscard, {
      defender: hero,
      pick: accepting("26018.defiance-interrupt"),
      boost: "01109",
    });
    expect(control.events.some((e) => e.type === "boostCancelled")).toBe(false);
  });

  it("26014.protector-interrupt: spending a mental resource prevents 1 of the damage Protector would take", () => {
    const opened = openHandFor("26014", BLACK_PANTHER, { extraDeck: ["26026"] });
    const { state: inPlay } = playOpened(opened);
    expect(cardsInPlay(inPlay)).toContain(opened.id);
    const given = moveToHand(inPlay, P1, "26026"); // Genius: a mental resource to pay the interrupt
    const [genius] = given.ids as [InstanceId];
    const villain = activeVillain(given.state).instanceId;
    const atk = characterProfile(given.state, villain, PLAYABLE_DEPS)!.atk;
    const control = runAttack(given.state, { defender: opened.id });
    expect(inst(control.state, opened.id).damage).toBe(atk);
    const pick: Picker = (state) => {
      const prompt = state.pendingChoice?.prompt.kind;
      if (prompt === "payForCard" || prompt === "payForAbility") return [`hand:${genius}`];
      return accepting("26014.protector-interrupt")(state);
    };
    const used = runAttack(given.state, { defender: opened.id, pick });
    expect(damagePrevented(used.events)).toBe(1);
    expect(inst(used.state, opened.id).damage).toBe(atk - 1);
    expect(playerOf(used.state, P1).discard).toContain(genius);
  });

  it("26015.victor-mancha-constant: reduces damage he takes from an attack by 1", () => {
    const opened = openHandFor(ANDROID, BLACK_PANTHER);
    const { state: inPlay } = playOpened(opened);
    const villain = activeVillain(inPlay).instanceId;
    const atk = characterProfile(inPlay, villain, PLAYABLE_DEPS)!.atk;
    const defended = runAttack(inPlay, { defender: opened.id });
    expect(inst(defended.state, opened.id).damage).toBe(atk - 1);
  });

  it("26016.flow-like-water-response: after you play a Defense card during an attack, deals 1 damage to the attacker", () => {
    const run = (withFlow: boolean) => {
      const opened = openHandFor("26016", BLACK_PANTHER, { extraDeck: ["26018"] });
      const hero = identityOf(opened.state);
      const base = withFlow ? playOpened(opened, firstLegal, hero).state : opened.state;
      const given = moveToHand(base, P1, "26018"); // Defiance: a Defense event
      const villain = activeVillain(given.state).instanceId;
      const pick = accepting("26018.defiance-interrupt", "26016.flow-like-water-response");
      const { state, events } = runAttack(given.state, { defender: hero, pick, boost: "01109" });
      expect(events.some((e) => e.type === "boostCancelled")).toBe(true);
      return inst(state, villain).damage;
    };
    expect(run(true)).toBe(run(false) + 1);
  });

  it("26018.defiance-interrupt: the boost card on the attack against you is discarded instead of turned faceup", () => {
    const opened = openHandFor("26018", BLACK_PANTHER);
    const hero = identityOf(opened.state);
    const { events, state } = runAttack(opened.state, {
      defender: hero,
      pick: accepting("26018.defiance-interrupt"),
      boost: "01109",
    });
    expect(events).toContainEqual(expect.objectContaining({ type: "boostCancelled", scope: "discarded" }));
    expect(playerOf(state, P1).discard).toContain(opened.id);
  });

  it("26021.preservation-response: after spending it, heals 1 damage from your hero (hero form only)", () => {
    const run = (alterEgo: boolean) => {
      const opened = openHandFor("26021", BLACK_PANTHER, { alterEgo });
      const identity = identityOf(opened.state);
      const [ALLY] = preconAllies(opened.state, 1) as [string];
      const damaged = patchInstance(opened.state, identity, { damage: 2 });
      const given = moveToHand(damaged, P1, ALLY);
      const ally = given.ids[0]!;
      const rest = filler(given.state, costOf(ALLY) - 1, [opened.id, ally]);
      const after = playCard(rest.state, ally, [opened.id, ...rest.ids], accepting("26021.preservation-response"));
      expect(playerOf(after, P1).playArea).toContain(ally);
      return inst(after, identity).damage;
    };
    expect(run(false)).toBe(1);
    // Hero Response (RRG 1.8 "Hero Response"): not in alter-ego form.
    expect(run(true)).toBe(2);
  });
});

describe("Vision basic cards, from Spider-Man (Justice)'s own deck", () => {
  const withMachineMan = () => {
    const opened = openHandFor("26022", SPIDER_MAN);
    const { state } = playOpened(opened);
    const spare = filler(state, 3, [opened.id]);
    return { state: spare.state, machine: opened.id, spare: spare.ids };
  };
  const spendSpare =
    (spare: readonly InstanceId[]): Picker =>
    (state) => {
      const choice = state.pendingChoice!;
      const offered = choice.options.find((o) => o.optionId.endsWith("26022.machine-man-interrupt"));
      if (offered) return [offered.optionId];
      const hand = choice.options.filter((o) => spare.some((id) => o.optionId === `hand:${id}`));
      return hand.length > 0 ? hand.map((o) => o.optionId).slice(0, choice.maxSelections) : firstLegal(state);
    };

  it("26022.machine-man-interrupt: spending up to 3 resources as he thwarts adds that much THW", () => {
    const { state, machine, spare } = withMachineMan();
    const main = state.mainScheme.instanceId;
    const primed = patchInstance(state, main, { threat: 9 });
    const thw = characterProfile(primed, machine, PLAYABLE_DEPS)!.thw;
    const thwarted = settle(
      runWith(PLAYABLE_DEPS, primed, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: machine,
        schemeInstanceId: main,
      } as never),
      spendSpare(spare),
      undefined,
      PLAYABLE_DEPS,
    );
    const printed = spare
      .map((id) => Object.values(printedResources(primed.cardPool[primed.instances[id]!.cardId]!)))
      .flat()
      .reduce((a, b) => a + b, 0);
    expect(printed).toBe(3);
    expect(inst(thwarted, main).threat).toBe(9 - (thw + 3));
    for (const id of spare) expect(playerOf(thwarted, P1).discard).toContain(id);
  });

  it("26022.machine-man-interrupt: spending resources as he attacks adds that much ATK", () => {
    const { state, machine, spare } = withMachineMan();
    const villain = activeVillain(state).instanceId;
    const atk = characterProfile(state, machine, PLAYABLE_DEPS)!.atk;
    const hit = basicAttack(state, machine, villain, spendSpare(spare.slice(0, 2)));
    expect(inst(hit, villain).damage).toBe(atk + 2);
  });

  it("26024.reboot-action: readies a friendly Android character and heals 1 damage from it", () => {
    const opened = openHandFor("26024", SPIDER_MAN);
    const { state: withAndroid, id: android } = injectIntoPlay(opened.state, ANDROID);
    const hurt = patchInstance(withAndroid, android, { exhausted: true, damage: 2 });
    const { state: after } = playOpened({ state: hurt, id: opened.id }, choosing(android as string));
    expect(inst(after, android).exhausted).toBe(false);
    expect(inst(after, android).damage).toBe(1);
    expect(playerOf(after, P1).discard).toContain(opened.id);
  });

  it("26024.reboot-action: a plain Action works in alter-ego form", () => {
    const opened = openHandFor("26024", SPIDER_MAN, { alterEgo: true });
    expect(playerOf(opened.state, P1).identity.form).toBe("alterEgo");
    const { state: withAndroid, id: android } = injectIntoPlay(opened.state, ANDROID);
    const hurt = patchInstance(withAndroid, android, { exhausted: true, damage: 2 });
    const { state: after } = playOpened({ state: hurt, id: opened.id }, choosing(android as string));
    expect(inst(after, android).exhausted).toBe(false);
    expect(inst(after, android).damage).toBe(1);
  });

  it("26036.meditation-action: Alter-Ego Action; exhausts your alter-ego to play a card from hand for 3 less", () => {
    const opened = openHandFor("26036", SPIDER_MAN, { alterEgo: true });
    const [ALLY] = preconAllies(opened.state, 1, 3) as [string];
    expect(costOf(ALLY)).toBeGreaterThan(0);
    const given = moveToHand(opened.state, P1, ALLY);
    const ally = given.ids[0]!;
    const discardBefore = playerOf(given.state, P1).discard.length;
    const after = playCard(given.state, opened.id, [], choosing(ally as string));
    expect(playerOf(after, P1).playArea).toContain(ally);
    // The ally's printed cost is fully reduced (3 less, floored at 0): nothing was spent, only Meditation was discarded.
    expect(playerOf(after, P1).discard.length).toBe(discardBefore + 1);
    expect(playerOf(after, P1).discard).toContain(opened.id);
    expect(inst(after, identityOf(after)).exhausted).toBe(true);
  });

  it("26036.meditation-action: an Alter-Ego Action is refused in hero form", () => {
    const opened = openHandFor("26036", SPIDER_MAN);
    expect(playerOf(opened.state, P1).identity.form).toBe("hero");
    expect(refused(opened.state, opened.id, [])).toBe(true);
  });
});

describe("Vision aggression card, from She-Hulk (Aggression)'s own deck", () => {
  const aggressionEvent = (state: GameState): string => {
    const owner = playerOf(state, P1);
    const id = [...owner.hand, ...owner.deck].find((i) => {
      const c = cardOf(state, i);
      return c.type === "event" && "aspect" in c && c.aspect === "aggression";
    })!;
    expect(id).toBeDefined();
    return cardOf(state, id).id as string;
  };

  it("26033.assault-training-action: Alter-Ego Action; exhaust + remove a training counter, shuffle an aggression event from the discard pile into the deck", () => {
    const opened = openHandFor("26033", SHE_HULK, { alterEgo: true });
    expect(playerOf(opened.state, P1).identity.form).toBe("alterEgo");
    const { state: inPlay } = playOpened(opened);
    expect(inst(inPlay, opened.id).counters.training).toBe(2);
    const { state: discarded, id: event } = moveToDiscard(inPlay, P1, aggressionEvent(inPlay));
    const used = settle(
      runWith(PLAYABLE_DEPS, discarded, use(P1, opened.id, "26033.assault-training-action")),
      choosing(event as string),
      undefined,
      PLAYABLE_DEPS,
    );
    expect(playerOf(used, P1).discard).not.toContain(event);
    expect(playerOf(used, P1).deck).toContain(event);
    expect(inst(used, opened.id).exhausted).toBe(true);
    expect(inst(used, opened.id).counters.training).toBe(1);
  });

  it("26033.assault-training-action: an Alter-Ego Action is refused in hero form", () => {
    const opened = openHandFor("26033", SHE_HULK);
    expect(playerOf(opened.state, P1).identity.form).toBe("hero");
    const { state: inPlay } = playOpened(opened);
    const { state: discarded } = moveToDiscard(inPlay, P1, aggressionEvent(inPlay));
    expect(applyCommand(discarded, use(P1, opened.id, "26033.assault-training-action"), PLAYABLE_DEPS).ok).toBe(false);
  });
});

describe("Vision justice card, from Spider-Man (Justice)'s own deck", () => {
  const attached = () => {
    const opened = openHandFor("26034", SPIDER_MAN);
    // "01186" absorbs Rhino's own boost draw so "01108" (Crowd Control, a side scheme) is the card revealed.
    const round = settle(
      runWith(PLAYABLE_DEPS, stackEncounterDeck(opened.state, "01186", "01108"), endTurn(P1)),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    const scheme = round.villainArea.find((id) => round.instances[id]?.cardId === "01108")!;
    expect(scheme).toBeDefined();
    const given = moveToHand(round, P1, "26034");
    const chance = given.ids[0]!;
    const withChance = settle(
      runWith(PLAYABLE_DEPS, given.state, play(P1, chance, [], { attachToInstanceId: scheme })),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    return { state: withChance, chance, scheme, hand: given.state };
  };

  it("26034.chance-encounter-constant: attaches to a side scheme and is refused on the main scheme", () => {
    const { state, chance, scheme, hand } = attached();
    expect(inst(state, chance).attachedTo).toBe(scheme);
    const refusal = applyCommand(
      hand,
      play(P1, chance, [], { attachToInstanceId: hand.mainScheme.instanceId }),
      PLAYABLE_DEPS,
    );
    expect(refusal.ok).toBe(false);
  });

  it("26034.chance-encounter-interrupt: when that scheme is defeated, an ally from the deck or discard pile goes to hand", () => {
    const { state, chance, scheme } = attached();
    const identity = identityOf(state);
    const primed = patchInstance(patchInstance(state, scheme, { threat: 1 }), identity, { exhausted: false });
    const owner = playerOf(primed, P1);
    expect([...owner.deck, ...owner.discard].some((id) => cardOf(primed, id).type === "ally")).toBe(true);
    const allies = (s: GameState) => playerOf(s, P1).hand.filter((id) => cardOf(s, id).type === "ally").length;
    const before = allies(primed);
    const defeated = settle(
      runWith(PLAYABLE_DEPS, primed, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme,
      } as never),
      accepting("26034.chance-encounter-interrupt"),
      undefined,
      PLAYABLE_DEPS,
    );
    expect(defeated.villainArea).not.toContain(scheme);
    expect(playerOf(defeated, P1).discard).toContain(chance);
    expect(allies(defeated)).toBe(before + 1);
  });
});

describe("Vision leadership card, from Captain Marvel (Leadership)'s own deck", () => {
  const withAllies = (alterEgo: boolean) => {
    const opened = openHandFor("26035", CAP_MARVEL, { alterEgo, extraDeck: [JOCASTA, GUARDIAN] });
    const jocasta = moveToHand(opened.state, P1, JOCASTA);
    const gamora = moveToHand(jocasta.state, P1, GUARDIAN);
    return { opened, state: gamora.state, jocasta: jocasta.ids[0]!, gamora: gamora.ids[0]! };
  };

  it("26035.joining-forces-action: Hero Action; puts an Avenger ally and a Guardian ally into play from hand", () => {
    const { opened, state, jocasta, gamora } = withAllies(false);
    const pay = filler(state, costOf("26035"), [opened.id, jocasta, gamora]);
    const after = playCard(pay.state, opened.id, pay.ids);
    expect(playerOf(after, P1).playArea).toContain(jocasta);
    expect(playerOf(after, P1).playArea).toContain(gamora);
    expect(playerOf(after, P1).discard).toContain(opened.id);
  });

  it("26035.joining-forces-action: a Hero Action card is refused in alter-ego form", () => {
    const { opened, state, jocasta, gamora } = withAllies(true);
    const pay = filler(state, costOf("26035"), [opened.id, jocasta, gamora]);
    expect(refused(pay.state, opened.id, pay.ids)).toBe(true);
  });
});
