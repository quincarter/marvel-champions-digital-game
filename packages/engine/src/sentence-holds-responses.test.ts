/**
 * `EffectSpec sentence`: the responses to what one printed sentence causes wait until all of it has resolved
 * (`resolve/sentence-hold.ts`). FFG ruling December 8, 2023 - Ruling 126 (Gamma Blast: "You must resolve the first
 * sentence of Gamma Blast in full before resolving the Response on Gamma form") and January 11, 2024 - Ruling 137 ("a
 * sentence in an ability must fully resolve before responses to that sentence can occur"); RRG 1.8 p. 4 and "'And'"
 * (p. 7). The held windows, the last effect's included, open as one window once the sentence ends (RRG 1.8
 * "Triggering Condition", p. 45). A flat list keeps its window between effects (the Mutant Protectors ruling, post-RRG
 * 1.5).
 *
 * Synthetic cards: an event placing 1, then 2, then 3 threat on the main scheme, and a support with "Forced Response:
 * After threat is placed on the main scheme, put a tally on your identity". The log's order tells where each window
 * opened.
 */
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import { startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { flat } from "@mc/content";
import { stubAlly, stubEvent, stubSupport, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import type { GameState } from "./state.js";
import { gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const place = (value: number): EffectSpec => ({
  kind: "placeThreat",
  target: { kind: "mainScheme" },
  amount: { kind: "const", value },
});

const TALLY = stubAbility("tally.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "placeThreat", targetIs: { categories: ["mainScheme"] } } },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "identityOf", player: { kind: "controller" } },
      counterType: "tally",
      amount: { kind: "const", value: 1 },
    },
  ],
} satisfies AbilityDefinition);
const TALLIER = stubSupport({ id: "tallier", cost: 0, abilities: [TALLY.ref] });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Place 1 threat on the main scheme and place 2 threat on the main scheme. Place 3 threat on the main scheme." */
const SENTENCE = actionEvent("one-sentence", [{ kind: "sentence", effects: [place(1), place(2)] }, place(3)]);
/** The same written flat: three sentences. */
const FLAT = actionEvent("flat", [place(1), place(2), place(3)]);

const deps = depsOf(TALLY, SENTENCE.ability, FLAT.ability);

/** Plays `card` with the tallier in play; the order of placements (`p<amount>`) and tallies (`t`) in the log. */
function order(card: { readonly id: string }): readonly string[] {
  let state = gameAtFirstTurn({
    cards: [TALLIER, SENTENCE.card, FLAT.card],
    deps,
    deck: [TALLIER.id, SENTENCE.card.id, FLAT.card.id],
  });
  state = playerCardIntoPlay(state, TALLIER.id as never).state;
  const given = giveCard(state, P1, card.id as never);
  const { events } = driveSession(startSession(given.state), deps, [
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
  ]);
  const identity = mustPlayer(given.state, P1).identity.instanceId;
  return events.flatMap((event: GameEvent) => {
    if (event.type === "threatPlaced" && event.schemeInstanceId === given.state.mainScheme.instanceId)
      return [`p${event.amount}`];
    if (event.type === "counterAdded" && event.instanceId === identity) return ["t"];
    return [];
  });
}

describe("a sentence holds its responses until it has resolved in full", () => {
  it("flat list: each placement's forced response resolves before the next placement", () => {
    expect(order(FLAT.card)).toEqual(["p1", "t", "p2", "t", "p3", "t"]);
  });

  it("one sentence: the first placement's response waits for the second; both resolve before the next sentence", () => {
    // Both placements' windows are held, the last effect's included, and open as one window once the sentence ends.
    expect(order(SENTENCE.card)).toEqual(["p1", "p2", "t", "t", "p3", "t"]);
  });
});

/**
 * The held windows open as ONE response window, each occurrence a triggering condition group of its own. RRG 1.8
 * "Triggering Condition" (p. 45): a single response window, abilities referring to any of the conditions "may be used
 * in any order"; "'And'" (p. 7). Forced before optional only within the same triggering condition (p. 5 chart;
 * "Forced", p. 20), so an optional response to the other condition may go before the forced one, or after it.
 */
