import type { GameState } from "@mc/engine";
import { activeVillain } from "@mc/engine";
import { firstLegal, inst, type Picker } from "../../testing/harness.js";
import { withDamage, withForm } from "../../testing/staging.js";
import { wave2Scenario } from "../setup.js";
import { playFromHand, startWave2Game } from "../testing.js";

/**
 * QA: Wasp Sting (13006) played for real in each of Wasp's forms.
 *
 * Card text (packages/content/src/data/wsp/cards.ts, printed): "Hero Action (attack): If you are in Giant hero form,
 * deal a total of 4 damage divided among enemies you choose. / Hero Action (attack): If you are in Tiny hero form,
 * deal 5 damage to an enemy." Cost 2.
 *
 * Rules: RRG 1.8 "Event" (p. 19): "If an event has more than one triggered ability on it, the player playing it
 * chooses one of those abilities to trigger when playing that event." So the play is legal whenever either ability
 * could be used (here: Hero Action, so hero form only), the player's pick is the one that resolves, and the other
 * ability does not. RRG "Initiating Abilities" (form requirement checked at initiation).
 * Engine sites: `eventActionAbility` (actions.ts) reads only the FIRST action ability for legality / cost / `while`;
 * `resolve/play-card.ts` stage "abilities" pushes a frame for EVERY action ability of the event.
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

describe("Wasp Sting (13006) by form: RRG 'Event' (p. 19), card text", () => {
  // Fails today: the engine resolves every Action ability of the played event and never reads the second ability's
  // `while`, so the Tiny 5 damage resolves on top of the Giant 4 (9 total). Fix site: resolve/play-card.ts "abilities".
  it.fails("Giant hero form: exactly 4 damage, not 4 plus the Tiny ability's 5", () => {
    const start = withForm(waspVsRhino(), GIANT);
    const villain = activeVillain(start).instanceId;
    const { state } = playFromHand(withDamage(start, villain, 0), "13006", 2, accepting(villain));
    expect(villainDamage(state)).toBe(4);
  });

  // Fails today: `eventActionAbility` returns the first ability, whose `while` is Giant, so play is refused in Tiny.
  it.fails("Tiny hero form: the card is playable and deals 5 damage to one enemy (RRG Event p. 19)", () => {
    const start = withForm(waspVsRhino(), TINY);
    const villain = activeVillain(start).instanceId;
    const { state } = playFromHand(withDamage(start, villain, 0), "13006", 2, accepting(villain));
    expect(villainDamage(state)).toBe(5);
  });

  it("Alter-ego form: a Hero Action event cannot be played (RRG 'Initiating Abilities' form requirement)", () => {
    const start = withForm(waspVsRhino(), "alterEgo");
    expect(() => playFromHand(start, "13006", 2)).toThrow();
  });
});
