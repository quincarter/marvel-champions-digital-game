/**
 * docs/phase7-wave8.md §3.11: another card's Forced Response resolved "as if it just attacked you".
 *
 * - `EffectSpec resolveSpecials` with `trigger: "forcedResponse"` and `asIf: { remainingHpAtLeast }`, shaped like
 *   "Resolve the 'Forced Response' on the active villain as if it has at least 1 hit point and attacked you. Move the
 *   active counter to the next villain and resolve its 'Forced Response' the same way."
 * - `AbilityCost.resolveAbility` (`resolve-ability-cost.ts`), shaped like "Hero Response: After you attack attached
 *   villain, resolve its 'Forced Response' as if it just attacked you → discard this card."
 *
 * Sources: RRG 1.8 "Cost" (p. 13), "Cost Arrow Icon" (p. 14), "Initiating Abilities" (p. 24), "Self-Referential"
 * (p. 39), "You, Your" (p. 49). Owner decision §4.1 Q7 = A: the cost is not payable, so the ability is not offered,
 * when the Forced Response it resolves can change nothing. No FFG ruling on these cards in the post-RRG 1.7 transcript.
 */

import { flat, type VillainCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { resolveAbilityCostEffects, resolveAbilityCostFault, resolvingWouldChange } from "./resolve-ability-cost.js";
import { cardsInPlay, hitPointFloor } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec, Predicate, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAttachment,
  stubEnvironment,
  stubMainScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, HERO } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, P1, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number): ValueSpec => ({ kind: "const", value });
const self: TargetRef = { kind: "self" };
const you: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const hasHitPoint: Predicate = { kind: "compare", left: { kind: "remainingHp", of: self }, op: "atLeast", right: n(1) };
const afterAttackingYou = (id: string, ...effects: EffectSpec[]) =>
  stubAbility(`${id}.forced-response`, {
    trigger: {
      kind: "response",
      forced: true,
      on: { on: "enemyAttack", selfIs: "source", playerIs: "controller", usesAttackedPlayer: true },
    },
    effects: [{ kind: "if", condition: hasHitPoint, then: effects }],
  });

/** "Forced Response: After Reaper attacks you, if he has at least 1 hit point, deal 1 damage to your identity." */
const REAPER_FR = afterAttackingYou("reaper", { kind: "dealDamage", target: you, amount: n(1) });
/** "… discard a support you control." Nothing to discard: nothing happens. */
const RAIDER_FR = afterAttackingYou(
  "raider",
  {
    kind: "chooseTarget",
    slot: "lost",
    query: { categories: ["support"], controller: "you" },
    chooser: { kind: "controller" },
  },
  { kind: "discardFromPlay", target: { kind: "slot", slot: "lost" } },
);
/** An ordinary Response (not forced) on a villain, which "its Forced Response" never names. */
const HERALD_RESPONSE = stubAbility("herald.response", {
  trigger: { kind: "response", forced: false, on: { on: "enemyAttack", selfIs: "source" } },
  effects: [{ kind: "dealDamage", target: you, amount: n(5) }],
});
const villain = (id: string, abilities: readonly StubAbility[]): VillainCard =>
  stubVillain({ id, stages: [{ hp: flat(9), atk: 1, sch: 1, abilities: abilities.map((a) => a.ref) }] });
const REAPER = villain("reaper", [REAPER_FR]);
const RAIDER = villain("raider", [RAIDER_FR]);
const HERALD = villain("herald", [HERALD_RESPONSE]);
const ROW = [REAPER, RAIDER, HERALD] as const;
type Name = "reaper" | "raider" | "herald";

/** "Forced Response: After a villain activates, move the active counter to the next villain." */
const PASS_ON = stubAbility("row.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: ["enemyAttack", "enemyScheme"], sourceIs: { categories: ["villain"] } },
  },
  effects: [{ kind: "moveActiveCounter", to: "nextInRow" }],
});
/** The row's villains stay in play at 0 hit points, as villains that protect each other do. */
const STAY = stubAbility("row.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotBeDefeated", target: { categories: ["villain"] } }] },
  effects: [],
});
const SCHEME = stubMainScheme({
  id: "the-row",
  stages: [
    { startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), abilities: [PASS_ON.ref, STAY.ref] },
  ],
});
/** A player card: "Forced Response: After an enemy attacks you, place 1 counter here." */
const WATCH_RESPONSE = stubAbility("watch.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true },
  },
  effects: [{ kind: "addCounters", target: self, counterType: "attacked", amount: n(1) }],
});
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: [WATCH_RESPONSE.ref] });
const GEAR = stubSupport({ id: "gear", cost: 0 });

