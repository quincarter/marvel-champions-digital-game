/**
 * Hail Hydra! (03030; reprinted as 04057 and 04147), in real Rhino games: "When Revealed: Each Hydra minion engaged
 * with a hero attacks that hero. Each player who was not attacked this way searches the encounter deck and discard
 * pile for a Hydra minion and puts it into play engaged with them."
 *
 * "Attacked this way" is the attacked player of each attack as it finished (issue #1012 §4, owner decision C): FFG
 * ruling July 25, 2024 (docs/rulings/post-rrg-1-6/01-july-2024.md), "Once a player defends an attack with a character
 * they control, that player is the 'attacked player'"; RRG 1.8 "Defend, Defense" (p. 16). Replay 36a2ee8a #58-63: a
 * player who defended another player's attack still searched. A stunned minion does not attack (RRG 1.8 "Stun", p. 41).
 */
import { cardId, PLAYABLE_CARDS } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  cardsInPlay,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  P1,
  P2,
  P3,
  patchInstance,
  type Picker,
} from "../../testing/harness.js";
import { DEPS, rhino } from "../../testing/qa-bench.js";
import { withForm } from "../../testing/staging.js";

vi.setConfig({ testTimeout: 120_000 });

const HAIL_HYDRA = "03030";
const HYDRA_SOLDIER = "03029";

/** Relabels the encounter deck's card at `index` as `code` (added to the game's card pool); it stays in the deck. */
function relabelEncounter(state: GameState, code: string, index: number): { state: GameState; id: InstanceId } {
  const card = PLAYABLE_CARDS.find((c) => c.id === cardId(code));
  if (!card) throw new Error(`no ${code} in the playable pool`);
  const id = activeEncounterDeck(state).deck[index]!;
  return {
    id,
    state: { ...patchInstance(state, id, { cardId: card.id }), cardPool: { ...state.cardPool, [card.id]: card } },
  };
}

/** Moves encounter card `id` out of the deck into `player`'s play area, faceup and engaged with them (surgery). */
function engage(state: GameState, id: InstanceId, player: PlayerId): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: pile.deck.filter((i) => i !== id) } },
    players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
    instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, engagedWith: player } },
  };
}

/** Moves encounter card `id` from the deck to the encounter discard pile (surgery). */
function toDiscard(state: GameState, id: InstanceId): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: [...pile.discard, id] },
    },
    instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true } },
  };
}

/** Moves encounter card `id` to just behind `fillers` cards on top of the deck. */
function stackBehind(state: GameState, id: InstanceId, fillers: number): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const rest = pile.deck.filter((i) => i !== id);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { ...pile, deck: [...rest.slice(0, fillers), id, ...rest.slice(fillers)] },
    },
  };
}

/** An ally from `player`'s deck put straight into their play area, ready (surgery). */
function allyInPlay(state: GameState, player: PlayerId): { state: GameState; id: InstanceId } {
  const owner = state.players.find((p) => p.playerId === player)!;
  const id = owner.deck.find((i) => state.cardPool[state.instances[i]!.cardId]?.type === "ally");
  if (!id) throw new Error(`no ally in ${player}'s deck`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, exhausted: false } },
    },
  };
}

const hydraEngagedWith = (state: GameState, player: PlayerId): InstanceId[] =>
  cardsInPlay(state).filter((id) => {
    const instance = state.instances[id]!;
    if (instance.engagedWith !== player) return false;
    const card = state.cardPool[instance.cardId];
    return card?.type === "minion" && card.traits.some((t) => String(t).toUpperCase() === "HYDRA");
  });

interface Setup {
  /** Starter decks of P2 onward (P1 is Spider-Man). */
  readonly others?: readonly string[];
  /** A Hydra Soldier engaged with each of these players, in this order (`Table.soldiers`). */
  readonly engaged?: readonly PlayerId[];
  /** Hydra Soldiers left in the encounter deck for the searches. */
  readonly spares?: number;
  /** Test surgery on the table once it is set. */
  readonly prepare?: (state: GameState) => GameState;
}
interface Table {
  readonly state: GameState;
  readonly hailHydra: InstanceId;
  readonly soldiers: readonly InstanceId[];
  readonly players: readonly PlayerId[];
}
const SEATS = [P1, P2, P3] as const;

