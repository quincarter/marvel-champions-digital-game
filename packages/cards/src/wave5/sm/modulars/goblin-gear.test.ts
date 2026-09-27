import { cardId, encounterSetId } from "@mc/content";
import {
  activeEncounterDeckId,
  activeVillain,
  hasKeyword,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  P1,
} from "../../../testing/harness.js";
import { driveEvents, encounterCardInVillainArea } from "../../../testing/staging.js";
import { playFromHand, runWave5, startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { wave5Scenario } from "../../setup.js";

/**
 * Goblin Gear (`sm` 27136–27141, `goblin-gear.ts`, docs/phase7-wave5.md §2.2): the recommended modular for the
 * Venom Goblin scenario, so its own scenario (with Ghost-Spider's own precon) is used directly rather than a
 * different scenario's own recommended-set slot (`down-to-earth.test.ts`'s own precedent for that shape) — Venom
 * Goblin can itself put a second enemy (a boosted-in minion) into play during a villain phase, so tests that count
 * attacks against the villain specifically filter by `enemyInstanceId`, not by "however many attacks happened".
 */
const game = (seed = 1) =>
  startWave5Game(
    wave5Scenario("venom-goblin", {
      seed,
      players: [{ starterDeckId: "ghost-spider" }],
      modularSetIds: [encounterSetId("goblin_gear")],
    }),
  );

/** Attaches `code` (found in the encounter deck or discard) to `hostId` — `venom/encounter-set.test.ts`'s own
 * `attachToHost` helper, copied (test-only surgery, no shared file to import it from). */
function attachToHost(
  state: GameState,
  code: string,
  hostId: InstanceId,
): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = cardId(code);
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === wanted) ??
    pile.discard.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  const host = inst(state, hostId);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, attachedTo: hostId },
        [hostId]: { ...host, attachments: [...host.attachments, id] },
      },
    },
  };
}

/** `toHero` toggles form, so it must only be sent when the identity isn't hero already. */
const asHero = (state: GameState): GameState =>
  playerOf(state, P1).identity.form === "hero" ? state : runWave5(state, toHero(P1));