describe("a sentence's held responses share one window, in any order across conditions", () => {
  /** "Response: After the villain takes damage, put a mark on your identity." Optional. */
  const MARK = stubAbility("mark.response", {
    trigger: { kind: "response", forced: false, on: { on: "dealDamage", targetIs: { categories: ["villain"] } } },
    effects: [
      {
        kind: "addCounters",
        target: { kind: "identityOf", player: { kind: "controller" } },
        counterType: "mark",
        amount: { kind: "const", value: 1 },
      },
    ],
  } satisfies AbilityDefinition);
  const MARKER = stubSupport({ id: "marker", cost: 0, abilities: [MARK.ref] });
  /** "Place 1 threat on the main scheme and deal 1 damage to the villain. Place 3 threat on the main scheme." */
  const MIXED = actionEvent("mixed", [
    {
      kind: "sentence",
      effects: [place(1), { kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 1 } }],
    },
    place(3),
  ]);
  const mixedDeps = depsOf(TALLY, MARK, MIXED.ability);

  /** The `chooseTriggers` answers in turn: `true` takes every option offered (in `reverse` order if asked), `false` none. */
  const answering =
    (...takes: boolean[]) =>
    (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind !== "chooseTriggers") return defaultPick(state);
      return takes.shift() === false ? [] : choice.options.map((option) => option.optionId);
    };

  function run(pick: (state: GameState) => readonly string[]) {
    let state = gameAtFirstTurn({
      cards: [TALLIER, MARKER, MIXED.card],
      deps: mixedDeps,
      deck: [TALLIER.id, MARKER.id, MIXED.card.id],
    });
    state = playerCardIntoPlay(state, TALLIER.id as never).state;
    state = playerCardIntoPlay(state, MARKER.id as never).state;
    const given = giveCard(state, P1, MIXED.card.id as never);
    const { events } = driveSession(
      startSession(given.state),
      mixedDeps,
      [{ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
      pick,
    );
    const identity = mustPlayer(given.state, P1).identity.instanceId;
    const villain = given.state.villains[0]!.instanceId;
    const log = events.flatMap((event: GameEvent) => {
      if (event.type === "threatPlaced" && event.schemeInstanceId === given.state.mainScheme.instanceId)
        return [`p${event.amount}`];
      if (event.type === "damageDealt" && event.targetInstanceId === villain) return ["d"];
      if (event.type === "counterAdded" && event.instanceId === identity)
        return [event.counterType === "mark" ? "m" : "t"];
      return [];
    });
    return { events, log };
  }

  it("the optional response to the last effect may resolve before the forced response to the first", () => {
    expect(run(answering(true)).log).toEqual(["p1", "d", "m", "t", "p3", "t"]);
  });

  it("or after it: declined ahead of the forced tier, it is offered again once the forced response has resolved", () => {
    expect(run(answering(false, true)).log).toEqual(["p1", "d", "t", "m", "p3", "t"]);
  });

  it("it is one window: the damage's condition and the placement's are offered together, after the whole sentence", () => {
    const { events, log } = run(answering(true));
    // Nothing answered inside the sentence: both of its effects came before any response.
    expect(log.slice(0, 2)).toEqual(["p1", "d"]);
    const opened = events.filter(
      (event): event is Extract<GameEvent, { type: "windowOpened" }> =>
        event.type === "windowOpened" && event.timing === "response" && event.event.kind === "dealDamage",
    );
    expect(opened.length).toBeGreaterThan(0);
    for (const window of opened) expect(window.alsoEvents?.map((each) => each.kind)).toContain("placeThreat");
    // No window of its own for the first placement.
    expect(
      events.some(
        (event) =>
          event.type === "windowOpened" &&
          event.timing === "response" &&
          event.event.kind === "placeThreat" &&
          event.event.amount === 1,
      ),
    ).toBe(false);
  });
});

/**
 * Gamma Blast's shape (21007, "Hero Action (attack): Change to Gamma energy form and deal 7 damage to an enemy"): one
 * sentence that changes form and attacks an enemy with retaliate. The form's Response waits for the whole sentence
 * (ruling 126) and joins the attack's response window as a condition group of its own (`sentence-hold.ts`). There:
 * retaliate first (RRG 1.8 p. 9 step 7; the engine applies it in `characterAttacked`'s apply step), then the "at the
 * end of this attack" delayed effect (p. 5 item 1; ruling Mar 6, 2026), then the window, where the attack's forced
 * response precedes its optional one (p. 8 step 6a/6b; p. 9 steps 7-8) and the form's optional Response may go before
 * or after either (p. 45; p. 5 chart, same triggering condition only). Synthetic cards; the identity starts in
 * alter-ego form and the sentence changes it to hero form.
 */
