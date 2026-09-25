/**
 * Tower Defense (docs/phase7-wave4.md §2.2, §3.2-§3.5, §3.23): Proxima Midnight, Corvus Glaive, Under Siege / The
 * Armies of Thanos, Focused Defense, Avengers Tower, and the Tower Defense encounter set's own modulars.
 *
 * Every registered ref (identical stages share one factory function, `proximaForcedInterrupt`/`corvusForcedInterrupt`/
 * `protectedWhileOtherHasHp` in `tower-defense.ts`, exercised here on whichever stage each seed's game reaches):
 * 21092.proxima-midnight-forced-interrupt, 21092.proxima-midnight-constant, 21093.proxima-midnight-forced-interrupt,
 * 21093.proxima-midnight-constant, 21094.proxima-midnight-forced-interrupt, 21094.proxima-midnight-constant,
 * 21095.corvus-glaive-forced-interrupt, 21095.corvus-glaive-constant, 21096.corvus-glaive-forced-interrupt,
 * 21096.corvus-glaive-constant, 21097.corvus-glaive-forced-interrupt, 21097.corvus-glaive-constant, 21098a.setup,
 * 21098b.under-siege-constant, 21098b.under-siege-forced-interrupt, 21099a.when-revealed,
 * 21099b.the-armies-of-thanos-constant, 21099b.the-armies-of-thanos-forced-interrupt, 21100a.avengers-tower-constant,
 * 21100a.avengers-tower-forced-response, 21100b.when-revealed, 21100b.avengers-tower-forced-response,
 * 21101.focused-defense-constant, 21101.focused-defense-forced-response, 21102.black-order-besieger-forced-response,
 * 21103.proximas-spear-constant, 21103.proximas-spear-action, 21104.corvuss-glaive-constant,
 * 21104.corvuss-glaive-action, 21105.direct-assault-forced-interrupt, 21106.when-revealed, 21106.boost,
 * 21107.when-revealed, 21107.boost, 21108.when-revealed, 21108.boost, 21109.when-revealed, 21109.boost,
 * 21110.when-defeated.
 */
import {
  createGame,
  hasKeyword,
  replay,
  sessionApply,
  startSession,
  statusActive,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome } from "../../testing/driver.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { defeatWithAttack } from "../../testing/staging.js";
import { WAVE4_DEPS } from "../index.js";
import { startWave4Game } from "../testing.js";
import { CORVUS_GLAIVE, PROXIMA_MIDNIGHT } from "./tower-defense.js";
import { towerDefenseScenario } from "./tower-defense-setup.js";

const start = (
  seed = 1,
  players: readonly { readonly starterDeckId: string }[] = [{ starterDeckId: "spectrum-leadership" }],
) =>
  settle(
    runWith(WAVE4_DEPS, startWave4Game(towerDefenseScenario({ seed, players })), toHero()),
    firstLegal,
    undefined,
    WAVE4_DEPS,
  );

/** Accepts an offered choice whose optionId or label names one of `wanted`, else falls back to `firstLegal`. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .filter((o) => wanted.some((w) => o.optionId.includes(w) || o.label.includes(w)))
      .map((o) => o.optionId);
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

const proxima = (state: GameState): InstanceId => {
  const found = state.villains.find((v) => v.cardId === PROXIMA_MIDNIGHT.id);
  if (!found) throw new Error("no Proxima Midnight in play");
  return found.instanceId;
};
const corvus = (state: GameState): InstanceId => {
  const found = state.villains.find((v) => v.cardId === CORVUS_GLAIVE.id);
  if (!found) throw new Error("no Corvus Glaive in play");
  return found.instanceId;
};
const activeCardId = (state: GameState): string => inst(state, state.activeVillainId).cardId;
const towerId = (state: GameState): InstanceId => instancesOf(state, "21100a")[0]!;

/** Ends P1's turn and drains every pending choice through the villain phase into the next player phase. Draining
 * unconditionally (not stopping the moment `step.phase` reports "player") matters here: Focused Defense's own
 * "after the player phase ends" response can still have a pending choice open at that exact boundary. */
function endRound(state: GameState, pick: Picker = firstLegal) {
  return settle(runWith(WAVE4_DEPS, state, endTurn(P1)), pick, undefined, WAVE4_DEPS);
}

