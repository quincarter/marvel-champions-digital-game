import {
  activeVillain,
  applyCommand,
  hasKeyword,
  legalActions,
  statBonus,
  undefeatedVillains,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  playerOf,
  settle,
  stackEncounterDeck,
  threatOn,
} from "../../../testing/harness.js";
import { driveEvents, encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { defeatWithAttack, playFromHand, runWave5, startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { wave5Scenario } from "../../setup.js";

/**
 * Guerrilla Tactics (`sm` 27142–27146, `guerrilla-tactics.ts`, docs/phase7-wave5.md §2.2/§3.10/§3.11), exercised in
 * The Sinister Six — the one scenario that requires this set — so every "each enemy" text is proven against a real
 * multiple-villain game rather than a synthetic single-enemy stub, and equally reads correctly with however many of
 * the six villains a given seed happens to put into play (`undefeatedVillains(state).length`, never hardcoded).
 *
 * A live comparison isolates each ability's own marginal effect from the villain phase's own natural threat/damage
 * (its own activation, step one's printed acceleration) either by diffing two otherwise-identical games that differ
 * only in whether the card under test is in play, or — for the boost/when-revealed abilities, which run inside the
 * same activation as the villain's own attack/scheme — by filtering the driven events to the ones this card's own
 * instance authored (`sourceInstanceId`), per docs/phase7-wave5-handoff.md's "assert the exact printed effect".
 */
const game = (seed = 1) =>
  startWave5Game(wave5Scenario("sinister-six", { seed, players: [{ starterDeckId: "ghost-spider" }] }));
const expertGame = (seed = 1) =>
  startWave5Game(
    wave5Scenario("sinister-six", { seed, players: [{ starterDeckId: "ghost-spider" }], difficulty: "expert" }),
  );
const twoPlayerExpertGame = (seed = 1) =>
  startWave5Game(
    wave5Scenario("sinister-six", {
      seed,
      players: [{ starterDeckId: "ghost-spider" }, { starterDeckId: "spider-man-morales" }],
      difficulty: "expert",
    }),
  );

const boostIconsOf = (events: readonly GameEvent[]): number | undefined =>
  events.find((e): e is Extract<GameEvent, { type: "attackResolved" }> => e.type === "attackResolved")?.boostIcons ??
  events.find((e): e is Extract<GameEvent, { type: "schemeResolved" }> => e.type === "schemeResolved")?.boostIcons;

describe("Life-Size Decoy (27142)", () => {
  it("27142.life-size-decoy-constant: gains toughness in expert mode, not in standard", () => {
    const standard = encounterCardInVillainArea(game(), "27142");
    expect(hasKeyword(standard.state, standard.id, "toughness", WAVE5_DEPS)).toBe(false);
    const expert = encounterCardInVillainArea(expertGame(), "27142");
    expect(hasKeyword(expert.state, expert.id, "toughness", WAVE5_DEPS)).toBe(true);
  });

  it("27142.boost: put into play engaged with you when drawn as an activation's boost card", () => {
    const state = game();
    const staged = stackEncounterDeck(state, "27142");
    const revealed = settle(runWave5(staged, endTurn(P1)), undefined, undefined, WAVE5_DEPS);
    const decoy = instancesOf(revealed, "27142").find((id) => inst(revealed, id).engagedWith === P1);
    expect(decoy).toBeDefined();
    expect(playerOf(revealed, P1).playArea).toContain(decoy);
  });

  describe("27142.life-size-decoy-constant-2: the engaged player cannot thwart side schemes", () => {
    // Miles Morales (P1, whose precon has Swing In, "(thwart): Remove 4 threat from a scheme") with the Decoy engaged
    // and Coordinated Effort (27143) in play at 4 threat; Ghost-Spider (P2) is not engaged with it. Both in hero form.
    const staged = () => {
      const base = startWave5Game(
        wave5Scenario("sinister-six", {
          seed: 1,
          players: [{ starterDeckId: "spider-man-morales" }, { starterDeckId: "ghost-spider" }],
        }),
      );
      const heroes = withForm(withForm(base, { heroForm: 0 }, P1), { heroForm: 0 }, P2);
      const side = encounterCardInVillainArea(heroes, "27143", 4);
      const pulled = encounterCardInVillainArea(side.state, "27142");
      // Test surgery: the Decoy engaged with P1 (the boost path above puts it there in a real game).
      const state: GameState = {
        ...pulled.state,
        villainArea: pulled.state.villainArea.filter((id) => id !== pulled.id),
        players: pulled.state.players.map((p) =>
          p.playerId === P1 ? { ...p, playArea: [...p.playArea, pulled.id] } : p,
        ),
        instances: { ...pulled.state.instances, [pulled.id]: { ...inst(pulled.state, pulled.id), engagedWith: P1 } },
      };
      return { state, side: side.id, decoy: pulled.id };
    };
    const basicThwart = (state: GameState, scheme: InstanceId, player: PlayerId = P1): Command => ({
      type: "basicThwart",
      playerId: player,
      thwarterInstanceId: identityOf(state, player),
      schemeInstanceId: scheme,
    });
    const thwartTargets = (state: GameState, player: PlayerId) => {
      const actions = legalActions(state, player, WAVE5_DEPS);
      if (actions.kind !== "turn") throw new Error(`not ${player}'s turn`);
      const hero = identityOf(state, player);
      const entry = actions.legal.find((a) => a.action.kind === "basicThwart" && a.action.instanceId === hero);
      return entry?.targets ?? [];
    };
    /** Picks `target` in a scheme choice, recording what was offered; otherwise `firstLegal`. */
    const choosing = (target: InstanceId, offered: InstanceId[]) => (s: GameState) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind !== "chooseTarget") return firstLegal(s);
      const cards = choice.options.flatMap((o) => (o.ref.kind === "card" ? [o] : []));
      offered.push(...cards.map((o) => (o.ref.kind === "card" ? o.ref.instanceId : ("" as InstanceId))));
      const hit = cards.find((o) => o.ref.kind === "card" && o.ref.instanceId === target);
      return hit ? [hit.optionId] : firstLegal(s);
    };

    it("refuses the engaged player's basic thwart of a side scheme before any cost; the main scheme stays legal", () => {
      const { state, side } = staged();
      const main = state.mainScheme.instanceId;
      const refused = applyCommand(state, basicThwart(state, side), WAVE5_DEPS);
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.error.code).toBe("no_valid_target");
      expect(thwartTargets(state, P1)).toContain(main);
      expect(thwartTargets(state, P1)).not.toContain(side);

      const before = threatOn(state, main);
      const thwarted = settle(runWave5(state, basicThwart(state, main)), firstLegal, undefined, WAVE5_DEPS);
      expect(threatOn(thwarted, main)).toBeLessThan(before);
      expect(threatOn(thwarted, side)).toBe(4);
    });

    it("a thwart event (Swing In) is not offered the side scheme; it thwarts the main scheme", () => {
      const { state, side } = staged();
      const main = state.mainScheme.instanceId;
      const before = threatOn(state, main);
      const offered: InstanceId[] = [];
      const played = playFromHand(state, "27033", 2, choosing(side, offered)).state;
      expect(offered).toContain(main);
      expect(offered).not.toContain(side);
      expect(threatOn(played, side)).toBe(4);
      expect(threatOn(played, main)).toBe(Math.max(0, before - 4));
    });

    it("binds only the engaged player: a player the Decoy is not engaged with may thwart the side scheme", () => {
      const { state: p1Turn, side } = staged();
      const p2Turn = settle(runWave5(p1Turn, endTurn(P1)), firstLegal, (s) => s.pendingChoice === null, WAVE5_DEPS);
      expect(p2Turn.step).toMatchObject({ phase: "player", activePlayerId: P2 });
      expect(thwartTargets(p2Turn, P2)).toContain(side);
      const thwarted = settle(runWave5(p2Turn, basicThwart(p2Turn, side, P2)), firstLegal, undefined, WAVE5_DEPS);
      expect(threatOn(thwarted, side)).toBeLessThan(4);
    });

    it("ends once the Decoy leaves play", () => {
      const { state, side, decoy } = staged();
      const defeated = defeatWithAttack(state, decoy);
      expect(playerOf(defeated, P1).playArea).not.toContain(decoy);
      const offered: InstanceId[] = [];
      const played = playFromHand(defeated, "27033", 2, choosing(side, offered)).state;
      expect(offered).toContain(side);
      expect(threatOn(played, side)).toBe(0);
    });
  });
});

