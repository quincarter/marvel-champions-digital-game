/**
 * docs/phase7-wave3.md §3.5: the patrol keyword. While a minion with it is engaged with a player, that player cannot
 * thwart the main scheme — neither with a basic thwart nor with a "(thwart)" ability — but other threat removal, and
 * thwarting a side scheme, still work. Synthetic cards shaped like Badoon Lieutenant, Kree Commando, Servant Bot and
 * Enraged Symbiote (`Patrol.`).
 *
 * Sources: RRG 1.8 "Patrol" (p. 32), "Thwart" (p. 44), "Crisis Icon" (p. 14); FAQ "Wasp (#1C)" (RRG 1.8 p. 61).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, startSession } from "./engine.js";
import { legalActions } from "./legal.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSideScheme } from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  P2,
  playFree,
} from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const mainScheme: TargetRef = { kind: "mainScheme" };

const LIEUTENANT = stubMinion({ id: "lieutenant", atk: 2, sch: 2, hp: 6, keywords: [{ name: "patrol" }] });
const BYSTANDER = stubMinion({ id: "bystander", atk: 1, sch: 1, hp: 3 });
const SIDE = stubSideScheme({ id: "side", startingThreat: 3 });

const actionEvent = (id: string, effects: readonly EffectSpec[], label?: readonly "thwart"[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects, ...(label ? { label } : {}) });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Hero Action (thwart): Remove 3 threat from the main scheme." — a thwart. */
const THWART_MAIN = actionEvent("thwart-main", [{ kind: "thwart", target: mainScheme, amount: n(3) }]);
/** "Remove 2 threat from the main scheme." — threat removal that is not a thwart. */
const REMOVE_MAIN = actionEvent("remove-main", [{ kind: "removeThreat", target: mainScheme, amount: n(2) }]);
/** Defeats every minion (so the patrol minion leaves). */
const SWEEP = actionEvent("sweep", [
  { kind: "dealDamage", target: { kind: "each", query: { categories: ["minion"] } }, amount: n(20) },
]);
const chosenScheme: TargetRef = { kind: "slot", slot: "scheme" };
const aScheme: EffectSpec = {
  kind: "chooseTarget",
  slot: "scheme",
  chooser: { kind: "controller" },
  query: { categories: ["scheme"] },
};
/** "Hero Action (thwart): Remove 3 threat from a scheme." */
const THWART_A_SCHEME = actionEvent(
  "thwart-a-scheme",
  [aScheme, { kind: "thwart", target: chosenScheme, amount: n(3) }],
  ["thwart"],
);
/** "…, ignoring any crisis icons in play." (Cable Arrow's wording.) */
const THWART_IGNORING_CRISIS = actionEvent("thwart-ignoring-crisis", [
  aScheme,
  { kind: "thwart", target: chosenScheme, amount: n(3), ignoreCrisis: true },
]);
/** "(thwart): Remove 1 threat from each scheme." */
const THWART_EACH = actionEvent("thwart-each", [
  { kind: "thwart", target: { kind: "each", query: { categories: ["scheme"] } }, amount: n(1) },
]);
/** A thwart that also does something else to its target: the target is valid if either effect can affect it. */
const THWART_AND_MARK = actionEvent("thwart-and-mark", [
  aScheme,
  { kind: "thwart", target: chosenScheme, amount: n(3) },
  { kind: "addCounters", target: chosenScheme, counterType: "mark", amount: n(1) },
]);
/**
 * The target is chosen while it is valid, then a patrol minion engages before the thwart resolves: the analogue of a
 * Guard minion engaging during step-5 cost payment (ruling, Apr 30, 2026 (2)). The removal is blocked as it applies.
 */
const CHOOSE_ENGAGE_THWART = actionEvent("choose-engage-thwart", [
  aScheme,
  { kind: "engage", minion: { kind: "named", name: "lieutenant" }, player: { kind: "controller" } },
  { kind: "thwart", target: chosenScheme, amount: n(3) },
]);
/** "Remove 2 threat from a scheme." — single-target threat removal that is not a thwart. */
const REMOVE_A_SCHEME = actionEvent("remove-a-scheme", [
  aScheme,
  { kind: "removeThreat", target: chosenScheme, amount: n(2) },
]);
const EVENTS = [
  THWART_MAIN,
  REMOVE_MAIN,
  SWEEP,
  THWART_A_SCHEME,
  THWART_IGNORING_CRISIS,
  THWART_EACH,
  THWART_AND_MARK,
  CHOOSE_ENGAGE_THWART,
  REMOVE_A_SCHEME,
];