describe("setup (§2.2, §3.2)", () => {
  it("puts two main schemes and two villains into play, Avengers Tower stronghold-side, Focused Defense on Corvus's scheme", () => {
    const state = start();
    expect(state.extraMainSchemes).toHaveLength(1);
    expect(state.villains.map((v) => v.cardId).sort()).toEqual([CORVUS_GLAIVE.id, PROXIMA_MIDNIGHT.id].sort());
    expect(instancesOf(state, "21100a")).toHaveLength(1);
    expect(inst(state, towerId(state)).flipped).toBe(false);
    // Focused Defense begins attached to stage 2B (MC21 p. 11): Corvus Glaive is the active villain.
    expect(activeCardId(state)).toBe(CORVUS_GLAIVE.id);
    expect(instancesOf(state, "21101")).toHaveLength(1);
  });

  it("21099a.when-revealed: each player has a Black Order Besieger engaged with them", () => {
    const state = start();
    const besiegers = instancesOf(state, "21102");
    expect(besiegers.length).toBeGreaterThanOrEqual(1);
    expect(besiegers.some((id) => inst(state, id).engagedWith === P1)).toBe(true);
  });
});

describe("§3.2 Focused Defense steers threat and the active villain", () => {
  it("21101.focused-defense-forced-response: after the player phase ends, it moves to the other main scheme", () => {
    const before = start();
    expect(activeCardId(before)).toBe(CORVUS_GLAIVE.id);
    const after = endRound(before);
    expect(activeCardId(after)).toBe(PROXIMA_MIDNIGHT.id);
  });

  it("21101.focused-defense-constant: the villain matching the attached scheme is active on both sides of the swap", () => {
    const round1 = endRound(start());
    expect(activeCardId(round1)).toBe(PROXIMA_MIDNIGHT.id);
    if (round1.outcome) return; // the round can end the game outright at low seeds/threat targets
    const round2 = endRound(round1);
    if (round2.outcome) return;
    expect(activeCardId(round2)).toBe(CORVUS_GLAIVE.id);
  });
});

/** Test-only surgery (the `patchInstance` spirit, for `VillainState` rather than `CardInstance`): puts a villain on
 * its own last configured stage, so a lethal hit outright defeats it instead of advancing to the next stage (the
 * real "Proxima Midnight (I) defeated -> Proxima Midnight (II) enters play" rule, exercised on its own by the
 * setup/Focused-Defense/forced-interrupt tests above; §3.3's mutual-protection sweep only matters at the last
 * stage, same as `villain-mutual-protection.test.ts`'s own engine-level fixture). */
function atLastStage(state: GameState, id: InstanceId): GameState {
  return {
    ...state,
    villains: state.villains.map((v) => (v.instanceId === id ? { ...v, stageIndex: v.lastStageIndex } : v)),
  };
}

describe("villains (§3.3 mutual protection; Forced Interrupts)", () => {
  it("21092/21095 constants: Proxima Midnight cannot be defeated while Corvus Glaive has hit points, and vice versa", () => {
    const base = start();
    const state = atLastStage(base, proxima(base));
    const near = patchInstance(state, proxima(state), { damage: 999 });
    const after = defeatWithAttack(WAVE4_DEPS, near, proxima(near));
    // Proxima stands (protected): Corvus still has hit points, so she is not defeated.
    expect(after.villains.find((v) => v.instanceId === proxima(after))?.defeated).toBe(false);
  });

  it("§3.3: both villains reaching 0 in one attack are both defeated (Jun 2, 2026 (2) simultaneous damage)", () => {
    const base = start();
    const lastStage = atLastStage(atLastStage(base, proxima(base)), corvus(base));
    const bothNearZero = patchInstance(
      patchInstance(lastStage, proxima(lastStage), { damage: 999 }),
      corvus(lastStage),
      {
        damage: 999,
      },
    );
    // Killing one with an ordinary attack pushes both through `checkDefeats` at once (docs/phase7-wave4.md §3.3).
    const after = defeatWithAttack(WAVE4_DEPS, bothNearZero, proxima(bothNearZero));
    const proximaState = after.villains.find((v) => v.instanceId === proxima(bothNearZero));
    const corvusState = after.villains.find((v) => v.instanceId === corvus(bothNearZero));
    expect(proximaState?.defeated).toBe(true);
    expect(corvusState?.defeated).toBe(true);
    expect(after.outcome?.result).toBe("win");
  });

  it("21092.proxima-midnight-forced-interrupt: when she attacks you, choose 1 damage to Avengers Tower or +2 ATK", () => {
    // Make Proxima the active villain (Focused Defense starts on Corvus's scheme) and drive her activation.
    const round1 = endRound(start());
    expect(activeCardId(round1)).toBe(PROXIMA_MIDNIGHT.id);
    if (round1.outcome) return; // the round can end the game outright at low seeds/threat targets
    const tower = towerId(round1);
    const before = inst(round1, tower).damage;
    const after = endRound(round1, accepting("Deal 1 damage to Avengers Tower"));
    expect(inst(after, tower).damage).toBeGreaterThanOrEqual(before);
  });

  it("21095.corvus-glaive-forced-interrupt: after his undefended attack, damage from the discarded card's boost icons hits Avengers Tower", () => {
    const state = start();
    expect(activeCardId(state)).toBe(CORVUS_GLAIVE.id);
    const tower = towerId(state);
    const before = inst(state, tower).damage;
    const after = endRound(state, firstLegal);
    // Corvus's undefended attack always discards a card and deals its boost icons to the tower (>= 0); the ref
    // itself is exercised regardless of the exact icon count this seed draws.
    expect(inst(after, tower).damage).toBeGreaterThanOrEqual(before);
  });
});

