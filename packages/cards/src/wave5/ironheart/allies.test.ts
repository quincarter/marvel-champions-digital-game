import { describe, expect, it } from "vitest";
import { trait } from "@mc/content";
import {
  hasKeyword,
  keywordTotal,
  maxHitPoints,
  statBonus,
  traitsOf,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import {
  firstLegal,
  inst,
  moveToHand,
  P1,
  patchInstance,
  play,
  payWith,
  run,
  runWith,
  settle,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { playFromHand } from "../../testing/staging.js";
import { WAVE5_DEPS } from "../index.js";
import { startWave5Game } from "../testing.js";
import { ironheartScenario } from "./support.js";

const ironheartVsRhino = (seed = 1) => startWave5Game(ironheartScenario("rhino", { seed }));

/** Accepts every optional trigger/target option named in `wanted` (by exact id, `<instanceId>:<abilityId>` suffix,
 * or a chosen target's own instance id) and greedily maxes out any cost-payment/card-picking prompt that isn't
 * itself the thing being matched — `wave5/sm/spider-man-morales/precon-player-cards.test.ts`'s own `accepting()`. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (
      choice.prompt.kind === "chooseCostCards" ||
      choice.prompt.kind === "chooseCards" ||
      choice.prompt.kind === "payForAbility"
    ) {
      return choice.options.slice(0, choice.maxSelections).map((o) => o.optionId);
    }
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Plays `code` (already in the player's hand) from `state`, paying `cost` other hand cards, driven by `pick`. */
function playFromHandHelper(
  state: ReturnType<typeof ironheartVsRhino>,
  code: string,
  cost: number,
  pick: Picker = firstLegal,
) {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  const after = settle(
    runWith(WAVE5_DEPS, given.state, play(P1, id, payWith(given.state, P1, cost, [id]))),
    pick,
    undefined,
    WAVE5_DEPS,
  );
  return { state: after, id };
}

/** Pulls `n` more cards into P1's hand from the precon deck (distinct resource-icon cards, well under each printed
 * quantity), so a second/third costly play in the same test doesn't run the real hand dry mid-sequence. */
const TOPUP_CODES = [
  "29017",
  "29017",
  "29017",
  "29018",
  "29018",
  "29018",
  "29019",
  "29019",
  "29019",
  "29027",
  "29027",
  "29027",
  "29021",
  "29021",
];
function topUp(state: GameState, n: number): GameState {
  return moveToHand(state, P1, ...TOPUP_CODES.slice(0, n)).state;
}

const AERIAL = trait("AERIAL");
const CHAMPION = trait("CHAMPION");

describe("Brawn (ally, 29004)", () => {
  it(
    "29004.brawn-constant: unscripted — engine gap (module docblock): no `while` gate on a resource trigger, " +
      "and no ConstantPart field grants a whole ability conditionally",
    () => {
      expect(WAVE5_DEPS.abilities["29004.brawn-constant"]).toBeUndefined();
    },
  );
});

describe("Cloud 9 (ally, 29014)", () => {
  it("29014.cloud-9-action: exhausts to give each Aerial character the chosen player controls +1 THW until the end of the phase", () => {
    const hero = run(ironheartVsRhino(1), toHero(P1));
    const { state: withCloud9, id: cloud9 } = playFromHand(WAVE5_DEPS, hero, "29014", 3);
    expect(traitsOf(withCloud9, cloud9, WAVE5_DEPS)).toContain(AERIAL); // Cloud 9 herself is Aerial.
    expect(statBonus(withCloud9, WAVE5_DEPS, cloud9, "thw")).toBe(0);
    const after = settle(
      runWith(WAVE5_DEPS, withCloud9, use(P1, cloud9, "29014.cloud-9-action")),
      accepting(P1),
      undefined,
      WAVE5_DEPS,
    );
    expect(statBonus(after, WAVE5_DEPS, cloud9, "thw")).toBe(1); // She herself is an Aerial character P1 controls.
    expect(inst(after, cloud9).exhausted).toBe(true);
  });

  it("29014.cloud-9-action: a non-Aerial character the same player controls is unaffected", () => {
    const hero = run(ironheartVsRhino(2), toHero(P1));
    const { state: withCloud9, id: cloud9 } = playFromHand(WAVE5_DEPS, hero, "29014", 3);
    const { state: withPatriot, id: patriot } = playFromHandHelper(withCloud9, "29016", 3, accepting());
    expect(traitsOf(withPatriot, patriot, WAVE5_DEPS)).not.toContain(AERIAL);
    const after = settle(
      runWith(WAVE5_DEPS, withPatriot, use(P1, cloud9, "29014.cloud-9-action")),
      accepting(P1),
      undefined,
      WAVE5_DEPS,
    );
    expect(statBonus(after, WAVE5_DEPS, patriot, "thw")).toBe(0); // Patriot prints no Aerial trait.
  });
});

describe("Falcon (ally, 29015)", () => {
  it("29015.falcon-response: after Falcon attacks, spending [energy] readies another chosen champion character", () => {
    const hero = run(ironheartVsRhino(1), toHero(P1));
    const { state: withFalcon, id: falcon } = playFromHand(WAVE5_DEPS, hero, "29015", 4);
    // Patriot declines his own "choose a champion character" response here (no other champion to target yet).
    const { state: withPatriot, id: patriot } = playFromHandHelper(topUp(withFalcon, 6), "29016", 3, accepting());
    expect(traitsOf(withPatriot, patriot, WAVE5_DEPS)).toContain(CHAMPION);
    const exhaustedPatriot = patchInstance(withPatriot, patriot, { exhausted: true });
    const villain = exhaustedPatriot.villains[0]!.instanceId;
    const after = settle(
      runWith(WAVE5_DEPS, exhaustedPatriot, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: falcon,
        targetInstanceId: villain,
      } as never),
      accepting("29015.falcon-response", patriot),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, patriot).exhausted).toBe(false); // Readied by Falcon's response.
  });

  it("29015.falcon-response: declined, the exhausted target stays exhausted", () => {
    const hero = run(ironheartVsRhino(2), toHero(P1));
    const { state: withFalcon, id: falcon } = playFromHand(WAVE5_DEPS, hero, "29015", 4);
    const { state: withPatriot, id: patriot } = playFromHandHelper(topUp(withFalcon, 6), "29016", 3, accepting());
    const exhaustedPatriot = patchInstance(withPatriot, patriot, { exhausted: true });
    const villain = exhaustedPatriot.villains[0]!.instanceId;
    const after = settle(
      runWith(WAVE5_DEPS, exhaustedPatriot, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: falcon,
        targetInstanceId: villain,
      } as never),
      firstLegal, // declines every optional response/target by default
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, patriot).exhausted).toBe(true);
  });
});

