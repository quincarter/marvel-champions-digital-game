import type { GameState } from "@mc/engine";
import { activeVillain, legalActions } from "@mc/engine";
import { firstLegal, inst, moveToHand, P1, type Picker } from "../../testing/harness.js";
import { withDamage, withForm } from "../../testing/staging.js";
import { WAVE2_DEPS } from "../index.js";
import { wave2Scenario } from "../setup.js";
import { playFromHand, startWave2Game } from "../testing.js";

/**
 * QA: Wasp Sting (13006) played for real in each of Wasp's forms.
 *
 * Card text (packages/content/src/data/wsp/cards.ts, printed): "Hero Action (attack): If you are in Giant hero form,
 * deal a total of 4 damage divided among enemies you choose. / Hero Action (attack): If you are in Tiny hero form,
 * deal 5 damage to an enemy." Cost 2.
 *
 * Rules: RRG 1.8 "Event" (p. 18): "If an event has more than one triggered ability on it, the player playing it
 * chooses one of those abilities to trigger when playing that event." So the play is legal whenever either ability
 * could be used (here: Hero Action, so hero form only), the player's pick is the one that resolves, and the other
 * ability does not. RRG "Initiating Abilities" (form requirement checked at initiation).
 * Engine sites: `eventActionToPlay` (actions.ts) picks the one Action ability usable in the form showing, and
 * `resolve/play-card.ts` stage "abilities" resolves that ability alone. Before that fix the first ability alone decided
 * legality and both resolved (9 damage as Giant, unplayable as Tiny).
 */
const waspVsRhino = (): GameState =>
  startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "wsp-aggression" }], seed: 2026 }));

const TINY = { heroForm: 0 } as const;
const GIANT = { heroForm: 1 } as const;

const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

const villainDamage = (state: GameState): number => inst(state, activeVillain(state).instanceId).damage;

describe("Wasp Sting (13006) by form: RRG 'Event' (p. 18), card text", () => {
  it("Giant hero form: exactly 4 damage, not 4 plus the Tiny ability's 5", () => {
    const start = withForm(waspVsRhino(), GIANT);
    const villain = activeVillain(start).instanceId;
    const { state } = playFromHand(withDamage(start, villain, 0), "13006", 2, accepting(villain));
    expect(villainDamage(state)).toBe(4);
  });

  it("Tiny hero form: the card is playable and deals 5 damage to one enemy (RRG Event p. 18)", () => {
    const start = withForm(waspVsRhino(), TINY);
    const villain = activeVillain(start).instanceId;
    const { state } = playFromHand(withDamage(start, villain, 0), "13006", 2, accepting(villain));
    expect(villainDamage(state)).toBe(5);
  });

  it("Alter-ego form: a Hero Action event cannot be played (RRG 'Initiating Abilities' form requirement)", () => {
    const start = withForm(waspVsRhino(), "alterEgo");
    expect(() => playFromHand(start, "13006", 2)).toThrow();
  });

  it("legalActions agrees: the Giant ability as Giant, the Tiny ability as Tiny, not listed as legal in alter-ego", () => {
    const abilitiesIn = (form: typeof TINY | typeof GIANT | "alterEgo"): readonly string[] | null => {
      const { state, ids } = moveToHand(withForm(waspVsRhino(), form), P1, "13006");
      const actions = legalActions(state, P1, WAVE2_DEPS);
      if (actions.kind !== "turn") throw new Error(`expected the player's turn, got ${actions.kind}`);
      const entry = actions.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === ids[0]);
      return entry ? (entry.abilities ?? []) : null;
    };
    expect(abilitiesIn(GIANT)).toEqual(["13006.wasp-sting-action"]);
    expect(abilitiesIn(TINY)).toEqual(["13006.wasp-sting-hero-action"]);
    expect(abilitiesIn("alterEgo")).toBeNull();
  });
});