/** Drives P1's whole turn into the villain phase, letting step 2 attack them (`asHero` first). */
const throughVillainPhase = (state: GameState) =>
  settle(runWave5(asHero(state), endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);

describe("Advanced Glider (27136)", () => {
  it("27136.advanced-glider-forced-response: after the attached villain attacks you, it attacks you again", () => {
    const state = game();
    const villain = activeVillain(state).instanceId;
    const attached = attachToHost(state, "27136", villain);
    const identity = identityOf(attached.state, P1);
    const { events } = driveEvents(WAVE5_DEPS, asHero(attached.state), endTurn(P1));
    const attacks = events.filter(
      (e): e is Extract<GameEvent, { type: "attackResolved" }> =>
        e.type === "attackResolved" && e.enemyInstanceId === villain && e.targetInstanceId === identity,
    );
    // Step 2's own attack plus at least one repeat from the Forced Response (the repeat attack's own boost card
    // can itself put another enemy into play whose own presence feeds Venom Goblin's own villain mechanics into a
    // further activation for this seed — `enemyInstanceId === villain` already excludes any attack from that other
    // enemy, so this counts only the villain's own attacks; `abilityResolved` below is the precise, deterministic
    // check that the Forced Response itself fired exactly once).
    expect(attacks.length).toBeGreaterThanOrEqual(2);
    const uses = events.filter(
      (e): e is Extract<GameEvent, { type: "abilityResolved" }> =>
        e.type === "abilityResolved" && e.abilityId === "27136.advanced-glider-forced-response",
    );
    // Limit once per round per player: never fires a second time even though the repeat attack it causes is
    // itself "attached villain activates against you" again.
    expect(uses).toHaveLength(1);
  });

  it("does not resolve at all with no Advanced Glider attached (no attack repeats)", () => {
    const state = game();
    const villain = activeVillain(state).instanceId;
    const identity = identityOf(state, P1);
    const { events } = driveEvents(WAVE5_DEPS, asHero(state), endTurn(P1));
    const attacks = events.filter(
      (e): e is Extract<GameEvent, { type: "attackResolved" }> =>
        e.type === "attackResolved" && e.enemyInstanceId === villain && e.targetInstanceId === identity,
    );
    expect(attacks).toHaveLength(1);
  });
});

describe("Concussive Bombs (27137)", () => {
  it("27137.concussive-bombs-constant: enters play with 2 bomb counters (Uses keyword) when revealed and attached", () => {
    const state = game();
    const staged = stackEncounterDeck(state, "27126", "27137");
    const revealed = settle(runWave5(asHero(staged), endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    const bomb = instancesOf(revealed, "27137").find((id) => inst(revealed, id).attachedTo !== null)!;
    expect(bomb).toBeDefined();
    expect(inst(revealed, bomb).counters["bomb"]).toBe(2);
  });

  it("27137.concussive-bombs-forced-response: after the villain attacks you, removes 1 bomb counter and exhausts 1 upgrade and 1 support you control", () => {
    const state = game();
    const villain = activeVillain(state).instanceId;
    const withUpgrade = playFromHand(state, "27009", 2); // Web-Bracelet
    const withSupport = playFromHand(withUpgrade.state, "27007", 1); // George Stacy
    const attached = attachToHost(withSupport.state, "27137", villain);
    const seeded = patchInstance(attached.state, attached.id, { counters: { bomb: 2 } });
    const after = throughVillainPhase(seeded);
    expect(inst(after, attached.id).counters["bomb"]).toBe(1);
    expect(inst(after, withUpgrade.id).exhausted).toBe(true);
    expect(inst(after, withSupport.id).exhausted).toBe(true);
  });

  it("with no upgrade or support you control, still removes the bomb counter (no legal target, no crash)", () => {
    const state = game();
    const villain = activeVillain(state).instanceId;
    const attached = attachToHost(state, "27137", villain);
    const seeded = patchInstance(attached.state, attached.id, { counters: { bomb: 2 } });
    const after = throughVillainPhase(seeded);
    expect(inst(after, attached.id).counters["bomb"]).toBe(1);
  });
});

describe("Incendiary Bombs (27138)", () => {
  it("27138.incendiary-bombs-forced-response: after the villain attacks you, removes 1 bomb counter and deals you 2 indirect damage", () => {
    const state = game();
    const villain = activeVillain(state).instanceId;
    const identity = identityOf(state, P1);
    const attached = attachToHost(state, "27138", villain);
    const seeded = patchInstance(attached.state, attached.id, { counters: { bomb: 2 } });
    const before = inst(seeded, identity).damage;
    const after = throughVillainPhase(seeded);
    expect(inst(after, attached.id).counters["bomb"]).toBe(1);
    // The villain's own ATK (undefended) plus this card's own 2 indirect damage.
    expect(inst(after, identity).damage).toBeGreaterThanOrEqual(before + 2);
  });
});

describe("Smoke Bombs (27139)", () => {
  it("27139.smoke-bombs-forced-response: after the villain attacks you, removes 1 bomb counter and discards the lowest-cost event from your hand", () => {
    const state = game();
    const villain = activeVillain(state).instanceId;
    const attached = attachToHost(state, "27139", villain);
    const seeded = patchInstance(attached.state, attached.id, { counters: { bomb: 2 } });
    // A known hand: Parental Guidance (27003, cost 0) and Ghost Kick (27002, cost 2), both Ghost-Spider events —
    // the existing hand is cleared first so the starting draw's own random cards can't also happen to be cheaper.
    const clearedHand: GameState = {
      ...seeded,
      players: seeded.players.map((p) =>
        p.playerId === P1 ? { ...p, discard: [...p.discard, ...p.hand], hand: [] } : p,
      ),
    };
    const withEvents = moveToHand(clearedHand, P1, "27003", "27002");
    const [cheapId, pricierId] = withEvents.ids as [InstanceId, InstanceId];
    const after = throughVillainPhase(withEvents.state);
    expect(inst(after, attached.id).counters["bomb"]).toBe(1);
    expect(playerOf(after, P1).hand).not.toContain(cheapId);
    expect(playerOf(after, P1).hand).toContain(pricierId);
    expect(playerOf(after, P1).discard).toContain(cheapId);
  });

  it("with an empty hand (no event to discard), still removes the bomb counter and resolves without crashing (no legal target)", () => {
    const state = game();
    const villain = activeVillain(state).instanceId;
    const attached = attachToHost(state, "27139", villain);
    const seeded = patchInstance(attached.state, attached.id, { counters: { bomb: 2 } });
    const emptyHanded: GameState = {
      ...seeded,
      players: seeded.players.map((p) =>
        p.playerId === P1 ? { ...p, discard: [...p.discard, ...p.hand], hand: [] } : p,
      ),
    };
    // Checked via events, not final state: `settle`'s open-ended run (no stop condition) keeps going past the
    // villain phase into the next round's own draw step, which would refill the hand and make a final-state
    // assertion about it meaningless (the `moveToHand`-based positive test above avoids this by checking events).
    const { events } = driveEvents(WAVE5_DEPS, asHero(emptyHanded), endTurn(P1));
    const removed = events.filter(
      (e): e is Extract<GameEvent, { type: "counterRemoved" }> =>
        e.type === "counterRemoved" && e.instanceId === attached.id && e.counterType === "bomb",
    );
    expect(removed).toHaveLength(1);
    const resolved = events.filter(
      (e): e is Extract<GameEvent, { type: "abilityResolved" }> =>
        e.type === "abilityResolved" && e.abilityId === "27139.smoke-bombs-forced-response",
    );
    expect(resolved).toHaveLength(1);
  });
});

describe("Limitless Supply (27140)", () => {
  it("27140.limitless-supply-constant: each Tech attachment gains surge — the `attachment` card-type category (encounter attachments like Concussive Bombs, TECH/WEAPON), not the `upgrade` category (player cards)", () => {
    const state = game();
    const villain = activeVillain(state).instanceId;
    const bomb = attachToHost(state, "27137", villain);
    expect(hasKeyword(bomb.state, bomb.id, "surge", WAVE5_DEPS)).toBe(false);
    const withCard = encounterCardInVillainArea(bomb.state, "27140");
    expect(hasKeyword(withCard.state, bomb.id, "surge", WAVE5_DEPS)).toBe(true);
  });

  it("does not grant surge to a Tech player upgrade (the `upgrade` category is a different card type than `attachment`)", () => {
    const state = game();
    const withUpgrade = playFromHand(state, "27009", 2); // Web-Bracelet: ITEM, TECH upgrade (not an `attachment`)
    const withCard = encounterCardInVillainArea(withUpgrade.state, "27140");
    expect(hasKeyword(withCard.state, withUpgrade.id, "surge", WAVE5_DEPS)).toBe(false);
  });
});

describe("Remote Navigation (27141)", () => {
  it("27141.when-revealed: with Advanced Glider in play, the villain activates against you", () => {
    const state = game();
    const villain = activeVillain(state).instanceId;
    const attached = attachToHost(state, "27136", villain);
    const identity = identityOf(attached.state, P1);
    // Two 0-boost-icon fillers (27126, quantityInSet 2): Advanced Glider's own repeat means *two* activations each
    // draw their own boost card from the top of the deck before step 3 deals anyone their own encounter card, so
    // one filler alone leaves Remote Navigation consumed as the second activation's own boost card instead of
    // reaching the player's hand to be revealed at all.
    const staged = stackEncounterDeck(attached.state, "27126", "27126", "27141");
    const { events } = driveEvents(WAVE5_DEPS, asHero(staged), endTurn(P1));
    const attacks = events.filter(
      (e): e is Extract<GameEvent, { type: "attackResolved" }> =>
        e.type === "attackResolved" && e.enemyInstanceId === villain && e.targetInstanceId === identity,
    );
    // Step 2's own attack, plus at least one more from Remote Navigation's own When Revealed (the same cascading
    // caveat Advanced Glider's own test documents: an extra attack's own random boost card can itself put another
    // enemy into play whose own presence feeds further Venom Goblin activity for this seed).
    expect(attacks.length).toBeGreaterThanOrEqual(2);
    const uses = events.filter(
      (e): e is Extract<GameEvent, { type: "abilityResolved" }> =>
        e.type === "abilityResolved" && e.abilityId === "27141.when-revealed",
    );
    expect(uses).toHaveLength(1);
  });

  it("27141.when-revealed: with no Advanced Glider in play, searches it out and reveals it instead of attacking", () => {
    const state = game();
    const villain = activeVillain(state).instanceId;
    const identity = identityOf(state, P1);
    const staged = stackEncounterDeck(state, "27126", "27141");
    const { state: after, events } = driveEvents(WAVE5_DEPS, asHero(staged), endTurn(P1));
    const attacks = events.filter(
      (e): e is Extract<GameEvent, { type: "attackResolved" }> =>
        e.type === "attackResolved" && e.enemyInstanceId === villain && e.targetInstanceId === identity,
    );
    // Only step 2's own attack — Remote Navigation's own branch found no Advanced Glider, so no repeat.
    expect(attacks).toHaveLength(1);
    const glider = instancesOf(after, "27136").find((id) => inst(after, id).attachedTo === villain);
    expect(glider).toBeDefined();
  });

  it('27141.boost: gives the villain 2 additional boost cards ("dealt", not necessarily +2 boost icons — the extra cards\' own printed pips may be 0) for the activation it resolves during', () => {
    const state = game();
    const villain = activeVillain(state).instanceId;
    const staged = stackEncounterDeck(state, "27141");
    const { events } = driveEvents(WAVE5_DEPS, asHero(staged), endTurn(P1));
    const dealtToVillain = events.filter(
      (e): e is Extract<GameEvent, { type: "boostCardDealt" }> =>
        e.type === "boostCardDealt" && e.enemyInstanceId === villain,
    );
    // 1 ordinary boost card for the activation (Remote Navigation itself, drawn as the boost card) + 2 more from
    // its own [star] Boost.
    expect(dealtToVillain.length).toBeGreaterThanOrEqual(3);
  });
});
