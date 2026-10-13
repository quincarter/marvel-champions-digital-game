/**
 * Bench for the wave 10 engine-rules QA (`../qa-wave10-engine-*.qa.test.ts`): `qa-bench.ts`'s Rhino table with a plain
 * (no patrol, no guard) minion, so a test can stage "no threat anywhere" with an enemy still in play.
 * Test support only; state surgery here stages a situation, never the behavior under test.
 */
import { cardId, PLAYABLE_CARDS } from "@mc/content";
import { PLAYABLE_DEPS } from "../playable/index.js";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  applyCommand,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { P1, patchInstance } from "./harness.js";
import { rhino } from "./qa-bench.js";

/** An encounter card relabeled Sentinel Mark IV with no keywords at all, engaged with P1 (a plain enemy). */
export function withPlainMinion(state: GameState): { readonly state: GameState; readonly id: InstanceId } {
  const sentinel = PLAYABLE_CARDS.find((card) => card.id === cardId("32093"));
  if (sentinel?.type !== "minion") throw new Error("no Sentinel Mark IV");
  const spare = activeEncounterDeck(state).deck[0]!;
  const pooled: GameState = {
    ...patchInstance(state, spare, { cardId: sentinel.id }),
    cardPool: { ...state.cardPool, [sentinel.id]: { ...sentinel, keywords: [] } },
  };
  const pile = activeEncounterDeck(pooled);
  return {
    id: spare,
    state: {
      ...pooled,
      encounterDecks: {
        ...pooled.encounterDecks,
        [activeEncounterDeckId(pooled)]: { deck: pile.deck.filter((i) => i !== spare), discard: pile.discard },
      },
      players: pooled.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, spare] } : p)),
      instances: { ...pooled.instances, [spare]: { ...pooled.instances[spare]!, faceup: true, engagedWith: P1 } },
    },
  };
}

/** The Rhino table with a plain minion engaged and the main scheme holding `threat`. */
export function plainTable(threat: number): { readonly state: GameState; readonly minion: InstanceId } {
  const base = rhino();
  const placed = withPlainMinion(base);
  return { state: patchInstance(placed.state, base.mainScheme.instanceId, { threat }), minion: placed.id };
}

/** The card record for a code, put in the game's pool. */
export function pooled(
  state: GameState,
  code: string,
): { readonly state: GameState; readonly cardId: ReturnType<typeof cardId> } {
  const id = cardId(code);
  const card = PLAYABLE_CARDS.find((c) => c.id === id);
  if (!card) throw new Error(`no card ${code}`);
  return { state: { ...state, cardPool: { ...state.cardPool, [id]: card } }, cardId: id };
}

/**
 * Puts these encounter cards on top of the active villain's encounter deck, in order, by relabeling cards that are
 * already there (surgery: the deck keeps its size). The first is drawn first: in a villain phase the villain's boost
 * card, then one card per player. Returns their instance ids.
 */
export function encounterTop(
  state: GameState,
  ...codes: readonly string[]
): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  let current = state;
  const pile = activeEncounterDeck(current);
  const ids = pile.deck.slice(0, codes.length);
  if (ids.length < codes.length) throw new Error("the encounter deck is too short to stage");
  codes.forEach((code, index) => {
    const made = pooled(current, code);
    current = patchInstance(made.state, ids[index]!, { cardId: made.cardId });
  });
  return { state: current, ids };
}

export interface Driven {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly accepted: boolean;
  /** The refusal's code and message when the first command was refused. */
  readonly refusal?: string;
  /** Prompt kinds the game asked, in order. */
  readonly asked: readonly string[];
}

/**
 * Applies a command and answers every choice with `answer` (the option ids; default: the first `minSelections`),
 * collecting events and prompt kinds. A rejected answer throws, which is how "a prompt with no legal answer" shows.
 */
export function driveWith(
  state: GameState,
  command: Command,
  answer: (state: GameState) => readonly string[] | null = () => null,
  deps: EngineDeps = PLAYABLE_DEPS,
): Driven {
  const first = applyCommand(state, command, deps);
  if (!first.ok)
    return { state, events: [], accepted: false, refusal: `${first.error.code}: ${first.error.message}`, asked: [] };
  const events: GameEvent[] = [...first.events];
  const asked: string[] = [];
  let current = first.state;
  for (let guard = 0; current.pendingChoice && !current.outcome; guard++) {
    if (guard > 200) throw new Error(`stuck on ${current.pendingChoice.prompt.kind}`);
    const choice = current.pendingChoice;
    asked.push(choice.prompt.kind);
    const picked =
      answer(current) ?? choice.options.slice(0, Math.max(choice.minSelections, 0)).map((option) => option.optionId);
    const next = applyCommand(
      current,
      { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: picked },
      deps,
    );
    if (!next.ok) throw new Error(`${choice.prompt.kind} answer rejected: ${next.error.message}`);
    events.push(...next.events);
    current = next.state;
  }
  return { state: current, events, accepted: true, asked };
}

/**
 * An answer function for `driveWith`: declines every defense (or takes `defender`), takes any option naming one of
 * `take` (a response or trigger window), and otherwise the first `minSelections` options.
 */
export const answering =
  (take: readonly InstanceId[] = [], defender?: InstanceId) =>
  (state: GameState): readonly string[] | null => {
    const choice = state.pendingChoice!;
    if (choice.prompt.kind === "declareDefender") {
      const wanted = defender ? choice.options.find((o) => o.optionId === defender) : undefined;
      return [wanted ? wanted.optionId : "decline"];
    }
    const hit = choice.options.filter((o) => take.some((id) => o.optionId.includes(id)));
    return hit.length > 0 ? hit.slice(0, Math.max(1, choice.maxSelections)).map((o) => o.optionId) : null;
  };

/** The damage events dealt to `target` by `source`, in order. */
export const damageTo = (events: readonly GameEvent[], target: InstanceId, source?: InstanceId): number[] =>
  events.flatMap((e) =>
    e.type === "damageDealt" && e.targetInstanceId === target && (source === undefined || e.sourceInstanceId === source)
      ? [e.amount]
      : [],
  );

/** A copy of `code` (a minion), relabeled from the top of the encounter deck, engaged with P1 and in the play area. */
export function minionEngaged(
  state: GameState,
  code: string,
  player = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const placed = encounterTop(state, code);
  const id = placed.ids[0]!;
  const pile = activeEncounterDeck(placed.state);
  return {
    id,
    state: {
      ...placed.state,
      encounterDecks: {
        ...placed.state.encounterDecks,
        [activeEncounterDeckId(placed.state)]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard },
      },
      players: placed.state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: {
        ...placed.state.instances,
        [id]: { ...placed.state.instances[id]!, faceup: true, engagedWith: player },
      },
    },
  };
}

/** Relabels the card `depth` places down the encounter deck (0 = top) as `code`. */
export function encounterAt(
  state: GameState,
  depth: number,
  code: string,
): { readonly state: GameState; readonly id: InstanceId } {
  const id = activeEncounterDeck(state).deck[depth]!;
  const made = pooled(state, code);
  return { id, state: patchInstance(made.state, id, { cardId: made.cardId }) };
}