describe("Patriot (ally, 29016)", () => {
  it("29016.patriot-response: after he enters play, the chosen champion character gets +1 THW/ATK/DEF until the end of the round", () => {
    const hero = run(ironheartVsRhino(1), toHero(P1));
    const given = moveToHand(hero, P1, "29016");
    const [patriotHand] = given.ids as [InstanceId];
    const paid = payWith(given.state, P1, 3, [patriotHand]);
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, patriotHand, paid)),
      // The trigger offer itself is `<patriotId>:29016.patriot-response`; the chooseTarget that follows offers
      // candidates by their own raw instance id — Patriot's own id matches both.
      accepting("29016.patriot-response", patriotHand),
      undefined,
      WAVE5_DEPS,
    );
    expect(statBonus(after, WAVE5_DEPS, patriotHand, "thw")).toBe(1);
    expect(statBonus(after, WAVE5_DEPS, patriotHand, "atk")).toBe(1);
    expect(statBonus(after, WAVE5_DEPS, patriotHand, "def")).toBe(1);
  });

  it("29016.patriot-response: a non-champion character (Agent 13, trait S.H.I.E.L.D. SPY only) is never offered as a target", () => {
    const hero = run(ironheartVsRhino(2), toHero(P1));
    const { state: withAgent13, id: agent13 } = playFromHandHelper(hero, "29022", 4, accepting());
    expect(traitsOf(withAgent13, agent13, WAVE5_DEPS)).not.toContain(CHAMPION);
    const given = moveToHand(topUp(withAgent13, 3), P1, "29016");
    const [patriotHand] = given.ids as [InstanceId];
    const paid = payWith(given.state, P1, 3, [patriotHand]);
    const reached = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, patriotHand, paid)),
      accepting("29016.patriot-response"), // accept the trigger offer, then inspect the ensuing chooseTarget prompt
      (s) => s.pendingChoice?.prompt.kind === "chooseTarget",
      WAVE5_DEPS,
    );
    const choice = reached.pendingChoice;
    expect(choice).toBeDefined();
    expect(choice?.prompt.kind).toBe("chooseTarget");
    expect(choice?.options.some((o) => o.optionId === agent13 || o.optionId.endsWith(`:${agent13}`))).toBe(false);
    expect(choice?.options.some((o) => o.optionId === patriotHand || o.optionId.endsWith(`:${patriotHand}`))).toBe(
      true,
    );
  });
});

