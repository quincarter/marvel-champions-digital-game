/**
 * `trigger.would` on an interrupt (docs/phase7-wave7.md §4.1, owner ruling 2026-10-06), proven with synthetic cards
 * shaped like Hope's Captor ("When the villain would attack you, … the villain schemes instead") against a villain's
 * own "Forced Interrupt: When [this villain] attacks you, …".
 *
 * RRG 1.8 "'Would'" (p. 48): the word "establishes a higher timing priority for those abilities than interrupts to the
 * same triggering condition without the word 'would'", and once one "changes the nature of that which is about to occur
 * (such as through a replacement effect), no further interrupts to the original trigger may be used". So the attack's
 * interrupt window resolves its "would" interrupts first, forced then optional and ordered among themselves as any tier
 * is, and only then gathers the others; the first player is never asked to order one kind against the other.
 */

import { flat, type AbilityReference, type AnyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_DECK, defaultPick, giveCard, newGame } from "./testing/scenario.js";

const p1 = playerId("p1");

const abilities: StubAbility[] = [];
const ability = (id: string, definition: AbilityDefinition): AbilityReference => {
  const stub = stubAbility(id, definition);
  abilities.push(stub);
  return stub.ref;
};
/** A mark on the main scheme, so the state as well as the log shows what resolved. */
const mark = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "each", query: { categories: ["mainScheme"] } },
  counterType,
  amount: { kind: "const", value: 1 },
});
const villainAttacks: EventPattern = { on: "enemyAttack", sourceIs: { categories: ["villain"] } };

/** "Forced Interrupt: When [this villain] attacks you, …": the ordinary wording. */
const VILLAIN = stubVillain({
  id: "boss",
  stages: [
    {
      hp: flat(30),
      atk: 2,
      sch: 0,
      abilities: [
        ability("boss.attacks", {
          trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", selfIs: "source" } },
          effects: [mark("attacks")],
        }),
      ],
    },
  ],
});
const SCHEME = stubMainScheme({
  id: "calm",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

/** "Forced Interrupt: When the villain would attack, [mark] instead." */
const REPLACER = stubSupport({
  id: "replacer",
  cost: 0,
  abilities: [
    ability("replacer.would", {
      trigger: { kind: "interrupt", forced: true, would: true, on: villainAttacks },
      effects: [{ kind: "replaceTriggeringEvent", with: [mark("replaced")] }],
    }),
  ],
});
/** "Forced Interrupt: When the villain would attack, [mark]." It replaces nothing. */
const watcher = (id: string): AnyCard =>
  stubSupport({
    id,
    cost: 0,
    abilities: [
      ability(`${id}.would`, {
        trigger: { kind: "interrupt", forced: true, would: true, on: villainAttacks },
        effects: [mark(id)],
      }),
    ],
  });
const WATCHER = watcher("watcher");
const LOOKOUT = watcher("lookout");
/** "Interrupt: When the villain would attack, cancel that attack." Optional. */
const DODGE = stubSupport({
  id: "dodge",
  cost: 0,
  abilities: [
    ability("dodge.would", {
      trigger: { kind: "interrupt", forced: false, would: true, on: villainAttacks },
      effects: [{ kind: "cancelTriggeringEvent" }, mark("dodged")],
    }),
  ],
});
/** The same replacement without the marker: one tier with the villain's interrupt, as before the marker existed. */
const UNMARKED = stubSupport({
  id: "unmarked",
  cost: 0,
  abilities: [
    ability("unmarked.interrupt", {
      trigger: { kind: "interrupt", forced: true, on: villainAttacks },
      effects: [{ kind: "replaceTriggeringEvent", with: [mark("replaced")] }],
    }),
  ],
});

const deps: EngineDeps = depsOf(...abilities);
const SUPPORTS: readonly AnyCard[] = [REPLACER, WATCHER, LOOKOUT, DODGE, UNMARKED];

type Prompt = { readonly kind: string; readonly labels: readonly string[] };

/**
 * Hero form with `inPlay` played, then the villain phase. `choose` answers a trigger prompt (an ordering or an optional
 * offer) from its option ids; every other prompt takes the default. Returns the trigger prompts that were asked.
 */
function villainPhase(
  inPlay: readonly AnyCard[],
  choose: (kind: string, optionIds: readonly string[]) => readonly string[] = (_kind, ids) => ids,
) {
  let state: GameState = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    deps,
    extraCards: [BLANK, ...SUPPORTS],
    encounterDeck: Array.from({ length: 12 }, () => BLANK.id),
    deck: [...DEFAULT_DECK, ...SUPPORTS.map((card) => card.id)],
  });
  const commands: Command[] = [{ type: "changeForm", playerId: p1 }];
  for (const card of inPlay) {
    const given = giveCard(state, p1, card.id);
    state = given.state;
    commands.push({ type: "playCard", playerId: p1, cardInstanceId: given.id, payment: [], attachToInstanceId: null });
  }
  commands.push({ type: "endTurn", playerId: p1 });
  const prompts: Prompt[] = [];
  const pick = (now: GameState): readonly string[] => {
    const choice = now.pendingChoice;
    if (!choice || (choice.prompt.kind !== "orderTriggers" && choice.prompt.kind !== "chooseTriggers"))
      return defaultPick(now);
    prompts.push({ kind: choice.prompt.kind, labels: choice.options.map((option) => option.label) });
    return choose(
      choice.prompt.kind,
      choice.options.map((option) => option.optionId),
    );
  };
  const run = runCommandsPicking(state, deps, pick, ...commands);
  return { ...run, prompts };
}

