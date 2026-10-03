import {
  cardsInPlay,
  createGame,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameSession,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome } from "../../../testing/driver.js";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  P2,
  payWith,
  play,
  playerOf,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { stageNemesisCardForReveal } from "../../../testing/staging.js";
import { WAVE6_DEPS, wave6Scenario, wave6StarterDeckSetup } from "../../index.js";
import { colossusGame } from "../colossus/support.js";
import { shadowcatGame } from "./support.js";

/**
 * Whole games with Shadowcat's own precon (`shadowcat-aggression`, `packages/content/src/data/mut_gen/starterDecks.ts`),
 * modeled on `../colossus/e2e.test.ts`: the card-name-agnostic greedy driver to a real outcome (solo, 2-player with
 * Colossus, expert), and hand-scripted sessions through her mass form (Phased defending, Toe to Toe, Powerful Punch per
 * RRG 1.8 FAQ "Powerful Punch (#14)", p. 63), her obligation, her nemesis, and Shadow and Steel's Team-Up. Every
 * scripted step goes through `sessionApply`, so each log replays deep-equal.
 */
const SEED = 2026;
const hero = (state: GameState) => identityOf(state, P1);
const solid = (state: GameState): InstanceId => instancesOf(state, "32031a")[0]!;
const isPhased = (state: GameState) => inst(state, solid(state)).flipped;
const villainOf = (state: GameState) => state.villains[0]!.instanceId;

/** Applies `command`, then answers every prompt with `pick`, noting the mass form's face after each step. */
function step(session: GameSession, command: Command, pick: Picker = firstLegal, faces?: boolean[]): GameSession {
  const note = (state: GameState) => {
    if (!faces || instancesOf(state, "32031a").length === 0) return;
    const phased = isPhased(state);
    if (faces[faces.length - 1] !== phased) faces.push(phased);
  };
  const first = sessionApply(session, command, WAVE6_DEPS);
  if (!first.ok) throw new Error(`${command.type} rejected: ${first.error.code}: ${first.error.message}`);
  let current = first.session;
  note(current.state);
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
    note(current.state);
  }
  return current;
}

/** Hero as defender; accepts the named optional triggers and pays `pay` hand cards for a card or ability. */
const choosing =
  (accept: readonly string[], pay = 0): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "declareDefender") {
      const defender = choice.options.find((o) => o.optionId === identityOf(state, choice.playerId));
      return [defender ? defender.optionId : "decline"];
    }
    if (choice.prompt.kind === "chooseTriggers") {
      const hits = choice.options.filter((o) => accept.some((a) => o.optionId.includes(a))).map((o) => o.optionId);
      return hits.length > 0 ? hits : firstLegal(state);
    }
    if (choice.prompt.kind === "payForCard" || choice.prompt.kind === "payForAbility")
      return choice.options.slice(0, pay).map((o) => o.optionId);
    return firstLegal(state);
  };

