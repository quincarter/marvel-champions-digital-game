import { encounterSetId } from "@mc/content";
import {
  activeEncounterDeckId,
  activeVillain,
  cardsInPlay,
  legalDefenders,
  statBonus,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  playerOf,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { driveEvents, encounterCardInVillainArea } from "../../testing/staging.js";
import { runWave5, startWave5Game, WAVE5_DEPS } from "../testing.js";
import { novaScenario } from "./support.js";

/**
 * Armadillo (`nova` 28028–28032, `armadillo.ts`): Nova's own precon at Sandman with the Armadillo modular set
 * added, so the modular's own minion, side scheme, attachment and two treacheries are all reachable from the same
 * game. Sandman (`sm`), not a Core scenario like Rhino: `coreScenario`'s own `encounterCardsOf(sets)` call
 * (`packages/cards/src/core/setup.ts`) reads the *default* `CORE_CARDS` pool for the scenario's own set plus any
 * `modularSetIds`, not `options.cardPool` (only its separate `difficultySets` call gets the pool argument) — a
 * Core scenario plus a non-Core modular set throws "has no Core cards" there. `buildSmSingleVillain`
 * (`wave5/setup.ts`) does not have that gap (`encounterCardsOf(sets, WAVE5_CARDS)`, pool passed both times), so an
 * in-cycle single-villain scenario reaches this modular set correctly. Reported as a `core/setup.ts` gap rather
 * than patched here (shared file, one line, needs `game-rules-architect`/whoever owns Core scenario wiring). Not
 * Venom: his own villain prints Toughness, so `statBonus`/`giveStatus` baselines would start at a tough status
 * card already present rather than 0, muddying every assertion below.
 */
const game = (seed = 1) =>
  startWave5Game(novaScenario("sandman", { seed, modularSetIds: [encounterSetId("armadillo")] }));

/**
 * The two Hero-form Tough and Tumble cases below use Mysterio instead of Sandman: Sandman's own kit
 * (`27065.surging-sands`) draws extra cards off the top of the deck specifically during a Hero-form attack, on top
 * of the ordinary villain-phase boost draw, making the fixed 1-filler staging below unreliable for that villain.
 */
const mysterioGame = (seed = 1) =>
  startWave5Game(novaScenario("mysterio", { seed, modularSetIds: [encounterSetId("armadillo")] }));

/** `toHero` toggles form, so it must only be sent when the identity isn't hero already. */
const asHero = (state: GameState): GameState =>
  playerOf(state, P1).identity.form === "hero" ? state : runWave5(state, toHero(P1));

/** Gives `id` a tough status card by test surgery, on top of whatever statuses it already carries. */
const withTough = (state: GameState, id: InstanceId, count = 1): GameState =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, tough: count } });

/**
 * `stackEncounterDeck` alone isn't enough to make `code` the card a player's own encounter-card reveal step deals:
 * the villain phase's own boost draw (step 2, one per activation) reads from the top of the same deck *first*
 * (RRG 1.8 "Boost", p. 11) — with no minion engaged, only the villain's own activation draws one, so one 0-icon
 * filler (`01186` Advance, `stageNemesisCardForReveal`'s own precedent) ahead of `code` survives it and reaches
 * the real reveal (`sm/modulars/goblin-gear.test.ts`'s Remote Navigation test documents the identical gotcha for
 * two activations needing two fillers).
 */
const stageForReveal = (state: GameState, ...codes: readonly string[]): GameState =>
  stackEncounterDeck(state, "01186", ...codes);

/**
 * A minion engaged with `player`, in their own `playArea` — not `state.villainArea`, which
 * `encounterCardInVillainArea` uses and which the villain phase's own minion-activation step never reads
 * (`packages/engine/src/villain/phase.ts`'s `executeEnemyActivations`: `current.playArea.filter(isMinion)`).
 * `sm/modulars/down-to-earth.test.ts`'s own `engagedMinion` precedent, copied (test-only surgery, no shared file).
 */
