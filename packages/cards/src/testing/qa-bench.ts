/**
 * Real-card bench for the 2026-10-03 rules-QA tests (`../qa-2026-10-03-*.test.ts`): a real Rhino game on the whole
 * playable pool (Core Spider-Man, Justice precon) with any card of the pool conjured into hand or play by relabeling
 * a deck card, plus a command driver that answers every choice from a small `Picks` description and collects events.
 *
 * Test support only: state surgery here is for staging a situation (a card in hand, a patrol minion engaged, a
 * counter on a card), never for the behavior under test.
 */
import { cardId, PLAYABLE_CARDS, trait } from "@mc/content";
import {
  activeEncounterDeck,
  applyCommand,
  createGame,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { PLAYABLE_DEPS, playableScenario } from "../playable/index.js";
import {
  firstLegal,
  identityOf,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  type Picker,
} from "./harness.js";
import { encounterCardInVillainArea, withForm } from "./staging.js";

export const DEPS = PLAYABLE_DEPS;
export const SIDE_CODE = "01107"; // Breakin' & Takin' (hazard icon, no crisis)
export const CRISIS_CODE = "01108"; // Crowd Control (crisis icon)
const SENTINEL = "32093"; // Sentinel Mark IV, made a patrol minion below

/** A real Rhino game, Spider-Man (Justice) or another precon's hero, in hero form, 8 threat on the main scheme, past setup. */
export function rhino(
  seed = 1,
  starterDeckId = "core-spider-man-justice",
  scenarioId = "rhino",
  alsoSeated: readonly string[] = [],
): GameState {
  const created = createGame(
    playableScenario(scenarioId, {
      seed,
      players: [{ starterDeckId }, ...alsoSeated.map((id) => ({ starterDeckId: id }))],
    }),
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  return patchInstance(withForm(settled, { heroForm: 0 }), settled.mainScheme.instanceId, { threat: 8 });
}

export interface Table {
  readonly state: GameState;
  readonly side: InstanceId | null;
  readonly crisis: InstanceId | null;
}
/** The table: a side scheme with 5 threat, and/or a crisis side scheme with 4, and/or a patrol minion engaged. */
export function table(opts: { readonly side?: boolean; readonly crisis?: boolean; readonly patrol?: boolean }): Table {
  let state = rhino();
  let side: InstanceId | null = null;
  let crisis: InstanceId | null = null;
  if (opts.side) {
    const placed = encounterCardInVillainArea(state, SIDE_CODE, 5);
    state = placed.state;
    side = placed.id;
  }
  if (opts.crisis) {
    const placed = encounterCardInVillainArea(state, CRISIS_CODE, 4);
    state = placed.state;
    crisis = placed.id;
  }
  if (opts.patrol) state = withPatrolMinion(state);
  return { state, side, crisis };
}

/** An encounter card relabeled Sentinel Mark IV with patrol (printed guard removed), engaged with P1. */
export function withPatrolMinion(state: GameState): GameState {
  const sentinel = PLAYABLE_CARDS.find((card) => card.id === cardId(SENTINEL));
  if (sentinel?.type !== "minion") throw new Error("no Sentinel Mark IV");
  const spare = activeEncounterDeck(state).deck[0]!;
  const pooled: GameState = {
    ...patchInstance(state, spare, { cardId: sentinel.id }),
    cardPool: { ...state.cardPool, [sentinel.id]: { ...sentinel, keywords: [{ name: "patrol" }] } },
  };
  const pile = activeEncounterDeck(pooled);
  return {
    ...pooled,
    encounterDecks: {
      ...pooled.encounterDecks,
      [pooled.activeVillainId!]: { deck: pile.deck.filter((i) => i !== spare), discard: pile.discard },
    },
    players: pooled.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, spare] } : p)),
    instances: { ...pooled.instances, [spare]: { ...pooled.instances[spare]!, faceup: true, engagedWith: P1 } },
  };
}

/** The hero's identity card given a trait in this game's pool (Hive Mind needs TINY, Agile Flight AERIAL). */
export function withTrait(state: GameState, name: string): GameState {
  const printed = state.instances[identityOf(state)]!.cardId;
  const card = state.cardPool[printed]!;
  if (card.type !== "hero_identity") throw new Error("the identity is not a hero identity");
  const hero = { ...card.hero, traits: [...card.hero.traits, trait(name)] };
  return { ...state, cardPool: { ...state.cardPool, [printed]: { ...card, hero } } };
}

