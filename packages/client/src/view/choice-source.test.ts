/**
 * `choiceSourceOf`/`choiceHeaderText`, checked against a real game wherever a
 * real one can reach the case, and against hand-built `StackFrame`s (the same
 * pattern `ability-label.test.ts` uses for a fixture `AbilityDefinition`)
 * for the `StackFrame` kinds a short scripted game doesn't happen to visit.
 *
 * The headline case is the reported bug: after paying for Doctor Strange's
 * Spell Mastery, the `chooseTarget` prompt for Crimson Bands of Cyttorak's
 * own "Special: Stun an enemy…" named nothing — `promptTitle` alone said
 * "Choose a target". Seed 439 (found by brute search, same convention as
 * `board-model-invocation.test.ts`) deals Crimson Bands of Cyttorak
 * (`09032`) to the top of the Invocation deck.
 */

import { describe, expect, test } from "vitest";
import { activeVillain, choiceId, frameId, type GameState, type PendingChoice, type StackFrame } from "@mc/engine";
import { abilityId } from "@mc/content";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { cardName } from "./names.js";
import { choiceHeaderInstanceId, choiceHeaderText, choiceSourceOf } from "./choice-source.js";

describe("choiceSourceOf: a real Doctor Strange game", () => {
  test("names Crimson Bands of Cyttorak's own Special, not just 'choose a target' — the reported bug", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "drs-protection" }],
      seed: 439,
    });
    for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
      const { choice } = store.state.legal.actions as {
        choice: { options: readonly { optionId: string }[]; minSelections: number };
      };
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
    }
    let legal = store.state.legal!.actions;
    if (legal.kind === "turn") {
      const flip = legal.legal.find((e) => e.action.kind === "changeForm");
      if (flip) await store.dispatch(flip.example);
    }
    legal = store.state.legal!.actions;
    if (legal.kind !== "turn") throw new Error("expected a turn");
    const spellMastery = legal.legal.find(
      (e) => e.action.kind === "useAbility" && e.action.abilityId === "09001a.spell-mastery",
    );
    if (!spellMastery) throw new Error("expected Spell Mastery to be usable");
    await store.dispatch(spellMastery.example);

    const afterLegal = store.state.legal?.actions;
    if (afterLegal?.kind !== "choice" || afterLegal.choice.prompt.kind !== "chooseTarget") {
      throw new Error(`expected a pending chooseTarget, got ${afterLegal?.kind}`);
    }
    const { choice } = afterLegal;
    const state = store.state.game!;

    // The engine itself sends no ability id for this prompt — the actual bug this module works around client-side.
    expect(choice.prompt.kind).toBe("chooseTarget");
    expect((choice.prompt as { abilityId: unknown }).abilityId).toBeNull();

    const source = choiceSourceOf(state, choice);
    expect(source).not.toBeNull();
    expect(cardName(state, source!.instanceId)).toBe("Crimson Bands of Cyttorak");
    expect(source!.abilityId).toBe(abilityId("09032.crimson-bands-of-cyttorak-special"));

    expect(choiceHeaderInstanceId(state, choice)).toBe(source!.instanceId);
    expect(choiceHeaderText(state, choice, POOL_DEPS, "Choose a target")).toBe(
      "Crimson Bands of Cyttorak — Special: choose a target",
    );
  });
});

