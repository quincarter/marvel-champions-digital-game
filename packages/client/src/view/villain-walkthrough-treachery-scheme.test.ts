import { describe, expect, test } from "vitest";
import type { Command, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import type { SessionConfig } from "../engine/host.js";
import { SessionStore } from "../store/session-store.js";
import { encounterCardActivates } from "./villain-phase-reveal.js";
import { appendWalkthrough, emptyWalkthrough, type Walkthrough } from "./villain-walkthrough.js";

/**
 * Issue #370 (@zackburnley's report, seed 98683): Rhino's attack resolves in step 2, then Dark Designs is revealed and
 * makes Rhino scheme (Emergency answers its interrupt window, two Pursued by the Past responses are ordered after).
 * The reveal step's beats used to carry the step-2 attack, and the docked rail showed the card through the scheme, so
 * its boost card and breakdown were never shown.
 */
const CONFIG = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 98683,
  difficultySets: { standard: "standard_iii" },
  tableRules: { sameNameHeroAllyConflict: true },
  outsideFacts: [{ wonPreviousGame: false }],
} as unknown as SessionConfig;

const choice = (choiceId: string, selectedOptionIds: string[]) => ({
  type: "resolveChoice",
  playerId: "p1",
  choiceId,
  selectedOptionIds,
});

const COMMANDS = [
  choice("c1", []),
  {
    type: "playCard",
    playerId: "p1",
    cardInstanceId: "i43",
    payment: [{ ability: { instanceId: "i3", abilityId: "01001b.scientist" } }, { fromHand: "i36" }],
    attachToInstanceId: null,
  },
  { type: "changeForm", playerId: "p1" },
  {
    type: "playCard",
    playerId: "p1",
    cardInstanceId: "i11",
    payment: [{ fromHand: "i40" }, { fromHand: "i39" }],
    attachToInstanceId: null,
  },
  choice("c2", ["i1"]),
  { type: "basicAttack", playerId: "p1", attackerInstanceId: "i3", targetInstanceId: "i1" },
  { type: "endTurn", playerId: "p1" },
  choice("c3", []),
  choice("c4", ["i3:01001a.spider-sense"]),
  choice("c5", ["decline"]),
  choice("c6", ["i35:01085.emergency-interrupt"]),
] as unknown as Command[];

async function revealStep(): Promise<Walkthrough> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(CONFIG);
  let walkthrough = emptyWalkthrough(1);
  for (const command of COMMANDS) {
    expect(await store.dispatch(command)).toBe(true);
    walkthrough = appendWalkthrough(
      walkthrough,
      store.state.lastEvents,
      store.state.game!,
      "p1" as PlayerId,
      POOL_DEPS,
    );
  }
  return walkthrough;
}

describe("a treachery that makes the villain scheme (#370)", () => {
  test("the reveal step's beats carry the card's own scheme, boost card and all, never step 2's attack", async () => {
    const walkthrough = await revealStep();
    const beats = walkthrough.steps[3]!.beats;
    const card = walkthrough.encounter.revealed.at(-1)!.instanceId;
    expect(beats[0]!.text).toBe("You revealed Dark Designs.");

    const flipped = beats.findIndex((beat) => beat.eventType === "boostCardFlipped");
    expect(flipped).toBeGreaterThan(0);
    // Before the scheme starts (the reveal, the interrupt window, Emergency) there is no activation at all.
    expect(beats.slice(0, flipped).every((beat) => beat.activation === null)).toBe(true);

    const boost = beats[flipped]!;
    expect(boost.startsActivation).toBe(true);
    expect(boost.activation).toMatchObject({ kind: "scheme", resolved: null });
    expect(boost.activation!.boosts).toHaveLength(1);

    const resolved = beats.find((beat) => beat.eventType === "schemeResolved")!;
    expect(resolved.activation).toMatchObject({ kind: "scheme", resolved: { threatBonus: -1, threatPlaced: 0 } });
    expect(resolved.activation!.boosts).toHaveLength(1);

    // The rail hands the body to that scheme while its beats are on screen, and shows the card before it.
    expect(encounterCardActivates(boost, card)).toBe(true);
    expect(encounterCardActivates(resolved, card)).toBe(true);
    expect(encounterCardActivates(beats[0]!, card)).toBe(false);
  });
});
