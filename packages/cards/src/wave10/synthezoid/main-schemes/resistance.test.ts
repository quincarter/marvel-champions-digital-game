import { keywordTotal, mainSchemeValue, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { competitiveOnlyTexts, validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  inst,
  mainThreat,
  patchInstance,
  playerOf,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, playFromHand, withForm } from "../../../testing/staging.js";
import { inPlayCard, types } from "../../../wave9/testing.js";
import { WAVE10_CARDS } from "../../cards.js";
import { CORE_SPIDER_MAN, SPIDER_WOMAN_SCENARIO, WAVE10_DEPS } from "../../testing.js";
import { ungatedStageGame } from "../testing.js";
import { SYNTHEZOID_MAIN_SCHEMES_RESISTANCE, SYNTHEZOID_MAIN_SCHEMES_RESISTANCE_SKIPPED } from "./resistance.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * The Synthezoid Smackdown resistance main scheme (57044a/b, 57045a/b; docs/phase7-synthezoid.md 1.5, 7.5): the
 * A faces and both B faces repeat Civil War stages word for word, so the scripts are Civil War's under new ids. Played
 * in the real `resistance-spider-woman` scenario (Synthezoid's Vision leader is not scripted yet) with the pack's
 * stages chosen by the id of their B faces; they follow Civil War's eight stages on the gathered card (stage pool
 * "side", wave 10 M1), so 57044b is stage index 8 and 57045b is stage index 9.
 */
const PROTECT_SECRET_IDENTITIES = "57044b";
const EXPOSE_OVERREACH = "57045b";
const OPEN_REBELLION = "56172b";
const NEIGHBORHOOD_PROTECTORS = "56173b";
const GLIDE = "56179";
const BLACK_CAT = "01002";
/** Cards that touch neither the main scheme nor a player's deck: boost cards and two side schemes. */
const FILLER = ["01188", "01189", "56183", "56198"] as const;
const REFS = [
  "57044a.setup",
  "57044b.protect-secret-identities-constant",
  "57044b.protect-secret-identities-forced-response",
  "57045b.expose-overreach-constant",
];
const deps = WAVE10_DEPS;
const SETUP_SENTENCE =
  "In competitive mode, the enemy team finds the Choosing Sides side scheme and your team reveals it.";

type Pair = readonly [string, string];
const open = (pair: Pair, twoPlayers = true): GameState =>
  ungatedStageGame(SPIDER_WOMAN_SCENARIO, pair, { twoPlayers });
/** One player on the Core Spider-Man deck (Black Cat is in it). */
const spiderMan = (): GameState =>
  ungatedStageGame(SPIDER_WOMAN_SCENARIO, [PROTECT_SECRET_IDENTITIES, EXPOSE_OVERREACH], {
    twoPlayers: false,
    starterDeckId: CORE_SPIDER_MAN,
  });
const scheme = (s: GameState): InstanceId => s.mainScheme.instanceId;
const target = (s: GameState): number => mainSchemeValue(s, "targetThreat", deps);
const hinder = (s: GameState): number => keywordTotal(s, scheme(s), "hinder", deps);
const heroes = (s: GameState): GameState => withForm(withForm(s, { heroForm: 0 }, P1), { heroForm: 0 }, P2);
const onStage = (s: GameState, stageIndex: number): GameState => ({
  ...s,
  mainScheme: { ...s.mainScheme, stageIndex },
});
const turnOrder = (s: GameState): PlayerId[] => {
  const step = s.step as unknown as { activePlayerId: PlayerId; remainingPlayerIds: PlayerId[] };
  return [step.activePlayerId, ...step.remainingPlayerIds];
};
const villainPhase = (s: GameState, pick: Picker = firstLegal) =>
  driveEventsPicking(deps, stackEncounterDeck(s, ...FILLER), pick, ...turnOrder(s).map((p) => endTurn(p)));
/** Both heroes, the scheme given this much threat. */
const withThreat = (s: GameState, threat: number): GameState => patchInstance(heroes(s), scheme(s), { threat });

const card = () => {
  const found = WAVE10_CARDS.find((c) => (c.id as string) === "57044a");
  if (found?.type !== "main_scheme") throw new Error("no 57044a");
  return found;
};

describe("registry", () => {
  it("scripts every ref the data names, none skipped, each valid", () => {
    expect(Object.keys(SYNTHEZOID_MAIN_SCHEMES_RESISTANCE).sort()).toEqual([...REFS].sort());
    expect(SYNTHEZOID_MAIN_SCHEMES_RESISTANCE_SKIPPED).toEqual({});
    expect([...abilityRefIds(card())].sort()).toEqual([...REFS].sort());
    for (const ref of REFS) expect(validateDefinition(SYNTHEZOID_MAIN_SCHEMES_RESISTANCE[ref]!), ref).toEqual([]);
    expect(competitiveOnlyTexts(SYNTHEZOID_MAIN_SCHEMES_RESISTANCE["57044a.setup"]!)).toEqual([SETUP_SENTENCE]);
    expect(card().stages.map((s) => [s.printedCardId, s.stageNumber, s.completionLoses ?? false])).toEqual([
      [PROTECT_SECRET_IDENTITIES, 1, false],
      [EXPOSE_OVERREACH, 2, true],
    ]);
  });
});

describe("57044a Setup and the stage 1 hinder of 57044b Protect Secret Identities", () => {
  it("57044a.setup finds and reveals the leader's side scheme (Self-propelled Glide, 6 threat)", () => {
    const s = open([PROTECT_SECRET_IDENTITIES, EXPOSE_OVERREACH]);
    expect(s.mainScheme.stageIndex).toBe(8);
    expect(inst(s, inPlayCard(s, GLIDE)!).threat).toBe(6);
  });

  it("hinder 2 per hero only with more than one player: 0 threat and target 7 alone, 4 and 14 with two", () => {
    const one = open([PROTECT_SECRET_IDENTITIES, EXPOSE_OVERREACH], false);
    expect([hinder(one), mainThreat(one), target(one)]).toEqual([0, 0, 7]);
    const two = open([PROTECT_SECRET_IDENTITIES, EXPOSE_OVERREACH]);
    expect([hinder(two), mainThreat(two), target(two)]).toEqual([4, 4, 14]);
  });
});

describe("57044b Protect Secret Identities: Forced Response, each player discards the top 3", () => {
  it("each player discards their own top 3, after the threat is placed, and Open Rebellion's stage does not", () => {
    const s = heroes(open([PROTECT_SECRET_IDENTITIES, EXPOSE_OVERREACH]));
    const tops = [P1, P2].map((p) => playerOf(s, p).deck.slice(0, 3));
    const { state, events } = villainPhase(s);
    [P1, P2].forEach((player, seat) => {
      for (const id of tops[seat]!) expect(playerOf(state, player).discard, `${player} ${id}`).toContain(id);
    });
    const ref = "57044b.protect-secret-identities-forced-response";
    const resolved = events.filter((e) => e.type === "abilityResolved" && e.abilityId === ref);
    expect(resolved).toHaveLength(1);
    expect(events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === ref)).toBeGreaterThan(
      events.findIndex((e) => e.type === "threatPlaced"),
    );
    const other = heroes(open([OPEN_REBELLION, NEIGHBORHOOD_PROTECTORS]));
    const before = playerOf(other, P1).discard.length;
    expect(playerOf(villainPhase(other).state, P1).discard.length).toBeLessThan(before + 3);
  });
});