function engagedMinion(
  state: GameState,
  code: string,
  player = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const placed = encounterCardInVillainArea(state, code);
  return {
    id: placed.id,
    state: {
      ...placed.state,
      villainArea: placed.state.villainArea.filter((id) => id !== placed.id),
      players: placed.state.players.map((p) =>
        p.playerId === player ? { ...p, playArea: [...p.playArea, placed.id] } : p,
      ),
      instances: { ...placed.state.instances, [placed.id]: { ...inst(placed.state, placed.id), engagedWith: player } },
    },
  };
}

describe("Armored Assault (28028)", () => {
  it("28028.armored-assault-constant: each enemy with a tough status card gets +3 ATK", () => {
    const state = game();
    const villain = activeVillain(state).instanceId;
    const toughened = withTough(state, villain);
    expect(statBonus(toughened, WAVE5_DEPS, villain, "atk")).toBe(0);
    const withScheme = encounterCardInVillainArea(toughened, "28028");
    expect(statBonus(withScheme.state, WAVE5_DEPS, villain, "atk")).toBe(3);
  });

  it("does not affect an enemy with no tough status card", () => {
    const state = game();
    const villain = activeVillain(state).instanceId;
    const withScheme = encounterCardInVillainArea(state, "28028");
    expect(statBonus(withScheme.state, WAVE5_DEPS, villain, "atk")).toBe(0);
  });
});

describe("Armadillo (28029)", () => {
  it("28029.armadillo-constant: `giveStatus` can stack a second tough status card on him, past the normal one-card cap", () => {
    const state = game();
    const armadillo = encounterCardInVillainArea(state, "28029");
    const villain = activeVillain(state).instanceId;
    // Tough It Out (28032, quantity 2): When Revealed gives Armadillo (and the villain) a tough status card. Both
    // printed copies are tracked by instance id up front so the second one's own surge can be checked precisely,
    // whichever the seeded shuffle drew first.
    const bothCopies = instancesOf(armadillo.state, "28032");
    const deckOrder = armadillo.state.encounterDecks[activeEncounterDeckId(armadillo.state)]!.deck;
    const firstCopy = deckOrder.find((id) => bothCopies.includes(id))!;
    const secondCopy = bothCopies.find((id) => id !== firstCopy)!;
    // First Tough It Out: Armadillo 0 -> 1, villain 0 -> 1 (both succeed, no surge).
    const first = driveEvents(WAVE5_DEPS, stageForReveal(armadillo.state, "28032"), endTurn(P1));
    expect(inst(first.state, armadillo.id).statuses.tough).toBe(1);
    expect(inst(first.state, villain).statuses.tough).toBe(1);
    expect(first.events.some((e) => e.type === "surgeTriggered" && e.instanceId === firstCopy)).toBe(false);
    // Second Tough It Out: Armadillo's own `anyNumberOfToughStatusCards` lets his own go 1 -> 2; the villain (no
    // such rule, RRG 1.8 "Status Card", p. 41: one of each normally) is already capped at 1 and takes none.
    const second = driveEvents(WAVE5_DEPS, stageForReveal(first.state, "28032"), endTurn(P1));
    expect(inst(second.state, armadillo.id).statuses.tough).toBe(2);
    expect(inst(second.state, villain).statuses.tough).toBe(1);
    // "If 1 or fewer tough status cards were given this way, this card gains surge": the second reveal only gave
    // Armadillo his (the villain's own `giveStatus` failed), so 1 was given and it surges.
    expect(second.events.some((e) => e.type === "surgeTriggered" && e.instanceId === secondCopy)).toBe(true);
  });

  it("28029.armadillo-forced-response: after Armadillo activates against you, gives him a tough status card", () => {
    const state = game();
    const hero = asHero(state);
    const armadillo = engagedMinion(hero, "28029");
    expect(inst(armadillo.state, armadillo.id).statuses.tough).toBe(0);
    const { state: after, events } = driveEvents(WAVE5_DEPS, armadillo.state, endTurn(P1));
    const attacks = events.filter(
      (e): e is Extract<GameEvent, { type: "attackResolved" }> =>
        e.type === "attackResolved" && e.enemyInstanceId === armadillo.id,
    );
    expect(attacks).toHaveLength(1);
    expect(inst(after, armadillo.id).statuses.tough).toBeGreaterThanOrEqual(1);
    const resolved = events.filter(
      (e): e is Extract<GameEvent, { type: "abilityResolved" }> =>
        e.type === "abilityResolved" && e.abilityId === "28029.armadillo-forced-response",
    );
    expect(resolved).toHaveLength(1);
  });

  it("does not resolve when a different enemy (the villain) activates instead", () => {
    const state = game();
    const hero = asHero(state);
    const armadillo = encounterCardInVillainArea(hero, "28029");
    // Not engaged with anyone (still in `villainArea`, not any player's `playArea`): only the villain activates.
    const { events } = driveEvents(WAVE5_DEPS, armadillo.state, endTurn(P1));
    const resolved = events.filter(
      (e): e is Extract<GameEvent, { type: "abilityResolved" }> =>
        e.type === "abilityResolved" && e.abilityId === "28029.armadillo-forced-response",
    );
    expect(resolved).toHaveLength(0);
  });
});