describe("Gamma Blast's shape: change form and attack an enemy with retaliate, in one sentence", () => {
  const you = { kind: "controller" } as const;
  const counter = (counterType: string): EffectSpec => ({
    kind: "addCounters",
    target: { kind: "identityOf", player: you },
    counterType,
    amount: { kind: "const", value: 1 },
  });
  /** "Response: After you change form, …" (Gamma form's Response). Optional. */
  const FORM = stubAbility("form.response", {
    trigger: { kind: "response", forced: false, on: { on: "formChanged", playerIs: "controller" } },
    effects: [counter("form")],
  } satisfies AbilityDefinition);
  /** "Forced Response: After you attack, …". */
  const FOLLOW = stubAbility("follow.response", {
    trigger: { kind: "response", forced: true, on: { on: "attack", playerIs: "controller" } },
    effects: [counter("follow")],
  } satisfies AbilityDefinition);
  /** "Response: After you attack, …". Optional. */
  const AFTER = stubAbility("after.response", {
    trigger: { kind: "response", forced: false, on: { on: "attack", playerIs: "controller" } },
    effects: [counter("after")],
  } satisfies AbilityDefinition);
  /** "Forced Interrupt: When you attack, at the end of this attack …" (a delayed effect). */
  const ENDING = stubAbility("ending.interrupt", {
    trigger: { kind: "interrupt", forced: true, on: { on: "attack", playerIs: "controller" } },
    effects: [{ kind: "atEndOfAttack", effects: [counter("ended")] }],
  } satisfies AbilityDefinition);
  const supports = [FORM, FOLLOW, AFTER, ENDING].map((ability, index) =>
    stubSupport({ id: `gamma-support-${index}`, cost: 0, abilities: [ability.ref] }),
  );
  /** Retaliate 1. */
  const THORNY = stubVillain({
    id: "thorny-gamma-villain",
    stages: [{ hp: flat(40), atk: 2, sch: 1, keywords: [{ name: "retaliate", value: 1 }] }],
  });
  const BLAST_ABILITY = stubAbility("blast.action", {
    trigger: { kind: "action" },
    label: ["attack"],
    effects: [
      {
        kind: "sentence",
        effects: [
          { kind: "changeForm", player: you, to: "hero" },
          { kind: "attack", target: { kind: "villain" }, amount: { kind: "const", value: 2 } },
        ],
      },
    ],
  } satisfies AbilityDefinition);
  const BLAST = stubEvent({ id: "blast", cost: 0, abilities: [BLAST_ABILITY.ref] });
  const gammaDeps = depsOf(FORM, FOLLOW, AFTER, ENDING, BLAST_ABILITY);

  /** `chooseTriggers` answers in turn: "all", "none", or "reverse" (every option, last first). */
  const answering =
    (...takes: ("all" | "none" | "reverse")[]) =>
    (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind !== "chooseTriggers") return defaultPick(state);
      const ids = choice.options.map((option) => option.optionId);
      const take = takes.shift() ?? "all";
      return take === "none" ? [] : take === "reverse" ? [...ids].reverse() : ids;
    };

  function run(pick: (state: GameState) => readonly string[]) {
    const base = gameAtFirstTurn({
      cards: [THORNY, ...supports, BLAST],
      deps: gammaDeps,
      villain: THORNY,
      deck: [...supports.map((card) => card.id), BLAST.id],
    });
    let state: GameState = {
      ...base,
      players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "alterEgo" } })),
    };
    for (const card of supports) state = playerCardIntoPlay(state, card.id as never).state;
    const given = giveCard(state, P1, BLAST.id as never);
    const { events, session } = driveSession(
      startSession(given.state),
      gammaDeps,
      [{ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
      pick,
    );
    const identity = mustPlayer(given.state, P1).identity.instanceId;
    const villain = given.state.villains[0]!.instanceId;
    const log = events.flatMap((event: GameEvent) => {
      if (event.type === "triggerEvent" && event.phase === "resolved" && event.event.kind === "formChanged")
        return ["changed"];
      if (event.type === "damageDealt" && event.targetInstanceId === villain) return ["hit"];
      if (event.type === "damageDealt" && event.targetInstanceId === identity) return ["retaliate"];
      if (event.type === "counterAdded" && event.instanceId === identity) return [event.counterType];
      return [];
    });
    return { log, state: session.state };
  }

  it("taken when first offered, the form's Response resolves before the attack's forced response", () => {
    const { log, state } = run(answering("all"));
    expect(mustPlayer(state, P1).identity.form).toBe("hero");
    expect(log).toEqual(["changed", "hit", "retaliate", "ended", "form", "follow", "after"]);
  });

  it("declined then, it is offered again with the attack's optional response, and may go after it", () => {
    expect(run(answering("none", "reverse")).log).toEqual([
      "changed",
      "hit",
      "retaliate",
      "ended",
      "follow",
      "after",
      "form",
    ]);
  });
});

