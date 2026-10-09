import { CYCLOPS_CARDS, JUBILEE_CARDS, MAGNETO_CARDS, WAVE7_CARDS, WAVE8_STARTER_DECKS, cardId } from "@mc/content";
import type { AnyCard } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  applyCommands,
  createGame,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type ResourceType,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../core/setup.js";
import { mergeRegistries } from "../dsl/index.js";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  resourceAbility,
  settle,
} from "../testing/harness.js";
import { withForm } from "../testing/staging.js";
import { WAVE7_ABILITIES } from "../wave7/index.js";
import { JUBILEE_EVENTS } from "./jubilee/jubilee/events.js";
import { JUBILEE_IDENTITY } from "./jubilee/jubilee/identity.js";
import { MAGNETO_ASPECT_BASIC } from "./magneto/aspect-basic.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * QA: Cyclops (ally 49015) against Jubilee's Grand Finale (47009), docs/phase7-wave8.md section 4.1 row 46 (Q46 = A).
 *
 * Ruling: the owner's answer to Q46 cites FFG's rulings page. Cyclops's "increase the amount of damage that enemy takes
 * from each attack by 1" adds 1 to every instance of attack damage, and FFG's own example is Grand Finale: instances of
 * 2 + 2 + 2 + 2 become 3 + 3 + 3 + 3 = 12. RRG 1.8 "Attack (Player Ability Type)" (p. 10): an ability labeled attack is
 * one attack, even with several instances of damage.
 *
 * Grand Finale is scripted as a real `attack(2)` (first instance) and `dealDamage(2)` for each further instance
 * ("for each different type that paid": the number of instances after the first is the number of types paid, at most
 * the cost, Q34 = A). Cyclops is scripted as `applyRuleUntil(increaseDamageTaken, fromAttack, endOfPhase)`. The engine
 * counts the further `dealDamage` instances as damage from that attack (section 4.1 row 47, Q47 = A: an "(attack)"
 * ability is one attack, and damage it deals to enemies while resolving is damage from it), which this file checks.
 *
 * Counting note: "four instances" is the first attack plus three types paid (cost 3, E + M + PH). Paying with fewer
 * types gives fewer instances: one type = 2 instances, two types = 3.
 *
 * Game: Jubilee's `jubilee-justice` deck against Rhino with Cyclops 49015 and Kid Omega 49013 added (an illegal deck,
 * hence `requireLegalDecks: false`), registry = WAVE7 + Jubilee identity and events + Magneto aspect/basic cards.
 */
const DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE7_ABILITIES, JUBILEE_IDENTITY, JUBILEE_EVENTS, MAGNETO_ASPECT_BASIC),
};
const POOL: readonly AnyCard[] = [
  ...WAVE7_CARDS,
  ...JUBILEE_CARDS,
  ...MAGNETO_CARDS,
  ...CYCLOPS_CARDS.filter((c) => !WAVE7_CARDS.some((w) => w.id === c.id)),
];

const JUBILEE = WAVE8_STARTER_DECKS.find((d) => d.id === "jubilee-justice")!;
const CYCLOPS = "49015";
const KID_OMEGA = "49013";
const FINALE = "47009";
const E = "47019";
const M = "47013";
const PH = "47014";
const STRENGTH = "01090";
const CYCLOPS_REF = "49015.cyclops-response";
const KID_OMEGA_REF = "49013.kid-omega-response";
const LIKE_TOTALLY = "47001a.like-totally";

function setupGame(): GameState {
  const config = coreScenario("rhino", {
    players: [
      {
        identityCardId: JUBILEE.identityCardId,
        aspects: JUBILEE.aspects,
        deck: [
          ...JUBILEE.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
          cardId(STRENGTH),
          cardId(STRENGTH),
          cardId(CYCLOPS),
          cardId(KID_OMEGA),
        ],
      },
    ],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  } as never);
  const created = createGame({ ...config, requireLegalDecks: false }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  return withForm(settled, { heroForm: 0 }, P1);
}

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;

/** A minion relabeled from the next spare encounter card, engaged with the player, faceup and undamaged. */
function withMinion(s: GameState, code: string): { state: GameState; id: InstanceId } {
  const minion = s.cardPool[cardId(code)];
  if (minion?.type !== "minion") throw new Error(`no minion ${code} in the pool`);
  const deckId = activeEncounterDeckId(s);
  const pile = s.encounterDecks[deckId]!;
  const spare = pile.deck[0]!;
  return {
    id: spare,
    state: {
      ...patchInstance(s, spare, { cardId: minion.id, faceup: true, engagedWith: P1, damage: 0 }),
      encounterDecks: {
        ...s.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== spare), discard: pile.discard },
      },
      players: s.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, spare] } : p)),
    },
  };
}