describe("Coordinated Effort (27143)", () => {
  it("27143.coordinated-effort-constant: each enemy gains 1 acceleration icon, worth 1 threat per enemy at step one", () => {
    // Step one's own threat placement (RRG 1.8 "Villain Phase", step 1) is the very first `threatPlaced` event of
    // the phase, before the villain's own activation places any more — `driveEvents` runs the whole turn (nothing
    // in this harness can pause exactly at a step boundary that carries no player choice), so the ability's own
    // marginal contribution is read off that one event rather than a before/after phase-length delta.
    const base = game();
    const enemyCount = undefeatedVillains(base).length;
    const withCard = encounterCardInVillainArea(base, "27143").state;

    const stepOneThreat = (state: GameState) =>
      driveEvents(WAVE5_DEPS, state, endTurn(P1)).events.find(
        (e): e is Extract<GameEvent, { type: "threatPlaced" }> => e.type === "threatPlaced",
      )?.amount ?? 0;

    expect(stepOneThreat(withCard) - stepOneThreat(base)).toBe(enemyCount);
  });

  it("27143.boost: places exactly 1 threat on the main scheme and 1 on Light at the End (standard mode)", () => {
    const state = game();
    const card = instancesOf(state, "27143")[0]!;
    const staged = stackEncounterDeck(state, "27143");
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const placed = events.filter(
      (e): e is Extract<GameEvent, { type: "threatPlaced" }> =>
        e.type === "threatPlaced" && e.sourceInstanceId === card,
    );
    expect(placed).toHaveLength(2); // the main scheme and Light at the End
    expect(placed.every((e) => e.amount === 1)).toBe(true);
    expect(placed.some((e) => e.schemeInstanceId === state.mainScheme.instanceId)).toBe(true);
  });

  it("27143.boost: in expert mode, places 1 additional threat on the main scheme (2 total there)", () => {
    const state = expertGame();
    const card = instancesOf(state, "27143")[0]!;
    const staged = stackEncounterDeck(state, "27143");
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const onMainScheme = events
      .filter(
        (e): e is Extract<GameEvent, { type: "threatPlaced" }> =>
          e.type === "threatPlaced" &&
          e.sourceInstanceId === card &&
          e.schemeInstanceId === state.mainScheme.instanceId,
      )
      .reduce((sum, e) => sum + e.amount, 0);
    expect(onMainScheme).toBe(2);
  });
});

