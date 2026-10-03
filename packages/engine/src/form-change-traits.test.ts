/**
 * docs/phase7-wave6.md §3.56: the traits a form change left behind. "Response: After a MUTANT alter-ego changes into
 * hero form, exhaust Moira MacTaggert → that hero's controller draws 1 card." (Moira MacTaggert, `rogue` 38018). Once
 * the identity has changed it shows its hero face, which need not have the trait (MUTANT is printed on the alter-ego
 * faces), so `formChanged.fromTraits` carries the identity's traits just before the change, printed and granted
 * (copied ones included, §3.50), and a pattern's `targetIs` trait clauses read them as they read
 * `cardLeavesPlay.traits`. The rest of the query reads the identity as it now is.
 *
 * Sources: RRG 1.8 "Form, Change Form" (p. 21: only the form changes; lasting effects stay), "Traits" (p. 45), "Gains"
 * (p. 21).
 *
 * Synthetic cards only; the engine never names a card.
 */

import { flat, trait, type CardId, type Trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { ALLY, defaultPick, giveCard, newGame, RESOURCE } from "./testing/scenario.js";
import { playerCardIntoPlay } from "./testing/wave3.js";
import type { TriggerEvent } from "./trigger-events.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const you = { kind: "controller" } as const;
const yourIdentity: TargetRef = { kind: "identityOf", player: you };

const MUTANT = trait("MUTANT");
const CIVILIAN = trait("CIVILIAN");
const AVENGER = trait("AVENGER");
const X_MEN = trait("X-MEN");

/** MUTANT and CIVILIAN on the alter-ego face only; AVENGER on the hero face only. */
const MUTIE = (() => {
  const printed = stubIdentity({
    id: "mutie",
    hp: 20,
    atk: 1,
    thw: 1,
    def: 1,
    rec: 1,
    heroHandSize: 5,
    alterEgoHandSize: 6,
    heroTraits: [AVENGER],
  });
  return { ...printed, alterEgo: { ...printed.alterEgo, traits: [MUTANT, CIVILIAN] } };
})();

/** A forced response on the villain to an identity change `to` a form, its `targetIs` the query given. */
const watcher = (id: string, to: "hero" | "alterEgo", targetIs: TargetQuery): StubAbility =>
  stubAbility(`${id}.forced-response`, {
    trigger: {
      kind: "response",
      forced: true,
      on: { on: "formChanged", eventIs: { to, change: "identity" }, targetIs },
    },
    effects: [],
  });
const MUT_TO_HERO = watcher("mut-to-hero", "hero", { trait: MUTANT });
/** The near miss: the face now showing has AVENGER, the one left did not. */
const AVG_TO_HERO = watcher("avg-to-hero", "hero", { trait: AVENGER });
const AVG_TO_AE = watcher("avg-to-ae", "alterEgo", { trait: AVENGER });
const MUT_TO_AE = watcher("mut-to-ae", "alterEgo", { trait: MUTANT });
const NOT_MUT_TO_AE = watcher("not-mut-to-ae", "alterEgo", { withoutTrait: MUTANT });
const ANY_TO_HERO = watcher("any-to-hero", "hero", { anyTrait: [X_MEN, CIVILIAN] });
const XMEN_TO_HERO = watcher("xmen-to-hero", "hero", { trait: X_MEN });
/** Only the trait clause reads the old face: "a MUTANT [that is now a] hero" matches, "… alter-ego" does not. */
const MUT_NOW_HERO = watcher("mut-now-hero", "hero", { trait: MUTANT, categories: ["hero"] });
const MUT_NOW_AE = watcher("mut-now-ae", "hero", { trait: MUTANT, categories: ["alterEgo"] });
const WATCHERS = [
  MUT_TO_HERO,
  AVG_TO_HERO,
  AVG_TO_AE,
  MUT_TO_AE,
  NOT_MUT_TO_AE,
  ANY_TO_HERO,
  XMEN_TO_HERO,
  MUT_NOW_HERO,
  MUT_NOW_AE,
];

/** Moira's shape: an optional response on a support, exhaust it → "that hero's controller" draws 1. */
const MOIRA = stubAbility("moira-like.response", {
  trigger: {
    kind: "response",
    forced: false,
    on: { on: "formChanged", eventIs: { to: "hero", change: "identity" }, targetIs: { trait: MUTANT } },
  },
  cost: { exhaustSelf: true },
  effects: [{ kind: "draw", player: { kind: "eventPlayer" }, amount: { kind: "const", value: 1 } }],
});
const MOIRA_CARD = stubSupport({ id: "moira-like", cost: 0, abilities: [MOIRA.ref] });

const PAL = stubAlly({ id: "pal", cost: 0, atk: 1, thw: 1, hp: 3, traits: [X_MEN] });
const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const TO_AE = actionEvent("to-ae", [{ kind: "changeForm", player: you, to: "alterEgo" }]);
const TO_HERO = actionEvent("to-hero", [{ kind: "changeForm", player: you, to: "hero" }]);
const GAIN_XMEN = actionEvent("gain-xmen", [
  { kind: "grantTraitUntil", trait: X_MEN, target: yourIdentity, until: "endOfRound" },
]);
/** §3.50's copy: "you gain each of [the pal]'s traits". */
const COPY_PAL = actionEvent("copy-pal", [
  {
    kind: "grantTraitUntil",
    traitsOf: { kind: "each", query: { name: "pal" } },
    target: yourIdentity,
    until: "endOfRound",
  },
]);
const EVENTS = [TO_AE, TO_HERO, GAIN_XMEN, COPY_PAL];

const VILLAIN = stubVillain({
  id: "calm-villain",
  stages: [{ hp: flat(30), atk: 0, sch: 0, abilities: WATCHERS.map((w) => w.ref) }],
});
const QUIET_VILLAIN = stubVillain({ id: "quiet-villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

const ALL_DEPS: EngineDeps = depsOf(...WATCHERS, MOIRA, ...EVENTS.map((e) => e.ability));
const NO_WATCHERS: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));

interface Table {
  readonly state: GameState;
  readonly deps: EngineDeps;
  /** The events handed to p1, by card id. */
  readonly hand: Readonly<Record<string, InstanceId>>;
}

/** A game at p1's first turn, both seats MUTIE (alter-ego), p1 holding every test event. */
function table(opts: { players?: 1 | 2; watchers?: boolean; pal?: boolean; moira?: boolean } = {}): Table {
  const deps = opts.watchers === false ? NO_WATCHERS : ALL_DEPS;
  let state = newGame({
    identity: MUTIE,
    players: opts.players ?? 1,
    villain: opts.watchers === false ? QUIET_VILLAIN : VILLAIN,
    mainScheme: SCHEME,
    extraCards: [BLANK, PAL, MOIRA_CARD, ...EVENTS.map((e) => e.card)],
    deck: [
      ...EVENTS.flatMap((e) => copies(e.card.id, 2)),
      PAL.id,
      MOIRA_CARD.id,
      ...copies(RESOURCE.id, 10),
      ...copies(ALLY.id, 4),
    ],
    encounterDeck: copies(BLANK.id, 20),
    deps,
  });
  const hand: Record<string, InstanceId> = {};
  for (const event of EVENTS) {
    const given = giveCard(state, p1, event.card.id);
    state = given.state;
    hand[event.card.id] = given.id;
  }
  if (opts.pal) state = playerCardIntoPlay(state, PAL.id).state;
  if (opts.moira) state = playerCardIntoPlay(state, MOIRA_CARD.id).state;
  return { state, deps, hand };
}

const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const changeForm = (player: PlayerId = p1): Command => ({ type: "changeForm", playerId: player });

/** Takes every Moira-shaped response offered; everything else by default. */
const takeMoira = (state: GameState): readonly string[] => {
  const offered = (state.pendingChoice?.options ?? []).filter((o) => o.optionId.includes(MOIRA.ref.id));
  return offered.length > 0 ? [offered[0]!.optionId] : defaultPick(state);
};

/** Runs the commands through a session, checks the log replays to the same state, and returns state and events. */
function drive(t: Table, commands: readonly Command[], pick = defaultPick) {
  const result = runCommandsPicking(t.state, t.deps, pick, ...commands);
  const replayed = replay(result.session.log, t.deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.state);
  return result;
}

/** The watchers that resolved, in order, by name. */
const resolvedWatchers = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((e) =>
    e.type === "abilityResolved" && e.abilityId.endsWith(".forced-response")
      ? [e.abilityId.replace(".forced-response", "")]
      : [],
  );
/** Each identity change's `fromTraits`, sorted, as announced (only when a window opened for it). */
const announcedFromTraits = (events: readonly GameEvent[]): readonly (readonly Trait[] | undefined)[] => {
  const seen: TriggerEvent[] = [];
  for (const e of events) {
    if (e.type !== "windowOpened" || e.event.kind !== "formChanged" || seen.includes(e.event)) continue;
    seen.push(e.event);
  }
  return seen.map((e) => (e.kind === "formChanged" && e.fromTraits ? [...e.fromTraits].sort() : undefined));
};
const sorted = (...traits: readonly Trait[]) => [...traits].sort();
const form = (state: GameState, player: PlayerId = p1) => mustPlayer(state, player).identity.form;

describe("§3.56 formChanged.fromTraits: the traits of the face left behind", () => {
  it("alter-ego to hero: the old face's MUTANT matches, the new face's AVENGER does not", () => {
    const t = table();
    expect(form(t.state)).toBe("alterEgo");
    const { state, events } = drive(t, [changeForm()]);
    expect(form(state)).toBe("hero");
    expect(resolvedWatchers(events)).toEqual(["mut-to-hero", "any-to-hero", "mut-now-hero"]);
    expect(announcedFromTraits(events)).toEqual([sorted(MUTANT, CIVILIAN)]);
  });

  it("hero to alter-ego: the hero face's AVENGER matches, the alter-ego face's MUTANT does not", () => {
    const t = table();
    const { state, events } = drive(t, [changeForm(), play(t.hand["to-ae"]!)]);
    expect(form(state)).toBe("alterEgo");
    expect(resolvedWatchers(events)).toEqual([
      "mut-to-hero",
      "any-to-hero",
      "mut-now-hero",
      "avg-to-ae",
      "not-mut-to-ae",
    ]);
    expect(announcedFromTraits(events)).toEqual([sorted(MUTANT, CIVILIAN), [AVENGER]]);
  });

  it("several changes in one round: each announcement carries its own face's traits", () => {
    const t = table();
    const { state, events } = drive(t, [changeForm(), play(t.hand["to-ae"]!), play(t.hand["to-hero"]!)]);
    expect(form(state)).toBe("hero");
    expect(state.round).toBe(1);
    expect(resolvedWatchers(events)).toEqual([
      "mut-to-hero",
      "any-to-hero",
      "mut-now-hero",
      "avg-to-ae",
      "not-mut-to-ae",
      "mut-to-hero",
      "any-to-hero",
      "mut-now-hero",
    ]);
    expect(announcedFromTraits(events)).toEqual([sorted(MUTANT, CIVILIAN), [AVENGER], sorted(MUTANT, CIVILIAN)]);
  });

  it("no change of form: nothing is announced and nothing triggers", () => {
    const t = table();
    // Already in alter-ego form: the effect changes nothing (spec `changeForm`: no `formChanged` announced).
    const { state, events } = drive(t, [play(t.hand["to-ae"]!), play(t.hand["gain-xmen"]!)]);
    expect(form(state)).toBe("alterEgo");
    expect(events.filter((e) => e.type === "formChanged")).toEqual([]);
    expect(resolvedWatchers(events)).toEqual([]);
  });

  it("a trait granted before the change counts as the old face's", () => {
    const t = table();
    const { events } = drive(t, [play(t.hand["gain-xmen"]!), changeForm()]);
    expect(resolvedWatchers(events)).toEqual(["mut-to-hero", "any-to-hero", "xmen-to-hero", "mut-now-hero"]);
    expect(announcedFromTraits(events)).toEqual([sorted(MUTANT, CIVILIAN, X_MEN)]);
  });

  it("a trait copied (§3.50) before the change counts; without the copy it does not", () => {
    const copied = table({ pal: true });
    const withCopy = drive(copied, [play(copied.hand["copy-pal"]!), changeForm()]);
    expect(resolvedWatchers(withCopy.events)).toEqual(["mut-to-hero", "any-to-hero", "xmen-to-hero", "mut-now-hero"]);
    expect(announcedFromTraits(withCopy.events)).toEqual([sorted(MUTANT, CIVILIAN, X_MEN)]);

    const plain = table({ pal: true });
    const without = drive(plain, [changeForm()]);
    expect(resolvedWatchers(without.events)).toEqual(["mut-to-hero", "any-to-hero", "mut-now-hero"]);
  });

  it("Moira's shape: another player's MUTANT alter-ego changes to hero, that hero's controller draws", () => {
    const t = table({ players: 2, moira: true });
    const moiraId = mustPlayer(t.state, p1).playArea.find((id) => mustInstance(t.state, id).cardId === MOIRA_CARD.id)!;
    const { state: atP2, events: before } = drive(t, [{ type: "endTurn", playerId: p1 }], takeMoira);
    expect(before.filter((e) => e.type === "formChanged")).toEqual([]);
    const handBefore = mustPlayer(atP2, p2).hand.length;
    const p1HandBefore = mustPlayer(atP2, p1).hand.length;
    const { state, events } = drive({ ...t, state: atP2 }, [changeForm(p2)], takeMoira);
    expect(form(state, p2)).toBe("hero");
    expect(mustInstance(state, moiraId).exhausted).toBe(true);
    expect(mustPlayer(state, p2).hand.length).toBe(handBefore + 1);
    expect(mustPlayer(state, p1).hand.length).toBe(p1HandBefore);
    expect(events.filter((e) => e.type === "abilityResolved" && e.abilityId === MOIRA.ref.id)).toHaveLength(1);
  });

  it("with no card listening: no window opens and the log's formChanged entry is unchanged", () => {
    const t = table({ watchers: false });
    const { state, events } = drive(t, [changeForm(), play(t.hand["to-ae"]!)]);
    expect(form(state)).toBe("alterEgo");
    expect(events.filter((e) => e.type === "windowOpened")).toEqual([]);
    expect(events.filter((e) => e.type === "formChanged")).toEqual([
      { type: "formChanged", playerId: p1, to: "hero" },
      { type: "formChanged", playerId: p1, to: "alterEgo", byEffect: true },
    ]);
  });
});