describe("choiceSourceOf: direct-from-prompt kinds (no stack lookup needed)", () => {
  const BASE: Omit<PendingChoice, "prompt"> = {
    choiceId: choiceId("c1"),
    playerId: "p1" as never,
    minSelections: 0,
    maxSelections: 1,
    options: [],
    frameId: null,
    ordered: false,
    soleDecider: false,
    authority: "player",
  };

  test("payForCard names its own instance and ability directly", () => {
    const state = { stack: [] } as unknown as GameState;
    const choice: PendingChoice = {
      ...BASE,
      prompt: { kind: "payForCard", instanceId: "i1" as never, abilityId: "a1" as never, cost: 1 },
    };
    expect(choiceSourceOf(state, choice)).toEqual({ instanceId: "i1", abilityId: "a1" });
  });

  test("payForAbility names its own instance and ability directly", () => {
    const state = { stack: [] } as unknown as GameState;
    const choice: PendingChoice = {
      ...BASE,
      prompt: { kind: "payForAbility", instanceId: "i2" as never, abilityId: "a2" as never, cost: 1 },
    };
    expect(choiceSourceOf(state, choice)).toEqual({ instanceId: "i2", abilityId: "a2" });
  });

  test("declareDefender names the attacking enemy from prompt.attack", () => {
    const state = { stack: [] } as unknown as GameState;
    const choice: PendingChoice = {
      ...BASE,
      prompt: {
        kind: "declareDefender",
        attack: {
          enemyInstanceId: "i3" as never,
          targetPlayerId: "p1" as never,
          targetCharacterInstanceId: "i4" as never,
        },
      },
    };
    expect(choiceSourceOf(state, choice)).toEqual({ instanceId: "i3", abilityId: null });
  });

  test("a phase-owned choice (frameId null, no direct prompt fields) has no source", () => {
    const state = { stack: [] } as unknown as GameState;
    const choice: PendingChoice = { ...BASE, prompt: { kind: "mulligan", handSize: 5 } };
    expect(choiceSourceOf(state, choice)).toBeNull();
  });

  test("a frameId naming nothing on the (empty) stack has no source", () => {
    const state = { stack: [] } as unknown as GameState;
    const choice: PendingChoice = {
      ...BASE,
      frameId: frameId("gone"),
      prompt: { kind: "chooseTarget", slot: "x", abilityId: null },
    };
    expect(choiceSourceOf(state, choice)).toBeNull();
  });
});

