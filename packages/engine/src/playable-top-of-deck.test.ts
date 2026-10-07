/**
 * docs/phase7-wave8.md §3.49: "Once per phase, you may play the top card of your deck as if it was in your hand,
 * reducing its resource cost by 1." (the constant's `playableTopOfDeck`, with the ability's own once-per-phase limit).
 * Proven with synthetic cards shaped like Magik's kit (`aoa` 45030a, 45031, 45036 to 45040) and the cards the RRG's FAQ
 * names, each test driving real commands and choices.
 *
 * Sources: RRG 1.8 FAQ "Magik (#30A)" (p. 64), all four entries (tests 1, 3, 4 and 5); "Initiating Abilities" (p. 24):
 * the card leaves its zone at step 1, before costs are paid (the FAQ calls it step 3; no behavior differs); "Play, Put
 * into Play" (p. 32): "A card that is put into play is not considered to have been played"; "Limit" (p. 27): a
 * canceled use still counts; "Cost" (p. 13). Owner decisions §4.1 Q27 = A (played through a "play a card from your
 * hand" effect, both reductions apply) and Q26 = B.
 *
 * The test numbers in the titles are §3.49's. Test 10 (a campaign game's mission area) waits for §3.34 and §3.35.
 */

import { flat, trait, type AnyCard, type CardId, type HeroIdentityCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { deckTopPermission, deckTopPlayOf, playCostOf } from "./actions.js";
import type { Command, Payment } from "./commands.js";
import { applyCommand, replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { statusActive } from "./keywords.js";
import { legalActions } from "./legal.js";
import { handCountTowardHandSize } from "./select.js";
import { mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay, shownDeckTop } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec, Predicate, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubIdentity,
  stubObligation,
  stubResource,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, defaultPick, HERO, MAIN_SCHEME, RESOURCE } from "./testing/scenario.js";
import { copiesOf, P1, P2 } from "./testing/wave3.js";
import { choiceExclusions } from "./why-not.js";

const you = { kind: "controller" } as const;
const n = (value: number): ValueSpec => ({ kind: "const", value });
const X_MEN = trait("X-MEN");
const SELF_IDENTITY = { categories: ["identity"], controller: "you" } as const;
const abilities: StubAbility[] = [];
const ability = (id: string, definition: AbilityDefinition): StubAbility => {
  const stub = stubAbility(id, definition);
  abilities.push(stub);
  return stub;
};
const heroAction = (id: string, effects: readonly EffectSpec[]): StubAbility =>
  ability(`${id}.action`, { trigger: { kind: "action", form: "hero" }, effects });

// --- The hero: Magik's two lines, two constants of the hero face. ----------------------------------------------------
const FACEUP = ability("magik.constant", {
  trigger: { kind: "constant", rules: [{ kind: "topOfDeckFaceup", player: you }] },
  effects: [],
});
const PLAYABLE = ability("magik.constant-2", {
  trigger: { kind: "constant", playableTopOfDeck: { player: you, costReduction: 1 } },
  limit: { count: 1, period: "phase" },
  effects: [],
});
const magikNamed = (id: string): HeroIdentityCard =>
  stubIdentity({
    id,
    hp: 10,
    atk: 2,
    thw: 1,
    def: 2,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
    heroAbilities: [FACEUP.ref, PLAYABLE.ref],
    heroTraits: [X_MEN],
  });
const MAGIK = magikNamed("magik");
/** A second hero with the same two lines, for a table where both seats have the permission. */
const SISTER = magikNamed("sister");

// --- Resources: only their printed icons matter. ---------------------------------------------------------------------
const STRENGTH = stubResource({ id: "strength", icons: 0, produces: { physical: 2 } });
const GENIUS = stubResource({ id: "genius", icons: 0, produces: { mental: 2 } });
const ENERGY = stubResource({ id: "energy", icons: 0, produces: { energy: 2 } });
const CLOBBER = stubEvent({ id: "clobber", cost: 0, resourceIcons: { physical: 1 } });

const TOP_HAS_PHYSICAL: Predicate = {
  kind: "topOfDeckFaceup",
  player: you,
  matches: { anyPrintedResource: ["physical", "wild"] },
};

// --- Magik's events. -------------------------------------------------------------------------------------------------
/** Soul Strike: "Deal 4 damage to an enemy. If the top card of your deck has a [physical] or [wild] icon, stun it." */
const SOUL_STRIKE = stubEvent({
  id: "soul-strike",
  cost: 2,
  abilities: [
    heroAction("soul-strike", [
      { kind: "chooseTarget", slot: "enemy", query: { categories: ["enemy"] }, chooser: you },
      { kind: "attack", target: { kind: "slot", slot: "enemy" }, amount: n(4) },
      {
        kind: "if",
        condition: TOP_HAS_PHYSICAL,
        then: [{ kind: "giveStatus", target: { kind: "slot", slot: "enemy" }, status: "stunned" }],
      },
    ]).ref,
  ],
});
/** Exorcism: "Remove 4 threat from a scheme." */
const EXORCISM = stubEvent({
  id: "exorcism",
  cost: 2,
  abilities: [
    heroAction("exorcism", [
      { kind: "chooseTarget", slot: "scheme", query: { categories: ["scheme"] }, chooser: you },
      { kind: "removeThreat", target: { kind: "slot", slot: "scheme" }, amount: n(4) },
    ]).ref,
  ],
});
/** Stepping Disc: "Ready your hero." */
const STEPPING_DISC = stubEvent({
  id: "stepping-disc",
  cost: 1,
  abilities: [heroAction("stepping-disc", [{ kind: "ready", target: { kind: "identityOf", player: you } }]).ref],
});
/** Magic Barrier: "Hero Interrupt (defense): When an enemy initiates an attack, prevent 3 damage from this attack." */
const MAGIC_BARRIER = stubEvent({
  id: "magic-barrier",
  cost: 1,
  abilities: [
    ability("magic-barrier.interrupt", {
      trigger: {
        kind: "interrupt",
        forced: false,
        form: "hero",
        on: { on: "enemyAttack", sourceIs: { categories: ["enemy"] } },
      },
      label: ["defense"],
      effects: [{ kind: "modifyAttack", preventDamage: n(3) }],
    }).ref,
  ],
});

// --- Allies. ---------------------------------------------------------------------------------------------------------
/**
 * Colossus: "Toughness. Interrupt: When an enemy attacks you, play Colossus from your hand (paying his resource cost)
 * and declare him the defender without exhausting him."
 */
const COLOSSUS = stubAlly({
  id: "colossus",
  cost: 3,
  atk: 2,
  thw: 1,
  hp: 4,
  traits: [X_MEN],
  keywords: [{ name: "toughness" }],
  abilities: [
    ability("colossus.interrupt", {
      trigger: {
        kind: "interrupt",
        forced: false,
        on: {
          on: "enemyAttack",
          sourceIs: { categories: ["enemy"] },
          playerIs: "controller",
          usesAttackedPlayer: true,
        },
      },
      activeIn: "hand",
      effects: [
        { kind: "playFromHand", player: you, costReduction: n(0), card: { kind: "self" } },
        { kind: "declareDefender", character: { kind: "self" } },
      ],
    }).ref,
  ],
});
/** Pixie: "Response: After you play Pixie from your hand, add an X-MEN ally from your discard pile to your hand." */
const PIXIE = stubAlly({
  id: "pixie",
  cost: 2,
  atk: 1,
  thw: 1,
  hp: 2,
  traits: [X_MEN],
  abilities: [
    ability("pixie.response", {
      trigger: { kind: "response", forced: false, on: { on: "cardPlayed", selfIs: "target" } },
      effects: [
        {
          kind: "chooseCards",
          slot: "found",
          from: { kind: "zone", zone: "discard", player: you, filter: { categories: ["ally"], trait: X_MEN } },
          chooser: you,
          min: 1,
          max: 1,
        },
        { kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: "found" } }, to: "hand" },
      ],
    }).ref,
  ],
});
/** A Response event: "After you play an ally, draw 1 card." */
const ENCORE = stubEvent({
  id: "encore",
  cost: 0,
  abilities: [
    ability("encore.response", {
      trigger: {
        kind: "response",
        forced: false,
        on: { on: "cardPlayed", playerIs: "controller", targetIs: { categories: ["ally"] } },
      },
      effects: [{ kind: "draw", player: you, amount: n(1) }],
    }).ref,
  ],
});
const TRIAGE = stubAlly({ id: "triage", cost: 2, atk: 1, thw: 1, hp: 3, traits: [X_MEN] });