const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));
/** A side scheme with a crisis icon: while it is in play, players cannot remove threat from the main scheme. */
const CRISIS = stubSideScheme({ id: "crisis-side", startingThreat: 2, icons: ["crisis"] });
const CARDS = [LIEUTENANT, BYSTANDER, SIDE, CRISIS, ...EVENTS.map((e) => e.card)];
const ENCOUNTER: readonly CardId[] = [LIEUTENANT.id, BYSTANDER.id, SIDE.id, CRISIS.id, ...copiesOf(BYSTANDER.id, 20)];

/** Both players' identities in hero form, 5 threat on the main scheme, and the patrol minion engaged with `patrolled`. */
function start(patrolled: PlayerId | null, players: 1 | 2 = 1): GameState {
  let state = gameAtFirstTurn({
    cards: CARDS,
    deps,
    encounter: ENCOUNTER,
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
    players,
  });
  state = {
    ...state,
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
    instances: {
      ...state.instances,
      [state.mainScheme.instanceId]: { ...mustInstance(state, state.mainScheme.instanceId), threat: 5 },
    },
  };
  if (patrolled) state = minionEngagedWith(state, LIEUTENANT.id, patrolled).state;
  return state;
}

const mainThreat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const basicThwart = (player: PlayerId, scheme: InstanceId, state: GameState): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: mustPlayer(state, player).identity.instanceId,
  schemeInstanceId: scheme,
});