/** Heroes against Rhino, Hydra Soldiers engaged as `setup.engaged` says and spares in the deck, Hail Hydra! to be dealt. */
function table(fillers: number, setup: Setup): Table {
  const others = setup.others ?? ["core-captain-marvel-leadership"];
  let state = rhino(3, "core-spider-man-justice", "rhino", others);
  const players = SEATS.slice(0, others.length + 1);
  for (const player of players.slice(1)) state = withForm(state, { heroForm: 0 }, player);
  state = patchInstance(state, state.mainScheme.instanceId, { threat: 0 });
  const soldiers: InstanceId[] = [];
  for (const player of setup.engaged ?? [P1]) {
    const soldier = relabelEncounter(state, HYDRA_SOLDIER, 0);
    state = engage(soldier.state, soldier.id, player);
    soldiers.push(soldier.id);
  }
  // The spares go to the encounter discard pile, which the search reads too, so none is dealt to a player instead.
  for (let spare = 0; spare < (setup.spares ?? 1); spare++) {
    const relabeled = relabelEncounter(state, HYDRA_SOLDIER, 5);
    state = toDiscard(relabeled.state, relabeled.id);
  }
  const hailHydra = relabelEncounter(state, HAIL_HYDRA, 9);
  state = stackBehind(hailHydra.state, hailHydra.id, fillers);
  return { state: setup.prepare ? setup.prepare(state) : state, hailHydra: hailHydra.id, soldiers, players };
}

type Adjust = (state: GameState) => GameState;
interface Run {
  readonly before: GameState;
  readonly after: GameState;
  /** Cards revealed after Hail Hydra! (another player's encounter card) in the same steps. */
  readonly revealed: ReadonlySet<InstanceId>;
}

/** The Hydra minions `player`'s search put into play: engaged now, not before, and not revealed since. */
const found = (run: Run, player: PlayerId): number =>
  hydraEngagedWith(run.after, player).filter(
    (id) => !hydraEngagedWith(run.before, player).includes(id) && !run.revealed.has(id),
  ).length;

/**
 * Plays every turn out until Hail Hydra! has been revealed and resolved (it is in the encounter discard pile), answering
 * choices with `pick`; `adjust` may change the game just before each answer (test surgery at that moment). `before` is
 * the game just before the step that revealed it. Null when the villain phase did not reveal it with this many fillers
 * ahead of it (it was another card's boost card, say).
 */
function untilHailHydraResolves(base: Table, pick: Picker, adjust: Adjust): Run | null {
  let current = base.state;
  let before: GameState | null = null;
  const revealed = new Set<InstanceId>();
  const commands = base.players.map((player) => endTurn(player));
  for (let guard = 0; guard < 600 && !current.outcome; guard++) {
    if (activeEncounterDeck(current).discard.includes(base.hailHydra)) break;
    const choice = current.pendingChoice;
    let step: GameState;
    let result: ReturnType<typeof applyOk>;
    if (choice) {
      step = adjust(current);
      result = applyOk(
        step,
        { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: pick(step) },
        DEPS,
      );
    } else {
      const command = commands.shift();
      if (!command) return null;
      step = current;
      result = applyOk(current, command, DEPS);
    }
    for (const e of result.events) {
      if (e.type !== "encounterCardRevealed") continue;
      if (e.instanceId === base.hailHydra) before ??= step;
      else if (before) revealed.add(e.instanceId);
    }
    current = result.state;
  }
  return before && activeEncounterDeck(current).discard.includes(base.hailHydra)
    ? { before, after: current, revealed }
    : null;
}

function resolveHailHydra(
  pickFor: (table: Table) => Picker,
  setup: Setup = {},
  adjustFor: (table: Table) => Adjust = () => (s) => s,
) {
  for (let fillers = 1; fillers <= 6; fillers++) {
    const base = table(fillers, setup);
    const run = untilHailHydraResolves(base, pickFor(base), adjustFor(base));
    if (run) return { ...run, base };
  }
  throw new Error("Hail Hydra! was never revealed");
}

/** During Hail Hydra!'s attacks (it is faceup), the first of `ids` offered defends; every other attack is undefended. */
const defendingWith =
  (ids: (state: GameState) => readonly InstanceId[]) =>
  (base: Table): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "declareDefender" && state.instances[base.hailHydra]!.faceup) {
      const hit = ids(state).find((id) => choice.options.some((o) => o.optionId === id));
      if (hit) return [hit];
    }
    return firstLegal(state);
  };