describe("advancing 57044b to 57045b Expose Overreach (stage 1 to stage 2)", () => {
  it("advances at exactly the target to stage index 9: target 18, no hinder", () => {
    const s = open([PROTECT_SECRET_IDENTITIES, EXPOSE_OVERREACH]);
    // Step 1 places 3 (1 per player and 1 for Self-propelled Glide's acceleration icon); the filler adds nothing.
    const short = villainPhase(withThreat(s, target(s) - 4)).state;
    expect(short.mainScheme.stageIndex).toBe(8);
    const events = villainPhase(withThreat(s, target(s) - 3));
    expect(types(events.events, "mainSchemeCompleted")).toHaveLength(1);
    expect(events.state.mainScheme.stageIndex).toBe(9);
    expect(target(events.state)).toBe(18);
    expect(hinder(events.state)).toBe(0);
    expect(events.state.outcome).toBeNull();
  });
});

describe("57045b Expose Overreach: allies enter play exhausted; completing it loses the game", () => {
  it("Black Cat enters exhausted on this stage and ready on another stage 2", () => {
    const here = onStage(withForm(spiderMan(), { heroForm: 0 }), 9);
    const played = playFromHand(deps, here, BLACK_CAT, 2);
    expect(inst(played.state, played.id).exhausted).toBe(true);
    const elsewhere = onStage(withForm(spiderMan(), { heroForm: 0 }), 1);
    const ready = playFromHand(deps, elsewhere, BLACK_CAT, 2);
    expect(inst(ready.state, ready.id).exhausted).toBe(false);
  });

  it("completed by the villain phase's threat, the players lose (target 9 per player)", () => {
    const last = onStage(open([PROTECT_SECRET_IDENTITIES, EXPOSE_OVERREACH]), 9);
    expect(target(last)).toBe(18);
    expect(villainPhase(withThreat(last, 18 - 4)).state.outcome).toBeNull();
    expect(villainPhase(withThreat(last, 18 - 3)).state.outcome).toMatchObject({ result: "loss" });
  });
});