/**
 * Edges of the combined window: a card that entered play while the sentence held its windows (`entered-since.ts`),
 * a sentence inside a sentence, two players in the early round, and a "(thwart)" ability's hand-off.
 */
describe("a sentence's held windows: entering play, nesting, two players, a thwart", () => {
  const you = { kind: "controller" } as const;
  const counter = (counterType: string): EffectSpec => ({
    kind: "addCounters",
    target: { kind: "identityOf", player: you },
    counterType,
    amount: { kind: "const", value: 1 },
  });
  const villainDamage: EffectSpec = {
    kind: "dealDamage",
    target: { kind: "villain" },
    amount: { kind: "const", value: 1 },
  };
  /** "Response: After the villain takes damage, …" Optional. */
  const MARK = stubAbility("edge-mark.response", {
    trigger: { kind: "response", forced: false, on: { on: "dealDamage", targetIs: { categories: ["villain"] } } },
    effects: [counter("m")],
  } satisfies AbilityDefinition);
  /** "Forced Response: After threat is placed on the main scheme, …" on an ally that arrives mid-sentence. */
  const LATE_TALLY = stubAbility("late-tally.response", {
    trigger: { kind: "response", forced: true, on: { on: "placeThreat", targetIs: { categories: ["mainScheme"] } } },
    effects: [counter("x")],
  } satisfies AbilityDefinition);
  const LATE = stubAlly({ id: "late-ally", cost: 0, atk: 1, thw: 1, hp: 3, abilities: [LATE_TALLY.ref] });
  /** "Forced Interrupt: When the villain would take damage, put the late ally into play from your hand." */
  const HERALD = stubAbility("herald.interrupt", {
    trigger: { kind: "interrupt", forced: true, on: { on: "dealDamage", targetIs: { categories: ["villain"] } } },
    effects: [
      {
        kind: "selectCards",
        slot: "found",
        cards: { kind: "zone", zone: "hand", player: you, filter: { name: "late-ally" } },
      },
      { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: you },
    ],
  } satisfies AbilityDefinition);
  /** "Response: After you change form, …" Optional. */
  const FORM = stubAbility("edge-form.response", {
    trigger: { kind: "response", forced: false, on: { on: "formChanged", playerIs: "controller" } },
    effects: [counter("form")],
  } satisfies AbilityDefinition);
  /** "Forced Response: After you thwart, …". */
  const THWARTED = stubAbility("edge-thwarted.response", {
    trigger: { kind: "response", forced: true, on: { on: "thwart", playerIs: "controller" } },
    effects: [counter("thwarted")],
  } satisfies AbilityDefinition);
  /** "Forced Interrupt: When you thwart, cancel that thwart." */
  const SPOIL = stubAbility("edge-spoil.interrupt", {
    trigger: { kind: "interrupt", forced: true, on: { on: "thwart", playerIs: "controller" } },
    effects: [{ kind: "cancelTriggeringEvent" }],
  } satisfies AbilityDefinition);
  const support = (ability: typeof MARK, id: string) => stubSupport({ id, cost: 0, abilities: [ability.ref] });
  const TALLIER_S = support(TALLY, "edge-tallier");
  const MARK_S = support(MARK, "edge-marker");
  const HERALD_S = support(HERALD, "edge-herald");
  const FORM_S = support(FORM, "edge-form");
  const THWARTED_S = support(THWARTED, "edge-thwarted");
  const SPOIL_S = support(SPOIL, "edge-spoil");

  /** "Place 1 threat on the main scheme and deal 1 damage to the villain. Place 3 threat on the main scheme." */
  const MIXED = actionEvent("edge-mixed", [{ kind: "sentence", effects: [place(1), villainDamage] }, place(3)]);
  /** The same with its second half a sentence of its own inside the first. */
  const NESTED = actionEvent("edge-nested", [
    { kind: "sentence", effects: [place(1), { kind: "sentence", effects: [place(2), villainDamage] }] },
    place(3),
  ]);
  /** "Hero Action (thwart): Change to hero form and remove 1 threat from the main scheme." Photon Speed's shape. */
  const SPEED_ABILITY = stubAbility("edge-speed.action", {
    trigger: { kind: "action" },
    label: ["thwart"],
    effects: [
      {
        kind: "sentence",
        effects: [
          { kind: "changeForm", player: you, to: "hero" },
          { kind: "thwart", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } },
        ],
      },
    ],
  } satisfies AbilityDefinition);
  const SPEED = stubEvent({ id: "edge-speed", cost: 0, abilities: [SPEED_ABILITY.ref] });
  const edgeDeps = depsOf(
    TALLY,
    MARK,
    LATE_TALLY,
    HERALD,
    FORM,
    THWARTED,
    SPOIL,
    MIXED.ability,
    NESTED.ability,
    SPEED_ABILITY,
  );
  const ALL = [TALLIER_S, MARK_S, HERALD_S, FORM_S, THWARTED_S, SPOIL_S, LATE, MIXED.card, NESTED.card, SPEED];

  /** `chooseTriggers` answers in turn, per player: "all" or "none". Past the list, "all". */
  const answering =
    (takes: Partial<Record<string, ("all" | "none")[]>>) =>
    (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind !== "chooseTriggers") return defaultPick(state);
      return takes[choice.playerId]?.shift() === "none" ? [] : choice.options.map((option) => option.optionId);
    };

  interface Setup {
    readonly card: { readonly id: string };
    readonly mine?: readonly { readonly id: string }[];
    readonly theirs?: readonly { readonly id: string }[];
    readonly inHand?: readonly { readonly id: string }[];
    readonly alterEgo?: boolean;
    readonly pick?: (state: GameState) => readonly string[];
  }
  function run(setup: Setup) {
    const base = gameAtFirstTurn({
      cards: ALL,
      deps: edgeDeps,
      players: setup.theirs ? 2 : 1,
      deck: ALL.map((card) => card.id),
    });
    let state: GameState = setup.alterEgo
      ? { ...base, players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "alterEgo" } })) }
      : base;
    for (const card of setup.mine ?? []) state = playerCardIntoPlay(state, card.id as never).state;
    for (const card of setup.theirs ?? []) state = playerCardIntoPlay(state, card.id as never, P2).state;
    for (const card of setup.inHand ?? []) state = giveCard(state, P1, card.id as never).state;
    const given = giveCard(state, P1, setup.card.id as never);
    const { events, session } = driveSession(
      startSession(given.state),
      edgeDeps,
      [{ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
      setup.pick ?? answering({}),
    );
    const mine = mustPlayer(given.state, P1).identity.instanceId;
    const villain = given.state.villains[0]!.instanceId;
    const log = events.flatMap((event: GameEvent) => {
      if (event.type === "threatPlaced" && event.schemeInstanceId === given.state.mainScheme.instanceId)
        return [`p${event.amount}`];
      if (event.type === "triggerEvent" && event.phase === "resolved" && event.event.kind === "formChanged")
        return ["changed"];
      if (event.type === "triggerEvent" && event.phase === "resolved" && event.event.kind === "thwart")
        return ["thwart"];
      if (event.type === "damageDealt" && event.targetInstanceId === villain) return ["d"];
      if (event.type === "counterAdded") {
        const tag = event.counterType === "tally" ? "t" : event.counterType;
        return [event.instanceId === mine ? tag : `${tag}@p2`];
      }
      return [];
    });
    return { log, state: session.state };
  }

  it("a card put into play while the sentence held its windows does not answer a condition held from before it", () => {
    // The herald's interrupt to the damage puts the late ally into play after the first placement occurred: the
    // tallier (in play all along) answers that placement in the combined window; the late ally answers only p3.
    const { log } = run({ card: MIXED.card, mine: [TALLIER_S, HERALD_S], inHand: [LATE] });
    expect(log).toEqual(["p1", "d", "t", "p3", "t", "x"]);
  });

  it("a sentence inside a sentence: the inner one's windows join the outer one's, one window after it all", () => {
    expect(run({ card: NESTED.card, mine: [TALLIER_S, MARK_S] }).log).toEqual([
      "p1",
      "p2",
      "d",
      "m",
      "t",
      "t",
      "p3",
      "t",
    ]);
  });

  it("two players in the early round: the first declines, the second picks, and the first is offered it again", () => {
    const pick = answering({ [P1]: ["none", "all"], [P2]: ["all"] });
    const { log } = run({ card: MIXED.card, mine: [TALLIER_S, MARK_S], theirs: [MARK_S], pick });
    expect(log).toEqual(["p1", "d", "m@p2", "m", "t", "p3", "t"]);
  });

  it("two players who both decline the early round are each offered theirs again after the forced response", () => {
    const pick = answering({ [P1]: ["none", "all"], [P2]: ["none", "all"] });
    const { log } = run({ card: MIXED.card, mine: [TALLIER_S, MARK_S], theirs: [MARK_S], pick });
    expect(log).toEqual(["p1", "d", "t", "m", "m@p2", "p3", "t"]);
  });

  it("a '(thwart)' ability: taken when first offered, the form's Response resolves before the forced 'after you thwart'", () => {
    const { log, state } = run({ card: SPEED, mine: [FORM_S, THWARTED_S], alterEgo: true });
    expect(mustPlayer(state, P1).identity.form).toBe("hero");
    expect(log).toEqual(["changed", "thwart", "form", "thwarted"]);
  });

  it("a '(thwart)' ability: declined then, the form's Response is offered again after the forced response", () => {
    const pick = answering({ [P1]: ["none", "all"] });
    const { log } = run({ card: SPEED, mine: [FORM_S, THWARTED_S], alterEgo: true, pick });
    expect(log).toEqual(["changed", "thwart", "thwarted", "form"]);
  });

  it("a '(thwart)' ability whose thwart is cancelled still opens what its sentence held", () => {
    const { log } = run({ card: SPEED, mine: [FORM_S, THWARTED_S, SPOIL_S], alterEgo: true });
    expect(log).toEqual(["changed", "form"]);
  });
});

