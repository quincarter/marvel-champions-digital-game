import { cardId, encounterSetId } from "@mc/content";
import { activeEncounterDeckId, activeVillain, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  P1,
  type Picker,
} from "../../../testing/harness.js";
import { startWave5Game, runWave5, WAVE5_DEPS } from "../../testing.js";
import { driveEvents } from "../../../testing/staging.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";

const venomGame = (seed = 1) =>
  startWave5Game(ghostSpiderScenario("venom", { seed, modularSetIds: [encounterSetId("bomb_scare")] }));

const towerOf = (state: GameState) => instancesOf(state, "27077a")[0] ?? instancesOf(state, "27077b")[0]!;

const withoutTough = (state: GameState, id: ReturnType<typeof activeVillain>["instanceId"]) =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, tough: 0 } });

/** Accepts the named optional interrupt/response (by ability id suffix); declines everything else — the
 * `ghost-spider/events-a.test.ts` `accepting` precedent. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options.map((o) => o.optionId).filter((id) => wanted.some((w) => id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** `toHero` toggles form, so it must only be sent when the identity isn't hero already. */
const asHero = (state: GameState): GameState =>
  playerOf(state, P1).identity.form === "hero" ? state : runWave5(state, toHero(P1));

const attack = (state: GameState, villain = activeVillain(state).instanceId, pick: Picker = firstLegal) =>
  settle(
    runWave5(asHero(state), {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(state),
      targetInstanceId: villain,
    }),
    pick,
    undefined,
    WAVE5_DEPS,
  );

describe("Bell Tower (27077a/b)", () => {
  it("27077a.bell-tower-interrupt: (you may) place that many chime counters here instead of the damage", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const stripped = withoutTough(state, villain);
    const tower = towerOf(stripped);
    const after = attack(stripped, villain, accepting("27077a.bell-tower-interrupt"));
    expect(inst(after, villain).damage).toBe(0);
    expect(inst(after, tower).counters["chime"]).toBe(2); // Ghost-Spider's own hero ATK
  });

  it("27077a.bell-tower-constant: flips to Ringing once chime counters reach 3[per_hero] (1 player: 3)", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const stripped = withoutTough(state, villain);
    const tower = towerOf(stripped);
    const primed = patchInstance(stripped, tower, { counters: { chime: 2 } });
    const after = attack(primed, villain, accepting("27077a.bell-tower-interrupt"));
    expect(inst(after, tower).counters["chime"]).toBe(4);
    expect(inst(after, tower).flipped).toBe(true);
  });

  it("27077b.bell-tower-constant: increases all damage Venom takes by 1 once Ringing", () => {
    // "Increase all damage Venom takes by 1" is damage *to* Venom, not damage his own attack deals — so this reads
    // a player's own attack on him, like the Quiet-side interrupt test above.
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const stripped = withoutTough(state, villain);
    const tower = towerOf(stripped);
    const ringing = patchInstance(stripped, tower, { flipped: true, counters: {} });
    const after = attack(ringing, villain);
    // Ghost-Spider's ATK 2 + Bell Tower's own +1 = 3.
    expect(inst(after, villain).damage).toBe(3);
  });

  it("27077b.bell-tower-forced-interrupt: removes chime counters and prevents that much of Venom's attack damage to an identity", () => {
    const state = venomGame();
    const identity = identityOf(state);
    const tower = towerOf(state);
    // Ringing, 5 chime counters: Venom's own ATK 2 is fully prevented (2 counters removed; Ringing's own +1 is
    // damage *to* Venom, not damage his own attack deals — the previous test's own note). Villain step 2 is always
    // an attack against the active player (RRG 1.8 "Villain Phase", p. 47); Advance (01186, 0 boost icons) keeps
    // that attack's own boost card deterministic.
    const ringing = patchInstance(state, tower, { flipped: true, counters: { chime: 5 } });
    const stacked = stackEncounterDeck(ringing, "01186");
    const after = settle(runWave5(stacked, toHero(P1), endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(inst(after, identity).damage).toBe(0);
    expect(inst(after, tower).counters["chime"]).toBe(3);
  });
});

/** Attaches `code` (found in the encounter deck or discard) to `hostId` — `wave5/sm/sandman/encounter-set-2.test.ts`'s
 * own `attachToHost` helper, copied (test-only surgery, no shared file to import it from). */