/** The hand becomes exactly these cards (by code, in order); the old hand goes to the bottom of the deck. */
function stageHand(s: GameState, ...codes: readonly string[]): { state: GameState; ids: InstanceId[] } {
  const cleared: GameState = {
    ...s,
    players: s.players.map((p) => (p.playerId === P1 ? { ...p, hand: [], deck: [...p.deck, ...p.hand] } : p)),
  };
  const moved = moveToHand(cleared, P1, ...codes);
  return { state: moved.state, ids: [...moved.ids] };
}

/** A cost changed in this game's pool (the fixture for a cost of 4). */
const withCost = (s: GameState, code: string, cost: number): GameState => {
  const card = s.cardPool[cardId(code)] as AnyCard & { cost: number };
  return { ...s, cardPool: { ...s.cardPool, [code]: { ...card, cost } as AnyCard } };
};

/** What a driver does at a prompt; `undefined` falls through to the next rule, then to the first legal answer. */
type Rule = (s: GameState) => readonly string[] | undefined;

interface Run {
  readonly start: GameState;
  state: GameState;
  readonly commands: Command[];
  events: GameEvent[];
}

const begin = (s: GameState): Run => ({ start: s, state: s, commands: [], events: [] });

/** Applies a command and answers every choice with the rules (the first rule that answers wins). */
function step(run: Run, command: Command, ...rules: readonly Rule[]): readonly GameEvent[] {
  const log: GameEvent[] = [];
  const apply = (c: Command) => {
    const r = applyCommand(run.state, c, DEPS);
    if (!r.ok) throw new Error(`${c.type} rejected: ${r.error.code}: ${r.error.message}`);
    run.commands.push(c);
    run.state = r.state;
    log.push(...r.events);
  };
  apply(command);
  for (let guard = 0; run.state.pendingChoice; guard++) {
    if (guard > 100) throw new Error("choices did not settle");
    const choice = run.state.pendingChoice;
    let selected: readonly string[] | undefined;
    for (const rule of rules) {
      selected = rule(run.state);
      if (selected) break;
    }
    if (!selected) {
      selected =
        choice.prompt.kind === "declareDefender"
          ? ["decline"]
          : choice.prompt.kind === "chooseTarget"
            ? choice.options.slice(0, choice.maxSelections).map((o) => o.optionId)
            : firstLegal(run.state);
    }
    apply({
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: [...selected],
    });
  }
  run.events.push(...log);
  return log;
}

/** Accepts the offered trigger whose id contains `ref`. */
const accept =
  (ref: string): Rule =>
  (s) => {
    if (s.pendingChoice?.prompt.kind !== "chooseTriggers") return undefined;
    const hits = s.pendingChoice.options.filter((o) => o.optionId.includes(ref)).map((o) => o.optionId);
    return hits.length > 0 ? hits : undefined;
  };
/** Chooses these targets, in order, one answer per `chooseTarget` prompt. */
const targetsInOrder = (...answers: readonly InstanceId[]): Rule => {
  let next = 0;
  return (s) => {
    if (s.pendingChoice?.prompt.kind !== "chooseTarget") return undefined;
    const wanted = answers[next++];
    if (wanted === undefined) return undefined;
    if (!s.pendingChoice.options.some((o) => o.optionId === wanted)) {
      throw new Error(`target ${wanted} not offered (options ${s.pendingChoice.options.map((o) => o.optionId)})`);
    }
    return [wanted];
  };
};
/** Declares each wild as the given type, one type per wild. */
const declareAs =
  (...types: readonly ResourceType[]): Rule =>
  (s) =>
    s.pendingChoice?.prompt.kind === "declareWildTypes" ? types.map((t, i) => `${i}:${t}`) : undefined;
const optionLabeled =
  (text: string): Rule =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind !== "chooseOption") return undefined;
    const hit = choice.options.find((o) => o.label.includes(text));
    return hit ? [hit.optionId] : undefined;
  };