// --- The cards the FAQ plays her top card through. -------------------------------------------------------------------
/** Team-Building Exercise's effect, on an event: "play a card from your hand that shares a trait with your hero, reducing its resource cost by 1". */
const TEAM_BUILDING = stubEvent({
  id: "team-building",
  cost: 0,
  abilities: [
    heroAction("team-building", [
      {
        kind: "playFromHand",
        player: you,
        costReduction: n(1),
        filter: { sharesTraitWith: { kind: "identityOf", player: you } },
      },
    ]).ref,
  ],
});
/** Chaos Magic's effect: "Play a card from your hand, ignoring its resource cost." */
const CHAOS_MAGIC = stubEvent({
  id: "chaos-magic",
  cost: 0,
  abilities: [heroAction("chaos-magic", [{ kind: "playFromHand", player: you, ignoreCost: true }]).ref],
});
/** Fetch Quest's effect: "search your deck for a card and play that card, ignoring its resource cost. (Shuffle.)" */
const FETCH_QUEST = stubEvent({
  id: "fetch-quest",
  cost: 0,
  abilities: [
    heroAction("fetch-quest", [
      { kind: "playFromHand", player: you, from: "deck", ignoreCost: true, filter: { categories: ["ally"] } },
    ]).ref,
  ],
});
/** Mutant Protectors: "Hero Interrupt (defense): When an enemy attacks, put an X-MEN ally into play from your hand …". */
const MUTANT_PROTECTORS = stubEvent({
  id: "mutant-protectors",
  cost: 1,
  abilities: [
    ability("mutant-protectors.interrupt", {
      trigger: {
        kind: "interrupt",
        forced: false,
        form: "hero",
        on: { on: "enemyAttack", sourceIs: { categories: ["enemy"] } },
      },
      label: ["defense"],
      effects: [
        {
          kind: "chooseCards",
          slot: "ally",
          from: { kind: "zone", zone: "hand", player: you, filter: { categories: ["ally"], trait: X_MEN } },
          chooser: you,
          min: 1,
          max: 1,
        },
        { kind: "putIntoPlay", card: { kind: "slot", slot: "ally" }, controller: you },
        { kind: "declareDefender", character: { kind: "slot", slot: "ally" }, exhaust: true },
      ],
    }).ref,
  ],
});
/** "Change form." as an effect, playable in either form. */
const FLIP = stubEvent({
  id: "flip",
  cost: 0,
  abilities: [
    ability("flip.action", { trigger: { kind: "action" }, effects: [{ kind: "changeForm", player: you }] }).ref,
  ],
});
/** Pestilence's blank as a card in play: "Treat your identity's printed text box as if it were blank." */
const BLANK = stubUpgrade({
  id: "blank",
  cost: 0,
  abilities: [
    ability("blank.constant", {
      trigger: { kind: "constant", rules: [{ kind: "blankTextBox", target: SELF_IDENTITY }] },
      effects: [],
    }).ref,
  ],
});
/** Counterspell's line on a card in play: "Forced Interrupt: When you play an event, cancel its effects and discard it." */
const COUNTERSPELL = stubUpgrade({
  id: "counterspell",
  cost: 0,
  abilities: [
    ability("counterspell.forced-interrupt", {
      trigger: {
        kind: "interrupt",
        forced: true,
        on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: { categories: ["event"] } },
      },
      effects: [{ kind: "cancelTriggeringEvent" }],
    }).ref,
  ],
});
/**
 * Star-Lord's line on a card in play: "Interrupt: When you play a card from your hand, … → reduce the cost to play that
 * card by 1. (Limit once per round.)"
 */
const WHAT_COULD_GO_WRONG = ability("gamble.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "cardBeingPlayed", playerIs: "controller" } },
  limit: { count: 1, period: "round" },
  playCostReduction: { amount: 1, fromHand: true },
  effects: [],
});
const GAMBLE = stubUpgrade({ id: "gamble", cost: 0, abilities: [WHAT_COULD_GO_WRONG.ref] });
/** Panicked Refugees: an encounter card in a player deck. */
const REFUGEES = stubObligation({ id: "refugees" });

/** An encounter card with no boost icon and no text: every villain attack is exactly the villain's ATK. */
const QUIET = stubTreachery({ id: "quiet", boostIcons: 0 });
const BRUTE = stubVillain({ id: "brute", stages: [{ hp: flat(20), atk: 5, sch: 1 }] });

const KIT: readonly AnyCard[] = [
  STRENGTH,
  GENIUS,
  ENERGY,
  CLOBBER,
  SOUL_STRIKE,
  EXORCISM,
  STEPPING_DISC,
  MAGIC_BARRIER,
  COLOSSUS,
  PIXIE,
  TRIAGE,
  ENCORE,
  TEAM_BUILDING,
  CHAOS_MAGIC,
  FETCH_QUEST,
  MUTANT_PROTECTORS,
  FLIP,
  BLANK,
  COUNTERSPELL,
  GAMBLE,
];
const deps: EngineDeps = depsOf(...abilities);