describe("Agent 13 (ally, 29022) — a second printing of `sm` 27046", () => {
  it("29022.agent-13-response: aliased to the exact same effect as 27046 — after she attacks, readies a chosen S.H.I.E.L.D. support", () => {
    const hero = run(ironheartVsRhino(1), toHero(P1));
    const { state: withFacility, id: facility } = playFromHand(WAVE5_DEPS, hero, "29020", 3); // R&D Facility, trait S.H.I.E.L.D.
    const { state: withAgent13, id: agent13 } = playFromHand(WAVE5_DEPS, topUp(withFacility, 6), "29022", 4);
    const exhaustedFacility = patchInstance(withAgent13, facility, { exhausted: true });
    const villain = exhaustedFacility.villains[0]!.instanceId;
    const after = settle(
      runWith(WAVE5_DEPS, exhaustedFacility, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: agent13,
        targetInstanceId: villain,
      } as never),
      accepting("29022.agent-13-response", facility),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, facility).exhausted).toBe(false);
  });
});

describe("Snowguard (ally, 29023)", () => {
  const playSnowguard = (state: ReturnType<typeof ironheartVsRhino>, label: string) => {
    const hero = run(state, toHero(P1));
    return playFromHandHelper(hero, "29023", 4, (s) => {
      const choice = s.pendingChoice;
      if (!choice) return [];
      // First accept the "Response:" trigger offer itself, then pick the named quantity option it opens.
      if (choice.prompt.kind === "chooseTriggers") {
        const hit = choice.options.find((o) => o.optionId.endsWith(":29023.snowguard-response"));
        return hit ? [hit.optionId] : firstLegal(s);
      }
      const hit = choice.options.find((o) => o.label === label);
      return hit ? [hit.optionId] : firstLegal(s);
    });
  };

  it("29023.snowguard-response + -constant: placing 0 shift counters grants no bonus", () => {
    const { state: after, id: snowguard } = playSnowguard(ironheartVsRhino(1), "Place no shift counters");
    expect(statBonus(after, WAVE5_DEPS, snowguard, "atk")).toBe(0);
    expect(statBonus(after, WAVE5_DEPS, snowguard, "thw")).toBe(0);
    expect(maxHitPoints(after, snowguard, WAVE5_DEPS)).toBe(3); // printed hp, no +5.
    expect(hasKeyword(after, snowguard, "overkill", WAVE5_DEPS)).toBe(false);
    expect(keywordTotal(after, snowguard, "retaliate", WAVE5_DEPS)).toBe(0);
  });

  it("29023.snowguard-constant (1 shift counter): +3 ATK and her attacks gain overkill, nothing else", () => {
    const { state: after, id: snowguard } = playSnowguard(ironheartVsRhino(2), "Place 1 shift counter");
    expect(statBonus(after, WAVE5_DEPS, snowguard, "atk")).toBe(3);
    expect(hasKeyword(after, snowguard, "overkill", WAVE5_DEPS)).toBe(true);
    expect(statBonus(after, WAVE5_DEPS, snowguard, "thw")).toBe(0);
    expect(traitsOf(after, snowguard, WAVE5_DEPS)).not.toContain(AERIAL);
    expect(maxHitPoints(after, snowguard, WAVE5_DEPS)).toBe(3);
  });

  it("29023.snowguard-constant-2 (2 shift counters): +3 THW and gains the Aerial trait, nothing else", () => {
    const { state: after, id: snowguard } = playSnowguard(ironheartVsRhino(3), "Place 2 shift counters");
    expect(statBonus(after, WAVE5_DEPS, snowguard, "thw")).toBe(3);
    expect(traitsOf(after, snowguard, WAVE5_DEPS)).toContain(AERIAL);
    expect(statBonus(after, WAVE5_DEPS, snowguard, "atk")).toBe(0);
    expect(hasKeyword(after, snowguard, "overkill", WAVE5_DEPS)).toBe(false);
    expect(maxHitPoints(after, snowguard, WAVE5_DEPS)).toBe(3);
  });

  it("29023.snowguard-constant-3 (3 shift counters): +5 hit points and retaliate 1, nothing else", () => {
    const { state: after, id: snowguard } = playSnowguard(ironheartVsRhino(4), "Place 3 shift counters");
    expect(maxHitPoints(after, snowguard, WAVE5_DEPS)).toBe(8); // printed 3 + 5.
    expect(keywordTotal(after, snowguard, "retaliate", WAVE5_DEPS)).toBe(1);
    expect(statBonus(after, WAVE5_DEPS, snowguard, "atk")).toBe(0);
    expect(statBonus(after, WAVE5_DEPS, snowguard, "thw")).toBe(0);
    expect(traitsOf(after, snowguard, WAVE5_DEPS)).not.toContain(AERIAL);
  });
});

describe("Vivian (ally, 29024)", () => {
  it(
    "29024.vivian-response: unscripted — engine gap (module docblock): TargetQuery has no field reading a " +
      'candidate\'s own keywords, needed for "or non-permanent side scheme"',
    () => {
      expect(WAVE5_DEPS.abilities["29024.vivian-response"]).toBeUndefined();
    },
  );
});