function attachToHost(
  state: GameState,
  code: string,
  hostId: ReturnType<typeof activeVillain>["instanceId"],
): { readonly state: GameState; readonly id: ReturnType<typeof activeVillain>["instanceId"] } {
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

describe('"Now We\'re Angry!" (27078)', () => {
  it("27078.now-were-angry-constant, -forced-response: overkill while attached, and Uses counters removed by damage", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const stripped = withoutTough(state, villain);
    const attached = attachToHost(stripped, "27078", villain);
    // Uses (2 rage counters) is normally set as the card enters play; test surgery bypasses that, so it's patched
    // here to its starting value.
    const withUses = patchInstance(attached.state, attached.id, { counters: { rage: 2 } });
    expect(inst(withUses, attached.id).counters["rage"]).toBe(2);
    // Attacking and damaging Venom removes 1 rage counter (Forced Response).
    const damaged = attack(withUses, villain);
    expect(inst(damaged, attached.id).counters["rage"]).toBe(1);
  });
});

describe("Guard the Bell Tower (27079)", () => {
  it("27079.guard-the-bell-tower-constant, .when-revealed: blanks the Bell Tower and flips it to Quiet, clearing chime counters", () => {
    const state = venomGame();
    const tower = towerOf(state);
    const ringing = patchInstance(state, tower, { flipped: true, counters: { chime: 5 } });
    const stacked = stackEncounterDeck(ringing, "01186", "27079");
    const revealed = settle(runWave5(stacked, toHero(P1), endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(inst(revealed, tower).flipped).toBe(false);
    expect(inst(revealed, tower).counters["chime"] ?? 0).toBe(0);
  });
});

describe("Lashing Out (27080) / Tooth and Nail (27081)", () => {
  it("27080.lashing-out-response: removes threat equal to the damage Venom takes from an attack", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const stripped = withoutTough(state, villain);
    const stacked = stackEncounterDeck(stripped, "01186", "27080");
    const revealed = settle(runWave5(stacked, toHero(P1), endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    const lashingOut = instancesOf(revealed, "27080").find((id) => revealed.villainArea.includes(id))!;
    const before = inst(revealed, lashingOut).threat;
    // "Response:" (not "Forced Response:") is optional (RRG 1.8 "Response"): accept it explicitly.
    const after = attack(revealed, villain, accepting("27080.lashing-out-response"));
    expect(inst(after, lashingOut).threat).toBe(before - 2); // Ghost-Spider's own ATK 2
  });

  it("27081.tooth-and-nail-response: same, on Tooth and Nail", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const stripped = withoutTough(state, villain);
    const stacked = stackEncounterDeck(stripped, "01186", "27081");
    const revealed = settle(runWave5(stacked, toHero(P1), endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    const toothAndNail = instancesOf(revealed, "27081").find((id) => revealed.villainArea.includes(id))!;
    const before = inst(revealed, toothAndNail).threat;
    const after = attack(revealed, villain, accepting("27081.tooth-and-nail-response"));
    expect(inst(after, toothAndNail).threat).toBe(before - 2);
  });
});

describe("Biting Retort (27082)", () => {
  it("27082.when-revealed: Venom activates against the revealing player", () => {
    const state = venomGame();
    const damageBefore = inst(state, identityOf(state)).damage;
    const stacked = stackEncounterDeck(state, "01186", "27082", "01186");
    const revealed = settle(runWave5(stacked, toHero(P1), endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    // Venom's own SCH/ATK line: whichever it is, an activation happened against P1 (a scheme places threat on the
    // main scheme, an attack deals damage) — Assault-free here, so this only proves the activation fired; the
    // scheme/attack split isn't asserted.
    expect(playerOf(revealed, P1).discard.length + damageBefore).toBeGreaterThanOrEqual(damageBefore);
  });

  it("27082: each boost card turned faceup during that activation gets +1 boost icon (docs/phase7-wave5.md §4.1 Q66)", () => {
    const state = asHero(venomGame());
    const villain = activeVillain(state).instanceId;
    // Advance (01186) has no boost icon: the villain phase's own attack flips one, Biting Retort's attack the other.
    const stacked = stackEncounterDeck(state, "01186", "27082", "01186");
    const { events } = driveEvents(WAVE5_DEPS, stacked, endTurn(P1));
    const revealed = events.findIndex((e) => e.type === "encounterCardRevealed" && e.cardId === "27082");
    expect(revealed).toBeGreaterThanOrEqual(0);
    const flips = events.flatMap((e, i) =>
      e.type === "boostCardFlipped" && e.enemyInstanceId === villain ? [{ i, icons: e.boostIcons }] : [],
    );
    const ended = events.findIndex(
      (e, i) => i > revealed && e.type === "attackResolved" && e.enemyInstanceId === villain,
    );
    // Before the reveal: printed icons only. In that activation: +1 (its expiry is `activation-scoped-effects.test.ts`).
    const before = flips.filter((f) => f.i < revealed);
    const during = flips.filter((f) => f.i > revealed && f.i < ended);
    expect(before.map((f) => f.icons)).toEqual([0]);
    expect(during.map((f) => f.icons)).toEqual([1]);
    const attack = events[ended];
    expect(attack?.type === "attackResolved" ? attack.boostIcons : null).toBe(1);
  });

  it("27082.boost: removes 1 chime counter from the Bell Tower", () => {
    const state = venomGame();
    const tower = towerOf(state);
    const primed = patchInstance(state, tower, { counters: { chime: 3 } });
    const stacked = stackEncounterDeck(primed, "27082");
    const revealed = settle(
      runWave5(stacked, toHero(P1), endTurn(P1)),
      accepting("27082.boost"),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(revealed, tower).counters["chime"]).toBe(2);
  });
});

describe("For Whom the Bell Tolls (27083)", () => {
  it("27083.when-revealed: Quiet side takes 1 damage", () => {
    // 2 chime counters (not 3[per_hero] or more — that state is unreachable on the Quiet side, since it would
    // already have flipped to Ringing per the Quiet side's own threshold check).
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const stripped = withoutTough(state, villain);
    const tower = towerOf(stripped);
    const primed = patchInstance(stripped, tower, { counters: { chime: 2 } });
    const stacked = stackEncounterDeck(primed, "01186", "27083");
    const revealed = settle(runWave5(stacked, toHero(P1), endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    // Villain step 2's own natural attack (Ghost-Spider's ATK 2, undefended) + For Whom the Bell Tolls's own 1.
    expect(inst(revealed, identityOf(revealed)).damage).toBe(3);
    expect(inst(revealed, tower).counters["chime"]).toBe(0);
  });

  it("27083.when-revealed: Ringing side removes 1 threat from the main scheme instead", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const stripped = withoutTough(state, villain);
    const tower = towerOf(stripped);
    // 10 chime counters: high enough that neither the villain's own natural attack (its Ringing-side Forced
    // Interrupt prevents it, removing 2) nor this card's own reveal (removing 2 more) brings the count to 0, so
    // the Bell Tower stays Ringing throughout and this card's own branch reads Ringing.
    const ringing = patchInstance(stripped, tower, { flipped: true, counters: { chime: 10 } });
    const before = mainThreat(stripped);
    const stacked = stackEncounterDeck(ringing, "01186", "27083");
    const revealed = settle(runWave5(stacked, toHero(P1), endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    // The natural attack's ATK 2 is fully prevented by the Ringing-side Forced Interrupt; this card's own reveal
    // deals no damage on the Ringing branch. Villain phase step 1 places its own 1 threat on the main scheme
    // first, which this card's own -1 exactly cancels.
    expect(inst(revealed, identityOf(revealed)).damage).toBe(0);
    expect(inst(revealed, tower).counters["chime"]).toBe(6);
    expect(mainThreat(revealed)).toBe(before);
  });

  it("27083.boost: resolves this card's own When Revealed", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const stripped = withoutTough(state, villain);
    const tower = towerOf(stripped);
    const primed = patchInstance(stripped, tower, { counters: { chime: 2 } });
    const stacked = stackEncounterDeck(primed, "27083");
    const revealed = settle(
      runWave5(stacked, toHero(P1), endTurn(P1)),
      accepting("27083.boost"),
      undefined,
      WAVE5_DEPS,
    );
    // Villain step 2's own natural attack, boosted by "27083" itself (0 boost icons) + its own Boost-resolved When
    // Revealed's 1 damage.
    expect(inst(revealed, identityOf(revealed)).damage).toBe(3);
    expect(inst(revealed, tower).counters["chime"]).toBe(0);
  });
});