/** Two seats at the first turn: P1 plays Magik, P2 the plain stub hero (or Magik too), both with the whole kit. */
function table(second: HeroIdentityCard = HERO): GameState {
  const result = createGame(
    {
      seed: 49,
      cards: [...DEFAULT_CARDS, MAGIK, SISTER, BRUTE, QUIET, REFUGEES, ...KIT],
      villainCardId: BRUTE.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: copiesOf(QUIET.id, 30),
      players: [MAGIK, second].map((card) => ({
        identityCardId: card.id,
        deck: [...copiesOf(RESOURCE.id, 12), ...KIT.flatMap((kit) => [kit.id, kit.id])],
      })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}

/**
 * Test surgery, before a session starts (so its log replays): the player's hand, deck (top first) and discard pile
 * hold exactly the named cards, and every other card they own out of play is out of the game. `REFUGEES` is not in a
 * player deck, so a deck naming it is given a new instance of it.
 */
function arrange(
  state: GameState,
  zones: {
    readonly hand?: readonly AnyCard[];
    readonly deck: readonly AnyCard[];
    readonly discard?: readonly AnyCard[];
  },
  player: PlayerId = P1,
): GameState {
  const seat = mustPlayer(state, player);
  const pool = [...seat.hand, ...seat.deck, ...seat.discard];
  const take = (cards: readonly AnyCard[]): InstanceId[] =>
    cards.map((card) => {
      const at = pool.findIndex((id) => state.instances[id]!.cardId === card.id);
      if (at < 0) throw new Error(`${player} has no spare ${card.id}`);
      return pool.splice(at, 1)[0]!;
    });
  const hand = take(zones.hand ?? []);
  const deck = take(zones.deck);
  const discard = take(zones.discard ?? []);
  return {
    ...state,
    removedFromGame: [...state.removedFromGame, ...pool],
    players: state.players.map((p) => (p.playerId === player ? { ...p, hand, deck, discard } : p)),
  };
}

/** The obligation as the top card of P1's deck: an instance of a deck card re-pointed at the encounter card's data. */
function withRefugeesOnTop(state: GameState): GameState {
  const top = mustPlayer(state, P1).deck[0]!;
  return { ...state, instances: { ...state.instances, [top]: { ...state.instances[top]!, cardId: REFUGEES.id } } };
}

const inHand = (state: GameState, card: AnyCard, player: PlayerId = P1): InstanceId => {
  const id = mustPlayer(state, player).hand.find((x) => state.instances[x]!.cardId === card.id);
  if (!id) throw new Error(`${player} holds no ${card.id}`);
  return id;
};
const inPlay = (state: GameState, card: AnyCard): InstanceId | undefined =>
  cardsInPlay(state).find((x) => state.instances[x]!.cardId === card.id);
const deckOf = (state: GameState, player: PlayerId = P1) => mustPlayer(state, player).deck;
const topOf = (state: GameState, player: PlayerId = P1): InstanceId => deckOf(state, player)[0]!;
const cardAt = (state: GameState, id: InstanceId | undefined): CardId | undefined =>
  id === undefined ? undefined : mustInstance(state, id).cardId;
const cardIds = (state: GameState, ids: readonly InstanceId[]): CardId[] => ids.map((id) => cardAt(state, id)!);
/** The first `count` plain 1-resource cards in the player's hand, as a payment. */
const pay = (state: GameState, count: number, player: PlayerId = P1): Payment[] =>
  mustPlayer(state, player)
    .hand.filter((id) => cardAt(state, id) === RESOURCE.id)
    .slice(0, count)
    .map((fromHand) => ({ fromHand }));
const playId = (id: InstanceId, payment: readonly Payment[] = [], player: PlayerId = P1): Command => ({
  type: "playCard",
  playerId: player,
  cardInstanceId: id,
  payment,
  attachToInstanceId: null,
});
/** Plays the top card of the player's deck, paying with `resources` plain resource cards from their hand. */
const playTop =
  (resources: number, player: PlayerId = P1) =>
  (state: GameState): Command =>
    playId(topOf(state, player), pay(state, resources, player), player);
const playHand =
  (card: AnyCard, resources = 0, player: PlayerId = P1) =>
  (state: GameState): Command =>
    playId(inHand(state, card, player), pay(state, resources, player), player);
const toHero = (player: PlayerId = P1): Command => ({ type: "changeForm", playerId: player });
const endTurn = (player: PlayerId): Command => ({ type: "endTurn", playerId: player });

/** One prompt a picker answered: its kind, the cards it offered and what was picked. */
interface Asked {
  readonly kind: string;
  readonly playerId: PlayerId;
  readonly offered: readonly CardId[];
  readonly picked: readonly CardId[];
}
interface Picks {
  /** In a `chooseTriggers` prompt, the cards whose option is picked. */
  readonly triggers?: readonly AnyCard[];
  /** In a `chooseCards` prompt, the card picked (else the default pick). */
  readonly card?: AnyCard;
  /** How many plain resource cards answer a payment prompt. */
  readonly resources?: number;
}
/** A choice picker for `driveSession` that follows `picks`, and records every prompt it answered in `asked`. */
function picker(picks: Picks, asked: Asked[] = []): (state: GameState) => readonly string[] {
  return (state) => {
    const choice = state.pendingChoice!;
    const cardOf = (option: (typeof choice.options)[number]): CardId | undefined =>
      "instanceId" in option.ref ? cardAt(state, option.ref.instanceId) : undefined;
    const optionsFor = (cards: readonly AnyCard[]) =>
      cards.flatMap((card) => choice.options.filter((option) => cardOf(option) === card.id).slice(0, 1));
    let chosen: readonly (typeof choice.options)[number][];
    const kind = choice.prompt.kind;
    if (kind === "chooseTriggers") chosen = optionsFor(picks.triggers ?? []);
    else if (kind === "chooseCards" && picks.card && optionsFor([picks.card]).length > 0)
      chosen = optionsFor([picks.card]);
    else if (kind === "spendResources" || kind === "payForCard")
      chosen = choice.options.filter((option) => cardOf(option) === RESOURCE.id).slice(0, picks.resources ?? 0);
    else {
      const ids = defaultPick(state);
      chosen = choice.options.filter((option) => ids.includes(option.optionId));
      if (chosen.length !== ids.length) return ids; // "decline" and other answers that are not options
    }
    asked.push({
      kind,
      playerId: choice.playerId,
      offered: choice.options.flatMap((option) => cardOf(option) ?? []),
      picked: chosen.flatMap((option) => cardOf(option) ?? []),
    });
    return chosen.map((option) => option.optionId);
  };
}

interface Run {
  readonly session: GameSession;
  readonly state: GameState;
  /** The events of the last step only. */
  readonly events: readonly GameEvent[];
  /** The prompts answered during the last step. */
  readonly asked: readonly Asked[];
}
const begin = (state: GameState): Run => ({ session: startSession(state), state, events: [], asked: [] });
/** One command (built from the state it is applied to), its choices answered by `picks` (default: the default pick). */
function step(run: Run, command: Command | ((state: GameState) => Command), picks: Picks = {}): Run {
  const next = typeof command === "function" ? command(run.state) : command;
  const asked: Asked[] = [];
  const { session, events } = driveSession(run.session, deps, [next], picker(picks, asked));
  return { session, state: session.state, events, asked };
}
function expectReplays(run: Run): void {
  const replayed = replay(run.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(run.state);
}
/** Magik in hero form with `deck` (top first), `hand` and `discard`. */
function inHeroForm(zones: Parameters<typeof arrange>[1]): Run {
  return step(begin(arrange(table(), zones)), toHero());
}

const played = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "cardPlayed"
      ? [{ instanceId: e.instanceId, paid: e.resourcesPaid, from: e.from, countsAsFrom: e.countsAsFrom }]
      : [],
  );
const shown = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "deckTopShown" ? [e.instanceId] : []));
const uses = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "abilityUseRecorded" && e.abilityId === PLAYABLE.ref.id ? [e.uses] : []));
/** The order of the log lines that matter to the FAQ's first entry. */
const trace = (events: readonly GameEvent[], card: InstanceId) =>
  events.flatMap((e) => {
    if (e.type === "abilityUseRecorded" && e.abilityId === PLAYABLE.ref.id) return ["limitUsed"];
    if (e.type === "cardMoved" && e.instanceId === card) return [`moved:${e.to.kind}`];
    if (e.type === "deckTopShown") return [`shown:${e.instanceId}`];
    if (e.type === "cardMoved" && e.to.kind === "discard" && e.instanceId !== card) return ["resourceDiscarded"];
    if (e.type === "cardPlayed") return ["cardPlayed"];
    return [];
  });
