import {
  applyCommand,
  cardsInPlay,
  characterProfile,
  createGame,
  undefeatedVillains,
  type AbilityRegistry,
  type EngineDeps,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../../testing/harness.js";
import { driveEvents } from "../../../testing/staging.js";
import { runWave5, WAVE5_DEPS } from "../../testing.js";
import { wave5Scenario, type Wave5ScenarioOptions } from "../../setup.js";

/**
 * The Sinister Six's own encounter attachments (`sm` 27103–27106) and side scheme (27107, MC27 p. 15). One player
 * (so ending a single turn reaches the villain phase, unlike a 2-player game whose player phase visits every seat
 * first): `players + 1 = 2` villains are already in play from the main scheme's own Setup (`main-scheme.ts`), so
 * every attachment's `attachesTo` (data, not scripted here — see `encounter-attachments.ts`'s module docblock) finds
 * a legal host without needing "Ambush!"'s fallback.
 */
function sinisterSixGame(overrides: Partial<Wave5ScenarioOptions> = {}): GameState {
  const config: GameSetupConfig = wave5Scenario("sinister-six", {
    seed: 1,
    players: [{ starterDeckId: "ghost-spider" }],
    ...overrides,
  });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
}

/** `WAVE5_DEPS` with the named ability ids deleted — the "this card's behavior disappears without the script" check. */
function depsWithout(...ids: readonly string[]): EngineDeps {
  const abilities: AbilityRegistry = { ...WAVE5_DEPS.abilities };
  for (const id of ids) delete (abilities as Record<string, unknown>)[id];
  return { ...WAVE5_DEPS, abilities };
}

/** Changes to hero form so the identity can make a basic attack or a basic thwart. */
function toHeroApplied(state: GameState): GameState {
  return settle(runWave5(state, toHero(P1)), firstLegal, undefined, WAVE5_DEPS);
}

/**
 * Reveals `code` the ordinary way (the villain phase's own step 3/4, RRG 1.8 "Villain Phase", p. 47), stacking a
 * harmless filler (01186 "Advance") ahead of it: step 2's automatic villain attack draws *that* card as its own
 * boost card first, leaving `code` on top of the deck for step 3 to deal (the order `stageNemesisCardForReveal`
 * uses for a nemesis-set card, `testing/staging.ts`). Shared-encounter-deck cards like these five aren't nemesis
 * cards, so `revealFromEncounterDeck` (which stages from a player's `setAside`) doesn't apply — this is its
 * shared-deck counterpart.
 */
function revealCard(
  deps: EngineDeps,
  state: GameState,
  code: string,
): { readonly state: GameState; readonly id: InstanceId } {
  const stacked = stackEncounterDeck(state, "01186", code);
  const after = settle(runWith(deps, stacked, endTurn(P1)), firstLegal, undefined, deps);
  const id = instancesOf(after, code).find((candidate) => cardsInPlay(after).includes(candidate));
  if (!id) throw new Error(`${code} did not enter play`);
  return { state: after, id };
}

/** A basic thwart from P1's identity against `target`, readying it first (`scenario-cards.test.ts`'s own shape). */
function thwart(deps: EngineDeps, state: GameState, target: InstanceId): GameState {
  const identity = identityOf(state, P1);
  const readied = patchInstance(state, identity, { exhausted: false });
  return settle(
    runWith(deps, readied, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identity,
      schemeInstanceId: target,
    }),
    firstLegal,
    undefined,
    deps,
  );
}

describe("Heightened Morale (27103, attachment)", () => {
  it("27103.heightened-morale-constant-2: +X ATK, X = the number of villains in play", () => {
    const state = sinisterSixGame();
    const villainCount = undefeatedVillains(state).length;
    expect(villainCount).toBe(2); // players (1) + 1
    const { state: revealed, id: card } = revealCard(WAVE5_DEPS, state, "27103");
    const host = undefeatedVillains(revealed).find((v) => inst(revealed, v.instanceId).attachments.includes(card));
    expect(host, "Heightened Morale should have attached to a villain (attachesTo is data)").toBeDefined();
    const withBonus = characterProfile(revealed, host!.instanceId, WAVE5_DEPS)!.atk;
    const withoutTheScript = characterProfile(
      revealed,
      host!.instanceId,
      depsWithout("27103.heightened-morale-constant-2"),
    )!.atk;
    expect(withBonus - withoutTheScript).toBe(villainCount);
  });
});