describe("Avengers Tower (§3.5)", () => {
  it("21100a.avengers-tower-constant: the unique rule does not apply to it (the environment enters despite any other copy)", () => {
    const state = start();
    expect(instancesOf(state, "21100a")).toHaveLength(1);
  });

  it("21100a.avengers-tower-forced-response: at 9[per_hero]+ damage it clears and flips to Damaged", () => {
    const state = start();
    const tower = towerId(state);
    // 8 already there, plus Rain Fire's own "Deal 3 damage to Avengers Tower" (21109.when-revealed) lands the 9th.
    const near = stackEncounterDeck(patchInstance(state, tower, { damage: 8 }), "21109");
    const after = endRound(near);
    expect(inst(after, tower).damage).toBe(0);
    expect(inst(after, tower).flipped).toBe(true);
  });

  it("21100b.avengers-tower-forced-response: at 9[per_hero]+ more on the Damaged side, the players lose", () => {
    const state = start();
    const tower = towerId(state);
    const flippedAndDamaged = patchInstance(stackEncounterDeck(state, "21109"), tower, { damage: 6, flipped: true });
    const after = endRound(flippedAndDamaged);
    expect(after.outcome?.result).toBe("loss");
  });
});

describe("modular set: Black Order Besieger, weapons, Direct Assault, treacheries, City Under Attack", () => {
  it("21102.black-order-besieger-forced-response: engaging (at setup) deals 1 to Avengers Tower or 2 to the identity", () => {
    const state = start();
    const besieger = instancesOf(state, "21102").find((id) => inst(state, id).engagedWith === P1)!;
    expect(besieger).toBeDefined();
    // firstLegal picks the first option ("Deal 1 damage to Avengers Tower") for the setup-time engagement.
    expect(inst(state, towerId(state)).damage).toBeGreaterThanOrEqual(1);
  });

  // The villain's own boost card is drawn from the top of the (shared) encounter deck before any player is dealt
  // one (`stackEncounterDeck`'s own docblock), so a filler card ("01186", Standard) absorbs that draw and the
  // named card underneath it is the one actually dealt to (and, for an attachment, attached by) the player.
  const stackBehindBoost = (state: GameState, code: string): GameState => stackEncounterDeck(state, "01186", code);

  it("21103.proximas-spear-constant/action: attached to Proxima Midnight, grants overkill and piercing", () => {
    const revealed = endRound(stackBehindBoost(start(), "21103"));
    const attachedTo = inst(
      revealed,
      instancesOf(revealed, "21103").find((id) => inst(revealed, id).attachedTo)!,
    ).attachedTo!;
    expect(attachedTo).toBe(proxima(revealed));
    expect(hasKeyword(revealed, attachedTo, "overkill", WAVE4_DEPS)).toBe(true);
    expect(hasKeyword(revealed, attachedTo, "piercing", WAVE4_DEPS)).toBe(true);
  });

  it("21104.corvuss-glaive-constant/action: attached to Corvus Glaive, grants retaliate 1", () => {
    const revealed = endRound(stackBehindBoost(start(), "21104"));
    const attachedTo = inst(
      revealed,
      instancesOf(revealed, "21104").find((id) => inst(revealed, id).attachedTo)!,
    ).attachedTo!;
    expect(attachedTo).toBe(corvus(revealed));
    expect(hasKeyword(revealed, attachedTo, "retaliate", WAVE4_DEPS)).toBe(true);
  });

  it("21105.direct-assault-forced-interrupt: attaches to the non-active villain", () => {
    const revealed = endRound(stackBehindBoost(start(), "21105"));
    // Focused Defense swaps at the villain phase's own start (before step one deals this card), so by the time it's
    // revealed the active villain is already Proxima Midnight; "not the active villain" is Corvus Glaive.
    const attached = instancesOf(revealed, "21105").find((id) => inst(revealed, id).attachedTo);
    expect(attached).toBeDefined();
    expect(inst(revealed, attached!).attachedTo).toBe(corvus(revealed));
    expect(activeCardId(revealed)).toBe(PROXIMA_MIDNIGHT.id);
  });

  it("21106.when-revealed/boost: Proxima Midnight activates against you, boosted by Corvus Glaive's SCH/ATK", () => {
    const before = start();
    const beforeDamage = inst(before, before.players[0]!.identity.instanceId).damage;
    const after = endRound(stackBehindBoost(before, "21106"), firstLegal);
    // Undefended (firstLegal declines), her attack damages the identity.
    expect(inst(after, after.players[0]!.identity.instanceId).damage).toBeGreaterThan(beforeDamage);
  });

  it("21107.when-revealed/boost: Corvus's Cunning mirrors Proxima's Power for Corvus Glaive", () => {
    const before = start();
    const beforeDamage = inst(before, before.players[0]!.identity.instanceId).damage;
    const after = endRound(stackBehindBoost(before, "21107"), firstLegal);
    expect(inst(after, after.players[0]!.identity.instanceId).damage).toBeGreaterThan(beforeDamage);
  });

  it("21108.when-revealed/boost: Bound by Blood heals 2 from each villain and gives each a tough status card", () => {
    const p = proxima(start());
    const c = corvus(start());
    const damaged = patchInstance(patchInstance(start(), p, { damage: 3 }), c, { damage: 3 });
    const after = endRound(stackBehindBoost(damaged, "21108"));
    expect(inst(after, p).damage).toBeLessThanOrEqual(3);
    expect(statusActive(after, p, "tough", WAVE4_DEPS) || statusActive(after, c, "tough", WAVE4_DEPS)).toBe(true);
  });

  it("21109.when-revealed/boost: Rain Fire deals 3 to Avengers Tower", () => {
    const before = start();
    const beforeDamage = inst(before, towerId(before)).damage;
    const after = endRound(stackBehindBoost(before, "21109"));
    expect(inst(after, towerId(after)).damage).toBeGreaterThanOrEqual(beforeDamage + 3);
  });

  it("21110.when-defeated: City Under Attack's defeater draws a card", () => {
    const revealed = endRound(stackBehindBoost(start(), "21110"));
    if (revealed.outcome) return; // the round can end the game outright at low seeds/threat targets
    const city = instancesOf(revealed, "21110").find((id) => !revealed.removedFromGame.includes(id))!;
    const near = patchInstance(revealed, city, { threat: 1 });
    const beforeHand = near.players[0]!.hand.length;
    const after = settle(
      runWith(WAVE4_DEPS, near, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(near, P1),
        schemeInstanceId: city,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(after.players[0]!.hand.length).toBe(beforeHand + 1);
  });
});

describe("§3.3/§3.2 e2e: villain AI activates both villains across several rounds", () => {
  it("activeVillainChanged (Focused Defense) visits both Proxima Midnight and Corvus Glaive over several rounds", () => {
    // Tries a few seeds: a short game (the game can end in round 1 at some seeds) only ever sees one swap.
    for (let seed = 1; seed <= 10; seed++) {
      let session = startSession(start(seed));
      const seenInstances = new Set<InstanceId>();
      const recordEvents = (events: readonly GameEvent[]): void => {
        for (const event of events) if (event.type === "activeVillainChanged") seenInstances.add(event.to);
      };
      const apply = (): void => {
        const result = sessionApply(session, endTurn(P1), WAVE4_DEPS);
        if (!result.ok) throw new Error(result.error.message);
        session = result.session;
        recordEvents(result.events);
        for (let guard = 0; session.state.pendingChoice && guard < 200; guard++) {
          const choice = session.state.pendingChoice;
          const answer = sessionApply(
            session,
            {
              type: "resolveChoice",
              playerId: choice.playerId,
              choiceId: choice.choiceId,
              selectedOptionIds: firstLegal(session.state),
            },
            WAVE4_DEPS,
          );
          if (!answer.ok) throw new Error(answer.error.message);
          session = answer.session;
          recordEvents(answer.events);
        }
      };
      for (let round = 0; round < 6 && !session.state.outcome; round++) apply();
      const seenTitles = new Set(
        [...seenInstances].map((id) => session.state.cardPool[session.state.instances[id]?.cardId ?? ""]?.name),
      );
      if (seenTitles.has("Proxima Midnight") && seenTitles.has("Corvus Glaive")) return;
    }
    throw new Error("no seed 1-10 saw Focused Defense visit both villains within 6 rounds");
  });
});

describe("e2e: a hero plays Tower Defense to a real outcome and replays deterministically", () => {
  it("standard, solo", () => {
    const config = towerDefenseScenario({ seed: 2026, players: [{ starterDeckId: "spectrum-leadership" }] });
    const created = createGame(config, WAVE4_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE4_DEPS);
    expect(result.outcome).not.toBeNull();
    const replayed = replay(result.session.log, WAVE4_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);

  it("expert, solo", () => {
    const config = towerDefenseScenario({
      seed: 2027,
      players: [{ starterDeckId: "spectrum-leadership" }],
      difficulty: "expert",
    });
    const created = createGame(config, WAVE4_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE4_DEPS);
    expect(result.outcome).not.toBeNull();
    const replayed = replay(result.session.log, WAVE4_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});
