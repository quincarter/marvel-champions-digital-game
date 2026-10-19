/**
 * An ability whose effects changed nothing has not resolved (RRG 1.8 "Resolve", p. 37: "An ability is resolved when it
 * is triggered and one or more of its effects resolve"; FFG ruling on Citywide Crisis, RRG 1.0-1.4 era,
 * docs/rulings/rrg-1-0-to-1-4/10-expansion-card-questions-part-3.md). `<bind>.count`, `<bind>.resolved` and the
 * `abilityResolved` announcement all read the same game fingerprint (docs/phase7-wave11-scenarios.md §S7 E33).
 */
import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { locateCard } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSideScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import {
  encounterCardInVillainArea,
  gameAtFirstTurn,
  onTopOfEncounterDeck,
  P1,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const threat = (amount: number): EffectSpec => ({
  kind: "placeThreat",
  target: { kind: "self" },
  amount: { kind: "const", value: amount },
});
/** Special: place 1 threat here (changes the game). */
const CHANGES = stubAbility("changes.special", { trigger: { kind: "special" }, effects: [threat(1)] });
/** Special: place 0 threat here (changes nothing). */
const NOOP = stubAbility("noop.special", { trigger: { kind: "special" }, effects: [threat(0)] });
/** Special: place 0 threat here, then 1 (only its second effect changes the game). */
const PARTIAL = stubAbility("partial.special", { trigger: { kind: "special" }, effects: [threat(0), threat(1)] });
const scheme = (id: string, ability: typeof CHANGES) =>
  stubSideScheme({ id, startingThreat: 0, boostIcons: 0, abilities: [ability.ref] });
const CHANGING = scheme("changing", CHANGES);
const NOOPING = scheme("nooping", NOOP);
const PARTIALLY = scheme("partially", PARTIAL);
/** "When Revealed: Resolve the 'Special' ability on each side scheme, then discard each side scheme resolved this way." */
const SWEEP = stubAbility("sweep.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    { kind: "resolveSpecials", of: { kind: "each", query: { categories: ["sideScheme"] } }, bind: "r" },
    { kind: "discardFromPlay", target: { kind: "slot", slot: "r.resolved" } },
  ],
});
const SWEEP_CARD = stubTreachery({ id: "sweep", boostIcons: 0, abilities: [SWEEP.ref] });
/** "Forced Response: After [an ability] resolves, place 1 threat on the main scheme." One per watched ability. */
const watcher = (watched: string) =>
  stubAbility(`watch-${watched}.response`, {
    trigger: { kind: "response", forced: true, on: { on: "abilityResolved", eventIs: { abilityId: watched } } },
    effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } }],
  });
const WATCHERS = [CHANGES, NOOP, PARTIAL].map((a) => watcher(a.ref.id));
const WATCH_CARDS = WATCHERS.map((w, i) => stubSupport({ id: `watch-${i}`, cost: 0, abilities: [w.ref] }));
const BLANK = stubTreachery({ id: "blank-boost-e33", boostIcons: 0 });
const VILLAIN = stubVillain({ id: "quiet-e33", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const deps: EngineDeps = depsOf(CHANGES, NOOP, PARTIAL, SWEEP, ...WATCHERS);

function reveal(watch: boolean) {
  const schemes = [CHANGING, NOOPING, PARTIALLY];
  let state: GameState = gameAtFirstTurn({
    cards: [...schemes, SWEEP_CARD, BLANK, VILLAIN, ...WATCH_CARDS],
    deps,
    villain: VILLAIN,
    deck: WATCH_CARDS.map((c) => c.id),
    encounter: [...schemes.map((s) => s.id), SWEEP_CARD.id, ...Array.from({ length: 10 }, () => BLANK.id)],
  });
  const ids: Record<string, InstanceId> = {};
  for (const s of schemes) {
    const placed = encounterCardInVillainArea(state, s.id);
    state = placed.state;
    ids[s.id] = placed.id;
  }
  const watchers: InstanceId[] = [];
  if (watch)
    for (const card of WATCH_CARDS) {
      const placed = playerCardIntoPlay(state, card.id as CardId, P1);
      state = placed.state;
      watchers.push(placed.id);
    }
  state = onTopOfEncounterDeck(onTopOfEncounterDeck(state, SWEEP_CARD.id), BLANK.id);
  const { session, events } = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }], defaultPick);
  const fired = watchers.map(
    (id) => events.filter((e) => e.type === "threatPlaced" && e.sourceInstanceId === id).length,
  );
  const inPlay = (card: string) => locateCard(session.state, ids[card]!)?.kind === "villainArea";
  return { fired, inPlay };
}

describe("E33: a no-op Special is neither `<bind>.resolved` nor announced as resolved", () => {
  it("only the side schemes whose Special changed the game are discarded as resolved", () => {
    const { inPlay } = reveal(false);
    expect(inPlay("changing")).toBe(false);
    expect(inPlay("partially")).toBe(false);
    expect(inPlay("nooping")).toBe(true);
  });

  it("'after [ability] resolves' hears the changing and the partly changing Special, not the no-op", () => {
    const { fired } = reveal(true);
    // CHANGES, NOOP, PARTIAL in that order.
    expect(fired).toEqual([1, 0, 1]);
  });
});
