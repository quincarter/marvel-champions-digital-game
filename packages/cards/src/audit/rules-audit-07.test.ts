/**
 * Rules audit chunk 07 (Glossary: ENEMY ACTIVATION ... "GAINS"), proofs that need real cards. Each `it.fails` marks a
 * place the engine does something an official source forbids, and flips to a failure when it is fixed.
 *
 * Green Goblin (I) (02014): "Forced Response: After Green Goblin attacks and damages you, place 1 threat on the main
 * scheme." FFG Game Rules Specialist (Alex), post-RRG 1.5 rulings 225-226 (July 18, 2024, in
 * `Hall of Heroes "Latest FFG Rulings (post RRG 1.5)"`): "After X attacks and damages you" checks "if the attacked
 * player's identity was damaged as a result of the attack ... The 'you' in this ability does refer to your identity",
 * i.e. it is "After X damages you with an attack". Ruling January 11, 2026 (2) repeats the reading for the overkill
 * case. The script (`wave1/gob/mutagen-formula.ts`) is `after.villainAttacks({ againstYou, damages })`, whose `damages`
 * is the attack's total `damage` result, and that total counts damage taken by a defending ally
 * (`resolve/event.ts` `recordDamageTaken`: "The attack's `damage`/`damaged` totals count the attacked character's
 * damage"), so the response resolves when an ally absorbs the whole attack.
 */
import { describe, expect, it } from "vitest";
import type { GameEvent, GameState, InstanceId } from "@mc/engine";
import { P1, endTurn, firstLegal, identityOf, stackEncounterDeck } from "../testing/harness.js";
import { driveEventsPicking, playFromHand, withForm } from "../testing/staging.js";
import { GOB_DEPS, startGobGame } from "../wave1/gob/testing.js";
import { wave1Scenario } from "../wave1/setup.js";

const BLACK_CAT = "01002"; // ally, cost 2, 2 hit points
const BOOST = "02023"; // Goblin Soldier, a minion: only its boost icons matter as the villain's boost card
const GOBLIN_RESPONSE = "02014.green-goblin-forced-response";

function goblinAttacks(defend: boolean): { events: readonly GameEvent[]; state: GameState; ally: InstanceId } {
  const start = withForm(
    startGobGame(
      wave1Scenario("mutagen-formula", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 13 }),
    ),
    { heroForm: 0 },
  );
  const { state: withAlly, id: ally } = playFromHand(GOB_DEPS, start, BLACK_CAT, 2);
  const staged = stackEncounterDeck(withAlly, BOOST);
  const goblin = staged.activeVillainId!;
  let defended = false;
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    if (!defended && choice.prompt.kind === "declareDefender" && choice.prompt.attack.enemyInstanceId === goblin) {
      defended = true;
      return defend ? [ally] : ["decline"];
    }
    return choice.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s);
  };
  const { events, state } = driveEventsPicking(GOB_DEPS, staged, pick, endTurn(P1));
  return { events, state, ally };
}
/** The response resolutions between Green Goblin's first attack and the next attack (a revealed treachery may make another). */
const firstAttackOf = (events: readonly GameEvent[]): readonly GameEvent[] => {
  const first = events.findIndex((e) => e.type === "attackResolved");
  const next = events.findIndex((e, i) => i > first && e.type === "attackResolved");
  return events.slice(first, next < 0 ? undefined : next);
};
const responses = (events: readonly GameEvent[]) => {
  return firstAttackOf(events).filter((e) => e.type === "abilityResolved" && e.abilityId.endsWith(GOBLIN_RESPONSE));
};

describe("Green Goblin (02014) 'attacks and damages you' (FFG rulings 225-226, July 18, 2024)", () => {
  it("control: nobody defends, the identity is damaged, and the response resolves", () => {
    const { events, state } = goblinAttacks(false);
    const firstAttack = firstAttackOf(events);
    expect(firstAttack.filter((e) => e.type === "damageDealt").map((e) => e.targetInstanceId)).toEqual([
      identityOf(state, P1),
    ]);
    expect(responses(events)).toHaveLength(1);
  });

  it("an ally defends and takes all the damage: the identity was not damaged, so the response does not resolve", () => {
    const { events, state } = goblinAttacks(true);
    const firstAttack = firstAttackOf(events);
    const hits = firstAttack.filter((e) => e.type === "damageDealt").map((e) => e.targetInstanceId);
    expect(hits).toHaveLength(1);
    expect(hits).not.toContain(identityOf(state, P1));
    // Before the fix: it resolved once, off the ally's damage.
    expect(responses(events)).toHaveLength(0);
  });
});