const spendHand =
  (...ids: readonly InstanceId[]): Rule =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind !== "spendResources") return undefined;
    const hits = ids.map((id) => `hand:${id}`).filter((id) => choice.options.some((o) => o.optionId === id));
    return hits.length > 0 ? hits : undefined;
  };

const play = (card: InstanceId, pay: readonly InstanceId[], extra: Partial<Command> = {}): Command =>
  ({
    type: "playCard",
    playerId: P1,
    cardInstanceId: card,
    payment: pay.map((fromHand) => ({ fromHand })),
    attachToInstanceId: null,
    ...extra,
  }) as Command;

/** Cyclops (cost 3, paid with both Strengths) played from a fresh hand; `target` chosen for the grant, or declined. */
function playCyclops(run: Run, target: InstanceId | null): void {
  const staged = stageHand(run.state, CYCLOPS, STRENGTH, STRENGTH);
  run.state = staged.state;
  const [card, ...pay] = staged.ids as [InstanceId, ...InstanceId[]];
  step(run, play(card, pay), ...(target === null ? [] : [accept(CYCLOPS_REF), targetsInOrder(target)]));
}

/**
 * Grand Finale paid with `pay` (card codes), the targets of its instances in order. With `cost4`, the printed cost is 4
 * (fixture) and "Like, totally!" is the fourth type.
 */
function playFinale(run: Run, pay: readonly string[], targets: readonly InstanceId[], ...more: readonly Rule[]) {
  const staged = stageHand(run.state, FINALE, ...pay);
  run.state = staged.state;
  const [card, ...payers] = staged.ids as [InstanceId, ...InstanceId[]];
  const events = step(run, play(card, payers), targetsInOrder(...targets), ...more);
  return events;
}

const damageEvents = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "damageDealt" ? [{ target: e.targetInstanceId, amount: e.amount }] : []));
const amountsTo = (events: readonly GameEvent[], target: InstanceId): number[] =>
  damageEvents(events)
    .filter((d) => d.target === target)
    .map((d) => d.amount);