const villainOf = (state: GameState): InstanceId => inPlay(state, BRUTE)!;
const magik = (state: GameState, player: PlayerId = P1) =>
  mustInstance(state, mustPlayer(state, player).identity.instanceId);
const damageOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).damage;
/** `legalActions`' entry for playing this card, legal or not. */
function listed(state: GameState, id: InstanceId, player: PlayerId = P1) {
  const actions = legalActions(state, player, deps);
  if (actions.kind !== "turn" && actions.kind !== "notYourTurn") return { legal: undefined, illegal: undefined };
  const isPlay = (entry: { action: { kind: string; instanceId?: InstanceId } }) =>
    entry.action.kind === "playCard" && entry.action.instanceId === id;
  return { legal: actions.legal.find(isPlay), illegal: actions.illegal.find(isPlay) };
}

describe("§3.49 playing the top card of your deck as if it was in your hand", () => {
  it("1. FAQ entry 1: Soul Strike off the top pays 1, the next card shows before any resource is spent, and it reads that card", () => {
    const start = inHeroForm({ hand: [RESOURCE, RESOURCE], deck: [SOUL_STRIKE, STRENGTH, CLOBBER] });
    const [strike, strength] = deckOf(start.state);
    const villain = villainOf(start.state);
    // Listed by `legalActions` as a play from the top of the deck, at its cost of 2 less 1.
    const entry = listed(start.state, strike!);
    expect(entry.legal?.action).toEqual({ kind: "playCard", instanceId: strike, from: "deckTop" });
    expect(entry.legal?.needsPayment).toBe(true);
    expect(playCostOf(start.state, P1, strike!, deps)).toMatchObject({
      printed: 2,
      current: 1,
      contributions: [{ sourceInstanceId: magik(start.state).instanceId, delta: -1 }],
    });
    expect(deckTopPlayOf(start.state, deps, P1, strike!)).toMatchObject({ costReduction: 1, limitUsed: false });

    const run = step(start, playTop(1));
    // The limit is used and the card leaves the deck first; Strength shows at once; only then is the resource spent.
    expect(trace(run.events, strike!).slice(0, 5)).toEqual([
      "limitUsed",
      "moved:resolving",
      `shown:${strength}`,
      "resourceDiscarded",
      "cardPlayed",
    ]);
    expect(shown(run.events)).toEqual([strength]);
    expect(played(run.events)).toEqual([{ instanceId: strike, paid: 1, from: "deckTop", countsAsFrom: "hand" }]);
    // 4 damage, and the villain is stunned: "the top card of your deck" was Strength ([physical]) as the event resolved.
    expect(damageOn(run.state, villain)).toBe(4);
    expect(statusActive(run.state, villain, "stunned", deps)).toBe(true);
    expect(mustPlayer(run.state, P1).hand).toHaveLength(1);
    expect(cardAt(run.state, mustPlayer(run.state, P1).discard[0])).toBe(SOUL_STRIKE.id);
    expect(deckOf(run.state)).toEqual([strength, deckOf(start.state)[2]]);
    expect(shownDeckTop(run.state, deps, P1)).toBe(strength);
    expectReplays(run);
  });

  it("1. FAQ entry 1, Genius second: 4 damage and no stun", () => {
    const start = inHeroForm({ hand: [RESOURCE, RESOURCE], deck: [SOUL_STRIKE, GENIUS, CLOBBER] });
    const run = step(start, playTop(1));
    const villain = villainOf(run.state);
    expect(played(run.events)).toMatchObject([{ paid: 1, from: "deckTop" }]);
    expect(damageOn(run.state, villain)).toBe(4);
    expect(statusActive(run.state, villain, "stunned", deps)).toBe(false);
    expectReplays(run);
  });

  it("2. once per phase: not offered again that phase; Magic Barrier off the top for 0 in the villain phase (5 − 3 = 2 taken); a new use next player phase", () => {
    // After Soul Strike she holds 1 card and draws 4 at the end of the player phase: Stepping Disc, then 3 resources.
    const start = inHeroForm({
      hand: [RESOURCE, RESOURCE],
      deck: [SOUL_STRIKE, STEPPING_DISC, RESOURCE, RESOURCE, RESOURCE, MAGIC_BARRIER, EXORCISM, RESOURCE],
    });
    const first = step(start, playTop(1));
    expect(uses(first.events)).toEqual([1]);
    // The new top card is a 1-cost event she could pay for, and it is not offered: once per phase.
    const disc = topOf(first.state);
    expect(cardAt(first.state, disc)).toBe(STEPPING_DISC.id);
    const entry = listed(first.state, disc);
    expect(entry.legal).toBeUndefined();
    expect(entry.illegal).toMatchObject({
      action: { kind: "playCard", instanceId: disc, from: "deckTop" },
      reason: "limit_reached",
      message: "you have already played the top card of your deck this phase",
    });
    expect(deckTopPermission(first.state, deps, P1)).toMatchObject({ instanceId: disc, limitUsed: true });
    expect(deckTopPlayOf(first.state, deps, P1, disc)).toBeNull();
    // What it would cost is its printed cost again: the reduction belongs to the permission's one play.
    expect(playCostOf(first.state, P1, disc, deps)).toMatchObject({ printed: 1, current: 1, contributions: [] });
    const refused = applyCommand(first.state, playId(disc, pay(first.state, 1)), deps);
    expect(refused.ok ? null : refused.error.code).toBe("limit_reached");

    // The villain phase: the villain (ATK 5, no boost icon) attacks her; Magic Barrier is the top card of her deck.
    const villainPhase = step(step(first, endTurn(P1)), endTurn(P2), { triggers: [MAGIC_BARRIER] });
    const window = villainPhase.asked.find((a) => a.kind === "chooseTriggers" && a.playerId === P1);
    expect(window?.offered).toEqual([MAGIC_BARRIER.id]);
    expect(window?.picked).toEqual([MAGIC_BARRIER.id]);
    const barrier = played(villainPhase.events);
    // Cost 1 less 1: nothing to pay, so no payment prompt was asked either.
    expect(barrier).toMatchObject([{ paid: 0, from: "deckTop", countsAsFrom: "hand" }]);
    expect(cardAt(villainPhase.state, barrier[0]!.instanceId)).toBe(MAGIC_BARRIER.id);
    expect(villainPhase.asked.some((a) => a.kind === "payForCard")).toBe(false);
    expect(uses(villainPhase.events)).toEqual([1]);
    expect(mustPlayer(villainPhase.state, P1).hand).toHaveLength(5);
    // 5 − 3 prevented = 2 taken; no defender, so no DEF.
    expect(damageOn(villainPhase.state, magik(villainPhase.state).instanceId)).toBe(2);
    expect(magik(villainPhase.state).exhausted).toBe(false);

    // Round 2: P2 is the first player. On her turn the permission has a new use: Exorcism (cost 2) for 1.
    expect(villainPhase.state.round).toBe(2);
    const herTurn = step(villainPhase, endTurn(P2));
    const exorcism = topOf(herTurn.state);
    expect(cardAt(herTurn.state, exorcism)).toBe(EXORCISM.id);
    expect(listed(herTurn.state, exorcism).legal?.action).toMatchObject({ from: "deckTop" });
    const again = step(herTurn, playTop(1));
    expect(played(again.events)).toEqual([{ instanceId: exorcism, paid: 1, from: "deckTop", countsAsFrom: "hand" }]);
    expect(uses(again.events)).toEqual([1]);
    expectReplays(again);
  });

  it("3. FAQ entry 2, Q27 = A: Team-Building Exercise offers Colossus on top beside her hand cards; 3 − 1 − 1 = 1 paid; the limit is used", () => {
    const start = inHeroForm({
      hand: [TEAM_BUILDING, TRIAGE, RESOURCE, RESOURCE],
      deck: [COLOSSUS, STRENGTH, CLOBBER],
    });
    const colossus = topOf(start.state);
    const run = step(start, playHand(TEAM_BUILDING), { card: COLOSSUS, resources: 1 });
    const choice = run.asked.find((a) => a.kind === "chooseCards");
    // Her X-MEN hand card and the top card of her deck; the resource cards share no trait with her hero.
    expect(choice?.offered).toEqual([TRIAGE.id, COLOSSUS.id]);
    expect(choice?.picked).toEqual([COLOSSUS.id]);
    // The event itself, from her hand for 0; then Colossus through it, from the top of her deck for 3 − 1 − 1.
    expect(played(run.events)).toEqual([
      { instanceId: expect.anything(), paid: 0, from: undefined, countsAsFrom: undefined },
      { instanceId: colossus, paid: 1, from: "deckTop", countsAsFrom: "hand" },
    ]);
    expect(inPlay(run.state, COLOSSUS)).toBe(colossus);
    expect(mustInstance(run.state, colossus).controllerId).toBe(P1);
    // Toughness, as for any ally entering play.
    expect(statusActive(run.state, colossus, "tough", deps)).toBe(true);
    expect(cardIds(run.state, mustPlayer(run.state, P1).hand)).toEqual([TRIAGE.id, RESOURCE.id]);
    expect(uses(run.events)).toEqual([1]);
    expect(deckTopPermission(run.state, deps, P1)?.limitUsed).toBe(true);
    expect(shown(run.events)).toEqual([deckOf(run.state)[0]]);
    expectReplays(run);
  });

  it("3. the limit is shared by every route: with it used, Team-Building Exercise offers hand cards only, and says why", () => {
    const start = inHeroForm({
      hand: [TEAM_BUILDING, TRIAGE, RESOURCE, RESOURCE, RESOURCE],
      deck: [STEPPING_DISC, COLOSSUS, STRENGTH],
    });
    const used = step(start, playTop(0));
    expect(played(used.events)).toMatchObject([{ paid: 0, from: "deckTop" }]);
    const colossus = topOf(used.state);
    // Stop at the card choice to read "why not Colossus?".
    const asking = applyCommand(used.state, playHand(TEAM_BUILDING)(used.state), deps);
    if (!asking.ok) throw new Error(asking.error.message);
    expect(asking.state.pendingChoice?.prompt).toEqual({ kind: "chooseCards", slot: "playFromHand" });
    expect(asking.state.pendingChoice?.options.map((option) => option.ref)).toEqual([
      { kind: "card", instanceId: inHand(used.state, TRIAGE) },
    ]);
    expect(choiceExclusions(asking.state, deps)).toEqual([{ instanceId: colossus, reason: "deckTopPlayLimitUsed" }]);

    const run = step(used, playHand(TEAM_BUILDING), { card: TRIAGE, resources: 1 });
    expect(played(run.events)[1]).toEqual({
      instanceId: inPlay(run.state, TRIAGE),
      paid: 1,
      from: undefined,
      countsAsFrom: undefined,
    });
    expect(topOf(run.state)).toBe(colossus);
    expectReplays(run);
  });

  it("3. 'play a card from your hand, ignoring its resource cost' reaches the top card too, and uses the limit", () => {
    const start = inHeroForm({ hand: [CHAOS_MAGIC], deck: [COLOSSUS, STRENGTH] });
    const colossus = topOf(start.state);
    const run = step(start, playHand(CHAOS_MAGIC), { card: COLOSSUS });
    expect(run.asked.find((a) => a.kind === "chooseCards")?.offered).toEqual([COLOSSUS.id]);
    expect(played(run.events)[1]).toEqual({ instanceId: colossus, paid: 0, from: "deckTop", countsAsFrom: "hand" });
    expect(inPlay(run.state, COLOSSUS)).toBe(colossus);
    expect(uses(run.events)).toEqual([1]);
    expectReplays(run);
  });

  it("4. FAQ entry 3: Pixie off the top for 1 was played from her hand; her Response returns Colossus from the discard pile", () => {
    const start = inHeroForm({ hand: [RESOURCE, RESOURCE], deck: [PIXIE, STRENGTH], discard: [COLOSSUS] });
    const pixie = topOf(start.state);
    const colossus = mustPlayer(start.state, P1).discard[0]!;
    const run = step(start, playTop(1), { triggers: [PIXIE] });
    expect(played(run.events)).toEqual([{ instanceId: pixie, paid: 1, from: "deckTop", countsAsFrom: "hand" }]);
    expect(run.asked.find((a) => a.kind === "chooseTriggers")).toMatchObject({
      offered: [PIXIE.id],
      picked: [PIXIE.id],
    });
    expect(inPlay(run.state, PIXIE)).toBe(pixie);
    expect(mustPlayer(run.state, P1).hand).toContain(colossus);
    expect(mustPlayer(run.state, P1).hand).toHaveLength(2);
    // She counts as a card played this phase and this turn, like a card from hand.
    expect(run.state.playedByPlayerThisPhase?.[P1]).toEqual([pixie]);
    expect(run.state.playedThisTurn?.[P1]).toEqual([pixie]);
    expectReplays(run);
  });

  it("4. a Response event on top is played in its window; with the limit used it is left out, and the prompt says why", () => {
    // Triage from her hand: Encore on top answers it from the deck, for 0, and uses the limit.
    const start = inHeroForm({ hand: [TRIAGE, RESOURCE, RESOURCE], deck: [ENCORE, STRENGTH, CLOBBER] });
    const encore = topOf(start.state);
    const run = step(start, playHand(TRIAGE, 2), { triggers: [ENCORE] });
    expect(run.asked.find((a) => a.kind === "chooseTriggers")).toMatchObject({ offered: [ENCORE.id] });
    expect(played(run.events)).toEqual([
      { instanceId: inPlay(run.state, TRIAGE), paid: 2, from: undefined, countsAsFrom: undefined },
      { instanceId: encore, paid: 0, from: "deckTop", countsAsFrom: "hand" },
    ]);
    expect(uses(run.events)).toEqual([1]);
    // It drew Strength, the card that became the top card when Encore left the deck.
    expect(cardIds(run.state, mustPlayer(run.state, P1).hand)).toEqual([STRENGTH.id]);
    expectReplays(run);

    // Pixie off the top uses the limit; Encore under her is then the top card, and her window offers Pixie alone.
    const used = inHeroForm({ hand: [RESOURCE], deck: [PIXIE, ENCORE, STRENGTH], discard: [COLOSSUS] });
    const under = deckOf(used.state)[1]!;
    const asking = applyCommand(used.state, playTop(1)(used.state), deps);
    if (!asking.ok) throw new Error(asking.error.message);
    expect(asking.state.pendingChoice?.prompt.kind).toBe("chooseTriggers");
    expect(asking.state.pendingChoice?.options.map((option) => option.ref)).toMatchObject([
      { kind: "ability", abilityId: "pixie.response" },
    ]);
    expect(choiceExclusions(asking.state, deps)).toEqual([{ instanceId: under, reason: "deckTopPlayLimitUsed" }]);
  });

  it("5. FAQ entry 4: Mutant Protectors cannot put Colossus into play from the top; with Triage in hand only Triage is offered", () => {
    // No ally in her hand: the event has no card to put into play, so the attack's window does not offer it. Colossus's
    // own Interrupt is a play, so it is offered from the top; here she declines it.
    const none = step(
      // She holds 3 cards and draws 2 at the end of the player phase, which leaves Colossus on top.
      step(
        inHeroForm({ hand: [MUTANT_PROTECTORS, RESOURCE, RESOURCE], deck: [RESOURCE, RESOURCE, COLOSSUS, STRENGTH] }),
        endTurn(P1),
      ),
      endTurn(P2),
    );
    const window = none.asked.find((a) => a.kind === "chooseTriggers" && a.playerId === P1);
    expect(window?.offered).toEqual([COLOSSUS.id]);
    expect(inPlay(none.state, COLOSSUS)).toBeUndefined();
    expect(damageOn(none.state, magik(none.state).instanceId)).toBe(5);
    expect(played(none.events)).toEqual([]);

    // Triage in hand: the event is offered, and its card choice is Triage alone. Colossus stays on top of the deck.
    const start = inHeroForm({
      hand: [MUTANT_PROTECTORS, TRIAGE, RESOURCE, RESOURCE, RESOURCE],
      deck: [COLOSSUS, STRENGTH],
    });
    const colossus = topOf(start.state);
    const run = step(step(start, endTurn(P1)), endTurn(P2), { triggers: [MUTANT_PROTECTORS], resources: 1 });
    const offered = run.asked.find((a) => a.kind === "chooseTriggers" && a.playerId === P1);
    expect(offered?.offered).toEqual([MUTANT_PROTECTORS.id, COLOSSUS.id]);
    expect(run.asked.find((a) => a.kind === "chooseCards")?.offered).toEqual([TRIAGE.id]);
    // Triage (3 hit points) was put into play, defended the attack of 5 and was defeated; Magik took nothing.
    expect(cardIds(run.state, mustPlayer(run.state, P1).discard)).toContain(TRIAGE.id);
    expect(damageOn(run.state, magik(run.state).instanceId)).toBe(0);
    expect(topOf(run.state)).toBe(colossus);
    // Mutant Protectors itself was played from her hand; Triage was put into play, not played; the limit is unused.
    expect(played(run.events)).toMatchObject([{ paid: 1, from: undefined }]);
    expect(uses(run.events)).toEqual([]);
    expectReplays(run);
  });

  it("5. the Colossus shape: his Interrupt plays him from the top of her deck for 3 − 1 = 2 and he defends ready", () => {
    // She holds 3 cards and draws 2 at the end of the player phase, which leaves Colossus on top.
    const start = inHeroForm({
      hand: [RESOURCE, RESOURCE, RESOURCE],
      deck: [RESOURCE, RESOURCE, COLOSSUS, STRENGTH, CLOBBER],
    });
    const colossus = deckOf(start.state)[2]!;
    const run = step(step(start, endTurn(P1)), endTurn(P2), { triggers: [COLOSSUS], resources: 2 });
    expect(run.asked.find((a) => a.kind === "chooseTriggers" && a.playerId === P1)?.picked).toEqual([COLOSSUS.id]);
    expect(played(run.events)).toEqual([{ instanceId: colossus, paid: 2, from: "deckTop", countsAsFrom: "hand" }]);
    expect(uses(run.events)).toEqual([1]);
    expect(inPlay(run.state, COLOSSUS)).toBe(colossus);
    // He defended without exhausting; his tough status card took the attack of 5; Magik took nothing.
    expect(mustInstance(run.state, colossus).exhausted).toBe(false);
    expect(
      run.events.flatMap((e) =>
        e.type === "attackResolved" ? [{ target: e.targetInstanceId, dealt: e.damageDealt }] : [],
      ),
    ).toEqual([{ target: colossus, dealt: 5 }]);
    expect(statusActive(run.state, colossus, "tough", deps)).toBe(false);
    expect(damageOn(run.state, colossus)).toBe(0);
    expect(damageOn(run.state, magik(run.state).instanceId)).toBe(0);
    expect(mustPlayer(run.state, P1).hand).toHaveLength(3);
    expectReplays(run);
  });

  it("6. paying: Exorcism (2) with a hand of one card costs 1; an empty hand cannot pay it; Stepping Disc (1) costs 0 from an empty hand", () => {
    const one = inHeroForm({ hand: [RESOURCE], deck: [EXORCISM, STRENGTH] });
    const paid = step(one, playTop(1));
    expect(played(paid.events)).toMatchObject([{ paid: 1, from: "deckTop" }]);
    expect(mustPlayer(paid.state, P1).hand).toEqual([]);
    expectReplays(paid);

    const empty = inHeroForm({ hand: [], deck: [EXORCISM, STRENGTH] });
    const exorcism = topOf(empty.state);
    const entry = listed(empty.state, exorcism);
    expect(entry.legal).toBeUndefined();
    expect(entry.illegal).toMatchObject({
      action: { kind: "playCard", instanceId: exorcism, from: "deckTop" },
      reason: "insufficient_resources",
    });
    const refused = applyCommand(empty.state, playId(exorcism), deps);
    expect(refused.ok ? null : refused.error.code).toBe("insufficient_resources");
    // The new top card is not in her hand: Strength on top after the play could not have paid either.
    expect(deckTopPermission(empty.state, deps, P1)?.limitUsed).toBe(false);

    const disc = inHeroForm({ hand: [], deck: [STEPPING_DISC, STRENGTH] });
    expect(listed(disc.state, topOf(disc.state)).legal?.needsPayment).toBe(false);
    expect(playCostOf(disc.state, P1, topOf(disc.state), deps)).toMatchObject({ printed: 1, current: 0 });
    const free = step(disc, playTop(0));
    expect(played(free.events)).toMatchObject([{ paid: 0, from: "deckTop", countsAsFrom: "hand" }]);
    expectReplays(free);
  });

  it("6. a cost of 0 stays 0, and the top card pays for nothing: not for itself, not as a resource", () => {
    const start = inHeroForm({ hand: [SOUL_STRIKE, RESOURCE], deck: [CLOBBER, STRENGTH, STRENGTH] });
    const clobber = topOf(start.state);
    expect(playCostOf(start.state, P1, clobber, deps)).toMatchObject({ printed: 0, current: 0 });
    // Strength under it is not hers to spend, and neither is the top card: a hand card's payment names hand cards.
    const strike = inHand(start.state, SOUL_STRIKE);
    const withTop = applyCommand(start.state, playId(strike, [...pay(start.state, 1), { fromHand: clobber }]), deps);
    expect(withTop.ok).toBe(false);
    // The card played from the top may not pay for itself.
    const exorcismOnTop = inHeroForm({ hand: [], deck: [EXORCISM, STRENGTH] });
    const self = topOf(exorcismOnTop.state);
    expect(applyCommand(exorcismOnTop.state, playId(self, [{ fromHand: self }]), deps).ok).toBe(false);
    // It is not in her hand for a count either.
    expect(handCountTowardHandSize(start.state, P1, deps)).toBe(2);
    expect(mustPlayer(start.state, P1).hand).not.toContain(clobber);
    const run = step(start, playTop(0));
    expect(played(run.events)).toMatchObject([{ paid: 0, from: "deckTop" }]);
    expectReplays(run);
  });

  it("7. alter-ego form: not playable, not listed; Team-Building Exercise's shape offers hand cards only", () => {
    const start = begin(
      arrange(table(), { hand: [CHAOS_MAGIC, TRIAGE, RESOURCE, FLIP], deck: [STEPPING_DISC, COLOSSUS] }),
    );
    const disc = topOf(start.state);
    expect(mustPlayer(start.state, P1).identity.form).toBe("alterEgo");
    expect(deckTopPermission(start.state, deps, P1)).toBeNull();
    expect(listed(start.state, disc)).toEqual({ legal: undefined, illegal: undefined });
    const refused = applyCommand(start.state, playId(disc), deps);
    expect(refused.ok ? null : refused.error.code).toBe("card_not_in_zone");
    expect(playCostOf(start.state, P1, disc, deps)).toMatchObject({ printed: 1, current: 1, contributions: [] });

    // In hero form it is listed; back in alter-ego form (nothing moved) it is not, and no use was spent.
    const hero = step(start, toHero());
    expect(listed(hero.state, disc).legal?.action).toMatchObject({ from: "deckTop" });
    const back = step(hero, playHand(FLIP));
    expect(mustPlayer(back.state, P1).identity.form).toBe("alterEgo");
    expect(listed(back.state, disc)).toEqual({ legal: undefined, illegal: undefined });
    expect(choiceExclusions(back.state, deps)).toEqual([]);
    expectReplays(back);
  });

  it("7. her text box blank: not playable, not listed, and a 'play a card from your hand' effect offers hand cards only", () => {
    const start = inHeroForm({
      hand: [BLANK, TEAM_BUILDING, TRIAGE, RESOURCE, RESOURCE],
      deck: [COLOSSUS, STRENGTH],
    });
    const colossus = topOf(start.state);
    expect(listed(start.state, colossus).legal).toBeDefined();
    const blank = step(start, playHand(BLANK));
    expect(deckTopPermission(blank.state, deps, P1)).toBeNull();
    expect(shownDeckTop(blank.state, deps, P1)).toBeNull();
    expect(listed(blank.state, colossus)).toEqual({ legal: undefined, illegal: undefined });
    const refused = applyCommand(blank.state, playId(colossus, pay(blank.state, 2)), deps);
    expect(refused.ok ? null : refused.error.code).toBe("card_not_in_zone");

    const run = step(blank, playHand(TEAM_BUILDING), { card: COLOSSUS, resources: 1 });
    const choice = run.asked.find((a) => a.kind === "chooseCards");
    expect(choice?.offered).toEqual([TRIAGE.id]);
    // The default pick took the one card offered: Triage, for 2 − 1 = 1.
    expect(played(run.events)[1]).toMatchObject({ paid: 1, from: undefined });
    expect(inPlay(run.state, TRIAGE)).toBeDefined();
    expect(topOf(run.state)).toBe(colossus);
    expect(uses(run.events)).toEqual([]);
    expectReplays(run);
  });

  it("8. Energy on top, or an encounter card: nothing is offered and the limit is unused", () => {
    const energy = inHeroForm({ hand: [RESOURCE, RESOURCE], deck: [ENERGY, STEPPING_DISC] });
    const top = topOf(energy.state);
    expect(listed(energy.state, top)).toEqual({ legal: undefined, illegal: undefined });
    const refused = applyCommand(energy.state, playId(top), deps);
    expect(refused.ok ? null : refused.error.code).toBe("card_type_not_playable");
    expect(deckTopPermission(energy.state, deps, P1)).toMatchObject({ instanceId: top, limitUsed: false });

    const refugees = step(
      begin(withRefugeesOnTop(arrange(table(), { hand: [RESOURCE], deck: [ENERGY, STRENGTH] }))),
      toHero(),
    );
    const obligation = topOf(refugees.state);
    expect(cardAt(refugees.state, obligation)).toBe(REFUGEES.id);
    expect(listed(refugees.state, obligation)).toEqual({ legal: undefined, illegal: undefined });
    const noPlay = applyCommand(refugees.state, playId(obligation), deps);
    expect(noPlay.ok ? null : noPlay.error.code).toBe("card_type_not_playable");
    expect(deckTopPermission(refugees.state, deps, P1)?.limitUsed).toBe(false);
    expect(refugees.state.abilityUses).toEqual({});
  });

  it("9. a canceled play: the limit is used, the card is in her discard pile, and the next card stays shown", () => {
    const start = inHeroForm({
      hand: [COUNTERSPELL, RESOURCE, RESOURCE, RESOURCE],
      deck: [SOUL_STRIKE, STRENGTH, STEPPING_DISC],
    });
    const [strike, strength] = deckOf(start.state);
    const cursed = step(start, playHand(COUNTERSPELL));
    const villain = villainOf(cursed.state);
    const run = step(cursed, playTop(1));
    // Paid for and played, its effects canceled: no damage, no stun.
    expect(played(run.events)).toEqual([{ instanceId: strike, paid: 1, from: "deckTop", countsAsFrom: "hand" }]);
    expect(damageOn(run.state, villain)).toBe(0);
    expect(statusActive(run.state, villain, "stunned", deps)).toBe(false);
    expect(mustPlayer(run.state, P1).discard).toContain(strike);
    expect(uses(run.events)).toEqual([1]);
    expect(shown(run.events)).toEqual([strength]);
    expect(shownDeckTop(run.state, deps, P1)).toBe(strength);
    expect(deckOf(run.state)[0]).toBe(strength);
    expect(deckTopPermission(run.state, deps, P1)).toMatchObject({ instanceId: strength, limitUsed: true });
    expectReplays(run);
  });

  it.todo("10. campaign: Goldballs (3) off the top to the mission for 0 under Mission Team's discount (§3.34, §3.35)");

  it("a second player's top card is unaffected, and each Magik has her own use", () => {
    // P2 on the plain hero: nothing of theirs is playable from the deck, on their turn or hers.
    const plain = step(
      begin(
        arrange(
          arrange(table(), { hand: [RESOURCE], deck: [STEPPING_DISC, STRENGTH] }),
          { hand: [RESOURCE, RESOURCE], deck: [STEPPING_DISC, STRENGTH] },
          P2,
        ),
      ),
      toHero(),
    );
    const theirs = topOf(plain.state, P2);
    expect(deckTopPermission(plain.state, deps, P2)).toBeNull();
    const onTheirTurn = step(plain, endTurn(P1));
    expect(listed(onTheirTurn.state, theirs, P2)).toEqual({ legal: undefined, illegal: undefined });
    const refused = applyCommand(onTheirTurn.state, playId(theirs, pay(onTheirTurn.state, 1, P2), P2), deps);
    expect(refused.ok ? null : refused.error.code).toBe("card_not_in_zone");

    // Two Magiks: P1's play uses P1's limit only; P2 still plays her own top card this phase.
    const two = arrange(
      arrange(table(SISTER), { hand: [RESOURCE], deck: [STEPPING_DISC, STRENGTH] }),
      { hand: [RESOURCE, RESOURCE], deck: [EXORCISM, STRENGTH] },
      P2,
    );
    const first = step(step(begin(two), toHero()), playTop(0));
    expect(deckTopPermission(first.state, deps, P1)?.limitUsed).toBe(true);
    // P1 may not play P2's top card.
    const cross = applyCommand(first.state, playId(topOf(first.state, P2)), deps);
    expect(cross.ok ? null : cross.error.code).toBe("card_not_in_zone");
    const second = step(step(step(first, endTurn(P1)), toHero(P2)), playTop(1, P2));
    expect(deckTopPermission(step(first, endTurn(P1)).state, deps, P2)).toBeNull(); // alter-ego until she flips
    expect(played(second.events)).toMatchObject([{ paid: 1, from: "deckTop", countsAsFrom: "hand" }]);
    expect(cardAt(second.state, played(second.events)[0]!.instanceId)).toBe(EXORCISM.id);
    expect(uses(second.events)).toEqual([1]);
    expectReplays(second);
  });

  it("a searched deck's card is not her top-card play: no reduction, no use of the limit, no 'from' on the log", () => {
    const start = inHeroForm({ hand: [FETCH_QUEST, RESOURCE], deck: [TRIAGE, STRENGTH, CLOBBER] });
    const triage = topOf(start.state);
    const run = step(start, playHand(FETCH_QUEST), { card: TRIAGE });
    expect(played(run.events)[1]).toEqual({ instanceId: triage, paid: 0, from: undefined, countsAsFrom: undefined });
    expect(inPlay(run.state, TRIAGE)).toBe(triage);
    expect(uses(run.events)).toEqual([]);
    expect(deckTopPermission(run.state, deps, P1)?.limitUsed).toBe(false);
    expectReplays(run);
  });

  it("'when you play a card from your hand → reduce its cost' applies to the top card with her own reduction: 3 − 1 − 1 = 1", () => {
    const start = inHeroForm({ hand: [GAMBLE, RESOURCE, RESOURCE], deck: [COLOSSUS, STRENGTH] });
    const colossus = topOf(start.state);
    const armed = step(start, playHand(GAMBLE));
    const gamble = inPlay(armed.state, GAMBLE)!;
    const run = step(armed, (state) => ({
      ...playId(colossus, pay(state, 1)),
      costReductionAbilities: [{ instanceId: gamble, abilityId: WHAT_COULD_GO_WRONG.ref.id }],
    }));
    expect(played(run.events)).toEqual([{ instanceId: colossus, paid: 1, from: "deckTop", countsAsFrom: "hand" }]);
    expect(inPlay(run.state, COLOSSUS)).toBe(colossus);
    expectReplays(run);
  });
});