describe("Hidden in Shadow (27144)", () => {
  it("27144.hidden-in-shadow-constant: each enemy gains 1 hazard icon, dealing 1 more encounter card per enemy at the deal step", () => {
    // Removing Hidden in Shadow from the deck to place it in play (`encounterCardInVillainArea`) shifts every
    // card behind it, which can change *which* cards the rest of the phase draws and cascade into an unrelated
    // dealt-count difference. Stacking every copy of Advance (01186, printing no reveal effect of its own) on top
    // for both variants first keeps the phase's own draws identical regardless of the card's presence, so the
    // measured difference is this ability's own marginal contribution alone.
    const state = game();
    const enemyCount = undefeatedVillains(state).length;
    const fillers = ["01186", "01186"];
    const base = stackEncounterDeck(state, ...fillers);
    const withCard = encounterCardInVillainArea(stackEncounterDeck(state, ...fillers), "27144").state;
    const dealtCount = (s: GameState) =>
      driveEvents(WAVE5_DEPS, s, endTurn(P1)).events.filter(
        (e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter",
      ).length;
    expect(dealtCount(withCard) - dealtCount(base)).toBe(enemyCount);
  });

  it("27144.boost: deals exactly 1 indirect damage to the (one) player, standard mode", () => {
    const state = game();
    const card = instancesOf(state, "27144")[0]!;
    const staged = stackEncounterDeck(state, "27144");
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const dealt = events
      .filter(
        (e): e is Extract<GameEvent, { type: "damageDealt" }> =>
          e.type === "damageDealt" && e.sourceInstanceId === card,
      )
      .reduce((sum, e) => sum + e.amount, 0);
    expect(dealt).toBe(1);
  });

  it("27144.boost: in expert mode, deals 1 additional indirect damage to the first player only (2 players)", () => {
    const state = twoPlayerExpertGame();
    const card = instancesOf(state, "27144")[0]!;
    const staged = stackEncounterDeck(state, "27144");
    // A 2-player villain phase only starts once every player has ended their turn.
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1), endTurn(P2));
    const dealtTo = (player: typeof P1) =>
      events
        .filter(
          (e): e is Extract<GameEvent, { type: "damageDealt" }> =>
            e.type === "damageDealt" && e.sourceInstanceId === card && e.targetInstanceId === identityOf(state, player),
        )
        .reduce((sum, e) => sum + e.amount, 0);
    expect(dealtTo(P1)).toBe(2); // 1 for "each player" + 1 additional for the first player
    expect(dealtTo(P2)).toBe(1);
  });
});

