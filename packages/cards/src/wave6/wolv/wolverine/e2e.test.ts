import { characterProfile, createGame, replay, sessionApply, startSession, type Command } from "@mc/engine";
import type { GameSession, GameState, InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome } from "../../../testing/driver.js";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { revealFromEncounterDeck, withDamage, withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS, wave6Scenario } from "../../index.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";
import { wolverineGame } from "./support.js";

/**
 * Whole games with Wolverine's own precon (`wolverine-aggression`, `packages/content/src/data/wolv/starterDecks.ts`),
 * modeled on `../../phoenix/phoenix/e2e.test.ts`: the card-name-agnostic greedy driver to a real outcome (solo, 2-player
 * with Cyclops, expert), and hand-scripted sessions through his kit (Healing Factor, the Claws playing Lunging Strike
 * with piercing and overkill, Berserker Barrage with Aggressive Energy, Death Factor declined and accepted on a
 * recovery, Jubilee's +2 ATK). Every scripted step goes through `sessionApply`, so each log replays deep-equal.
 */
const SEED = 2026;
const ADVANCE = "01186";
const CLAWS = "35002.wolverines-claws-action";

function settle(session: GameSession, pick: Picker): GameSession {
  let current = session;
  for (let guard = 0; current.state.pendingChoice && !current.state.outcome; guard++) {
    if (guard > 200) throw new Error(`choices did not settle (${current.state.pendingChoice.prompt.kind})`);
    const choice = current.state.pendingChoice;
    const result = sessionApply(
      current,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(current.state),
      },
      WAVE6_DEPS,
    );
    if (!result.ok) throw new Error(`resolveChoice rejected: ${result.error.code}: ${result.error.message}`);
    current = result.session;
  }
  return current;
}

function step(session: GameSession, command: Command, pick: Picker = firstLegal): GameSession {
  const result = sessionApply(session, command, WAVE6_DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code}: ${result.error.message}`);
  return settle(result.session, pick);
}

function assertReplays(session: GameSession): void {
  expect(session.state.pendingChoice).toBeNull();
  const replayed = replay(session.log, WAVE6_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(session.state);
}

const damageOf = (state: GameState): number => inst(state, identityOf(state, P1)).damage;
const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const inPlay = (state: GameState, id: InstanceId): boolean => playerOf(state, P1).playArea.includes(id);

/** The villain is stunned and the encounter deck stacked with harmless cards, so the villain phase deals no damage. */
const quiet = (state: GameState): GameState => {
  const villain = villainOf(state);
  const stunned = patchInstance(state, villain, { statuses: { ...inst(state, villain).statuses, stunned: 1 } });
  return stackEncounterDeck(stunned, ADVANCE, ADVANCE);
};

/** Takes the first option whose id or label contains `text`; otherwise `rest`. */
const choosing =
  (text: string, rest: Picker = firstLegal): Picker =>
  (state) => {
    const hit = state.pendingChoice?.options.find((o) => o.label.includes(text) || o.optionId.includes(text));
    return hit ? [hit.optionId] : rest(state);
  };
const targeting =
  (id: InstanceId, rest: Picker = firstLegal): Picker =>
  (state) =>
    state.pendingChoice?.options.some((o) => o.optionId === id) ? [id] : rest(state);
/** Declines every optional trigger; otherwise the first legal choice. */
const declining: Picker = (state) => (state.pendingChoice?.prompt.kind === "chooseTriggers" ? [] : firstLegal(state));

function greedy(config: ReturnType<typeof wave6Scenario>) {
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE6_DEPS);
  console.info(
    `[wave6 e2e] Wolverine: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE6_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}