const theVillain: TargetRef = { kind: "villain" };
const resolveIts = (asIf?: number): EffectSpec => ({
  kind: "resolveSpecials",
  of: theVillain,
  trigger: "forcedResponse",
  ...(asIf !== undefined ? { asIf: { remainingHpAtLeast: asIf } } : {}),
});
const action = (id: string, ...effects: EffectSpec[]) =>
  stubAbility(`omen.${id}`, { trigger: { kind: "action" }, effects });
/** "Resolve the 'Forced Response' on the active villain as if it attacked you." */
const PLAIN = action("plain", resolveIts());
/** "… as if it has at least 1 hit point and attacked you." */
const AS_IF = action("as-if", resolveIts(1));
/** Rough Riders' shape: the active villain's, the counter one place along the row, then that villain's. */
const RIDERS = action("riders", resolveIts(1), { kind: "moveActiveCounter", to: "nextInRow" }, resolveIts(1));
const ACTIONS = [PLAIN, AS_IF, RIDERS];
/**
 * An encounter card in the villain's area that prints the three as Actions, so "the active villain" is read as an
 * encounter card reads it (a player card naming "the villain" with several in play asks its player which).
 */
const OMEN = stubEnvironment({ id: "omen", abilities: ACTIONS.map((a) => a.ref) });

const resolveCost: AbilityCost = { resolveAbility: { of: { kind: "host" }, trigger: "forcedResponse" } };
/** "Hero Response: After you attack attached villain, resolve its 'Forced Response' as if it just attacked you → discard this card." */
const HORSE_RESPONSE = stubAbility("horse.response", {
  trigger: {
    kind: "response",
    forced: false,
    form: "hero",
    on: {
      on: "attack",
      playerIs: "controller",
      sourceIs: { categories: ["identity"] },
      targetIs: { categories: ["villain"], hostOfSelf: true },
    },
  },
  cost: resolveCost,
  effects: [{ kind: "discardFromPlay", target: self }],
});
/** "Attached villain is considered to have at least 1 hit point." */
const HORSE_CONSTANT = stubAbility("horse.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "consideredRemainingHp", target: { categories: ["villain"], hostOfSelf: true }, atLeast: 1 }],
  },
  effects: [],
});
const HORSE = stubAttachment({ id: "horse", abilities: [HORSE_CONSTANT.ref, HORSE_RESPONSE.ref] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const deps: EngineDeps = depsOf(
  REAPER_FR,
  RAIDER_FR,
  HERALD_RESPONSE,
  PASS_ON,
  STAY,
  WATCH_RESPONSE,
  HORSE_RESPONSE,
  HORSE_CONSTANT,
  ...ACTIONS,
);

/** P1 in hero form at their first turn, the row Reaper, Raider, Herald with the active counter on `holder`. */
function start(holder: Name = "reaper"): GameState {
  const result = createGame(
    {
      seed: 7,
      cards: [...DEFAULT_CARDS, ...ROW, SCHEME, FILLER, HORSE, WATCH, GEAR, OMEN],
      villainCardId: REAPER.id,
      villains: ROW.map((card) => ({ villainCardId: card.id, encounterDeck: [] })),
      sharedEncounterDeck: true,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: [HORSE.id, HORSE.id, OMEN.id, ...copiesOf(FILLER.id, 12)],
      includeIdentitySets: false,
      players: [
        {
          identityCardId: HERO.id,
          deck: [...DEFAULT_DECK, WATCH.id, GEAR.id],
        },
      ],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  const begun = driveSession(startSession(result.state), deps).session.state;
  const state = encounterCardInVillainArea(begun, OMEN.id).state;
  const seated: GameState = {
    ...state,
    villainRow: state.villains.map((v) => v.instanceId),
    players: state.players.map((p) => ({
      ...p,
      identity: { ...p.identity, form: "hero" as const, heroFormIndex: 0 },
    })),
  };
  return { ...seated, activeVillainId: idOf(seated, holder) };
}

const idOf = (state: GameState, name: Name): InstanceId => {
  const found = state.villains.find((v) => String(v.cardId) === name);
  if (!found) throw new Error(`no villain ${name}`);
  return found.instanceId;
};
const heroId = (state: GameState): InstanceId => mustPlayer(state, P1).identity.instanceId;
const heroDamage = (state: GameState): number => mustInstance(state, heroId(state)).damage;
const withDamage = (state: GameState, name: Name, damage: number): GameState => ({
  ...state,
  instances: { ...state.instances, [idOf(state, name)]: { ...mustInstance(state, idOf(state, name)), damage } },
});
/** Attaches a copy of the horse from the encounter deck to `name` (surgery: no reveal). */
function horseOn(state: GameState, name: Name): { state: GameState; id: InstanceId } {
  const host = idOf(state, name);
  for (const [deckId, piles] of Object.entries(state.encounterDecks)) {
    const id = piles.deck.find((candidate) => state.instances[candidate]?.cardId === HORSE.id);
    if (!id) continue;
    return {
      id,
      state: {
        ...state,
        encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((x) => x !== id) } },
        instances: {
          ...state.instances,
          [id]: { ...mustInstance(state, id), faceup: true, attachedTo: host },
          [host]: { ...mustInstance(state, host), attachments: [...mustInstance(state, host).attachments, id] },
        },
      },
    };
  }
  throw new Error("no horse in an encounter deck");
}
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const counters = (state: GameState, id: InstanceId, type: string) => mustInstance(state, id).counters[type] ?? 0;

/** Uses one of the omen's Actions as P1. */
function useOmen(state: GameState, ability: StubAbility) {
  const omen = cardsInPlay(state).find((id) => state.instances[id]?.cardId === OMEN.id)!;
  const command: Command = {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: omen,
    abilityId: ability.ref.id,
    payment: [],
  };
  const run = driveSession(startSession(state), deps, [command]);
  return { state: run.session.state, events: run.events, session: run.session };
}

const basicAttack = (state: GameState, name: Name): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: heroId(state),
  targetInstanceId: idOf(state, name),
});
const offersHorse = (state: GameState): boolean =>
  state.pendingChoice?.prompt.kind === "chooseTriggers" &&
  state.pendingChoice.options.some((o) => o.ref?.kind === "ability" && o.ref.abilityId === HORSE_RESPONSE.ref.id);
