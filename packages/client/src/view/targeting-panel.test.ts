/**
 * The targeting panel's wording, against hand-built `OutcomePreview` fixtures — `preview()`'s own correctness is
 * the engine's job (`packages/engine/src/preview.test.ts`); this only proves the panel words what `preview` already
 * said correctly, without restating a rule. A real-engine integration test at the bottom proves the wiring itself:
 * that `targetingPanelOf` builds the same command a dispatch would and reads a real `preview()` result.
 */

import { describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import type { CardId } from "@mc/content";
import {
  legalActions,
  preview,
  type BlockedTarget,
  type ChoiceExclusion,
  type Command,
  type CounterSnapshot,
  type GameEvent,
  type GameState,
  type InstanceId,
  type OutcomePreview,
} from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import type { SessionConfig } from "../engine/host.js";
import { SessionStore } from "../store/session-store.js";
import { EXCLUSION_TEST_ONLY } from "./highlights.js";
import { cardName } from "./names.js";
import {
  excludedGroupsOf,
  groupBlockedByMessage,
  groupExclusionsByCode,
  outcomeLines,
  targetingPanelOf,
} from "./targeting-panel.js";

const id = (value: string): InstanceId => value as InstanceId;
const nameOf =
  (map: Record<string, string>) =>
  (instanceId: InstanceId): string =>
    map[instanceId] ?? instanceId;

const snapshot = (overrides: Partial<CounterSnapshot> = {}): CounterSnapshot => ({
  inPlay: true,
  damage: 0,
  remainingHitPoints: null,
  maxHitPoints: null,
  threat: null,
  threatLimit: null,
  exhausted: false,
  statuses: { stunned: 0, confused: 0, tough: 0 },
  ...overrides,
});

const complete = (events: readonly GameEvent[], counters: OutcomePreview["counters"]): OutcomePreview => ({
  stop: { kind: "complete" },
  events,
  counters,
  outcome: null,
});

describe("outcomeLines", () => {
  test("a survivable hit: before HP → after HP, nothing else", () => {
    const target = id("klaw");
    const result = complete(
      [{ type: "damageDealt", targetInstanceId: target, amount: 5, sourceInstanceId: null }],
      [
        {
          instanceId: target,
          before: snapshot({ remainingHitPoints: 14, maxHitPoints: 22 }),
          after: snapshot({ remainingHitPoints: 9, maxHitPoints: 22 }),
        },
      ],
    );
    expect(outcomeLines(result, nameOf({}), target)).toEqual(["14 HP → 9 HP"]);
  });

  test("a lethal hit with Overkill: defeated, then the spillover", () => {
    const target = id("runner");
    const other = id("villain");
    const result = complete(
      [
        { type: "damageDealt", targetInstanceId: target, amount: 5, sourceInstanceId: null },
        { type: "characterDefeated", instanceId: target, cardId: "runner-card" as CardId },
        { type: "overkillSpilled", fromInstanceId: target, toInstanceId: other, amount: 2 },
      ],
      [
        {
          instanceId: target,
          before: snapshot({ remainingHitPoints: 3, maxHitPoints: 3 }),
          after: snapshot({ inPlay: false, remainingHitPoints: null, maxHitPoints: 3 }),
        },
        {
          instanceId: other,
          before: snapshot({ remainingHitPoints: 14, maxHitPoints: 22 }),
          after: snapshot({ remainingHitPoints: 14, maxHitPoints: 22 }),
        },
      ],
    );
    // Klaw's own HP is unaffected by this preview (before === after), so it earns no line of its own — only the
    // target that was actually hit does.
    expect(outcomeLines(result, nameOf({}), target)).toEqual(["3 HP → Defeated", "Overkill: 2 spills over."]);
  });

  test("a lethal hit with no Overkill: the excess is honestly reported as lost, not spilled", () => {
    const target = id("runner");
    const result = complete(
      [
        { type: "damageDealt", targetInstanceId: target, amount: 5, sourceInstanceId: null },
        { type: "characterDefeated", instanceId: target, cardId: "runner-card" as CardId },
      ],
      [
        {
          instanceId: target,
          before: snapshot({ remainingHitPoints: 2, maxHitPoints: 2 }),
          after: snapshot({ inPlay: false, remainingHitPoints: null, maxHitPoints: 2 }),
        },
      ],
    );
    expect(outcomeLines(result, nameOf({}), target)).toEqual(["2 HP → Defeated", "No overkill, so 3 was lost."]);
  });

  test("Toughness absorbs the hit: no HP change, the token spent instead", () => {
    const target = id("she-hulk");
    const result = complete(
      [{ type: "damagePrevented", targetInstanceId: target, amount: 3, reason: "tough" }],
      [
        {
          instanceId: target,
          before: snapshot({ remainingHitPoints: 7, maxHitPoints: 12 }),
          after: snapshot({ remainingHitPoints: 7, maxHitPoints: 12 }),
        },
      ],
    );
    expect(outcomeLines(result, nameOf({}), target)).toEqual(["Toughness absorbed it."]);
  });

  test("a scheme cleared to 0 reads as cleared, not '0 threat'", () => {
    const target = id("side-scheme");
    const result = complete(
      [{ type: "schemeDefeated", instanceId: target, cardId: "side-scheme-card" as CardId }],
      [{ instanceId: target, before: snapshot({ threat: 4 }), after: snapshot({ inPlay: false, threat: 0 }) }],
    );
    expect(outcomeLines(result, nameOf({}), target)).toEqual(["Cleared."]);
  });

  test("a scheme merely thwarted: before threat → after threat", () => {
    const target = id("side-scheme");
    const result = complete(
      [],
      [{ instanceId: target, before: snapshot({ threat: 5 }), after: snapshot({ threat: 2 }) }],
    );
    expect(outcomeLines(result, nameOf({}), target)).toEqual(["5 threat → 2 threat"]);
  });

  test("a second instance the effect also named is prefixed with its own name; the primary target is not", () => {
    const primary = id("t1");
    const secondary = id("t2");
    const result = complete(
      [
        { type: "damageDealt", targetInstanceId: primary, amount: 6, sourceInstanceId: null },
        { type: "damageDealt", targetInstanceId: secondary, amount: 2, sourceInstanceId: null },
      ],
      [
        {
          instanceId: primary,
          before: snapshot({ remainingHitPoints: 6, maxHitPoints: 6 }),
          after: snapshot({ inPlay: false, remainingHitPoints: null, maxHitPoints: 6 }),
        },
        {
          instanceId: secondary,
          before: snapshot({ remainingHitPoints: 3, maxHitPoints: 3 }),
          after: snapshot({ remainingHitPoints: 1, maxHitPoints: 3 }),
        },
      ],
    );
    expect(outcomeLines(result, nameOf({ t2: "Weapons Runner" }), primary)).toEqual([
      "6 HP → Defeated",
      "Weapons Runner: 3 HP → 1 HP",
    ]);
  });

  test("a rejected preview reports only the engine's own message — no counters, no caveat", () => {
    const target = id("klaw");
    const result: OutcomePreview = {
      stop: {
        kind: "rejected",
        reason: "no_valid_target",
        message: "a guard minion blocks attacks against the villain",
      },
      events: [],
      counters: [],
      outcome: null,
    };
    expect(outcomeLines(result, nameOf({}), target)).toEqual(["a guard minion blocks attacks against the villain"]);
  });

  test("hidden information truncation adds the honest caveat, after whatever was certain", () => {
    const target = id("deck-search");
    const result: OutcomePreview = {
      stop: { kind: "hiddenInformation", at: "cardMoved" },
      events: [{ type: "damageDealt", targetInstanceId: target, amount: 2, sourceInstanceId: null }],
      counters: [
        {
          instanceId: target,
          before: snapshot({ remainingHitPoints: 5, maxHitPoints: 5 }),
          after: snapshot({ remainingHitPoints: 3, maxHitPoints: 5 }),
        },
      ],
      outcome: null,
    };
    expect(outcomeLines(result, nameOf({}), target)).toEqual(["5 HP → 3 HP", "Depends on hidden cards."]);
  });

  test("an optional response window stop reads as 'if nobody responds'", () => {
    const target = id("klaw");
    const result: OutcomePreview = {
      stop: {
        kind: "choice",
        playerId: id("p1") as unknown as never,
        prompt: { kind: "chooseTriggers", event: {} as never, timing: "interrupt" as never },
        soleDecider: false,
      },
      events: [{ type: "damageDealt", targetInstanceId: target, amount: 5, sourceInstanceId: null }],
      counters: [
        {
          instanceId: target,
          before: snapshot({ remainingHitPoints: 14, maxHitPoints: 22 }),
          after: snapshot({ remainingHitPoints: 9, maxHitPoints: 22 }),
        },
      ],
      outcome: null,
    };
    expect(outcomeLines(result, nameOf({}), target)).toEqual(["14 HP → 9 HP", "If nobody responds."]);
  });

  test("a nested target choice reads as '…then you'll choose a target'", () => {
    const target = id("klaw");
    const result: OutcomePreview = {
      stop: {
        kind: "choice",
        playerId: id("p1") as unknown as never,
        prompt: { kind: "chooseTarget", slot: "second", abilityId: null },
        soleDecider: false,
      },
      events: [],
      counters: [],
      outcome: null,
    };
    expect(outcomeLines(result, nameOf({}), target)).toEqual(["…then you'll choose a target."]);
  });

  test("no change at all reads as no lines, so the caller can fall back to a neutral confirm line", () => {
    const target = id("villain");
    const result = complete(
      [],
      [
        {
          instanceId: target,
          before: snapshot({ remainingHitPoints: 14, maxHitPoints: 22 }),
          after: snapshot({ remainingHitPoints: 14, maxHitPoints: 22 }),
        },
      ],
    );
    expect(outcomeLines(result, nameOf({}), target)).toEqual([]);
  });
});

describe("groupBlockedByMessage", () => {
  test("groups by the engine's own message, not its coarse reason code", () => {
    const blocked: readonly BlockedTarget[] = [
      { instanceId: id("runner"), reason: "no_valid_target", message: "not engaged with you" },
      { instanceId: id("enforcer"), reason: "no_valid_target", message: "not engaged with you" },
      {
        instanceId: id("klaw"),
        reason: "no_valid_target",
        message: "a guard minion blocks attacks against the villain",
      },
    ];
    const groups = groupBlockedByMessage(
      blocked,
      nameOf({ runner: "Weapons Runner", enforcer: "Sonic Enforcer", klaw: "Klaw" }),
    );
    expect(groups).toEqual([
      { code: "no_valid_target", label: "not engaged with you", names: ["Weapons Runner", "Sonic Enforcer"] },
      { code: "no_valid_target", label: "a guard minion blocks attacks against the villain", names: ["Klaw"] },
    ]);
  });

  test("empty when nothing was blocked — honestly empty, never a fabricated reason", () => {
    expect(groupBlockedByMessage([], nameOf({}))).toEqual([]);
  });
});

describe("groupExclusionsByCode / excludedGroupsOf", () => {
  test("groups by code and words each through highlights.ts's table", () => {
    const exclusions: readonly ChoiceExclusion[] = [
      { instanceId: id("minion1"), reason: "notEngagedWithYou" },
      { instanceId: id("minion2"), reason: "notEngagedWithYou" },
      { instanceId: id("ally"), reason: "wrongCategory" },
    ];
    const groups = groupExclusionsByCode(
      exclusions,
      nameOf({ minion1: "Minion 1", minion2: "Minion 2", ally: "Ally" }),
    );
    expect(groups).toEqual([
      { code: "notEngagedWithYou", label: "not engaged with you", names: ["Minion 1", "Minion 2"] },
      { code: "wrongCategory", label: "not the right kind of card", names: ["Ally"] },
    ]);
  });

  test("every ExclusionCode the engine can return has a wording — highlights.ts's table can't drift silently out of sync", () => {
    for (const code of EXCLUSION_TEST_ONLY.codes) {
      expect(EXCLUSION_TEST_ONLY.wording(code)).not.toBe("not a legal target");
    }
  });
});

describe("targetingPanelOf, against a real engine game", () => {
  const RHINO_SOLO: SessionConfig = {
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 4,
  };

  /** Plays past setup and flips to hero, the same as `payment-model.test.ts`'s own fixture. */
  async function intoTurn(): Promise<GameState> {
    const store = new SessionStore(new LocalEngineHost());
    await store.start(RHINO_SOLO);
    for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
      const { choice } = store.state.legal.actions as {
        choice: { options: readonly { optionId: string }[]; minSelections: number };
      };
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
    }
    const legal = store.state.legal?.actions;
    if (legal?.kind === "turn") {
      const flip = legal.legal.find((entry) => entry.action.kind === "changeForm");
      if (flip) await store.dispatch(flip.example);
    }
    return store.state.game!;
  }

  test("builds a panel from a real LegalAction: one option per legal target, each a real preview, nothing computed itself", async () => {
    const state = await intoTurn();
    const actions = legalActions(state, state.players[0]!.playerId, CORE_DEPS);
    if (actions.kind !== "turn") throw new Error("expected a turn");
    const attack = actions.legal.find((entry) => entry.action.kind === "basicAttack");
    if (!attack) throw new Error("expected a legal basic attack");
    expect(attack.targets.length).toBeGreaterThan(0);

    // The same re-aiming `scenes/board/selection.ts`'s `retarget` does for a `basicAttack`, inlined here so this
    // test doesn't reach into `scenes/` from `view/` (the module itself never does either — see its own doc comment).
    const retargetAttack = (target: InstanceId): Command =>
      attack.example.type === "basicAttack" ? { ...attack.example, targetInstanceId: target } : attack.example;

    if (attack.action.kind !== "basicAttack") throw new Error("expected a basicAttack action ref");
    const panel = targetingPanelOf(
      state,
      attack,
      {
        label: "Test Hero — Attack",
        name: cardName(state, attack.action.instanceId),
        instanceId: attack.action.instanceId,
      },
      retargetAttack,
      CORE_DEPS,
    );

    expect(panel.options.map((option) => option.instanceId).sort()).toEqual([...attack.targets].sort());
    for (const option of panel.options) {
      // Every option's outcome is exactly what a direct `preview()` of the same command says — the panel added no
      // arithmetic of its own on top of it.
      const direct = preview(state, retargetAttack(option.instanceId), CORE_DEPS);
      expect(option.lines).toEqual(outcomeLines(direct, (id2) => cardName(state, id2), option.instanceId));
      expect(option.confirmLine.length).toBeGreaterThan(0);
    }
    // Whatever the engine couldn't legally aim this at is grouped, never silently dropped.
    const blockedNames = panel.excluded.flatMap((group) => group.names);
    expect(blockedNames.length).toBe(attack.blockedTargets.length);
  });

  test("excludedGroupsOf resolves names off the real GameState", async () => {
    const state = await intoTurn();
    const villainId = state.villains[0]!.instanceId;
    const exclusions: readonly ChoiceExclusion[] = [{ instanceId: villainId, reason: "wrongCategory" }];
    expect(excludedGroupsOf(state, exclusions)).toEqual([
      { code: "wrongCategory", label: "not the right kind of card", names: [cardName(state, villainId)] },
    ]);
  });
});