describe("Wolverine (wolverine-aggression) vs Rhino", () => {
  it("solo, standard: plays to an outcome and replays deep-equal", () => {
    greedy(wave6Scenario("rhino", { players: [{ starterDeckId: "wolverine-aggression" }], seed: SEED }));
  }, 120_000);

  it("2-player, standard: Wolverine + Cyclops (Leadership)", () => {
    greedy(
      wave6Scenario("rhino", {
        players: [{ starterDeckId: "wolverine-aggression" }, { starterDeckId: "cyclops-leadership" }],
        seed: SEED,
      }),
    );
  }, 120_000);

  it("solo, expert", () => {
    const config = wave6Scenario("rhino", {
      players: [{ starterDeckId: "wolverine-aggression" }],
      seed: SEED,
      difficulty: "expert",
    });
    expect(config.difficulty).toBe("expert");
    greedy(config);
  }, 120_000);

  it("scripted: Healing Factor heals 2 when the next player phase begins, taken as a response", () => {
    const base = withForm(wolverineGame("rhino", { seed: SEED }), { heroForm: 0 });
    const hurt = quiet(patchInstance(base, identityOf(base, P1), { damage: 5 }));
    let session = startSession(hurt);
    session = step(session, { type: "endTurn", playerId: P1 }, choosing("35001a"));
    expect(damageOf(session.state)).toBe(3);
    assertReplays(session);
  });

  it("scripted: the Claws play Lunging Strike for free (piercing + overkill); Wolverine takes its printed cost", () => {
    const engaged = engageMinion(withForm(wolverineGame("rhino", { seed: SEED }), { heroForm: 0 }), "01101", P1);
    const minion = engaged.id;
    const tough = patchInstance(engaged.state, minion, {
      statuses: { ...inst(engaged.state, minion).statuses, tough: 1 },
    });
    const given = moveToHand(tough, P1, "35010");
    const strike = given.ids[0]!;
    const claws = instancesOf(given.state, "35002")[0]!;
    let session = startSession(given.state);
    session = step(session, use(P1, claws, CLAWS, [], { event: [strike] }), targeting(minion, declining));
    expect(damageOf(session.state)).toBe(3);
    expect(inst(session.state, claws).exhausted).toBe(true);
    expect(playerOf(session.state, P1).discard).toContain(strike);
    // Piercing ignores tough; 8 damage defeats the minion and overkill carries 5 to Rhino.
    expect(inPlay(session.state, minion)).toBe(false);
    expect(inst(session.state, villainOf(session.state)).damage).toBe(5);
    assertReplays(session);
  });

  it("scripted: Berserker Barrage repeats for 2 damage and Aggressive Energy adds 1 to each attack only", () => {
    const { state: one, id: minion } = engageMinion(
      withForm(wolverineGame("rhino", { seed: SEED }), { heroForm: 0 }),
      "01101",
      P1,
    );
    const given = moveToHand(one, P1, "35008", "35020");
    const [barrage, energy] = given.ids as [InstanceId, InstanceId];
    const filler = payWith(given.state, P1, 1, [barrage, energy]);
    let repeated = false;
    const pick: Picker = (s) => {
      const trigger = s.pendingChoice?.options.find((o) => o.label.includes("Aggressive Energy"));
      if (s.pendingChoice?.prompt.kind === "chooseTriggers" && trigger) return [trigger.optionId];
      const take = s.pendingChoice?.options.find((o) => o.label.includes("Take 2 damage"));
      if (take) {
        repeated = true;
        return [take.optionId];
      }
      return targeting(repeated ? villainOf(s) : minion)(s);
    };
    const session = step(startSession(given.state), play(P1, barrage, [energy, ...filler]), pick);
    expect(repeated).toBe(true);
    expect(inPlay(session.state, minion)).toBe(false);
    expect(inst(session.state, villainOf(session.state)).damage).toBe(5);
    expect(damageOf(session.state)).toBe(2);
    assertReplays(session);
  });

  describe("Death Factor on a basic recovery as Logan", () => {
    const recover = (pick: Picker) => {
      const { state, id } = revealFromEncounterDeck(WAVE6_DEPS, quiet(wolverineGame("rhino", { seed: SEED })), "35030");
      const hurt = patchInstance(withDamage(state, identityOf(state, P1), 3), identityOf(state, P1), {
        exhausted: false,
      });
      const session = step(startSession(hurt), { type: "basicRecover", playerId: P1 }, pick);
      return { session, id };
    };

    it("declined: Logan heals normally and Death Factor stays", () => {
      const { session, id } = recover(firstLegal);
      expect(damageOf(session.state)).toBeLessThan(3);
      expect(inst(session.state, id).attachedTo).toBe(identityOf(session.state, P1));
      assertReplays(session);
    });

    it("accepted: it is discarded and nothing is healed, though Logan still exhausts", () => {
      const { session, id } = recover(choosing("death-factor"));
      expect(damageOf(session.state)).toBe(3);
      expect(inst(session.state, identityOf(session.state, P1)).exhausted).toBe(true);
      expect(inst(session.state, id).attachedTo).toBeFalsy();
      assertReplays(session);
    });
  });

  it("scripted: Jubilee's chosen enemy takes +2 ATK from Wolverine's basic attack", () => {
    const base = withForm(wolverineGame("rhino", { seed: SEED }), { heroForm: 0 });
    const given = moveToHand(base, P1, "35003");
    const jubilee = given.ids[0]!;
    const villain = villainOf(given.state);
    let session = startSession(given.state);
    session = step(
      session,
      play(P1, jubilee, payWith(given.state, P1, 2, [jubilee])),
      targeting(villain, (s) =>
        s.pendingChoice?.prompt.kind === "chooseTriggers" ? [s.pendingChoice.options[0]!.optionId] : firstLegal(s),
      ),
    );
    expect(inPlay(session.state, jubilee)).toBe(true);
    const hero = identityOf(session.state, P1);
    const atk = characterProfile(session.state, hero, WAVE6_DEPS)!.atk;
    const before = inst(session.state, villain).damage;
    session = step(
      session,
      { type: "basicAttack", playerId: P1, attackerInstanceId: hero, targetInstanceId: villain },
      declining,
    );
    expect(inst(session.state, villain).damage - before).toBe(atk + 2);
    assertReplays(session);
  });
});
