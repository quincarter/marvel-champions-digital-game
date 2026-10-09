/**
 * Full QA, piece 10a (docs/phase7-wave8-full-qa.md, "Defects found"), proved on a REAL card: Under Surveillance (06031,
 * Thor's pack, Justice): "Attach to the main scheme. Max 1 per scheme. Increase the target threat value of attached
 * scheme by 4."
 *
 * RRG 1.8 "Main Scheme" (p. 27), when the main scheme deck advances: "1. Remove the top main scheme card from the game.
 * Return all tokens (except acceleration tokens) that were on that card to the token pool and discard each card
 * attached to it." So Under Surveillance does not carry over to stage 2: it goes to its owner's discard pile, and the
 * new stage's target threat is its own printed value again. The rule is the engine's
 * (`packages/engine/src/resolve/defeat.ts`, `advanceMainScheme`; fixtures in the engine's
 * `main-scheme-advance-discards-attachments.test.ts`); no card script was changed.
 */
import { cardId } from "@mc/content";
import { createGame, mainSchemeValue, type GameSetupConfig, type GameState } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  endTurn,
  firstLegal,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
} from "./testing/harness.js";
import { driveEventsPicking } from "./testing/staging.js";
import { wave1Scenario } from "./wave1/setup.js";
import { WAVE1_DEPS } from "./wave1/testing.js";

vi.setConfig({ testTimeout: 120_000 });

const UNDER_SURVEILLANCE = "06031";
const target = (s: GameState): number => mainSchemeValue(s, "targetThreat", WAVE1_DEPS, s.mainScheme);

/** Thor against Klaw (two main scheme stages), Under Surveillance added to his deck and played onto stage 1. */
function staged() {
  const config = wave1Scenario("klaw", { players: [{ starterDeckId: "thor-aggression" }], seed: 11 });
  const patched: GameSetupConfig = {
    ...config,
    requireLegalDecks: false,
    players: config.players.map((p) => ({ ...p, deck: [...p.deck, cardId(UNDER_SURVEILLANCE)] })),
  };
  const created = createGame(patched, WAVE1_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const started = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE1_DEPS);
  const printed = target(started);
  const given = moveToHand(started, P1, UNDER_SURVEILLANCE);
  const [card] = given.ids as [never];
  const scheme = given.state.mainScheme.instanceId;
  const attached = driveEventsPicking(
    WAVE1_DEPS,
    given.state,
    firstLegal,
    play(P1, card, payWith(given.state, P1, 2, [card]), { attachToInstanceId: scheme }),
  ).state;
  return { state: attached, card, scheme, printed };
}

describe("Under Surveillance (06031) is discarded when the main scheme advances (RRG 1.8 p. 27)", () => {
  it("stage 1 completes at its raised target; stage 2 enters without it, and it is in its owner's discard pile", () => {
    const at = staged();
    expect(at.state.mainScheme.stageIndex).toBe(0);
    expect(inst(at.state, at.card).attachedTo).toBe(at.scheme);
    expect(target(at.state)).toBe(at.printed + 4);

    // One short of the raised target: the villain phase's own threat completes the stage.
    const loaded = patchInstance(at.state, at.scheme, { threat: at.printed + 3 });
    const run = driveEventsPicking(WAVE1_DEPS, loaded, firstLegal, endTurn(P1));
    const completed = run.events.findIndex((e) => e.type === "mainSchemeCompleted");
    const advanced = run.events.findIndex((e) => e.type === "mainSchemeAdvanced");
    expect(completed).toBeGreaterThanOrEqual(0);
    expect(advanced).toBeGreaterThan(completed);

    const after = settle(run.state, firstLegal, (s) => s.step.phase === "player" || s.outcome !== null, WAVE1_DEPS);
    expect(after.mainScheme.stageIndex).toBe(1);
    expect(inst(after, at.scheme).attachments).toEqual([]);
    expect(inst(after, at.card).attachedTo).toBeNull();
    expect(playerOf(after, P1).discard).toContain(at.card);
    expect(playerOf(after, P1).playArea).not.toContain(at.card);
    // Counters and threat are handled as before: stage 2 holds only what it was given since it entered.
    expect(run.events.some((e) => e.type === "counterRemoved" && e.returnedOnAdvance)).toBe(false);
  });
});
