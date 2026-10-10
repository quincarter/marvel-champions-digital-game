/**
 * docs/phase7-wave9.md §3.20: `EffectSpec replaceLeaveDestination { to: { tuckedUnder } }`, from an interrupt to
 * `cardLeavesPlay`. "Forced Interrupt: When an ally leaves play, tuck it under here and place threat here equal to its
 * cost. Then, place 1 acceleration token here.", on a synthetic side scheme (the Vault).
 *
 * Sources: RRG 1.8 "Leaves Play" (p. 27: any move from an in-play area to an out-of-play area; the card's attachments
 * are discarded), "Tuck" (p. 45: "Tucked cards are not in play"; "When a card leaves play, each card tucked under it is
 * discarded"), "Defeat" (p. 15: a defeated ally "is discarded", the placement this replaces, not the defeat),
 * "Permanent" (p. 32), "'Cannot'" (p. 11), "'Would'" (p. 48) and "'Then'" (p. 44).
 *
 * Synthetic cards only: the Vault, allies of several kinds, a witness that counts defeats and leavings, a Net that
 * hears a tuck, and the player events and treacheries that make the allies leave.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubEvent, stubSideScheme, stubSupport, stubTreachery, stubUpgrade } from "./testing/fixtures.js";
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

const self = { kind: "self" } as const;
const you = { kind: "controller" } as const;
const one = { kind: "const", value: 1 } as const;
const it_ = { kind: "eventTarget" } as const;
const named = (name: string): TargetRef => ({ kind: "each", query: { name } });
const VAULT_ID = "vault.interrupt";

/** The Vault's Forced Interrupt (see the file comment). */
const VAULT_INTERRUPT = stubAbility(VAULT_ID, {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", targetIs: { categories: ["ally"] } } },
  effects: [
    { kind: "replaceLeaveDestination", to: { tuckedUnder: self } },
    { kind: "placeThreat", target: self, amount: { kind: "printedCost", of: it_ } },
    { kind: "then", effects: [{ kind: "addAccelerationToken", target: self }] },
  ],
});
/** "Forced Response: After an ally is defeated, place 1 fell counter here." / "After a card leaves play, … 1 left counter." */
const WITNESS_DEFEAT = stubAbility("witness.defeat", {
  trigger: { kind: "response", forced: true, on: { on: "characterDefeated", targetIs: { categories: ["ally"] } } },
  effects: [{ kind: "addCounters", target: self, counterType: "fell", amount: one }],
});
const WITNESS_LEFT = stubAbility("witness.left", {
  trigger: { kind: "response", forced: true, on: { on: "cardLeavesPlay", targetIs: { categories: ["ally"] } } },
  effects: [{ kind: "addCounters", target: self, counterType: "left", amount: one }],
});
/** "When Defeated: Place 1 last counter on the witness." (on Buddy) */
const BUDDY_DEFEATED = stubAbility("buddy.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [{ kind: "addCounters", target: named("witness"), counterType: "last", amount: one }],
});
/** "Forced Interrupt: When an encounter card effect would tuck a card, tuck it under here instead." */
const NET_INTERRUPT = stubAbility("net.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    would: true,
    on: { on: "cardBeingTucked", eventIs: { by: "encounterCard" } },
  },
  effects: [{ kind: "replaceTuckHost", to: self }],
});
const GUARDED_RULE = stubAbility("guarded.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotLeavePlay", target: { self: true }, by: "cardAbilities" }] },
  effects: [],
});
const ROOTED_RULE = stubAbility("rooted.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotLeavePlay", target: { self: true } }] },
  effects: [],
});