describe("Hail Hydra! (03030): 'each player who was not attacked this way' (ruling July 25, 2024; #1012 §4 C)", () => {
  it("P2 defends the Hydra Soldier's attack on P1: P2 was attacked and skips the search, P1 searches", () => {
    const run = resolveHailHydra(defendingWith((state) => [identityOf(state, P2)]));
    expect(hydraEngagedWith(run.before, P1)).toEqual(run.base.soldiers);
    expect(hydraEngagedWith(run.before, P2)).toEqual([]);
    // P1 was not attacked (the attack was initiated against P1, but P2 defended it): one more Hydra minion.
    expect(found(run, P1)).toBe(1);
    // P2 was the attacked player: no search.
    expect(found(run, P2)).toBe(0);
  });

  it("nobody defends: P1 was attacked and skips the search; P2, with no Hydra minion engaged, searches", () => {
    const run = resolveHailHydra(() => firstLegal);
    expect(hydraEngagedWith(run.before, P1)).toEqual(run.base.soldiers);
    expect(found(run, P1)).toBe(0);
    expect(found(run, P2)).toBe(1);
  });

  it("a Hydra minion engaged with each player, nobody defends: both were attacked and neither searches", () => {
    const run = resolveHailHydra(() => firstLegal, { engaged: [P1, P2] });
    const [mine, theirs] = run.base.soldiers;
    expect(hydraEngagedWith(run.before, P1)).toEqual([mine]);
    expect(hydraEngagedWith(run.before, P2)).toEqual([theirs]);
    expect(found(run, P1)).toBe(0);
    expect(found(run, P2)).toBe(0);
  });

  it("a stunned Hydra minion does not attack: its player was not attacked and searches", () => {
    // Stunned once Rhino attacks P2, after the minions engaged with P1 activated (RRG 1.8 "Villain Phase" step 2), so
    // the stun is still there when Hail Hydra! has it attack.
    const stunLate = (base: Table): Adjust => {
      let stunned = false;
      return (state) => {
        const prompt = state.pendingChoice?.prompt;
        if (stunned || prompt?.kind !== "declareDefender" || prompt.attack.targetPlayerId !== P2) return state;
        stunned = true;
        const soldier = base.soldiers[0]!;
        return patchInstance(state, soldier, { statuses: { ...state.instances[soldier]!.statuses, stunned: 1 } });
      };
    };
    const run = resolveHailHydra(() => firstLegal, { spares: 2 }, stunLate);
    const soldier = run.base.soldiers[0]!;
    expect(run.before.instances[soldier]!.statuses.stunned).toBe(1);
    // The stun was discarded instead of the attack (RRG 1.8 "Stun", p. 41).
    expect(run.after.instances[soldier]!.statuses.stunned).toBe(0);
    // P1 (whose minion did not attack) and P2 (no minion) each search.
    expect(found(run, P1)).toBe(1);
    expect(found(run, P2)).toBe(1);
  });

  it("P2 defends the attacks on both P1 and P3 (hero, then an ally): P2 skips the search, P1 and P3 search", () => {
    let ally: InstanceId | null = null;
    const prepare = (state: GameState): GameState => {
      const placed = allyInPlay(state, P2);
      ally = placed.id;
      return placed.state;
    };
    const run = resolveHailHydra(
      defendingWith((state) => [identityOf(state, P2), ...(ally ? [ally] : [])]),
      { others: ["core-captain-marvel-leadership", "core-iron-man-aggression"], engaged: [P1, P3], spares: 2, prepare },
    );
    const [p1Soldier, p3Soldier] = run.base.soldiers;
    expect(hydraEngagedWith(run.before, P1)).toEqual([p1Soldier]);
    expect(hydraEngagedWith(run.before, P3)).toEqual([p3Soldier]);
    // Both of P2's characters defended one of the attacks.
    expect(run.after.instances[identityOf(run.after, P2)]!.exhausted).toBe(true);
    expect(run.after.instances[ally!]!.exhausted).toBe(true);
    expect(found(run, P1)).toBe(1);
    expect(found(run, P3)).toBe(1);
    expect(found(run, P2)).toBe(0);
  });
});