/** "Response: After threat is placed on the main scheme, …", costing an energy resource the player does not have. */
const PRICEY = stubAbility("pricey.response", {
  trigger: { kind: "response", forced: false, on: { on: "placeThreat", targetIs: { categories: ["mainScheme"] } } },
  cost: { resources: { energy: 1 } },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "identityOf", player: { kind: "controller" } },
      counterType: "tally",
      amount: { kind: "const", value: 1 },
    },
  ],
} satisfies AbilityDefinition);
const PRICER = stubSupport({ id: "pricer", cost: 0, abilities: [PRICEY.ref] });

describe("a response that cannot be used, while a sentence holds its responses (#431)", () => {
  /** How many times the engine said the unpayable response was not offered while `card` resolved. */
  function notOfferedCount(card: { readonly id: string }): number {
    const pricedDeps = depsOf(PRICEY, SENTENCE.ability, FLAT.ability);
    let state = gameAtFirstTurn({
      cards: [PRICER, SENTENCE.card, FLAT.card],
      deps: pricedDeps,
      deck: [PRICER.id, SENTENCE.card.id, FLAT.card.id],
    });
    state = playerCardIntoPlay(state, PRICER.id as never).state;
    const given = giveCard(state, P1, card.id as never);
    // Nothing else in hand, so the energy cannot be paid.
    const bare = {
      ...given.state,
      players: given.state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [given.id] } : p)),
    };
    const { events } = driveSession(startSession(bare), pricedDeps, [
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    ]);
    return events.filter((e) => e.type === "abilityNotOffered" && e.abilityId === PRICEY.ref.id).length;
  }

  it("flat list: said after each placement", () => {
    expect(notOfferedCount(FLAT.card)).toBe(3);
  });

  it("inside the sentence nothing is said early, as while a reveal holds them; the last sentence's placement says it", () => {
    expect(notOfferedCount(SENTENCE.card)).toBe(1);
  });
});