/** Plays `card` from `player`'s hand for 0, returning the engine's answer (nothing is resolved). */
function attempt(state: GameState, card: CardId, player: PlayerId = P1) {
  const given = giveCard(state, player, card);
  const result = applyCommand(
    given.state,
    { type: "playCard", playerId: player, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  return { given, result };
}

const offered = (state: GameState, id: InstanceId, player: PlayerId = P1): boolean => {
  const legal = legalActions(state, player, deps);
  return legal.kind === "turn" && legal.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id);
};

/** Plays `card`, recording every scheme a target prompt offers, and answering with the first one. */
function playRecordingOffers(state: GameState, card: CardId) {
  const offers: (readonly string[])[] = [];
  const given = giveCard(state, P1, card);
  const { session, events } = driveSession(
    startSession(given.state),
    deps,
    [{ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
    (current) => {
      const choice = current.pendingChoice;
      if (choice?.prompt.kind === "chooseTarget") offers.push(choice.options.map((o) => o.optionId));
      return defaultPick(current);
    },
  );
  return { state: session.state, events, offers };
}

describe("§3.5 Patrol", () => {
  it("the engaged player cannot make a basic thwart against the main scheme", () => {
    const state = start(P1);
    const result = applyCommand(state, basicThwart(P1, state.mainScheme.instanceId, state), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("patrol");
  });

  it("…but may still thwart a side scheme", () => {
    const withSide = encounterCardInVillainArea(start(P1), SIDE.id, 3);
    const { session } = driveSession(startSession(withSide.state), deps, [
      basicThwart(P1, withSide.id, withSide.state),
    ]);
    expect(mustInstance(session.state, withSide.id).threat).toBeLessThan(3);
  });

  it("a '(thwart)' ability whose only target is the main scheme cannot be played (§4 Q5)", () => {
    const { given, result } = attempt(start(P1), THWART_MAIN.card.id);
    expect(result).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
    expect(offered(given.state, given.id)).toBe(false);
  });

  it("threat removal that is not a thwart still removes threat from the main scheme", () => {
    const { state } = playFree(start(P1), deps, REMOVE_MAIN.card.id);
    expect(mainThreat(state)).toBe(3);
  });

  it("a patrol minion engaged with another player restricts only that player", () => {
    const state = start(P2, 2);
    const { session } = driveSession(startSession(state), deps, [basicThwart(P1, state.mainScheme.instanceId, state)]);
    expect(mainThreat(session.state)).toBeLessThan(5);
    const blocked = applyCommand(state, basicThwart(P2, state.mainScheme.instanceId, state), deps);
    expect(blocked.ok).toBe(false);
  });

  it("once the patrol minion leaves play, the player may thwart the main scheme again", () => {
    const swept = playFree(start(P1), deps, SWEEP.card.id).state;
    const { session } = driveSession(startSession(swept), deps, [basicThwart(P1, swept.mainScheme.instanceId, swept)]);
    expect(mainThreat(session.state)).toBeLessThan(5);
  });

  it("a minion without the keyword restricts nothing", () => {
    const state = minionEngagedWith(start(null), BYSTANDER.id).state;
    const { state: after } = playFree(state, deps, THWART_MAIN.card.id);
    expect(mainThreat(after)).toBe(2);
  });
});

/** `state` with P1's hero confused (test surgery). */
function confuseHero(state: GameState): GameState {
  const hero = mustPlayer(state, P1).identity.instanceId;
  const instance = mustInstance(state, hero);
  return {
    ...state,
    instances: { ...state.instances, [hero]: { ...instance, statuses: { ...instance.statuses, confused: 1 } } },
  };
}

/**
 * RRG 1.8 "Confuse, Confused" (p. 13): "A confused character can attempt to thwart or use a thwart ability even if it
 * has no valid target for a thwart." A confused hero's basic thwart against the main scheme is not refused under patrol
 * or crisis: the attempt removes the confused status card and no threat, and the hero exhausts.
 */
describe("§3.5 a confused hero may attempt a basic thwart it has no valid target for", () => {
  const attemptThwart = (state: GameState) => {
    const hero = mustPlayer(state, P1).identity.instanceId;
    const { session, events } = driveSession(startSession(state), deps, [
      basicThwart(P1, state.mainScheme.instanceId, state),
    ]);
    return { after: session.state, events, hero };
  };

  it("while patrolled", () => {
    const { after, events, hero } = attemptThwart(confuseHero(start(P1)));
    expect(mustInstance(after, hero).statuses.confused).toBe(0);
    expect(mustInstance(after, hero).exhausted).toBe(true);
    expect(mainThreat(after)).toBe(5);
    expect(events).toContainEqual(expect.objectContaining({ type: "statusRemoved", status: "confused" }));
  });

  it("under a crisis icon", () => {
    const crisis = encounterCardInVillainArea(start(null), CRISIS.id, 2).state;
    const { after, hero } = attemptThwart(confuseHero(crisis));
    expect(mustInstance(after, hero).statuses.confused).toBe(0);
    expect(mainThreat(after)).toBe(5);
  });

  it("…while an unconfused hero is still refused", () => {
    const result = applyCommand(start(P1), basicThwart(P1, start(P1).mainScheme.instanceId, start(P1)), deps);
    expect(result).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
  });
});

/**
 * §4 Q5, resolved 2026-09-25: target validity. RRG 1.8 "Target" (pp. 42–43): "A target that cannot be thwarted is not
 * a valid target for a thwart-labeled ability", and an ability with multiple effects on its target keeps it as a valid
 * target if at least one of them can affect it. RRG 1.8 "Patrol" (p. 32), "Crisis Icon" (p. 14). Rulings, Apr 30,
 * 2026 (1) and (2).
 */
describe("§3.5 Patrol and crisis: target validity (§4 Q5)", () => {
  it("patrolled, with only the main scheme to choose: the '(thwart)' is refused and not offered", () => {
    const { given, result } = attempt(start(P1), THWART_A_SCHEME.card.id);
    expect(result).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
    expect(offered(given.state, given.id)).toBe(false);
  });

  it("…unless the hero is confused: a confused character may attempt it, and the attempt discards the card", () => {
    const confused = confuseHero(start(P1));
    const hero = mustPlayer(confused, P1).identity.instanceId;
    const { result } = attempt(confused, THWART_A_SCHEME.card.id);
    expect(result.ok).toBe(true);
    const after = playFree(confused, deps, THWART_A_SCHEME.card.id).state;
    expect(mustInstance(after, hero).statuses.confused).toBe(0);
    expect(mainThreat(after)).toBe(5);
  });

  it("…while a player who is not patrolled may play it against the main scheme", () => {
    const { given, result } = attempt(start(null), THWART_A_SCHEME.card.id);
    expect(result.ok).toBe(true);
    expect(offered(given.state, given.id)).toBe(true);
    expect(mainThreat(playFree(start(null), deps, THWART_A_SCHEME.card.id).state)).toBe(2);
  });

  it("patrolled, with a side scheme in play: offered, and the choice excludes the main scheme", () => {
    const withSide = encounterCardInVillainArea(start(P1), SIDE.id, 3);
    const { given, result } = attempt(withSide.state, THWART_A_SCHEME.card.id);
    expect(result.ok).toBe(true);
    expect(offered(given.state, given.id)).toBe(true);
    const played = playRecordingOffers(withSide.state, THWART_A_SCHEME.card.id);
    expect(played.offers).toEqual([[withSide.id]]);
    expect(mustInstance(played.state, withSide.id).threat).toBe(0);
    expect(mainThreat(played.state)).toBe(5);
  });

  it("patrol does not touch threat removal that is not a thwart", () => {
    const played = playRecordingOffers(start(P1), REMOVE_A_SCHEME.card.id);
    expect(mainThreat(played.state)).toBe(3);
  });

  it("a thwart that also does something else to its target keeps the main scheme as a valid target", () => {
    const state = start(P1);
    const { result } = attempt(state, THWART_AND_MARK.card.id);
    expect(result.ok).toBe(true);
    const played = playRecordingOffers(state, THWART_AND_MARK.card.id);
    expect(played.offers).toEqual([[state.mainScheme.instanceId]]);
    // The counter is placed; the thwart part does nothing to the main scheme, and the backstop logs why.
    expect(mustInstance(played.state, state.mainScheme.instanceId).counters.mark).toBe(1);
    expect(mainThreat(played.state)).toBe(5);
    expect(played.events).toContainEqual(expect.objectContaining({ type: "threatRemovalBlocked", reason: "patrol" }));
  });

  it("'each scheme' still initiates while one scheme is valid, and skips the main scheme", () => {
    const withSide = encounterCardInVillainArea(start(P1), SIDE.id, 3);
    const { state } = playFree(withSide.state, deps, THWART_EACH.card.id);
    expect(mustInstance(state, withSide.id).threat).toBe(2);
    expect(mainThreat(state)).toBe(5);
  });

  it("'each scheme' with the main scheme as the only scheme cannot be initiated", () => {
    const { result } = attempt(start(P1), THWART_EACH.card.id);
    expect(result).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
  });

  it("a target that becomes invalid after it is chosen: the backstop blocks the removal", () => {
    // The patrol minion is in play but not engaged when the target is chosen, then engages before the thwart.
    const lieutenant = encounterCardInVillainArea(start(null), LIEUTENANT.id);
    const played = playRecordingOffers(lieutenant.state, CHOOSE_ENGAGE_THWART.card.id);
    expect(played.offers).toEqual([[lieutenant.state.mainScheme.instanceId]]);
    expect(mustInstance(played.state, lieutenant.id).engagedWith).toBe(P1);
    expect(mainThreat(played.state)).toBe(5);
    expect(played.events).toContainEqual(expect.objectContaining({ type: "threatRemovalBlocked", reason: "patrol" }));
  });

  describe("crisis", () => {
    const withCrisis = () => encounterCardInVillainArea(start(null), CRISIS.id, 2);

    it("the main scheme is not offered to a single-target thwart; the crisis side scheme is", () => {
      const crisis = withCrisis();
      const played = playRecordingOffers(crisis.state, THWART_A_SCHEME.card.id);
      expect(played.offers).toEqual([[crisis.id]]);
      expect(mainThreat(played.state)).toBe(5);
    });

    it("nor to single-target threat removal that is not a thwart", () => {
      const crisis = withCrisis();
      const played = playRecordingOffers(crisis.state, REMOVE_A_SCHEME.card.id);
      expect(played.offers).toEqual([[crisis.id]]);
      expect(mainThreat(played.state)).toBe(5);
    });

    it("removal whose only target is the main scheme cannot be played", () => {
      const crisis = withCrisis();
      const { given, result } = attempt(crisis.state, REMOVE_MAIN.card.id);
      expect(result).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
      expect(offered(given.state, given.id)).toBe(false);
    });

    it("'ignoring any crisis icons in play' keeps the main scheme a valid target", () => {
      const crisis = withCrisis();
      const played = playRecordingOffers(crisis.state, THWART_IGNORING_CRISIS.card.id);
      expect(played.offers).toEqual([[crisis.state.mainScheme.instanceId, crisis.id]]);
      expect(mainThreat(played.state)).toBe(2);
    });
  });
});