function assertReplays(session: GameSession): void {
  expect(session.state.pendingChoice).toBeNull();
  const replayed = replay(session.log, WAVE6_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(session.state);
}

/** A villain that hits hard enough for a defense to cost hit points. */
const strongVillain = (state: GameState): GameState => {
  const villain = state.cardPool[state.instances[villainOf(state)]!.cardId]!;
  if (villain.type !== "villain") throw new Error("not a villain");
  return {
    ...state,
    cardPool: {
      ...state.cardPool,
      [villain.id]: {
        ...villain,
        sides: villain.sides.map((side) => ({ ...side, stages: side.stages.map((s) => ({ ...s, atk: 9 })) })),
      } as unknown as typeof villain,
    },
  };
};

/** Shadowcat in hero form, Solid (or Phased through Phase Control first), the villain's attack set to hit hard. */
function opened(phased: boolean, ...extraHand: readonly string[]) {
  let state = shadowcatGame("rhino", { seed: SEED });
  let session = startSession(strongVillain(state));
  if (phased) session = step(session, use(P1, hero(session.state), "32030b.kitty-pryde-constant"));
  session = step(session, toHero(P1));
  if (extraHand.length > 0) {
    const given = moveToHand(session.state, P1, ...extraHand);
    // Staged hands are state surgery: restart the session from the staged state (the log replays from there).
    session = startSession(stackEncounterDeck(given.state, "01186", "01186"));
    return { session, ids: given.ids };
  }
  state = stackEncounterDeck(session.state, "01186", "01186");
  return { session: startSession(state), ids: [] as readonly InstanceId[] };
}

function greedy(config: ReturnType<typeof wave6Scenario>, label: string) {
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE6_DEPS);
  console.info(
    `[wave6 e2e] ${label}: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE6_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}

describe("Shadowcat (shadowcat-aggression) vs Rhino", () => {
  it("solo, standard: plays to an outcome and replays deep-equal", () => {
    greedy(
      wave6Scenario("rhino", { players: [{ starterDeckId: "shadowcat-aggression" }], seed: SEED }),
      "Shadowcat solo",
    );
  }, 120_000);

  it("2-player, standard: Shadowcat + Colossus", () => {
    greedy(
      wave6Scenario("rhino", {
        players: [{ starterDeckId: "shadowcat-aggression" }, { starterDeckId: "colossus-protection" }],
        seed: SEED,
      }),
      "Shadowcat + Colossus",
    );
  }, 120_000);

  it("solo, expert", () => {
    const config = wave6Scenario("rhino", {
      players: [{ starterDeckId: "shadowcat-aggression" }],
      seed: SEED,
      difficulty: "expert",
    });
    expect(config.difficulty).toBe("expert");
    greedy(config, "Shadowcat expert");
  }, 120_000);

  describe("scripted: her mass form", () => {
    it("Phased defending takes no damage, then flips to Solid", () => {
      const { session: start } = opened(true);
      expect(isPhased(start.state)).toBe(true);
      const faces: boolean[] = [true];
      const session = step(start, { type: "endTurn", playerId: P1 }, choosing([]), faces);
      expect(inst(session.state, hero(session.state)).damage).toBe(0);
      expect(isPhased(session.state)).toBe(false);
      expect(faces).toEqual([true, false]);
      assertReplays(session);
    });

    it("Toe to Toe (Solid): Rhino attacks her first and she takes the damage, then Rhino takes 5", () => {
      const { session: start, ids } = opened(false, "32046");
      const [toeToToe] = ids as [InstanceId];
      const session = step(start, play(P1, toeToToe, payWith(start.state, P1, 1, [toeToToe])), choosing([]));
      expect(inst(session.state, hero(session.state)).damage).toBeGreaterThan(0);
      expect(inst(session.state, villainOf(session.state)).damage).toBe(5);
      expect(playerOf(session.state, P1).discard).toContain(toeToToe);
      assertReplays(session);
    });

    it("Powerful Punch (FAQ #14, RRG p. 63): she attacks first and flips, defends as Phased taking nothing, flips back", () => {
      // Powerful Punch is a Protection card, so this deck is deliberately not a legal one (`requireLegalDecks` off).
      const config = wave6Scenario("rhino", { players: [{ starterDeckId: "shadowcat-aggression" }], seed: SEED });
      const setup = wave6StarterDeckSetup("shadowcat-aggression");
      const swapped = [...setup.deck];
      swapped.splice(swapped.indexOf(swapped.find((c) => c === ("32046" as never))!), 1, "32014" as never);
      const created = createGame(
        { ...config, requireLegalDecks: false, players: [{ ...config.players[0]!, deck: swapped }] },
        WAVE6_DEPS,
      );
      if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
      let state = created.state;
      while (state.step.phase !== "player") {
        const pick = firstLegal(state);
        const choice = state.pendingChoice;
        if (!choice) break;
        const result = sessionApply(
          startSession(state),
          { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: pick },
          WAVE6_DEPS,
        );
        if (!result.ok) throw new Error(result.error.message);
        state = result.session.state;
      }
      let session = startSession(strongVillain(state));
      session = step(session, toHero(P1));
      const given = moveToHand(session.state, P1, "32014");
      session = startSession(stackEncounterDeck(given.state, "01186", "01186"));
      const [punch] = given.ids as [InstanceId];
      expect(isPhased(session.state)).toBe(false);
      const faces: boolean[] = [false];
      session = step(
        session,
        { type: "endTurn", playerId: P1 },
        // Rhino's later attacks this phase are defended without the optional flip, so only the punch's chain is flipped.
        (state) =>
          choosing(faces.length < 3 ? ["32014.powerful-punch-constant", "32031a.solid-response"] : [], 2)(state),
        faces,
      );
      expect(playerOf(session.state, P1).discard).toContain(punch);
      expect(inst(session.state, villainOf(session.state)).damage).toBeGreaterThanOrEqual(4);
      // Solid -> Phased after the punch's damage (her Response), Phased -> Solid after defending (Forced Response).
      expect(faces).toEqual([false, true, false]);
      expect(inst(session.state, hero(session.state)).damage).toBe(0);
      assertReplays(session);
    });
  });

  describe("scripted: her obligation and nemesis", () => {
    it("Permanently Phased is revealed into her play area, and the game goes on", () => {
      const base = shadowcatGame("rhino", { seed: 5 });
      let session = startSession(stackEncounterDeck(base, "01186", "32055"));
      session = step(session, { type: "endTurn", playerId: P1 });
      const [obligation] = instancesOf(session.state, "32055");
      expect(playerOf(session.state, P1).playArea).toContain(obligation);
      session = step(session, { type: "endTurn", playerId: P1 });
      assertReplays(session);
    });

    it("a White Queen reveal engages her with Shadowcat and confuses her", () => {
      const base = shadowcatGame("rhino", { seed: 6 });
      const inHero = startSession(base);
      let session = step(inHero, toHero(P1));
      session = startSession(stageNemesisCardForReveal(session.state, "32056"));
      session = step(session, { type: "endTurn", playerId: P1 });
      const [queen] = instancesOf(session.state, "32056");
      expect(cardsInPlay(session.state)).toContain(queen);
      expect(inst(session.state, hero(session.state)).statuses.confused).toBe(1);
      session = step(session, { type: "endTurn", playerId: P1 });
      assertReplays(session);
    });
  });

  describe("scripted: Shadow and Steel with Colossus", () => {
    it("Shadowcat plays it against an attack on Colossus: she defends, takes none, and Rhino takes 4", () => {
      const base = colossusGame("rhino", { seed: SEED, extraPlayers: [{ starterDeckId: "shadowcat-aggression" }] });
      const hero1 = identityOf(base, P1);
      let session = startSession(base);
      session = step(session, toHero(P1));
      session = step(session, { type: "endTurn", playerId: P1 });
      session = step(session, toHero(P2));
      const given = moveToHand(session.state, P2, "32050");
      session = startSession(given.state);
      const [card] = given.ids as [InstanceId];
      expect(playerOf(session.state, P2).hand).toContain(card);
      session = step(session, { type: "endTurn", playerId: P2 }, choosing(["32050.shadow-and-steel-constant"], 2));
      expect(playerOf(session.state, P2).discard).toContain(card);
      expect(inst(session.state, villainOf(session.state)).damage).toBeGreaterThanOrEqual(4);
      expect(inst(session.state, hero1).damage).toBe(0);
      assertReplays(session);
    });
  });
});