const resolved = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [String(e.abilityId)] : []));
const counters = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).counters;
const identityDamage = (state: GameState): number =>
  mustInstance(state, mustPlayer(state, p1).identity.instanceId).damage;
const attackWindows = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "windowOpened" && e.timing === "interrupt" && e.event.kind === "enemyAttack"
      ? [{ would: e.would === true, abilities: e.candidates.map((c) => String(c.abilityId)) }]
      : [],
  );
const expectReplays = (session: ReturnType<typeof villainPhase>["session"]) => {
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
};

describe("RRG 1.8 'Would' (p. 48): a 'would' interrupt resolves before the event's other interrupts are gathered", () => {
  it("a 'would' replacement and an ordinary forced interrupt: no ordering prompt, and the ordinary one is never used", () => {
    const { state, events, prompts, session } = villainPhase([REPLACER]);
    expect(prompts).toEqual([]);
    expect(resolved(events)).toEqual(["replacer.would"]);
    expect(attackWindows(events)).toEqual([{ would: true, abilities: ["replacer.would"] }]);
    expect(counters(state).replaced).toBe(1);
    expect(counters(state).attacks).toBeUndefined();
    expect(identityDamage(state)).toBe(0);
    expectReplays(session);
  });

  it("without the marker the two share a tier and the first player orders them (the marker is what separates them)", () => {
    const { prompts } = villainPhase([UNMARKED]);
    expect(prompts).toEqual([{ kind: "orderTriggers", labels: expect.arrayContaining(["boss", "unmarked"]) }]);
    expect(prompts[0]?.labels).toHaveLength(2);
  });

  it("a 'would' interrupt that does not replace: it resolves first, then the ordinary tier opens and the attack lands", () => {
    const { state, events, prompts, session } = villainPhase([WATCHER]);
    expect(prompts).toEqual([]);
    expect(resolved(events)).toEqual(["watcher.would", "boss.attacks"]);
    expect(attackWindows(events)).toEqual([
      { would: true, abilities: ["watcher.would"] },
      { would: false, abilities: ["boss.attacks"] },
    ]);
    expect(counters(state)).toMatchObject({ watcher: 1, attacks: 1 });
    expect(identityDamage(state)).toBe(2);
    expectReplays(session);
  });

  it.each([
    ["as offered", (ids: readonly string[]) => ids],
    ["reversed", (ids: readonly string[]) => [...ids].reverse()],
  ])("two 'would' interrupts are ordered among themselves, the ordinary one not among them (%s)", (_name, order) => {
    let picked: readonly string[] = [];
    const { state, events, prompts, session } = villainPhase([WATCHER, LOOKOUT], (_kind, ids) => {
      picked = order(ids);
      return picked;
    });
    expect(prompts).toHaveLength(1);
    expect(prompts[0]?.kind).toBe("orderTriggers");
    expect([...(prompts[0]?.labels ?? [])].sort()).toEqual(["lookout", "watcher"]);
    // Option ids are `<instanceId>:<abilityId>`: the two resolve in the order picked, then the villain's own.
    expect(resolved(events)).toEqual([...picked.map((id) => id.split(":")[1]), "boss.attacks"]);
    expect(counters(state)).toMatchObject({ watcher: 1, lookout: 1, attacks: 1 });
    expectReplays(session);
  });

  it("a 'would' replacement ordered after another 'would' interrupt still closes the window for the ordinary tier", () => {
    const { state, events, prompts } = villainPhase([WATCHER, REPLACER], (_kind, ids) =>
      [...ids].sort((a, b) => Number(a.endsWith("replacer.would")) - Number(b.endsWith("replacer.would"))),
    );
    expect(prompts).toHaveLength(1);
    expect(resolved(events)).toEqual(["watcher.would", "replacer.would"]);
    expect(counters(state).attacks).toBeUndefined();
  });

  it("an optional 'would' interrupt is offered before the ordinary forced interrupt resolves; used, it preempts it", () => {
    const { state, events, prompts, session } = villainPhase([DODGE]);
    expect(prompts).toEqual([{ kind: "chooseTriggers", labels: ["dodge"] }]);
    expect(resolved(events)).toEqual(["dodge.would"]);
    expect(counters(state).attacks).toBeUndefined();
    expect(identityDamage(state)).toBe(0);
    expectReplays(session);
  });

  it("an optional 'would' interrupt declined: the ordinary tier opens and the attack resolves", () => {
    const { state, events, prompts, session } = villainPhase([DODGE], () => []);
    expect(prompts).toEqual([{ kind: "chooseTriggers", labels: ["dodge"] }]);
    expect(resolved(events)).toEqual(["boss.attacks"]);
    expect(counters(state).attacks).toBe(1);
    expect(identityDamage(state)).toBe(2);
    expectReplays(session);
  });

  it("an attack no 'would' interrupt answers opens the one ordinary window, unchanged", () => {
    const { events, prompts, session } = villainPhase([]);
    expect(prompts).toEqual([]);
    expect(attackWindows(events)).toEqual([{ would: false, abilities: ["boss.attacks"] }]);
    expect(session.state.stack).toEqual([]);
    expectReplays(session);
  });
});
