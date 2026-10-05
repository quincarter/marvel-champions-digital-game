/**
 * docs/phase7-wave7.md §3.14, §3.34 item 2 (queue task 13): "Flip this card and reveal it" / "flip this card and reveal
 * [its other face]" on an encounter card that is not a villain (`flipCard { reveal: true }`). Synthetic cards shaped
 * like a double-sided permanent attachment whose b face has a When Revealed (a `flipSide` card) and a side scheme whose
 * other face is a side scheme of its own with a When Revealed (`otherFaceId` cards).
 *
 * Sources: the cards' own "flip this card and reveal" text; RRG 1.8 "Flip" (p. 20: the same card type "retains all
 * attached cards, tucked cards, status cards, and tokens"), "Side Scheme" (p. 40: "enters play with an amount of threat
 * on it equal to the card's starting threat value"), "Hinder X" (p. 22), "Incite X" (p. 24), "Peril" (p. 32), "Surge"
 * (p. 42), "Reveal" (p. 38); FAQ "Dial M for Mojo (#35)" (a villain's new face is revealed, so its reveal keywords
 * resolve; docs/phase7-wave6.md §4.1 Q36); rulings Jan 26, 2026 (4) answer 2, Apr 30, 2026 (3) answer 3 and Jun 25,
 * 2026 (4) answer 3 (an environment that flips is not revealed). Decisions §4.1 Q10 and Q19.
 *
 * The reading pinned here for "when an encounter card is revealed" abilities: the rulings refuse them on a flip whose
 * text does not say "reveal". A flip whose text does say it is a reveal, so those windows open; it is not a reveal
 * *from the encounter deck* (the frame's `source` is `elsewhere`), which is the reason the January ruling gives.
 */

import type { AbilityReference, AnyCard, CardId, KeywordInstance } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, locateCard, mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import {
  stubAttachment,
  stubEnvironment,
  stubEvent,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  onTopOfEncounterDeck,
  P1,
  P2,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const one = { kind: "const", value: 1 } as const;
const self: TargetRef = { kind: "self" };
const counter = (id: string, counterType: string, on: StubAbility["definition"]["trigger"]) =>
  stubAbility(id, { trigger: on, effects: [{ kind: "addCounters", target: self, counterType, amount: one }] });
const whenRevealed = (id: string, counterType: string) => counter(id, counterType, { kind: "whenRevealed" });
/** The back of a `flipSide` card. */
const back = (name: string, abilities: readonly AbilityReference[], keywords: readonly KeywordInstance[] = []) =>
  stubEnvironment({ id: "any", flipSide: { name, abilities, keywords } }).flipSide!;

/** A double-sided attachment on the villain: each face's When Revealed leaves its own counter. */
const FRONT_REVEALED = whenRevealed("captor.a.when-revealed", "frontRevealed");
const BACK_REVEALED = whenRevealed("captor.b.when-revealed", "backRevealed");
const captor = (id: string, keywords: readonly KeywordInstance[] = [], abilities = [BACK_REVEALED.ref]): AnyCard => ({
  ...stubAttachment({ id, attachesTo: { kind: "villain" }, abilities: [FRONT_REVEALED.ref] }),
  flipSide: back(`${id} (B)`, abilities, keywords),
});
const CAPTOR = captor("captor");
const SURGING = captor("surging", [{ name: "surge" }]);
const INCITING = captor("inciting", [{ name: "incite", value: 1 }]);
/** A b face whose When Revealed asks its revealer a question, with and without peril. */
const ASKS = stubAbility("asking.b.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    {
      kind: "chooseOne",
      chooser: { kind: "controller" },
      options: [
        { label: "a", effects: [] },
        { label: "b", effects: [] },
      ],
    },
  ],
});
const ASKING = captor("asking", [], [ASKS.ref]);
const PERILOUS = captor("perilous", [{ name: "peril" }], [ASKS.ref]);
/** A double-sided environment. */
const ENVIRONMENT_REVEALED = whenRevealed("wheel.b.when-revealed", "backRevealed");
const WHEEL = stubEnvironment({ id: "wheel", flipSide: { name: "wheel (B)", abilities: [ENVIRONMENT_REVEALED.ref] } });