describe("choiceSourceOf: derived from state.stack", () => {
  async function realState(): Promise<GameState> {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 2026,
    });
    return store.state.game!;
  }

  const choiceOn = (frame: StackFrame, promptSlot = "x"): PendingChoice => ({
    choiceId: choiceId("c1"),
    playerId: "p1" as never,
    minSelections: 0,
    maxSelections: 1,
    options: [],
    frameId: frame.frameId,
    ordered: false,
    soleDecider: false,
    authority: "player",
    prompt: { kind: "chooseTarget", slot: promptSlot, abilityId: null },
  });

  test("an 'ability' frame names its own instance and ability exactly", async () => {
    const state = await realState();
    const villain = activeVillain(state).instanceId;
    const frame = {
      frameId: frameId("f1"),
      answer: null,
      kind: "ability",
      instanceId: villain,
      abilityId: abilityId("01001a.spider-sense"),
      controllerId: "p1" as never,
      event: null,
      eventFrameId: null,
      bindings: {},
      vars: {},
    } as StackFrame;
    const withFrame = { ...state, stack: [frame] };
    expect(choiceSourceOf(withFrame, choiceOn(frame))).toEqual({
      instanceId: villain,
      abilityId: abilityId("01001a.spider-sense"),
    });
  });

  test("an 'effects' frame with exactly one currently active ability deduces it — not a guess, there is nothing else it could be", async () => {
    const state = await realState();
    // Spider-Man's identity names exactly one ability per face (`ability-label.test.ts` relies on the same fact).
    const identity = state.players[0]!.identity.instanceId;
    const frame = {
      frameId: frameId("f2"),
      answer: null,
      kind: "effects",
      effects: [],
      cursor: 0,
      bindings: {},
      vars: {},
      scopedPlayerId: null,
      selfInstanceId: identity,
      controllerId: null,
      event: null,
      eventFrameId: null,
    } as StackFrame;
    const withFrame = { ...state, stack: [frame] };
    const source = choiceSourceOf(withFrame, choiceOn(frame));
    expect(source?.instanceId).toBe(identity);
    // Whatever Spider-Man's one live ability is right now, it's not null — and it's the one this card can
    // actually be resolving, not a guess among several.
    expect(source?.abilityId).not.toBeNull();
  });

  test("an 'effects' frame with no selfInstanceId (a player-scoped effect) has no source", async () => {
    const state = await realState();
    const frame = {
      frameId: frameId("f3"),
      answer: null,
      kind: "effects",
      effects: [],
      cursor: 0,
      bindings: {},
      vars: {},
      scopedPlayerId: null,
      selfInstanceId: null,
      controllerId: null,
      event: null,
      eventFrameId: null,
    } as StackFrame;
    const withFrame = { ...state, stack: [frame] };
    expect(choiceSourceOf(withFrame, choiceOn(frame))).toBeNull();
  });

  test("a 'window' frame names whichever candidate is currently being asked (paying, then pending, then queue)", async () => {
    const state = await realState();
    const villain = activeVillain(state).instanceId;
    const candidate = {
      instanceId: villain,
      abilityId: abilityId("test.window"),
      controllerId: "p1" as never,
      forced: false,
      fromHand: false,
    };
    const frame = {
      frameId: frameId("f4"),
      answer: null,
      kind: "window",
      event: { kind: "roundStarted" } as never,
      timing: "response",
      eventFrameId: null,
      tierIndex: 0,
      queue: [],
      askingPlayerIds: [],
      pending: [],
      awaiting: "pay",
      paying: candidate,
    } as StackFrame;
    const withFrame = { ...state, stack: [frame] };
    expect(choiceSourceOf(withFrame, choiceOn(frame))).toEqual({
      instanceId: villain,
      abilityId: abilityId("test.window"),
    });
  });

  test("an 'enemyAttack' frame names the activating enemy", async () => {
    const state = await realState();
    const villain = activeVillain(state).instanceId;
    const frame = {
      frameId: frameId("f5"),
      answer: null,
      kind: "enemyAttack",
      enemyInstanceId: villain,
      attackedPlayerId: "p1" as never,
      targetPlayerId: "p1" as never,
      targetInstanceId: villain,
      defenderInstanceId: null,
      basicDefense: false,
      boostIcons: 0,
      stage: "dealDamage",
      eventFrameId: null,
    } as StackFrame;
    const withFrame = { ...state, stack: [frame] };
    expect(choiceSourceOf(withFrame, choiceOn(frame))).toEqual({ instanceId: villain, abilityId: null });
  });

  test("a 'playCard' frame names the played card and its triggered ability, when one is set", async () => {
    const state = await realState();
    const me = state.players[0]!;
    const cardInHand = me.hand[0]!;
    const frame = {
      frameId: frameId("f6"),
      answer: null,
      kind: "playCard",
      instanceId: cardInHand,
      playerId: "p1" as never,
      controllerId: "p1" as never,
      attachToInstanceId: null,
      stage: "effects",
      effectsCancelled: false,
      triggeredAbilityId: abilityId("test.triggered"),
      event: null,
      eventFrameId: null,
      bindings: {},
      vars: {},
    } as StackFrame;
    const withFrame = { ...state, stack: [frame] };
    expect(choiceSourceOf(withFrame, choiceOn(frame))).toEqual({
      instanceId: cardInHand,
      abilityId: abilityId("test.triggered"),
    });
  });

  test("a 'damageGroup' frame has no single source", async () => {
    const state = await realState();
    const frame = {
      frameId: frameId("f7"),
      answer: null,
      kind: "damageGroup",
      members: [],
      stage: "apply",
      cursor: 0,
      reportTo: null,
    } as StackFrame;
    const withFrame = { ...state, stack: [frame] };
    expect(choiceSourceOf(withFrame, choiceOn(frame))).toBeNull();
  });
});

describe("choiceHeaderText", () => {
  test("falls back to the generic title unchanged when nothing can be derived", () => {
    const state = { stack: [] } as unknown as GameState;
    const choice: PendingChoice = {
      choiceId: choiceId("c1"),
      playerId: "p1" as never,
      minSelections: 0,
      maxSelections: 1,
      options: [],
      frameId: null,
      ordered: false,
      soleDecider: false,
      authority: "player",
      prompt: { kind: "mulligan", handSize: 5 },
    };
    expect(choiceHeaderText(state, choice, POOL_DEPS, "Mulligan")).toBe("Mulligan");
  });
});