/** Takes the horse's response whenever a window offers it, and answers everything else by default. */
const takingHorse = (seen: { offered: number }) => (state: GameState) => {
  if (!offersHorse(state)) return defaultPick(state);
  seen.offered += 1;
  return state
    .pendingChoice!.options.filter((o) => o.ref?.kind === "ability" && o.ref.abilityId === HORSE_RESPONSE.ref.id)
    .map((o) => o.optionId);
};
function attackTakingHorse(state: GameState, name: Name) {
  const seen = { offered: 0 };
  const run = driveSession(startSession(state), deps, [basicAttack(state, name)], takingHorse(seen));
  return { state: run.session.state, events: run.events, session: run.session, offered: seen.offered };
}

describe("§3.11 resolveSpecials with trigger forcedResponse", () => {
  it("resolves the active villain's Forced Response with the resolving player as 'you'; nothing attacks", () => {
    const watched = playerCardIntoPlay(start(), WATCH.id);
    const run = useOmen(watched.state, PLAIN);
    expect(heroDamage(run.state)).toBe(1);
    expect(of(run.events, "abilityResolved").map((e) => e.abilityId)).toContain(REAPER_FR.ref.id);
    // No attack: nothing logged as one, no boost card dealt, and "after an enemy attacks you" did not hear it.
    expect(of(run.events, "attackResolved")).toHaveLength(0);
    expect(of(run.events, "boostCardDealt")).toHaveLength(0);
    expect(counters(run.state, watched.id, "attacked")).toBe(0);
    // Not an activation either: the row's "after a villain activates" leaves the counter where it is.
    expect(of(run.events, "activeVillainChanged")).toHaveLength(0);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.session.state);
  });

  it("only a Forced Response is resolved: a villain that prints an ordinary Response has none", () => {
    const run = useOmen(start("herald"), PLAIN);
    expect(heroDamage(run.state)).toBe(0);
    expect(of(run.events, "abilityResolved").map((e) => e.abilityId)).not.toContain(HERALD_RESPONSE.ref.id);
  });

  it("at 0 hit points the Forced Response's own condition stops it, unless it resolves as if it has at least 1", () => {
    const zero = withDamage(start(), "reaper", 9);
    expect(heroDamage(useOmen(zero, PLAIN).state)).toBe(0);

    const run = useOmen(zero, AS_IF);
    expect(heroDamage(run.state)).toBe(1);
    // The floor is a rule on the villain that lasts exactly as long as the Forced Response's effects do.
    const added = of(run.events, "lastingEffectAdded");
    expect(added).toHaveLength(1);
    expect(added[0]!.effect).toMatchObject({
      kind: "ruleGrant",
      rule: { kind: "consideredRemainingHp", atLeast: 1 },
      scope: { selfInstanceId: idOf(zero, "reaper") },
    });
    expect(of(run.events, "lastingEffectEnded").map((e) => e.id)).toEqual([added[0]!.effect.id]);
    const order = run.events.flatMap((e) =>
      e.type === "lastingEffectAdded" ? ["floor on"] : e.type === "lastingEffectEnded" ? ["floor off"] : [],
    );
    expect(order).toEqual(["floor on", "floor off"]);
    expect(run.state.lastingEffects).toEqual([]);
    expect(hitPointFloor(run.state, idOf(run.state, "reaper"), deps)).toBeUndefined();
    // Reaper's dial is untouched and nobody fell.
    expect(mustInstance(run.state, idOf(run.state, "reaper")).damage).toBe(9);
    expect(run.state.villains.every((v) => !v.defeated)).toBe(true);
  });

  it("the active villain's, the counter one place along, then that villain's: the counter moves once, and wraps", () => {
    // Herald, the rightmost, has no Forced Response; the counter wraps to Reaper, whose Forced Response resolves.
    const run = useOmen(withDamage(start("herald"), "reaper", 9), RIDERS);
    const moves = of(run.events, "activeVillainChanged");
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ from: idOf(run.state, "herald"), to: idOf(run.state, "reaper") });
    expect(run.state.activeVillainId).toBe(idOf(run.state, "reaper"));
    expect(heroDamage(run.state)).toBe(1);
    expect(of(run.events, "abilityResolved").map((e) => e.abilityId)).toEqual(
      expect.arrayContaining([REAPER_FR.ref.id]),
    );
  });

  it("both villains' Forced Responses resolve in turn, each for the same player", () => {
    const geared = playerCardIntoPlay(start("reaper"), GEAR.id);
    const run = useOmen(geared.state, RIDERS);
    expect(heroDamage(run.state)).toBe(1);
    expect(cardsInPlay(run.state)).not.toContain(geared.id);
    expect(run.state.activeVillainId).toBe(idOf(run.state, "raider"));
    const resolved = of(run.events, "abilityResolved")
      .map((e) => e.abilityId)
      .filter((id) => id === REAPER_FR.ref.id || id === RAIDER_FR.ref.id);
    expect(resolved).toEqual([REAPER_FR.ref.id, RAIDER_FR.ref.id]);
  });
});