/** Side schemes whose other face is a card of its own. */
const faces = <A extends AnyCard, B extends AnyCard>(a: A, b: B): readonly [A, B] => [
  { ...a, otherFaceId: b.id as CardId },
  { ...b, otherFaceId: a.id as CardId },
];
const BOMB_REVEALED = whenRevealed("bomb.when-revealed", "backRevealed");
const [GRASP, BOMB] = faces(
  stubSideScheme({ id: "grasp", startingThreat: 4 }),
  stubSideScheme({ id: "bomb", startingThreat: 3, abilities: [BOMB_REVEALED.ref] }),
);
/** A b face with a per-player starting threat and hinder. */
const [HOLD, BLAST] = faces(stubSideScheme({ id: "hold", startingThreat: 4 }), {
  ...stubSideScheme({ id: "blast", startingThreat: 0, keywords: [{ name: "hinder", value: 2 }] }),
  startingThreat: { base: 1, perPlayer: 2 },
  abilities: [BOMB_REVEALED.ref],
});
/** A side scheme whose other face is a minion. */
const [CAGE, BEAST] = faces(
  stubSideScheme({ id: "cage", startingThreat: 2 }),
  stubMinion({ id: "beast", atk: 1, sch: 1, hp: 3, boostIcons: 0, abilities: [BOMB_REVEALED.ref] }),
);
const CLAMP = stubAttachment({ id: "clamp", attachesTo: { kind: "sideScheme" } });
/** "Forced Interrupt: When this leaves play, …": a flip to another card type waits for it (wave 5 §4.1 Q32). */
const LATCH_LEAVES = stubAbility("latch.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [{ kind: "addCounters", target: { kind: "villain" }, counterType: "latchLeft", amount: one }],
});
const LATCH = stubAttachment({ id: "latch", attachesTo: { kind: "sideScheme" }, abilities: [LATCH_LEAVES.ref] });
const TWO_FACED = stubVillain({
  id: "two-faced",
  stages: [{ hp: { base: 10, perPlayer: 0 }, atk: 1, sch: 1, abilities: [FRONT_REVEALED.ref] }],
  back: {
    name: "two-faced (B)",
    stages: [{ hp: { base: 10, perPlayer: 0 }, atk: 1, sch: 1, abilities: [BACK_REVEALED.ref] }],
  },
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

/** A player's support that sees every reveal window and every flip. */
const SAW_REVEALING = counter("spy.interrupt", "sawRevealing", {
  kind: "interrupt",
  forced: true,
  on: { on: "encounterCardRevealing" },
});
const SAW_REVEALED = counter("spy.response", "sawRevealed", {
  kind: "response",
  forced: true,
  on: { on: "cardRevealed" },
});
const SAW_FLIPPED = counter("spy.flipped", "sawFlipped", {
  kind: "response",
  forced: true,
  on: { on: "cardFlipped" },
});
const SPY = stubSupport({ id: "spy", cost: 0, abilities: [SAW_REVEALING.ref, SAW_REVEALED.ref, SAW_FLIPPED.ref] });
/** "Interrupt: When an encounter card is revealed, cancel the effects of that card and discard it." */
const CANCEL = stubAbility("canceller.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "encounterCardRevealing" } },
  effects: [{ kind: "cancelRevealedCard" }],
});
const CANCELLER = stubSupport({ id: "canceller", cost: 0, abilities: [CANCEL.ref] });

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const each = (category: "attachment" | "environment" | "sideScheme", name?: string): TargetRef => ({
  kind: "each",
  query: { categories: [category], ...(name ? { name } : {}) },
});
const DOUBLE_SIDED = [CAPTOR, SURGING, INCITING, ASKING, PERILOUS];
const FLIP_PLAIN = action("flip-plain", [
  ...DOUBLE_SIDED.map((card): EffectSpec => ({ kind: "flipCard", target: each("attachment", card.name) })),
  { kind: "flipCard", target: each("environment") },
  { kind: "flipCard", target: each("sideScheme") },
]);
const FLIP_REVEAL = action("flip-reveal", [
  ...DOUBLE_SIDED.map((card): EffectSpec => ({
    kind: "flipCard",
    target: each("attachment", card.name),
    reveal: true,
  })),
  { kind: "flipCard", target: each("sideScheme"), reveal: true },
]);
const FLIP_REVEAL_ENVIRONMENT = action("flip-reveal-environment", [
  { kind: "flipCard", target: each("environment"), reveal: true },
]);
const FLIP_REVEAL_VILLAIN = action("flip-reveal-villain", [
  { kind: "flipCard", target: { kind: "villain" }, reveal: true },
]);
const REVEAL_TOP = action("reveal-top", [{ kind: "revealEncounterCard", player: { kind: "controller" } }]);
const ACTIONS = [FLIP_PLAIN, FLIP_REVEAL, FLIP_REVEAL_ENVIRONMENT, FLIP_REVEAL_VILLAIN, REVEAL_TOP];

const deps: EngineDeps = depsOf(
  FRONT_REVEALED,
  BACK_REVEALED,
  ASKS,
  ENVIRONMENT_REVEALED,
  BOMB_REVEALED,
  LATCH_LEAVES,
  SAW_REVEALING,
  SAW_REVEALED,
  SAW_FLIPPED,
  CANCEL,
  ...ACTIONS.map((a) => a.ability),
);
const ENCOUNTER_CARDS = [...DOUBLE_SIDED, WHEEL, GRASP, BOMB, HOLD, BLAST, CAGE, BEAST, CLAMP, LATCH, BLANK];
const IN_DECK = [...DOUBLE_SIDED, WHEEL, GRASP, HOLD, CAGE, CLAMP, LATCH];

function start(options: { readonly players?: 1 | 2; readonly villain?: ReturnType<typeof stubVillain> } = {}) {
  return gameAtFirstTurn({
    cards: [...ENCOUNTER_CARDS, TWO_FACED, SPY, CANCELLER, ...ACTIONS.map((a) => a.card)],
    deps,
    players: options.players ?? 1,
    ...(options.villain ? { villain: options.villain } : {}),
    encounter: [...IN_DECK.map((card) => card.id), ...copiesOf(BLANK.id, 20)],
    deck: [SPY.id, CANCELLER.id, ...ACTIONS.map((a) => a.card.id)],
  });
}

const idOf = (state: GameState, card: AnyCard): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === card.id)!.instanceId;
/** `card` revealed from the top of the encounter deck: an attachment lands on its host. */
function revealed(state: GameState, card: AnyCard): { readonly state: GameState; readonly id: InstanceId } {
  const after = playFree(onTopOfEncounterDeck(state, card.id), deps, REVEAL_TOP.card.id).state;
  return { state: after, id: idOf(after, card) };
}
/** Tokens on a card in play (surgery). */
const withTokens = (
  state: GameState,
  id: InstanceId,
  tokens: { damage?: number; counters?: Record<string, number> },
) => ({
  ...state,
  instances: {
    ...state.instances,
    [id]: {
      ...mustInstance(state, id),
      ...(tokens.damage === undefined ? {} : { damage: tokens.damage }),
      counters: { ...mustInstance(state, id).counters, ...tokens.counters },
    },
  },
});

