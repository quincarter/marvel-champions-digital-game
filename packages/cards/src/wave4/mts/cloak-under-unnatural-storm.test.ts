import { applyCommand, cardsInPlay, type GameState, type InstanceId, legalActions } from "@mc/engine";
import { describe, expect, it } from "vitest";
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
  settle,
  stackEncounterDeck,
  toHero,
  use,
} from "../../testing/harness.js";
import { WAVE4_DEPS } from "../index.js";
import { wave4Scenario } from "../setup.js";
import { runWave4, startWave4Game } from "../testing.js";

/**
 * Issue #568: "Exhaust Cloak of Levitation → ready Doctor Strange" spent the Cloak and readied nobody while Unnatural
 * Storm was in play. RRG 1.8 "Target" (p. 43): a character that cannot ready is not a valid target for a card that
 * readies it. With no valid target the ability cannot be initiated ("Initiating Abilities", p. 24, step 2) and its
 * cost cannot be paid ("Cost", p. 14).
 */
const CLOAK_ACTION = "09009.cloak-of-levitation-action";

/** The issue's own Doctor Strange deck. */
const STRANGE = {
  identityCardId: "09001a",
  // prettier-ignore
  deck: ["12014", "12017", "21011", "21014", "21015", "21018", "21055", "01066", "01072", "01074", "01086", "01086",
    "01088", "01089", "01090", "01092", "03013", "03015", "03019", "03024", "04012", "05023", "08031", "09002", "09003",
    "09003", "09004", "09004", "09005", "09005", "09006", "09007", "09007", "09008", "09009", "09010", "09010", "09011",
    "09026", "09039"],
  aspects: ["leadership" as const],
};

function strangeWithCloak(): { readonly state: GameState; readonly cloak: InstanceId; readonly strange: InstanceId } {
  const started = startWave4Game(wave4Scenario("hela", { players: [STRANGE], seed: 1 }));
  const given = moveToHand(started, P1, "09009");
  const [cloak] = given.ids as [InstanceId];
  const hero = runWave4(given.state, toHero());
  const state = settle(
    runWave4(hero, play(P1, cloak, payWith(hero, P1, 2, [cloak]))),
    firstLegal,
    (s) => s.stack.length === 0,
    WAVE4_DEPS,
  );
  return { state, cloak, strange: identityOf(state) };
}

/** The next villain phase reveals Unnatural Storm; back on P1's turn, with `Doctor Strange` exhausted. */
function underTheStorm(state: GameState, strange: InstanceId): GameState {
  const stacked = stackEncounterDeck(state, "01186", "21159");
  const nextRound = settle(
    runWave4(stacked, { type: "endTurn", playerId: P1 }),
    firstLegal,
    (s) => s.round > stacked.round && s.step.phase === "player" && s.stack.length === 0,
    WAVE4_DEPS,
  );
  expect(instancesOf(nextRound, "21159").some((id) => cardsInPlay(nextRound).includes(id))).toBe(true);
  return patchInstance(nextRound, strange, { exhausted: true });
}

const offered = (state: GameState, cloak: InstanceId): boolean => {
  const actions = legalActions(state, P1, WAVE4_DEPS);
  if (actions.kind !== "turn") throw new Error(`expected P1's turn, got ${actions.kind}`);
  return actions.legal.some(
    ({ action }) =>
      action.kind === "useAbility" && action.instanceId === cloak && String(action.abilityId) === CLOAK_ACTION,
  );
};

describe("Cloak of Levitation with no valid target (#568)", () => {
  it("readies an exhausted Doctor Strange", () => {
    const { state, cloak, strange } = strangeWithCloak();
    const exhausted = patchInstance(state, strange, { exhausted: true });
    expect(offered(exhausted, cloak)).toBe(true);
    const after = runWave4(exhausted, use(P1, cloak, CLOAK_ACTION));
    expect(inst(after, strange).exhausted).toBe(false);
    expect(inst(after, cloak).exhausted).toBe(true);
  });

  it("is not offered under Unnatural Storm, and the Cloak is not spent", () => {
    const { state, cloak, strange } = strangeWithCloak();
    const storm = underTheStorm(state, strange);
    expect(inst(storm, cloak).exhausted).toBe(false);
    expect(offered(storm, cloak)).toBe(false);
    const refused = applyCommand(storm, use(P1, cloak, CLOAK_ACTION), WAVE4_DEPS);
    expect(refused.ok ? null : refused.error.code).toBe("no_valid_target");
  });
});