/** Attaches `code` (found in the encounter deck or discard) to `hostId` — `sm/modulars/goblin-gear.test.ts`'s own
 * `attachToHost` helper, copied (test-only surgery, no shared file to import it from). */
function attachToHost(
  state: GameState,
  code: string,
  hostId: InstanceId,
): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = instancesOf(state, code).find((i) => pile.deck.includes(i) || pile.discard.includes(i))!;
  const host = inst(state, hostId);
  return {
    id: wanted,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== wanted), discard: pile.discard.filter((i) => i !== wanted) },
      },
      instances: {
        ...state.instances,
        [wanted]: { ...state.instances[wanted]!, faceup: true, attachedTo: hostId },
        [hostId]: { ...host, attachments: [...host.attachments, wanted] },
      },
    },
  };
}

describe("Rollin', Rollin' (28030)", () => {
  it("28030.rollin-rollin-constant: with Armadillo already in play, attaches to him directly (no search)", () => {
    const state = game();
    const armadillo = encounterCardInVillainArea(state, "28029");
    const staged = stageForReveal(armadillo.state, "28030");
    const { state: after } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    // Still exactly one Armadillo instance: the fallback search never ran.
    expect(instancesOf(after, "28029")).toHaveLength(1);
    const rollin = instancesOf(after, "28030").find((id) => inst(after, id).attachedTo !== null)!;
    expect(rollin).toBeDefined();
    expect(inst(after, rollin).attachedTo).toBe(armadillo.id);
    expect(inst(after, armadillo.id).attachments).toContain(rollin);
  });

  it("28030.rollin-rollin-constant: with Armadillo not in play, searches him out, puts him into play engaged with you, and attaches", () => {
    const state = game();
    expect(cardsInPlay(state).includes(instancesOf(state, "28029")[0]!)).toBe(false);
    const staged = stageForReveal(state, "28030");
    const { state: after } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const armadilloId = instancesOf(after, "28029")[0]!;
    expect(cardsInPlay(after).includes(armadilloId)).toBe(true);
    expect(inst(after, armadilloId).engagedWith).toBe(P1);
    const rollin = instancesOf(after, "28030").find((id) => inst(after, id).attachedTo !== null)!;
    expect(inst(after, rollin).attachedTo).toBe(armadilloId);
    expect(inst(after, armadilloId).attachments).toContain(rollin);
  });

  it("28030.rollin-rollin-constant-2: while Armadillo has a tough status card, characters cannot defend against his attacks", () => {
    const state = game();
    const hero = asHero(state);
    const armadillo = encounterCardInVillainArea(hero, "28029");
    const attached = attachToHost(armadillo.state, "28030", armadillo.id);
    const toughened = withTough(attached.state, armadillo.id);
    expect(legalDefenders(toughened, P1, WAVE5_DEPS, armadillo.id)).toEqual([]);
  });

  it("negative: without a tough status card, your identity can still defend against him", () => {
    const state = game();
    const hero = asHero(state);
    const armadillo = encounterCardInVillainArea(hero, "28029");
    const attached = attachToHost(armadillo.state, "28030", armadillo.id);
    const identity = identityOf(attached.state, P1);
    expect(inst(attached.state, armadillo.id).statuses.tough).toBe(0);
    expect(legalDefenders(attached.state, P1, WAVE5_DEPS, armadillo.id)).toContain(identity);
  });
});