describe("Teamwork Makes the Dream Work (27145)", () => {
  it("27145.teamwork-makes-the-dream-work-constant: each enemy gets +1 SCH and +1 ATK", () => {
    const state = game();
    const villain = activeVillain(state).instanceId;
    expect(statBonus(state, WAVE5_DEPS, villain, "atk")).toBe(0);
    expect(statBonus(state, WAVE5_DEPS, villain, "sch")).toBe(0);
    const withCard = encounterCardInVillainArea(state, "27145").state;
    expect(statBonus(withCard, WAVE5_DEPS, villain, "atk")).toBe(1);
    expect(statBonus(withCard, WAVE5_DEPS, villain, "sch")).toBe(1);
  });

  it("27145.boost: its printed 2 boost icons count as-is in standard mode", () => {
    const state = game();
    const staged = stackEncounterDeck(state, "27145");
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    expect(boostIconsOf(events)).toBe(2);
  });

  it("27145.boost: in expert mode, gets +2 more boost icons (4 total)", () => {
    const state = expertGame();
    const staged = stackEncounterDeck(state, "27145");
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    expect(boostIconsOf(events)).toBe(4);
  });
});

describe("From Every Direction (27146)", () => {
  it("27146.from-every-direction-constant: gains surge only in expert mode", () => {
    expect(WAVE5_DEPS.abilities["27146.from-every-direction-constant"]).toMatchObject({
      trigger: {
        kind: "constant",
        keywordGrants: [
          { keyword: { name: "surge" }, target: { self: true }, while: { kind: "inMode", mode: "expert" } },
        ],
      },
    });
  });

  it("27146.when-revealed: places exactly 1 threat on the main scheme for each enemy in play", () => {
    const state = game();
    const enemyCount = undefeatedVillains(state).length;
    // quantityInSet 2 for this card, so either physical copy may be the one `stackEncounterDeck` actually stages;
    // match on any of its instances rather than assuming index 0 is the staged one.
    const copies = instancesOf(state, "27146");
    // One filler (Advance, 01186) ahead of it absorbs the active villain's own unconditional boost draw
    // (`enemy-activation.ts`'s `getsBoostCard`, `staging.ts`'s `stackSetAsideBehindBoost`/`stageNemesisCardForReveal`
    // own documented trap), so From Every Direction lands as the actual card dealt to and revealed by P1.
    const staged = stackEncounterDeck(state, "01186", "27146");
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const placedByThisCard = events
      .filter(
        (e): e is Extract<GameEvent, { type: "threatPlaced" }> =>
          e.type === "threatPlaced" &&
          e.sourceInstanceId !== null &&
          copies.includes(e.sourceInstanceId) &&
          e.schemeInstanceId === state.mainScheme.instanceId,
      )
      .reduce((sum, e) => sum + e.amount, 0);
    expect(placedByThisCard).toBe(enemyCount);
  });
});