/** Relabels a deck card of P1's to `code` (a card outside the precon); it stays in the deck. */
export function relabel(
  state: GameState,
  code: string,
  from = 1,
): { readonly state: GameState; readonly id: InstanceId } {
  const owner = playerOf(state, P1);
  const spare = owner.deck[owner.deck.length - from]!;
  return { state: patchInstance(state, spare, { cardId: cardId(code) }), id: spare };
}
/** `relabel`, then into P1's hand. */
export function conjure(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const moved = moveToHand(relabel(state, code).state, P1, code);
  return { state: moved.state, id: moved.ids[0]! };
}
/** A copy of `code` put straight into P1's play area, faceup, with counters (surgery: no cost, no enter-play). */
export function intoPlay(
  state: GameState,
  code: string,
  counters: Readonly<Record<string, number>> = {},
  from = 2,
): { readonly state: GameState; readonly id: InstanceId } {
  const spare = relabel(state, code, from);
  const id = spare.id;
  return {
    id,
    state: {
      ...spare.state,
      players: spare.state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
      instances: {
        ...spare.state.instances,
        [id]: { ...spare.state.instances[id]!, faceup: true, controllerId: P1, counters: { ...counters } },
      },
    },
  };
}

export interface Picks {
  /** A scheme `chooseTarget` takes when offered; the first option otherwise. */
  readonly target?: InstanceId;
  /** How a division is spread: scheme -> points. */
  readonly shares?: ReadonlyMap<InstanceId, number>;
  /** Option labels (substrings) a `chooseOne` prompt takes, the first that matches. */
  readonly labels?: readonly string[];
  /** Cards a `payForCard` prompt (a hand card played as a response) pays with. */
  readonly pay?: number;
  /** Option ids containing any of these are taken when offered (response and interrupt windows). */
  readonly use?: readonly string[];
  /** A prompt of this kind takes the option(s) whose id contains the given text (declareDefender: a defender). */
  readonly defend?: string;
}
export const picker =
  (picks: Picks): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "declareDefender" && picks.defend) {
      const hit = choice.options.find((o) => o.optionId.includes(picks.defend!));
      return hit ? [hit.optionId] : ["decline"];
    }
    if (choice.prompt.kind === "chooseTarget") {
      const match = picks.target ? choice.options.find((o) => o.optionId === picks.target) : undefined;
      return [(match ?? choice.options[0]!).optionId];
    }
    if (choice.prompt.kind === "payForAbility") return [choice.options[0]!.optionId];
    if (choice.prompt.kind === "payForCard") {
      return choice.options.slice(0, picks.pay ?? 0).map((o) => o.optionId);
    }
    if (choice.prompt.kind === "divide" && picks.shares) {
      return [...picks.shares].flatMap(([id, points]) => Array.from({ length: points }, (_, i) => `${id}#${i + 1}`));
    }
    const wanted = (picks.use ?? []).flatMap((id) =>
      choice.options.filter((o) => o.optionId.includes(id)).map((o) => o.optionId),
    );
    if (wanted.length > 0) return wanted.slice(0, Math.max(1, choice.maxSelections));
    const labeled = (picks.labels ?? []).flatMap((l) => choice.options.filter((o) => o.label.includes(l)));
    return labeled.length > 0 ? [labeled[0]!.optionId] : firstLegal(state);
  };

export interface Played {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly accepted: boolean;
}
/** Plays the card (paying its cost from the rest of the hand), answering every choice with `picks`. */
export function playOut(state: GameState, id: InstanceId, cost: number, picks: Picks = {}): Played {
  return drive(state, play(P1, id, payWith(state, P1, cost, [id])), picks);
}
/** Applies one command and answers every choice it opens with `picks`, collecting the events. */
export function drive(state: GameState, command: Command, picks: Picks = {}, deps = DEPS): Played {
  const first = applyCommand(state, command, deps);
  if (!first.ok) return { state, events: [], accepted: false };
  const events: GameEvent[] = [...first.events];
  let current = first.state;
  for (let guard = 0; current.pendingChoice && !current.outcome; guard++) {
    if (guard > 100) throw new Error(`stuck on ${current.pendingChoice.prompt.kind}`);
    const choice = current.pendingChoice;
    const next = applyCommand(
      current,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: picker(picks)(current),
      },
      deps,
    );
    if (!next.ok) throw new Error(`${choice.prompt.kind} answer rejected: ${next.error.message}`);
    events.push(...next.events);
    current = next.state;
  }
  return { state: current, events, accepted: true };
}

/** The thwarts that resolved: who thwarted, which scheme, and how much threat that thwart removed. */
export const thwarts = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "thwart"
      ? [{ by: e.event.thwarterInstanceId, scheme: e.event.schemeInstanceId, amount: e.event.amount }]
      : [],
  );