describe("Tough and Tumble (28031)", () => {
  it("28031.when-revealed-alter-ego: each enemy with a tough status card schemes", () => {
    const state = game(); // Nova's precon opens in alter-ego form.
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    const armadillo = encounterCardInVillainArea(state, "28029");
    const toughened = withTough(armadillo.state, armadillo.id);
    const staged = stageForReveal(toughened, "28031");
    const tumbleId = instancesOf(toughened, "28031")[0]!;
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const schemes = events.filter(
      (e): e is Extract<GameEvent, { type: "schemeResolved" }> =>
        e.type === "schemeResolved" && e.enemyInstanceId === armadillo.id,
    );
    expect(schemes).toHaveLength(1);
    expect(events.some((e) => e.type === "surgeTriggered" && e.instanceId === tumbleId)).toBe(false);
  });

  it("28031.when-revealed-alter-ego: with no enemy holding a tough status card, nobody schemes and this card gains surge instead", () => {
    const state = game();
    const staged = stageForReveal(state, "28031");
    const tumbleId = instancesOf(state, "28031")[0]!;
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const schemes = events.filter(
      (e): e is Extract<GameEvent, { type: "schemeResolved" }> =>
        e.type === "schemeResolved" && e.enemyInstanceId === instancesOf(state, "28029")[0],
    );
    expect(schemes).toHaveLength(0);
    expect(events.some((e) => e.type === "surgeTriggered" && e.instanceId === tumbleId)).toBe(true);
  });

  it("28031.when-revealed-hero: each enemy with a tough status card attacks you", () => {
    const state = mysterioGame();
    const hero = asHero(state);
    const armadillo = encounterCardInVillainArea(hero, "28029");
    const toughened = withTough(armadillo.state, armadillo.id);
    const identity = identityOf(toughened, P1);
    const staged = stageForReveal(toughened, "28031");
    const tumbleId = instancesOf(toughened, "28031")[0]!;
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const attacks = events.filter(
      (e): e is Extract<GameEvent, { type: "attackResolved" }> =>
        e.type === "attackResolved" && e.enemyInstanceId === armadillo.id && e.targetInstanceId === identity,
    );
    expect(attacks).toHaveLength(1);
    expect(events.some((e) => e.type === "surgeTriggered" && e.instanceId === tumbleId)).toBe(false);
  });

  it("28031.when-revealed-hero: with no enemy holding a tough status card, this card gains surge instead", () => {
    const state = mysterioGame();
    const hero = asHero(state);
    const staged = stageForReveal(hero, "28031");
    const tumbleId = instancesOf(hero, "28031")[0]!;
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    expect(events.some((e) => e.type === "surgeTriggered" && e.instanceId === tumbleId)).toBe(true);
  });
});

describe("Tough It Out (28032)", () => {
  it("28032.when-revealed: gives Armadillo and the villain each a tough status card", () => {
    const state = game();
    const armadillo = encounterCardInVillainArea(state, "28029");
    const villain = activeVillain(state).instanceId;
    const toughItOutId = instancesOf(armadillo.state, "28032")[0]!;
    const staged = stageForReveal(armadillo.state, "28032");
    const { state: after, events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    expect(inst(after, armadillo.id).statuses.tough).toBe(1);
    expect(inst(after, villain).statuses.tough).toBe(1);
    expect(events.some((e) => e.type === "surgeTriggered" && e.instanceId === toughItOutId)).toBe(false);
  });

  it("negative: with both already holding a tough status card, neither takes another and this card gains surge (1 or fewer given)", () => {
    const state = game();
    const armadillo = encounterCardInVillainArea(state, "28029");
    const villain = activeVillain(state).instanceId;
    const bothToughened = withTough(withTough(armadillo.state, armadillo.id), villain);
    const toughItOutId = instancesOf(bothToughened, "28032")[0]!;
    const staged = stageForReveal(bothToughened, "28032");
    const { state: after, events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    // The villain (no `anyNumberOfToughStatusCards`) stays at 1; Armadillo's own unlimited rule would let his own
    // grow past 1, but this test's focus is the surge branch, so his own count is not asserted here.
    expect(inst(after, villain).statuses.tough).toBe(1);
    expect(events.some((e) => e.type === "surgeTriggered" && e.instanceId === toughItOutId)).toBe(true);
  });
});