describe("§3.11 the cost form: resolve its Forced Response → discard this card", () => {
  it("after a basic attack on the attached villain the response is offered; used, the Forced Response resolves and the card is discarded, with no attack by the villain", () => {
    const horsed = horseOn(start(), "reaper");
    const watched = playerCardIntoPlay(horsed.state, WATCH.id);
    const run = attackTakingHorse(watched.state, "reaper");
    expect(run.offered).toBe(1);
    // The hero's attack (ATK 2) landed, then Reaper's Forced Response dealt 1 to the hero.
    expect(mustInstance(run.state, idOf(run.state, "reaper")).damage).toBe(2);
    expect(heroDamage(run.state)).toBe(1);
    expect(cardsInPlay(run.state)).not.toContain(horsed.id);
    expect(mustInstance(run.state, idOf(run.state, "reaper")).attachments).toEqual([]);
    expect(of(run.events, "resolveAbilityCostSettled")).toEqual([
      {
        type: "resolveAbilityCostSettled",
        instanceId: horsed.id,
        playerId: P1,
        ofInstanceId: idOf(run.state, "reaper"),
        trigger: "forcedResponse",
        resolved: 1,
        paid: true,
      },
    ]);
    // The cost resolves before the effect (RRG 1.8 "Cost Arrow Icon", p. 14).
    const settledAt = run.events.findIndex((e) => e.type === "resolveAbilityCostSettled");
    const discardedAt = run.events.findIndex((e) => e.type === "cardDiscardedFromPlay" && e.instanceId === horsed.id);
    expect(settledAt).toBeGreaterThan(-1);
    expect(discardedAt).toBeGreaterThan(settledAt);
    // The villain did not attack: no boost card, no "after an enemy attacks you", the counter where it was.
    expect(of(run.events, "boostCardDealt")).toHaveLength(0);
    expect(counters(run.state, watched.id, "attacked")).toBe(0);
    expect(run.state.activeVillainId).toBe(idOf(run.state, "reaper"));
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.session.state);
  });

  it("the attachment's own floor is what lets a villain at 0 resolve it: no asIf is passed", () => {
    const horsed = horseOn(withDamage(start(), "reaper", 9), "reaper");
    const run = attackTakingHorse(horsed.state, "reaper");
    expect(run.offered).toBe(1);
    expect(heroDamage(run.state)).toBe(1);
    expect(cardsInPlay(run.state)).not.toContain(horsed.id);
  });

  it("Q7 = A: not offered when the Forced Response can change nothing (no support to discard), and offered once there is one", () => {
    const horsed = horseOn(start(), "raider");
    const raider = idOf(horsed.state, "raider");
    const cost = resolveCost.resolveAbility!;
    expect(resolvingWouldChange(horsed.state, deps, horsed.id, P1, raider, cost)).toBe(false);
    expect(resolveAbilityCostFault(horsed.state, deps, horsed.id, P1, raider, cost)).toBe(
      "resolving that ability would change nothing",
    );
    const bare = attackTakingHorse(horsed.state, "raider");
    expect(bare.offered).toBe(0);
    expect(cardsInPlay(bare.state)).toContain(horsed.id);
    expect(of(bare.events, "resolveAbilityCostSettled")).toHaveLength(0);

    const geared = playerCardIntoPlay(horsed.state, GEAR.id);
    expect(resolvingWouldChange(geared.state, deps, horsed.id, P1, raider, cost)).toBe(true);
    // Asking changed nothing: the state the probe was given is the state still.
    expect(cardsInPlay(geared.state)).toContain(geared.id);
    const run = attackTakingHorse(geared.state, "raider");
    expect(run.offered).toBe(1);
    expect(cardsInPlay(run.state)).not.toContain(geared.id);
    expect(cardsInPlay(run.state)).not.toContain(horsed.id);
  });

  it("not offered on a villain with no Forced Response, nor after an attack on a different villain", () => {
    const onHerald = horseOn(start(), "herald");
    expect(
      resolveAbilityCostFault(
        onHerald.state,
        deps,
        onHerald.id,
        P1,
        idOf(onHerald.state, "herald"),
        resolveCost.resolveAbility!,
      ),
    ).toBe("that card has no such ability to resolve");
    expect(attackTakingHorse(onHerald.state, "herald").offered).toBe(0);

    const onReaper = horseOn(start(), "reaper");
    expect(attackTakingHorse(onReaper.state, "raider").offered).toBe(0);
  });

  it("paid at a moment resolving could change nothing, the steps are the settling alone and the cost is unpaid", () => {
    const steps = resolveAbilityCostEffects(idOf(start(), "raider"), resolveCost.resolveAbility!, false, null);
    expect(steps.effects.map((e) => e.kind)).toEqual(["settleResolveAbilityCost"]);
    expect(steps.effects[0]).toMatchObject({ wouldChange: false });
    const payable = resolveAbilityCostEffects(idOf(start(), "reaper"), resolveCost.resolveAbility!, true, null);
    expect(payable.effects.map((e) => e.kind)).toEqual(["resolveSpecials", "settleResolveAbilityCost"]);
  });
});