describe("Taunting Presence (27104, attachment)", () => {
  it("27104.taunting-presence-constant-2: threat cannot be removed from Light at the End", () => {
    const state = toHeroApplied(sinisterSixGame());
    const light = instancesOf(state, "27102a")[0]!;
    const withThreat = patchInstance(state, light, { threat: 5 });
    const { state: attached } = revealCard(WAVE5_DEPS, withThreat, "27104");
    const threatBefore = inst(attached, light).threat;

    const blocked = thwart(WAVE5_DEPS, attached, light);
    expect(inst(blocked, light).threat, "threatCannotBeRemoved should have blocked the thwart").toBe(threatBefore);

    const withoutTheScript = thwart(depsWithout("27104.taunting-presence-constant-2"), attached, light);
    expect(inst(withoutTheScript, light).threat).toBeLessThan(threatBefore);
  });
});

describe("Team Leader (27105, attachment)", () => {
  it("27105.team-leader-constant: attaches to the villain with the lowest activation order value (data; no other text)", () => {
    const state = sinisterSixGame();
    const { state: revealed, id: card } = revealCard(WAVE5_DEPS, state, "27105");
    const host = undefeatedVillains(revealed).find((v) => inst(revealed, v.instanceId).attachments.includes(card));
    expect(host).toBeDefined();
  });
});

describe("Take One for the Team (27106, attachment)", () => {
  it("27106.take-one-for-the-team-constant-2: you cannot attack villains without an attached copy", () => {
    const state = toHeroApplied(sinisterSixGame());
    const { state: attached, id: card } = revealCard(WAVE5_DEPS, state, "27106");
    const villains = undefeatedVillains(attached);
    const withCard = villains.find((v) => inst(attached, v.instanceId).attachments.includes(card))!;
    const withoutCard = villains.find((v) => v.instanceId !== withCard.instanceId)!;
    expect(withoutCard, "players+1=2 villains: one other villain has no attached copy").toBeDefined();

    const identity = identityOf(attached, P1);
    const attack = (target: InstanceId) =>
      ({ type: "basicAttack" as const, playerId: P1, attackerInstanceId: identity, targetInstanceId: target }) as const;

    expect(applyCommand(attached, attack(withoutCard.instanceId), WAVE5_DEPS).ok).toBe(false);
    expect(applyCommand(attached, attack(withCard.instanceId), WAVE5_DEPS).ok).toBe(true);
    // Without the script, attacking the villain that lacks the attachment is legal again.
    expect(
      applyCommand(attached, attack(withoutCard.instanceId), depsWithout("27106.take-one-for-the-team-constant-2")).ok,
    ).toBe(true);
  });
});

describe("Brute Force Barricade (27107, side scheme)", () => {
  it("27107.brute-force-barricade-constant: threat cannot be removed from other side schemes (Light at the End), but can from itself", () => {
    const state = toHeroApplied(sinisterSixGame());
    const light = instancesOf(state, "27102a")[0]!;
    const withThreat = patchInstance(state, light, { threat: 5 });
    const { state: withBarricade, id: barricade } = revealCard(WAVE5_DEPS, withThreat, "27107");
    const barricadeThreatBefore = inst(withBarricade, barricade).threat;
    const lightThreatBefore = inst(withBarricade, light).threat;

    const blockedOther = thwart(WAVE5_DEPS, withBarricade, light);
    expect(inst(blockedOther, light).threat).toBe(lightThreatBefore);

    const allowedSelf = thwart(WAVE5_DEPS, withBarricade, barricade);
    expect(inst(allowedSelf, barricade).threat).toBeLessThan(barricadeThreatBefore);

    const withoutTheScript = thwart(depsWithout("27107.brute-force-barricade-constant"), withBarricade, light);
    expect(inst(withoutTheScript, light).threat).toBeLessThan(lightThreatBefore);
  });

  it('27107.boost: "[star] Boost: Give the villain 1 additional boost card for this activation"', () => {
    const state = sinisterSixGame();
    // 27107 as the top card of the encounter deck becomes the villain's own automatic boost card for the villain
    // phase's step 2 attack (RRG 1.8 "Villain Phase", p. 47 — step 2 draws its boost card before step 3 deals any
    // other encounter card, so no filler is needed ahead of it).
    const stacked = stackEncounterDeck(state, "27107");
    const { events } = driveEvents(WAVE5_DEPS, stacked, endTurn(P1));
    const flips = events.filter((e) => e.type === "boostCardFlipped");
    expect(flips.length).toBe(2); // 27107 itself, plus the 1 additional card its own Boost: ability gives.

    const withoutScript = driveEvents(depsWithout("27107.boost"), stacked, endTurn(P1));
    const flipsWithoutScript = withoutScript.events.filter((e) => e.type === "boostCardFlipped");
    expect(flipsWithoutScript.length).toBe(1);
  });
});