const VAULT = stubSideScheme({ id: "vault", startingThreat: 2, boostIcons: 0, abilities: [VAULT_INTERRUPT.ref] });
const WITNESS = stubSupport({ id: "witness", cost: 0, abilities: [WITNESS_DEFEAT.ref, WITNESS_LEFT.ref] });
const NET = stubSupport({ id: "net", cost: 0, abilities: [NET_INTERRUPT.ref] });
const BUDDY = stubAlly({ id: "buddy", cost: 3, atk: 1, thw: 1, hp: 3, abilities: [BUDDY_DEFEATED.ref] });
const PAL = stubAlly({ id: "pal", cost: 2, atk: 1, thw: 1, hp: 3 });
const FIXTURE = stubAlly({ id: "fixture", cost: 1, atk: 1, thw: 1, hp: 3, keywords: [{ name: "permanent" }] });
const GUARDED = stubAlly({ id: "guarded", cost: 1, atk: 1, thw: 1, hp: 3, abilities: [GUARDED_RULE.ref] });
const ROOTED = stubAlly({ id: "rooted", cost: 1, atk: 1, thw: 1, hp: 3, abilities: [ROOTED_RULE.ref] });
const TROPHY = stubAlly({ id: "trophy", cost: 1, atk: 1, thw: 1, hp: 3, keywords: [{ name: "victory", value: 1 }] });
const GIZMO = stubUpgrade({ id: "gizmo", cost: 0 });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

/** A player event and a treachery (When Revealed) that each resolve `effects`. */
function sources(id: string, effects: readonly EffectSpec[]) {
  const action = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  const revealed = stubAbility(`bad-${id}.when-revealed`, { trigger: { kind: "whenRevealed" }, effects });
  return {
    abilities: [action, revealed],
    event: stubEvent({ id, cost: 0, abilities: [action.ref] }),
    treachery: stubTreachery({ id: `bad-${id}`, boostIcons: 0, abilities: [revealed.ref] }),
  };
}
const discard = (name: string) => sources(`discard-${name}`, [{ kind: "discardFromPlay", target: named(name) }]);
const zap = (name: string) =>
  sources(`zap-${name}`, [{ kind: "dealDamage", target: named(name), amount: { kind: "const", value: 5 } }]);

const ZAP = zap("buddy");
const DISCARD = discard("buddy");
const TO_HAND = sources("to-hand", [{ kind: "moveCards", cards: { kind: "ref", ref: named("buddy") }, to: "hand" }]);
const TUCK = sources("tuck", [
  { kind: "tuckCards", cards: { kind: "ref", ref: named("buddy") }, under: named("vault") },
]);
const DISCARD_PAL = discard("pal");
const DISCARD_BOTH = sources("discard-both", [
  {
    kind: "discardFromPlay",
    target: { kind: "each", query: { categories: ["ally"], anyOf: [{ name: "buddy" }, { name: "pal" }] } },
  },
]);
const DISCARD_VAULT = discard("vault");
const DISCARD_FIXTURE = discard("fixture");
const DISCARD_GUARDED = discard("guarded");
const ZAP_GUARDED = zap("guarded");
const DISCARD_ROOTED = discard("rooted");
const ZAP_TROPHY = zap("trophy");
const REVEAL = sources("reveal", [{ kind: "revealEncounterCard", player: you }]);
const ALL = [
  ZAP,
  DISCARD,
  TO_HAND,
  TUCK,
  DISCARD_PAL,
  DISCARD_BOTH,
  DISCARD_VAULT,
  DISCARD_FIXTURE,
  DISCARD_GUARDED,
  ZAP_GUARDED,
  DISCARD_ROOTED,
  ZAP_TROPHY,
  REVEAL,
];
const OTHERS = [WITNESS_DEFEAT, WITNESS_LEFT, BUDDY_DEFEATED, GUARDED_RULE, ROOTED_RULE];
const deps: EngineDeps = depsOf(VAULT_INTERRUPT, NET_INTERRUPT, ...OTHERS, ...ALL.flatMap((set) => set.abilities));
/** The same cards with no Vault ability and no Net: nothing replaces a leaving. */
const quietDeps: EngineDeps = depsOf(...OTHERS, ...ALL.flatMap((set) => set.abilities));

const ALLIES = [BUDDY, PAL, FIXTURE, GUARDED, ROOTED, TROPHY];
type AllyName = "buddy" | "pal" | "fixture" | "guarded" | "rooted" | "trophy";