describe("Cyclops 49015 under Grand Finale 47009 (Q46 = A: FFG's example, 2 + 2 + 2 + 2 becomes 3 + 3 + 3 + 3 = 12)", () => {
  it("control, no Cyclops: three types paid, four instances of 2 on Rhino = 8", () => {
    const run = begin(setupGame());
    const rhino = villainOf(run.state);
    const events = playFinale(run, [E, M, PH], [rhino, rhino, rhino, rhino]);
    expect(amountsTo(events, rhino)).toEqual([2, 2, 2, 2]);
    expect(inst(run.state, rhino).damage).toBe(8);
  });

  // FFG's ruling (Q46 = A) and the owner's general rule (Q47 = A): every instance is damage from the one attack the
  // ability makes, so each instance against the enemy Cyclops chose takes his +1 (the engine's `attack-ability.ts`).
  it("Cyclops used on Rhino first: four instances of 3 = 12 (FFG's own example)", () => {
    const run = begin(setupGame());
    const rhino = villainOf(run.state);
    playCyclops(run, rhino);
    const events = playFinale(run, [E, M, PH], [rhino, rhino, rhino, rhino]);
    expect(amountsTo(events, rhino)).toEqual([3, 3, 3, 3]);
    expect(inst(run.state, rhino).damage).toBe(12);
  });

  it("Cyclops used on Rhino first, one type paid: two instances, 3 + 3 = 6", () => {
    const run = begin(setupGame());
    const rhino = villainOf(run.state);
    playCyclops(run, rhino);
    const events = playFinale(run, [E, E, E], [rhino, rhino]);
    expect(amountsTo(events, rhino)).toEqual([3, 3]);
    expect(inst(run.state, rhino).damage).toBe(6);
  });

  it("Cyclops used on Rhino first, two types paid: three instances, 3 + 3 + 3 = 9", () => {
    const run = begin(setupGame());
    const rhino = villainOf(run.state);
    playCyclops(run, rhino);
    const events = playFinale(run, [E, E, M], [rhino, rhino, rhino]);
    expect(amountsTo(events, rhino)).toEqual([3, 3, 3]);
    expect(inst(run.state, rhino).damage).toBe(9);
  });

  it("four types paid (cost 4 fixture, Like, totally! as the fourth) under Cyclops: five instances of 3 = 15", () => {
    const base = withCost(setupGame(), FINALE, 4);
    const run = begin(base);
    const rhino = villainOf(run.state);
    playCyclops(run, rhino);
    const staged = stageHand(run.state, FINALE, E, M, PH);
    run.state = staged.state;
    const [card, ...payers] = staged.ids as [InstanceId, ...InstanceId[]];
    const like = resourceAbility(identityOf(run.state, P1), LIKE_TOTALLY);
    const events = step(
      run,
      { ...play(card, payers), payment: [like, ...payers.map((fromHand) => ({ fromHand }))] } as Command,
      declareAs("wild"),
      targetsInOrder(rhino, rhino, rhino, rhino, rhino),
    );
    expect(amountsTo(events, rhino)).toEqual([3, 3, 3, 3, 3]);
    // Rhino (14 hit points here) is defeated by 15 and flips, so the total is read from the events, not the damage.
    expect(amountsTo(events, rhino).reduce((a, b) => a + b, 0)).toBe(15);
  });

  it("split across two enemies, Cyclops on Rhino only: +1 on the instances that hit Rhino (3 + 3), none on Melter (2 + 2)", () => {
    const base = setupGame();
    const melterAdded = withMinion(base, "01132"); // Masters of Evil minion: 5 hit points, no Guard
    const run = begin(melterAdded.state);
    const rhino = villainOf(run.state);
    const melter = melterAdded.id;
    playCyclops(run, rhino);
    const events = playFinale(run, [E, M, PH], [rhino, melter, rhino, melter]);
    expect(damageEvents(events)).toEqual([
      { target: rhino, amount: 3 },
      { target: melter, amount: 2 },
      { target: rhino, amount: 3 },
      { target: melter, amount: 2 },
    ]);
    expect(inst(run.state, rhino).damage).toBe(6);
    expect(inst(run.state, melter).damage).toBe(4);
  });

  it("split across two enemies, Cyclops on Melter only: the instances that hit Melter are 3, the ones on Rhino 2", () => {
    const melterAdded = withMinion(setupGame(), "01132");
    const run = begin(melterAdded.state);
    const rhino = villainOf(run.state);
    const melter = melterAdded.id;
    playCyclops(run, melter);
    const events = playFinale(run, [E, M, PH], [rhino, melter, rhino, melter]);
    expect(damageEvents(events)).toEqual([
      { target: rhino, amount: 2 },
      { target: melter, amount: 3 },
      { target: rhino, amount: 2 },
      { target: melter, amount: 3 },
    ]);
  });

  it("damage that is not an attack on the chosen enemy in the same phase is not increased (Kid Omega: 1 damage to each enemy)", () => {
    const run = begin(setupGame());
    const rhino = villainOf(run.state);
    playCyclops(run, rhino);
    const staged = stageHand(run.state, KID_OMEGA, PH, M, E);
    run.state = staged.state;
    const [card, p1, p2, spend] = staged.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    const events = step(run, play(card, [p1, p2]), accept(KID_OMEGA_REF), optionLabeled("energy"), spendHand(spend));
    expect(amountsTo(events, rhino)).toEqual([1]);
    expect(inst(run.state, rhino).damage).toBe(1);
  });

  it("replay: the same commands from the initial state reach a deep-equal state and the same events", () => {
    const added = withMinion(setupGame(), "01132");
    // Every card staged up front, so the log holds only commands: Cyclops with both Strengths, Finale with E, M, PH.
    const staged = stageHand(added.state, CYCLOPS, STRENGTH, STRENGTH, FINALE, E, M, PH);
    const run = begin(staged.state);
    const rhino = villainOf(run.state);
    const [cyclops, s1, s2, finale, e, m, ph] = staged.ids as [InstanceId, ...InstanceId[]];
    step(run, play(cyclops, [s1!, s2!]), accept(CYCLOPS_REF), targetsInOrder(rhino));
    const events = step(run, play(finale!, [e!, m!, ph!]), targetsInOrder(rhino, added.id, rhino, added.id));
    expect(events.length).toBeGreaterThan(0);
    const replayed = applyCommands(run.start, run.commands, DEPS);
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;
    expect(replayed.state).toEqual(run.state);
    expect(replayed.events).toEqual(run.events);
  });
});