/** Accepts every optional trigger offered; otherwise the default pick. */
const accept = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
  return defaultPick(state);
};
function play(state: GameState, card: CardId) {
  const given = giveCard(state, P1, card);
  return runCommandsPicking(given.state, deps, accept, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}

const counters = (state: GameState, id: InstanceId) => mustInstance(state, id).counters;
const mainThreat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const reveals = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "encounterCardRevealed" ? [{ card: String(e.cardId), by: e.playerId }] : []));
const offers = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "choiceRequested" && e.choice.prompt.kind === "chooseTriggers").length;
const indexOf = (events: readonly GameEvent[], type: GameEvent["type"]) => events.findIndex((e) => e.type === type);
const windows = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" &&
    e.phase === "resolved" &&
    ["encounterCardRevealing", "cardRevealed", "cardFlipped"].includes(e.event.kind)
      ? [e.event.kind]
      : [],
  );

describe("§3.14 a double-sided attachment that flips and reveals its other face", () => {
  it("resolves the new face's When Revealed once, where it is, keeping its tokens and its host", () => {
    const attached = revealed(start(), CAPTOR);
    const before = withTokens(attached.state, attached.id, { damage: 2, counters: { mark: 3 } });
    const villain = activeVillain(before).instanceId;
    const { state, events } = play(before, FLIP_REVEAL.card.id);
    const card = mustInstance(state, attached.id);
    expect(card.flipped).toBe(true);
    expect(card.counters).toEqual({ frontRevealed: 1, backRevealed: 1, mark: 3 });
    expect(card.damage).toBe(2);
    expect(locateCard(state, attached.id)).toEqual({ kind: "attachment", hostInstanceId: villain });
    expect(mustInstance(state, villain).attachments).toContain(attached.id);
    expect(reveals(events)).toEqual([{ card: "captor", by: P1 }]);
  });

  it("the log shows the flip, then the reveal", () => {
    const attached = revealed(start(), CAPTOR);
    const { events } = play(attached.state, FLIP_REVEAL.card.id);
    expect(indexOf(events, "cardFlipped")).toBeGreaterThan(-1);
    expect(indexOf(events, "encounterCardRevealed")).toBeGreaterThan(indexOf(events, "cardFlipped"));
  });

  it("without the flag a flip is not a reveal: no When Revealed, no reveal windows, no canceller offered", () => {
    const attached = revealed(start(), CAPTOR);
    const spy = playerCardIntoPlay(attached.state, SPY.id);
    const before = playerCardIntoPlay(spy.state, CANCELLER.id).state;
    const { state, events } = play(before, FLIP_PLAIN.card.id);
    expect(mustInstance(state, attached.id).flipped).toBe(true);
    expect(counters(state, attached.id)).toEqual({ frontRevealed: 1 });
    expect(counters(state, spy.id)).toEqual({ sawFlipped: 1 });
    expect(reveals(events)).toEqual([]);
    expect(offers(events)).toBe(0);
  });

  it("with the flag the reveal windows open, then 'after this card flips'", () => {
    const attached = revealed(start(), CAPTOR);
    const spy = playerCardIntoPlay(attached.state, SPY.id);
    const { state, events } = play(spy.state, FLIP_REVEAL.card.id);
    expect(counters(state, spy.id)).toEqual({ sawRevealing: 1, sawRevealed: 1, sawFlipped: 1 });
    expect(windows(events)).toEqual(["encounterCardRevealing", "cardRevealed", "cardFlipped"]);
  });

  it("with the flag a 'when an encounter card is revealed' canceller is offered; canceled, the card stays in play", () => {
    const attached = revealed(start(), CAPTOR);
    const before = playerCardIntoPlay(attached.state, CANCELLER.id).state;
    const villain = activeVillain(before).instanceId;
    const { state, events } = play(before, FLIP_REVEAL.card.id);
    expect(offers(events)).toBe(1);
    expect(counters(state, attached.id)).toEqual({ frontRevealed: 1 });
    expect(mustInstance(state, attached.id).flipped).toBe(true);
    expect(locateCard(state, attached.id)).toEqual({ kind: "attachment", hostInstanceId: villain });
  });

  it("the player resolving the flip reveals the new face, first player or not", () => {
    const attached = revealed(start({ players: 2 }), CAPTOR);
    const { events } = play({ ...attached.state, firstPlayerId: P2 }, FLIP_REVEAL.card.id);
    expect(reveals(events)).toEqual([{ card: "captor", by: P1 }]);
  });

  it("replays to the same state", () => {
    const attached = revealed(start(), CAPTOR);
    const { session } = play(attached.state, FLIP_REVEAL.card.id);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});

describe("§3.14 the reveal keywords of a face revealed by a flip (as a villain's new face, wave 6 Q36)", () => {
  it("surge: the revealing player reveals one more card, and the flipped card stays", () => {
    const attached = revealed(start(), SURGING);
    const before = onTopOfEncounterDeck(attached.state, BLANK.id);
    const { state, events } = play(before, FLIP_REVEAL.card.id);
    expect(reveals(events).map((r) => r.card)).toEqual(["surging", "blank"]);
    expect(events.filter((e) => e.type === "surgeTriggered")).toHaveLength(1);
    expect(locateCard(state, attached.id)?.kind).toBe("attachment");
  });

  it("incite: its threat goes on the main scheme", () => {
    const attached = revealed(start(), INCITING);
    const { state } = play(attached.state, FLIP_REVEAL.card.id);
    expect(mainThreat(state)).toBe(mainThreat(attached.state) + 1);
  });

  it("neither resolves on a flip without the flag", () => {
    const surging = revealed(start(), SURGING);
    const both = revealed(surging.state, INCITING);
    const { state, events } = play(both.state, FLIP_PLAIN.card.id);
    expect(reveals(events)).toEqual([]);
    expect(mainThreat(state)).toBe(mainThreat(both.state));
  });

  it("peril: the revealer resolves the new face's When Revealed alone", () => {
    const soleDecider = (card: AnyCard) => {
      const attached = revealed(start(), card);
      const { events } = play(attached.state, FLIP_REVEAL.card.id);
      const asked = events.flatMap((e) => (e.type === "choiceRequested" ? [e.choice] : []));
      expect(asked).toHaveLength(1);
      return asked[0]!.soleDecider;
    };
    expect(soleDecider(ASKING)).toBe(false);
    expect(soleDecider(PERILOUS)).toBe(true);
  });
});

describe("§3.14 environments and villains keep their wave 6 Q36 behavior", () => {
  it("an environment's plain flip is no reveal, and no canceller is offered (rulings Jan 26, Apr 30, Jun 25, 2026)", () => {
    const wheel = encounterCardInVillainArea(start(), WHEEL.id);
    const spy = playerCardIntoPlay(wheel.state, SPY.id);
    const before = playerCardIntoPlay(spy.state, CANCELLER.id).state;
    const { state, events } = play(before, FLIP_PLAIN.card.id);
    expect(mustInstance(state, wheel.id).flipped).toBe(true);
    expect(counters(state, wheel.id)).toEqual({});
    expect(counters(state, spy.id)).toEqual({ sawFlipped: 1 });
    expect(reveals(events)).toEqual([]);
    expect(offers(events)).toBe(0);
  });

  it("an environment whose card text says 'flip and reveal' is revealed", () => {
    const wheel = encounterCardInVillainArea(start(), WHEEL.id);
    const { state, events } = play(wheel.state, FLIP_REVEAL_ENVIRONMENT.card.id);
    expect(counters(state, wheel.id)).toEqual({ backRevealed: 1 });
    expect(reveals(events)).toEqual([{ card: "wheel", by: P1 }]);
    expect(locateCard(state, wheel.id)).toEqual({ kind: "villainArea" });
  });

  it("a villain's flip reveals its new face once, with the flag or without", () => {
    const before = start({ villain: TWO_FACED });
    const villain = activeVillain(before).instanceId;
    const { state, events } = play(before, FLIP_REVEAL_VILLAIN.card.id);
    expect(activeVillain(state).side).toBe("B");
    expect(counters(state, villain).backRevealed).toBe(1);
    expect(reveals(events)).toEqual([{ card: "two-faced", by: P1 }]);
  });
});

describe("§3.34 a side scheme that flips and reveals its other side scheme face (§4.1 Q19)", () => {
  /** The a face in play holding `carried` threat, a counter and an attachment, then flipped. */
  function flipped(a: AnyCard, flip: CardId, players: 1 | 2 = 1, carried = 5, attachment: AnyCard = CLAMP) {
    const scheme = encounterCardInVillainArea(start({ players }), a.id, carried);
    const clamped = revealed(withTokens(scheme.state, scheme.id, { counters: { mark: 2 } }), attachment);
    expect(mustInstance(clamped.state, scheme.id).attachments).toEqual([clamped.id]);
    return { ...play(clamped.state, flip), id: scheme.id, clamp: clamped.id };
  }

  it("the new face holds the carried threat plus its starting threat, and its When Revealed resolves once", () => {
    const { state, events, id, clamp } = flipped(GRASP, FLIP_REVEAL.card.id);
    const bomb = mustInstance(state, id);
    expect(bomb.cardId).toBe(BOMB.id);
    expect(bomb.threat).toBe(5 + 3);
    expect(bomb.counters).toEqual({ mark: 2, backRevealed: 1 });
    expect(bomb.attachments).toEqual([clamp]);
    expect(locateCard(state, id)).toEqual({ kind: "villainArea" });
    expect(reveals(events)).toEqual([{ card: "bomb", by: P1 }]);
  });

  it("the log shows the flip, the starting threat, then the reveal", () => {
    const { events, id } = flipped(GRASP, FLIP_REVEAL.card.id);
    const flip = indexOf(events, "cardFlippedToOtherFace");
    const threat = events.findIndex((e, i) => i > flip && e.type === "threatPlaced" && e.schemeInstanceId === id);
    const reveal = events.findIndex((e) => e.type === "encounterCardRevealed" && e.instanceId === id);
    expect(flip).toBeGreaterThan(-1);
    expect(threat).toBeGreaterThan(flip);
    expect(reveal).toBeGreaterThan(threat);
  });

  it("a per-player starting threat and hinder are counted in a 1-player and a 2-player game", () => {
    expect(mustInstance(flipped(HOLD, FLIP_REVEAL.card.id, 1).state, idOf(start(), HOLD)).cardId).toBe(BLAST.id);
    const threatAt = (players: 1 | 2) => {
      const { state, id } = flipped(HOLD, FLIP_REVEAL.card.id, players);
      return mustInstance(state, id).threat;
    };
    expect(threatAt(1)).toBe(5 + (1 + 2 * 1) + 2);
    expect(threatAt(2)).toBe(5 + (1 + 2 * 2) + 2);
  });

  it("with no carried threat it holds its starting threat alone", () => {
    const { state, id } = flipped(GRASP, FLIP_REVEAL.card.id, 1, 0);
    expect(mustInstance(state, id).threat).toBe(3);
  });

  it("without the flag the new face enters with its starting threat (wave 4 Q17) and is not revealed", () => {
    const { state, events, id } = flipped(GRASP, FLIP_PLAIN.card.id);
    const bomb = mustInstance(state, id);
    expect(bomb.cardId).toBe(BOMB.id);
    expect(bomb.threat).toBe(5 + 3);
    expect(bomb.counters).toEqual({ mark: 2 });
    expect(reveals(events).filter((r) => r.card === "bomb")).toEqual([]);
  });

  it("a face of another type enters play bare, then is revealed once where it went", () => {
    const { state, events, id } = flipped(CAGE, FLIP_REVEAL.card.id);
    const beast = mustInstance(state, id);
    expect(beast.cardId).toBe(BEAST.id);
    expect(beast.engagedWith).toBe(P1);
    expect(beast.counters).toEqual({ backRevealed: 1 });
    expect(beast.threat).toBe(0);
    expect(locateCard(state, id)).toEqual({ kind: "playArea", playerId: P1 });
    expect(reveals(events).filter((r) => r.card === "beast")).toHaveLength(1);
  });

  it("a flip that waits for its attachment's 'when this leaves play' interrupt still reveals the new face once", () => {
    const { state, events, id, clamp } = flipped(CAGE, FLIP_REVEAL.card.id, 1, 5, LATCH);
    expect(counters(state, activeVillain(state).instanceId).latchLeft).toBe(1);
    expect(locateCard(state, clamp)?.kind).toBe("encounterDiscard");
    expect(mustInstance(state, id)).toMatchObject({ cardId: BEAST.id, engagedWith: P1, attachments: [] });
    expect(counters(state, id)).toEqual({ backRevealed: 1 });
    expect(reveals(events).filter((r) => r.card === "beast")).toHaveLength(1);
    expect(windows(events).filter((kind) => kind === "cardFlipped")).toHaveLength(1);
  });

  it("replays to the same state", () => {
    const { session } = flipped(GRASP, FLIP_REVEAL.card.id);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