interface Table {
  readonly state: GameState;
  readonly vault: InstanceId;
  readonly second: InstanceId | null;
  readonly witness: InstanceId;
  readonly net: InstanceId | null;
  /** The allies in play; one not asked for is absent. */
  readonly ally: Readonly<Record<AllyName, InstanceId>>;
  readonly gizmo: InstanceId;
}

/**
 * The Vault in play with 2 threat. P1 controls the witness, Buddy (cost 3, with the Gizmo attached) and Pal (cost 2,
 * P2's in a two-player game); `extra` adds one more ally (three is the ally limit). `vaults: 2` puts a second Vault in
 * play, with 0 threat.
 */
function table(
  options: {
    readonly players?: 1 | 2;
    readonly net?: boolean;
    readonly vaults?: 1 | 2;
    readonly extra?: (typeof ALLIES)[number];
    readonly with?: EngineDeps;
  } = {},
): Table {
  const players = options.players ?? 1;
  const start = gameAtFirstTurn({
    players,
    cards: [VAULT, WITNESS, NET, GIZMO, FILLER, ...ALLIES, ...ALL.flatMap((set) => [set.event, set.treachery])],
    deps: options.with ?? deps,
    deck: [WITNESS.id, NET.id, GIZMO.id, ...ALLIES.map((ally) => ally.id), ...ALL.map((set) => set.event.id)],
    encounter: [VAULT.id, VAULT.id, ...ALL.map((set) => set.treachery.id), ...copiesOf(FILLER.id, 20)],
  });
  const vault = encounterCardInVillainArea(start, VAULT.id, 2);
  const second = options.vaults === 2 ? encounterCardInVillainArea(vault.state, VAULT.id, 0) : null;
  const witness = playerCardIntoPlay(second?.state ?? vault.state, WITNESS.id);
  let s = witness.state;
  const ally = {} as Record<AllyName, InstanceId>;
  for (const card of [BUDDY, PAL, ...(options.extra ? [options.extra] : [])]) {
    const put = playerCardIntoPlay(s, card.id, card === PAL && players === 2 ? P2 : P1);
    ally[`${card.id}` as AllyName] = put.id;
    s = put.state;
  }
  const gizmo = playerCardIntoPlay(s, GIZMO.id);
  const net = options.net ? playerCardIntoPlay(gizmo.state, NET.id) : null;
  s = net?.state ?? gizmo.state;
  // Surgery: the Gizmo attached to Buddy.
  const state: GameState = {
    ...s,
    players: s.players.map((p) =>
      p.playerId === P1 ? { ...p, playArea: p.playArea.filter((id) => id !== gizmo.id) } : p,
    ),
    instances: {
      ...s.instances,
      [gizmo.id]: { ...mustInstance(s, gizmo.id), attachedTo: ally.buddy },
      [ally.buddy]: { ...mustInstance(s, ally.buddy), attachments: [gizmo.id] },
    },
  };
  return {
    state,
    vault: vault.id,
    second: second?.id ?? null,
    witness: witness.id,
    net: net?.id ?? null,
    ally,
    gizmo: gizmo.id,
  };
}

/** Resolves a source's effects from its player event, or from its treachery revealed off the encounter deck. */
function resolve(state: GameState, source: ReturnType<typeof sources>, from: "player" | "encounter", using = deps) {
  if (from === "player") return playFree(state, using, source.event.id);
  return playFree(onTopOfEncounterDeck(state, source.treachery.id), using, REVEAL.event.id);
}

const tucked = (state: GameState, host: InstanceId) => mustInstance(state, host).tucked;
const threat = (state: GameState, id: InstanceId) => mustInstance(state, id).threat;
const tokens = (state: GameState, id: InstanceId) => mustInstance(state, id).counters.acceleration ?? 0;
const seen = (state: GameState, t: Table, counter: "fell" | "left" | "last") =>
  mustInstance(state, t.witness).counters[counter] ?? 0;
