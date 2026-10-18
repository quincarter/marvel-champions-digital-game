import { FNE_STARTER_DECKS, PLAYABLE_CARDS, cardId, type UpgradeCard } from "@mc/content";
import { applyCommand, createGame, separateDeckOf, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import { coreScenario } from "../../../core/setup.js";
import { P1, firstLegal, identityOf, inst, settle, use, type Picker } from "../../../testing/harness.js";
import { defeatWithAttack, withForm } from "../../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../../wave9/falcon/testing.js";
import { WAVE11_DEPS } from "../../index.js";
import { FNE_DAREDEVIL_IDENTITY as REGISTRY, FNE_DAREDEVIL_IDENTITY_SKIPPED as SKIPPED } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Daredevil (60001a hero face, 60001b Matt Murdock) against Core's Rhino, docs/phase7-wave11.md §3.1 to §3.3 and §8.4
 * line 1. The printed starter deck `fne-daredevil-justice` with its Sense deck (60002 to 60006, fixed order). Hero
 * face: THW 2, ATK 2, DEF 2, hand size 5, 10 hit points; alter-ego face: REC 3, hand size 6.
 *
 * Sources: the scan (Action "Superhuman Senses"; the Forced Interrupt printed on both faces); MC60 p. 26 (the Sense
 * deck); RRG 1.8 "Play, Put Into Play" (p. 32), "Replacement Effect" (p. 37) and "'Would'" (p. 48).
 */
const ACTION = "60001a.superhuman-senses";
const HERO_INTERRUPT = "60001a.daredevil-forced-interrupt";
const ALTER_EGO_INTERRUPT = "60001b.matt-murdock-forced-interrupt";
const ALTER_EGO_CONSTANT = "60001b.matt-murdock-constant";
const SENSE_CODES = ["60002", "60003", "60004", "60005", "60006"];

function newGame(seed = 1): GameState {
  const deck = FNE_STARTER_DECKS.find((d) => d.id === "fne-daredevil-justice")!;
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const seat = {
    identityCardId: deck.identityCardId,
    aspects: deck.aspects,
    deck: deck.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
  };
  const created = createGame({ ...config, players: [seat] }, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
}

const heroGame = (seed = 1): GameState => withForm(newGame(seed), { heroForm: 0 });
const senseDeck = (s: GameState) => separateDeckOf(s, P1, "Sense").deck;
const codesOf = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((i) => inst(s, i).cardId as string);
const costOf = (code: string): number =>
  (PLAYABLE_CARDS.find((c) => c.id === cardId(code)) as UpgradeCard).cost as number;

/** Gives the player exactly `n` cards in hand (the rest to the deck's top), so payment is a known set. */
function withHand(s: GameState, n: number): GameState {
  const owner = s.players.find((p) => p.playerId === P1)!;
  const all = [...owner.hand, ...owner.deck];
  return {
    ...s,
    players: s.players.map((p) => (p.playerId === P1 ? { ...p, hand: all.slice(0, n), deck: all.slice(n) } : p)),
  };
}

/** Pays a play's cost with the first offered card and puts the upgrade on the first legal host. */
const payAndAttach: Picker = (s) => {
  const choice = s.pendingChoice;
  if (choice?.prompt.kind === "spendResources" && choice.options[0]) return [choice.options[0].optionId];
  if (choice?.prompt.kind === "chooseTarget" && choice.options[0]) return [choice.options[0].optionId];
  return firstLegal(s);
};

const useAction = (s: GameState) => use(P1, identityOf(s), ACTION);

function superhumanSenses(s: GameState, pick: Picker = payAndAttach): { state: GameState; events: GameEvent[] } {
  const result = applyCommand(s, useAction(s), WAVE11_DEPS);
  if (!result.ok) throw new Error(result.error.message);
  const events = [...result.events];
  let state = result.state;
  for (let guard = 0; state.pendingChoice && guard < 50; guard++) {
    const next = applyCommand(
      state,
      {
        type: "resolveChoice",
        playerId: state.pendingChoice.playerId,
        choiceId: state.pendingChoice.choiceId,
        selectedOptionIds: pick(state),
      },
      WAVE11_DEPS,
    );
    if (!next.ok) throw new Error(next.error.message);
    events.push(...next.events);
    state = next.state;
  }
  return { state, events };
}

describe("wave 11 fne/daredevil/identity", () => {
  it("registers only valid definitions", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
  });

  it("scripts all four refs of 60001a/b, so nothing is skipped", () => {
    expect(Object.keys(REGISTRY).sort()).toEqual(
      [ACTION, ALTER_EGO_CONSTANT, ALTER_EGO_INTERRUPT, HERO_INTERRUPT].sort(),
    );
    expect(SKIPPED).toEqual({});
  });

  it("begins the game with the Sense deck: all five Sense upgrades (Superhuman Senses never reorders it)", () => {
    const deck = senseDeck(newGame());
    expect(codesOf(newGame(), deck).sort()).toEqual(SENSE_CODES);
    expect(codesOf(newGame(7), senseDeck(newGame(7))).sort()).toEqual(SENSE_CODES);
  });

  it("Superhuman Senses plays the top Sense upgrade, paying its cost; the next card becomes the top", () => {
    const start = withHand(heroGame(), 3);
    const before = senseDeck(start);
    const top = before[0]!;
    const { state, events } = superhumanSenses(start);
    expect(senseDeck(state)).toEqual(before.slice(1));
    const host = inst(state, top).attachedTo;
    expect(host).toBeDefined();
    expect(inst(state, host!).attachments).toContain(top);
    const played = events.find((e) => e.type === "cardPlayed") as unknown as
      | { instanceId: InstanceId; from?: string; countsAsFrom?: string; resourcesPaid?: number }
      | undefined;
    expect(played).toMatchObject({ instanceId: top, from: "separateDeck", countsAsFrom: "hand" });
    expect(played?.resourcesPaid).toBe(costOf(codesOf(start, [top])[0]!));
    expect(state.players.find((p) => p.playerId === P1)!.hand).toHaveLength(3 - played!.resourcesPaid!);
  });

  it("is not offered when the hero cannot pay the top card's cost", () => {
    const poor = withHand(heroGame(), 0);
    const result = applyCommand(poor, useAction(poor), WAVE11_DEPS);
    expect(result.ok).toBe(false);
    expect(senseDeck(poor)).toHaveLength(5);
  });

  it("is not available on the Matt Murdock face (the Action is printed on the hero face)", () => {
    const alterEgo = withHand(newGame(), 3);
    expect(applyCommand(alterEgo, useAction(alterEgo), WAVE11_DEPS).ok).toBe(false);
  });

  it("a Sense upgrade leaving with its defeated host goes to the bottom of the Sense deck, not the discard", () => {
    const MINION = "m-sandman";
    const staged = withHand(engageMinion(heroGame(), "01102", MINION), 3);
    const before = senseDeck(staged);
    const top = before[0]!;
    const onMinion: Picker = (s) => {
      const choice = s.pendingChoice;
      const minion = choice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === (MINION as InstanceId));
      return choice?.prompt.kind === "chooseTarget" && minion ? [minion.optionId] : payAndAttach(s);
    };
    const { state: attached } = superhumanSenses(staged, onMinion);
    expect(inst(attached, top).attachedTo).toBe(MINION);
    expect(senseDeck(attached)).toEqual(before.slice(1));

    const after = defeatWithAttack(WAVE11_DEPS, attached, MINION as InstanceId);
    expect(after.players.find((p) => p.playerId === P1)!.playArea).not.toContain(MINION);
    // Replaced, not discarded: it is the last card of the Sense deck and in nobody's discard pile.
    expect(senseDeck(after)).toEqual([...before.slice(1), top]);
    expect(after.players.find((p) => p.playerId === P1)!.discard).not.toContain(top);
    expect(inst(after, top).attachedTo).toBeNull();
  });

  it("prints the same Forced Interrupt on both faces: one definition, the Sense deck's bottom", () => {
    expect(REGISTRY[ALTER_EGO_INTERRUPT]).toEqual(REGISTRY[HERO_INTERRUPT]);
    expect(REGISTRY[HERO_INTERRUPT]).toMatchObject({
      trigger: { kind: "interrupt", forced: true },
      effects: [{ kind: "replaceLeaveDestination", to: { separateDeck: "Sense", at: "bottom" } }],
    });
  });

  const replacedByInterrupt = (form: "hero" | "alterEgo") => {
    const MINION = "m-sandman2";
    const staged = withHand(engageMinion(heroGame(), "01102", MINION), 3);
    const top = senseDeck(staged)[0]!;
    const onMinion: Picker = (s) => {
      const choice = s.pendingChoice;
      const minion = choice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === (MINION as InstanceId));
      return choice?.prompt.kind === "chooseTarget" && minion ? [minion.optionId] : payAndAttach(s);
    };
    const { state: attached } = superhumanSenses(staged, onMinion);
    // Alter-ego: Matt Murdock cannot attack, so his ally Elektra (60007) defeats the minion.
    const withAlly = form === "alterEgo" ? stagedInPlay(withForm(attached, "alterEgo"), "60007") : undefined;
    const base = withAlly?.state ?? attached;
    const near = {
      ...base,
      instances: { ...base.instances, [MINION]: { ...inst(base, MINION as InstanceId), damage: 999 } },
    };
    const hit = applyCommand(
      near,
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: withAlly?.id ?? identityOf(near),
        targetInstanceId: MINION as InstanceId,
      },
      WAVE11_DEPS,
    );
    if (!hit.ok) throw new Error(hit.error.message);
    const events: GameEvent[] = [...hit.events];
    let state = hit.state;
    for (let guard = 0; state.pendingChoice && guard < 50; guard++) {
      const next = applyCommand(
        state,
        {
          type: "resolveChoice",
          playerId: state.pendingChoice.playerId,
          choiceId: state.pendingChoice.choiceId,
          selectedOptionIds: firstLegal(state),
        },
        WAVE11_DEPS,
      );
      if (!next.ok) throw new Error(next.error.message);
      events.push(...next.events);
      state = next.state;
    }
    expect(state.players.find((p) => p.playerId === P1)!.identity.form).toBe(form);
    expect(events.filter((e) => e.type === "returnedToSeparateDeck")).toMatchObject([
      { instanceId: top, name: "Sense", replaced: true },
    ]);
    expect(events.filter((e) => e.type === "returnedToSeparateDeck")).toHaveLength(1);
    expect(senseDeck(state).at(-1)).toBe(top);
  };

  it("the bottom placement is the hero-face Forced Interrupt's replacement, not the discard-pile backstop", () => {
    replacedByInterrupt("hero");
  });

  it("the alter-ego face's Forced Interrupt does the same when an ally defeats the host", () => {
    replacedByInterrupt("alterEgo");
  });
});