const discardOf = (state: GameState, player = P1) => mustPlayer(state, player).discard;
const inPlay = (state: GameState, id: InstanceId) => cardsInPlay(state).includes(id);
const vaultResolved = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === VAULT_ID).length;
const leavings = (events: readonly GameEvent[], id: InstanceId, phase: "initiated" | "resolved") =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === phase && e.event.kind === "cardLeavesPlay" && e.event.instanceId === id
      ? [e.event.to]
      : [],
  );
const discardedFromPlay = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "cardDiscardedFromPlay" ? [e.instanceId] : []));
const unresolved = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "preThenUnresolved" ? [e.cause] : []));
function expectReplays(session: GameSession, using = deps) {
  const replayed = replay(session.log, using);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("§3.20 an ally that leaves play ends tucked under the scheme", () => {
  it("defeated by damage (cost 3, scheme at 2): tucked, 5 threat, 1 token; still defeated, still left play", () => {
    const t = table();
    const { state, events, session } = resolve(t.state, ZAP, "player");
    expect(tucked(state, t.vault)).toEqual([t.ally.buddy]);
    expect(discardOf(state)).not.toContain(t.ally.buddy);
    expect(inPlay(state, t.ally.buddy)).toBe(false);
    expect(threat(state, t.vault)).toBe(5);
    expect(tokens(state, t.vault)).toBe(1);
    // A new copy, faceup, its owner's; its attachment was discarded as it left (RRG 1.8 "Leaves Play", p. 27).
    expect(mustInstance(state, t.ally.buddy)).toMatchObject({
      damage: 0,
      faceup: true,
      controllerId: P1,
      attachedTo: null,
    });
    expect(discardOf(state)).toContain(t.gizmo);
    // It was defeated: its When Defeated resolved, and "after an ally is defeated" answered, once each.
    expect(events.filter((e) => e.type === "characterDefeated" && e.instanceId === t.ally.buddy)).toHaveLength(1);
    expect(seen(state, t, "last")).toBe(1);
    expect(seen(state, t, "fell")).toBe(1);
    // It left play, once, and where it went is under the scheme; it was never discarded.
    expect(seen(state, t, "left")).toBe(1);
    expect(leavings(events, t.ally.buddy, "initiated")).toEqual(["discard"]);
    expect(leavings(events, t.ally.buddy, "resolved")).toEqual(["tucked"]);
    expect(discardedFromPlay(events)).toEqual([t.gizmo]);
    expect(vaultResolved(events)).toBe(1);
    expectReplays(session);
  });

  it.each(["player", "encounter"] as const)("discarded by a %s card's effect: tucked, 5 threat, 1 token", (from) => {
    const t = table();
    const { state, events, session } = resolve(t.state, DISCARD, from);
    expect(tucked(state, t.vault)).toEqual([t.ally.buddy]);
    expect(discardOf(state)).not.toContain(t.ally.buddy);
    expect(threat(state, t.vault)).toBe(5);
    expect(tokens(state, t.vault)).toBe(1);
    expect(seen(state, t, "fell")).toBe(0);
    expect(seen(state, t, "left")).toBe(1);
    expect(discardedFromPlay(events)).toEqual([t.gizmo]);
    expectReplays(session);
  });

  it("returned to its owner's hand: tucked instead, the hand does not have it, 5 threat, 1 token", () => {
    const t = table();
    const { state, session } = resolve(t.state, TO_HAND, "player");
    expect(tucked(state, t.vault)).toEqual([t.ally.buddy]);
    expect(mustPlayer(state, P1).hand).not.toContain(t.ally.buddy);
    expect(mustInstance(state, t.ally.buddy).faceup).toBe(true);
    expect(threat(state, t.vault)).toBe(5);
    expect(tokens(state, t.vault)).toBe(1);
    expectReplays(session);
  });

  it("tucked under the scheme by an encounter card: 1 card under it, one move, 5 threat, 1 token", () => {
    const t = table();
    const { state, events, session } = resolve(t.state, TUCK, "encounter");
    expect(tucked(state, t.vault)).toEqual([t.ally.buddy]);
    expect(threat(state, t.vault)).toBe(5);
    expect(tokens(state, t.vault)).toBe(1);
    expect(unresolved(events)).toEqual([]);
    expect(events.filter((e) => e.type === "cardMoved" && e.to.kind === "tucked")).toHaveLength(1);
    expectReplays(session);
  });

  it("two allies leaving from one effect (costs 3 and 2): both tucked, 7 threat, 2 tokens", () => {
    const t = table();
    const { state, events, session } = resolve(t.state, DISCARD_BOTH, "player");
    expect([...tucked(state, t.vault)].sort()).toEqual([t.ally.buddy, t.ally.pal].sort());
    expect(threat(state, t.vault)).toBe(7);
    expect(tokens(state, t.vault)).toBe(2);
    expect(vaultResolved(events)).toBe(2);
    expect(seen(state, t, "left")).toBe(2);
    expectReplays(session);
  });

  it("another player's ally (cost 2): tucked under its owner's control, 4 threat, 1 token", () => {
    const t = table({ players: 2 });
    const { state, session } = resolve(t.state, DISCARD_PAL, "player");
    expect(tucked(state, t.vault)).toEqual([t.ally.pal]);
    expect(mustInstance(state, t.ally.pal)).toMatchObject({ ownerId: P2, controllerId: P2, faceup: true });
    expect(discardOf(state, P2)).not.toContain(t.ally.pal);
    expect(threat(state, t.vault)).toBe(4);
    expect(tokens(state, t.vault)).toBe(1);
    expectReplays(session);
  });
});

describe("§3.20 the host leaves play afterwards", () => {
  it("the scheme is discarded with 2 allies under it: each goes to its owner's discard pile, faceup", () => {
    const t = table({ players: 2 });
    const first = resolve(t.state, DISCARD_BOTH, "player");
    expect(tucked(first.state, t.vault)).toHaveLength(2);
    const { state, session } = resolve(first.state, DISCARD_VAULT, "player");
    expect(inPlay(state, t.vault)).toBe(false);
    expect(discardOf(state, P1)).toContain(t.ally.buddy);
    expect(discardOf(state, P2)).toContain(t.ally.pal);
    expect(mustInstance(state, t.ally.buddy).faceup).toBe(true);
    // Discarded from under a card, not from play: they do not leave play a second time.
    expect(seen(state, t, "left")).toBe(2);
    expectReplays(session);
  });
});

describe("§3.20 a card that cannot leave play, or has a destination of its own", () => {
  it("a permanent ally a card effect would discard: in play, 0 under the scheme, 2 threat, 0 tokens, not asked", () => {
    const t = table({ extra: FIXTURE });
    const { state, events } = resolve(t.state, DISCARD_FIXTURE, "player");
    expect(inPlay(state, t.ally.fixture)).toBe(true);
    expect(tucked(state, t.vault)).toEqual([]);
    expect(threat(state, t.vault)).toBe(2);
    expect(tokens(state, t.vault)).toBe(0);
    expect(vaultResolved(events)).toBe(0);
  });

  it("'card abilities cannot remove': a discard by an effect does nothing (2 threat); a defeat by damage tucks it (3)", () => {
    const t = table({ extra: GUARDED });
    const kept = resolve(t.state, DISCARD_GUARDED, "encounter");
    expect(inPlay(kept.state, t.ally.guarded)).toBe(true);
    expect(tucked(kept.state, t.vault)).toEqual([]);
    expect(threat(kept.state, t.vault)).toBe(2);
    expect(vaultResolved(kept.events)).toBe(0);
    // Reaching zero hit points is the game's rule, with no card ability behind the leaving (RRG 1.8 "Defeat", p. 15).
    const fell = resolve(t.state, ZAP_GUARDED, "encounter");
    expect(tucked(fell.state, t.vault)).toEqual([t.ally.guarded]);
    expect(threat(fell.state, t.vault)).toBe(3);
    expect(tokens(fell.state, t.vault)).toBe(1);
  });

  it("'cannot leave play': in play, 0 under the scheme, 2 threat, 0 tokens", () => {
    const t = table({ extra: ROOTED });
    const { state, events } = resolve(t.state, DISCARD_ROOTED, "player");
    expect(inPlay(state, t.ally.rooted)).toBe(true);
    expect(tucked(state, t.vault)).toEqual([]);
    expect(threat(state, t.vault)).toBe(2);
    expect(tokens(state, t.vault)).toBe(0);
    expect(vaultResolved(events)).toBe(0);
  });

  it("a defeated Victory 1 ally (cost 1): the victory display, 0 under the scheme; 3 threat, no token (no 'Then')", () => {
    const t = table({ extra: TROPHY });
    const { state, events, session } = resolve(t.state, ZAP_TROPHY, "player");
    expect(state.victoryDisplay).toContain(t.ally.trophy);
    expect(tucked(state, t.vault)).toEqual([]);
    // "… and place threat here equal to its cost" is joined by "and", so it still resolves; the "Then" does not.
    expect(threat(state, t.vault)).toBe(3);
    expect(tokens(state, t.vault)).toBe(0);
    expect(unresolved(events)).toEqual(["leaveNotReplaced"]);
    expectReplays(session);
  });

  it("two schemes with the interrupt: the ally is under exactly 1, and only that one gets a token", () => {
    const t = table({ vaults: 2 });
    const { state, events, session } = resolve(t.state, DISCARD, "player");
    const hosts = [t.vault, t.second!];
    expect(hosts.flatMap((host) => tucked(state, host))).toEqual([t.ally.buddy]);
    const winner = hosts.find((host) => tucked(state, host).length === 1)!;
    const loser = hosts.find((host) => host !== winner)!;
    expect(tokens(state, winner)).toBe(1);
    expect(tokens(state, loser)).toBe(0);
    expect(unresolved(events)).toEqual(["leaveNotReplaced"]);
    expect(vaultResolved(events)).toBe(2);
    expectReplays(session);
  });
});

describe("§3.20 the tuck is a tuck: 'when a card would be tucked' hears it", () => {
  it("the Net sends it under itself: 1 card under the Net, 0 under the scheme; the scheme still gets 5 threat, 1 token", () => {
    const t = table({ net: true });
    const { state, events, session } = resolve(t.state, DISCARD, "player");
    expect(tucked(state, t.net!)).toEqual([t.ally.buddy]);
    expect(tucked(state, t.vault)).toEqual([]);
    expect(inPlay(state, t.ally.buddy)).toBe(false);
    const tucks = events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "cardBeingTucked" ? [e.event] : [],
    );
    expect(tucks).toMatchObject([
      { instanceId: t.ally.buddy, hostInstanceId: t.vault, sourceInstanceId: t.vault, by: "encounterCard" },
    ]);
    expect(threat(state, t.vault)).toBe(5);
    expect(tokens(state, t.vault)).toBe(1);
    expect(seen(state, t, "left")).toBe(1);
    expect(leavings(events, t.ally.buddy, "resolved")).toEqual(["tucked"]);
    expectReplays(session);
  });
});

describe("§3.20 no listener: nothing changes", () => {
  it.each([
    ["a defeat by damage", ZAP],
    ["a discard", DISCARD],
    ["a return to hand", TO_HAND],
  ] as const)(
    "%s with the interrupt in the registry but not in play: the log and state of the registry without it",
    (_, source) => {
      const strip = (state: GameState): GameState => ({
        ...state,
        villainArea: state.villainArea.filter((id) => mustInstance(state, id).cardId !== VAULT.id),
      });
      const loud = table();
      const quiet = table({ with: quietDeps });
      const a = resolve(strip(quiet.state), source, "player", quietDeps);
      const b = resolve(strip(loud.state), source, "player");
      expect(b.events).toEqual(a.events);
      expect(b.state).toEqual(a.state);
      expect(source === TO_HAND ? mustPlayer(b.state, P1).hand : discardOf(b.state)).toContain(loud.ally.buddy);
      expectReplays(a.session, quietDeps);
      expectReplays(b.session);
    },
  );
});
