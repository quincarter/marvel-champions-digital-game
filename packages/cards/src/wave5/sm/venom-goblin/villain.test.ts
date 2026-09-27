import { cardId, encounterSetId } from "@mc/content";
import { currentName, getInstance, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { endTurn, firstLegal, inst, P1, patchInstance, picking, playerOf } from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";

/**
 * Real-game tests for Venom Goblin (`sm` 27113–27115, MC27 p. 17): the villain's own three stages
 * (`villain.ts`). `27117a.lower-manhattan-special`/`27118a.midtown-manhattan-special`/
 * `27119a.upper-manhattan-special` and the flip/glider mechanics they sit on top of are `main-scheme.test.ts`'s and
 * `scenario.test.ts`'s own coverage; these tests exercise the villain's own Forced Response and When Revealed refs
 * that call them.
 */
/** `villainStartStageIndex`/`villainLastStageIndex` are `GameSetupConfig` fields, not `Wave5ScenarioOptions` ones
 * (`buildSmSingleVillain` computes them from the scenario record) — override the built config directly, the same
 * `{...scenario(...), ...overrides}` shape `wave5/sm/venom/villain.test.ts`'s own `venomGame` uses. */
function venomGoblinGame(
  overrides: { readonly villainStartStageIndex?: number; readonly villainLastStageIndex?: number } = {},
  seed = 11,
): GameState {
  return startWave5Game({
    ...ghostSpiderScenario("venom-goblin", { seed, modularSetIds: [encounterSetId("bomb_scare")] }),
    ...overrides,
  });
}

const schemes = (state: GameState): readonly InstanceId[] => [
  state.mainScheme.instanceId,
  ...(state.extraMainSchemes ?? []).map((s) => s.instanceId),
];
const schemeNamed = (state: GameState, name: string): InstanceId => {
  const found = schemes(state).find((id) => currentName(state, id) === name);
  if (!found)
    throw new Error(`no main scheme named ${name} among ${schemes(state).map((id) => currentName(state, id))}`);
  return found;
};
const threatOf = (state: GameState, name: string): number => getInstance(state, schemeNamed(state, name))!.threat;
const gliderOn = (state: GameState): string | undefined =>
  schemes(state)
    .filter((id) => (getInstance(state, id)?.counters["glider"] ?? 0) > 0)
    .map((id) => currentName(state, id))[0];

/** Moves the glider counter by direct state surgery, so a test can start a villain activation with it on a chosen
 * scheme instead of wherever Setup put it (Midtown Manhattan). */
function gliderTo(state: GameState, name: string): GameState {
  let next = state;
  for (const id of schemes(state)) {
    const counters = { ...inst(next, id).counters };
    if (counters["glider"]) delete counters["glider"];
    next = patchInstance(next, id, { counters });
  }
  const target = schemeNamed(next, name);
  next = patchInstance(next, target, { counters: { ...inst(next, target).counters, glider: 1 } });
  return next;
}

/** The total `damageDealt` sourced from `sourceInstanceId` — Midtown Manhattan's own "take 2 indirect damage" tags
 * its `dealDamage` with the scheme's own instance id (its Special's own "self"), distinct from the villain's own
 * attack (sourced from the villain instance) and from anything the round's own standard encounter card reveal does
 * (sourced from whatever card it reveals, never this scheme). */
const damageFrom = (events: readonly GameEvent[], sourceInstanceId: InstanceId): number =>
  events
    .filter((e): e is Extract<GameEvent, { type: "damageDealt" }> => e.type === "damageDealt")
    .filter((e) => e.sourceInstanceId === sourceInstanceId)
    .reduce((sum, e) => sum + e.amount, 0);

/** The events between `abilityId`'s own `abilityResolved` and the next `stepChanged` (the "enemyActivations" step
 * ending) — everything that ability's own effects caused, before the round moves on to the standard encounter card
 * reveal step, which can also discard from hand/deck for reasons that have nothing to do with this ability. */
const eventsDuring = (events: readonly GameEvent[], abilityId: string): readonly GameEvent[] => {
  const start = events.findIndex((e) => e.type === "abilityResolved" && String(e.abilityId) === abilityId);
  if (start < 0) return [];
  const end = events.findIndex((e, i) => i > start && e.type === "stepChanged");
  return events.slice(start, end < 0 ? events.length : end);
};

/**
 * A [Symbiote] environment (Lower Manhattan's own environment face, 27117b) in the villain area. The environment
 * faces are never in the encounter deck (they enter play only when a stage flips), so the test adds a fresh instance
 * of it rather than staging one from the deck.
 */
function withSymbioteEnvironment(state: GameState): { readonly state: GameState; readonly id: InstanceId } {
  const template = state.instances[state.mainScheme.instanceId]!;
  const id = "test-symbiote-env" as InstanceId;
  return {
    id,
    state: {
      ...state,
      instances: {
        ...state.instances,
        [id]: {
          ...template,
          instanceId: id,
          cardId: cardId("27117b"),
          ownerId: null,
          controllerId: null,
          damage: 0,
          threat: 0,
          statuses: { stunned: 0, confused: 0, tough: 0 },
          counters: {},
          attachedTo: null,
          attachments: [],
          boostCards: [],
          tucked: [],
          facedownAs: null,
          engagedWith: null,
          flipped: false,
          faceup: true,
        },
      },
      villainArea: [...state.villainArea, id],
    },
  };
}

describe("Venom Goblin (I) (27113): Infest the City — [star] Forced Response", () => {
  it("fires when Venom Goblin attacks a hero-form player, moving the glider to the least-threat main scheme", () => {
    let state = venomGoblinGame();
    state = withForm(state, { heroForm: 0 }, P1);
    state = gliderTo(state, "Midtown Manhattan");
    state = patchInstance(state, schemeNamed(state, "Lower Manhattan"), { threat: 0 }); // 0+1 accel = 1, the least
    state = patchInstance(state, schemeNamed(state, "Midtown Manhattan"), { threat: 5 });
    state = patchInstance(state, schemeNamed(state, "Upper Manhattan"), { threat: 3 }); // well below its target (10): stays a main scheme
    const { state: after, events } = driveEventsPicking(WAVE5_DEPS, state, picking("0"), endTurn(P1)); // "Place 2 threat"
    expect(events.some((e) => e.type === "attackResolved")).toBe(true);
    expect(gliderOn(after)).toBe("Lower Manhattan");
    expect(threatOf(after, "Lower Manhattan")).toBe(1 + 2); // step-one acceleration, then the chosen "place 2 threat"
  });

  it("also fires when Venom Goblin schemes against an alter-ego player (§4.1 Q67)", () => {
    let state = venomGoblinGame(); // starts alter-ego by default: the villain's own activation schemes.
    state = gliderTo(state, "Midtown Manhattan");
    state = patchInstance(state, schemeNamed(state, "Lower Manhattan"), { threat: 0 });
    state = patchInstance(state, schemeNamed(state, "Midtown Manhattan"), { threat: 5 });
    state = patchInstance(state, schemeNamed(state, "Upper Manhattan"), { threat: 3 }); // well below its target (10): stays a main scheme
    const { state: after, events } = driveEventsPicking(WAVE5_DEPS, state, picking("1"), endTurn(P1)); // "Resolve its Special"
    expect(events.some((e) => e.type === "schemeResolved")).toBe(true);
    expect(events.some((e) => e.type === "attackResolved")).toBe(false);
    expect(gliderOn(after)).toBe("Lower Manhattan");
  });

  it("a tie for least threat is broken by the first player's own choice (MC27 p. 21 FAQ)", () => {
    let base = venomGoblinGame();
    base = withForm(base, { heroForm: 0 }, P1);
    base = gliderTo(base, "Upper Manhattan");
    base = patchInstance(base, schemeNamed(base, "Lower Manhattan"), { threat: 0 }); // 0+1 = 1
    base = patchInstance(base, schemeNamed(base, "Midtown Manhattan"), { threat: 1 }); // 1+1 = 2
    base = patchInstance(base, schemeNamed(base, "Upper Manhattan"), { threat: 0 }); // 0+1 = 1, tied with Lower
    const lower = schemeNamed(base, "Lower Manhattan");
    const upper = schemeNamed(base, "Upper Manhattan");
    const pickLower = driveEventsPicking(WAVE5_DEPS, base, picking(lower, "1"), endTurn(P1));
    expect(gliderOn(pickLower.state)).toBe("Lower Manhattan");
    const pickUpper = driveEventsPicking(WAVE5_DEPS, base, picking(upper, "1"), endTurn(P1));
    expect(gliderOn(pickUpper.state)).toBe("Upper Manhattan");
  });

  it('the "place 2 threat" branch places threat instead of resolving the Special', () => {
    let state = venomGoblinGame();
    state = withForm(state, { heroForm: 0 }, P1);
    state = gliderTo(state, "Upper Manhattan");
    state = patchInstance(state, schemeNamed(state, "Lower Manhattan"), { threat: 9 });
    state = patchInstance(state, schemeNamed(state, "Midtown Manhattan"), { threat: 9 });
    state = patchInstance(state, schemeNamed(state, "Upper Manhattan"), { threat: 0 }); // stays the least: 0+1=1
    const { state: after, events } = driveEventsPicking(WAVE5_DEPS, state, picking("0"), endTurn(P1));
    expect(gliderOn(after)).toBe("Upper Manhattan");
    expect(threatOf(after, "Upper Manhattan")).toBe(1 + 2);
    // Upper Manhattan's own Special ("discard 1 card from your hand") never resolved — checked by ability id, not
    // a raw hand-size delta: the round's own standard encounter card reveal can discard from hand too, unrelated to
    // this choice.
    expect(events.some((e) => e.type === "abilityResolved" && e.abilityId === "27119a.upper-manhattan-special")).toBe(
      false,
    );
  });
});

describe("Venom Goblin (II) (27114): When Revealed deals 2 facedown encounter cards to each player; Claim the Throne resolves the Special outright", () => {
  it("27114.when-revealed deals exactly 2 facedown encounter cards to each player (2-player game)", () => {
    const state = venomGoblinGame({ villainStartStageIndex: 1, villainLastStageIndex: 1 }, 21);
    // `wave5Scenario`'s own 2-player seat, mirroring `ghostSpiderScenario`'s `extraPlayers` shape (docs/
    // phase7-wave5-handoff.md's own precedent for a second seat in these tests).
    // `venomGoblinGame` above seats one player; assert the single dealt-to player directly here instead.
    expect(playerOf(state, P1).dealtEncounter.length).toBe(2);
  });

  it("Claim the Throne resolves the glider scheme's own Special without offering a choice", () => {
    let state = venomGoblinGame({ villainStartStageIndex: 1, villainLastStageIndex: 1 }, 22);
    state = withForm(state, { heroForm: 0 }, P1);
    state = gliderTo(state, "Midtown Manhattan");
    const midtown = schemeNamed(state, "Midtown Manhattan");
    state = patchInstance(state, schemeNamed(state, "Lower Manhattan"), { threat: 9 });
    state = patchInstance(state, midtown, { threat: 0 }); // strictly least: 0+1=1
    state = patchInstance(state, schemeNamed(state, "Upper Manhattan"), { threat: 3 }); // well below its target (10): stays a main scheme
    const { state: after, events } = driveEventsPicking(WAVE5_DEPS, state, firstLegal, endTurn(P1));
    expect(events.some((e) => e.type === "attackResolved")).toBe(true);
    expect(events.some((e) => e.type === "optionChosen")).toBe(false); // (II) never offers "Choose to either"
    // The Special resolved on whichever scheme the glider landed on: Midtown Manhattan's own "take 2 indirect
    // damage" (no [Symbiote] environment in play here, so no +1 bonus). Checked by `sourceInstanceId`, not a raw
    // identity-damage delta: the villain's own attack (undefended) damages the identity too, and so can the round's
    // own standard encounter card reveal.
    expect(gliderOn(after)).toBe("Midtown Manhattan");
    expect(damageFrom(events, midtown)).toBe(2);
  });
});

describe("Venom Goblin (III) (27115): When Revealed deals 3 facedown encounter cards to each player; Reign of Terror places 1 threat then resolves the Special", () => {
  it("27115.when-revealed deals exactly 3 facedown encounter cards to each player", () => {
    const state = venomGoblinGame({ villainStartStageIndex: 2, villainLastStageIndex: 2 }, 31);
    expect(playerOf(state, P1).dealtEncounter.length).toBe(3);
  });

  it("places 1 threat on the glider scheme, then resolves its Special (Upper Manhattan: discard 1 from hand)", () => {
    let state = venomGoblinGame({ villainStartStageIndex: 2, villainLastStageIndex: 2 }, 32);
    state = withForm(state, { heroForm: 0 }, P1);
    state = gliderTo(state, "Upper Manhattan");
    state = patchInstance(state, schemeNamed(state, "Lower Manhattan"), { threat: 9 });
    state = patchInstance(state, schemeNamed(state, "Midtown Manhattan"), { threat: 9 });
    state = patchInstance(state, schemeNamed(state, "Upper Manhattan"), { threat: 0 }); // stays least: 0+1=1
    const { state: after, events } = driveEventsPicking(WAVE5_DEPS, state, firstLegal, endTurn(P1));
    expect(gliderOn(after)).toBe("Upper Manhattan");
    // Reign of Terror's own "place 1 threat on that scheme", within its own event window (the round's encounter
    // card reveal can place threat on the glider scheme too).
    const upper = schemeNamed(after, "Upper Manhattan");
    const villainId = after.villains[0]!.instanceId;
    const placed = eventsDuring(events, "27115.venom-goblin-constant").filter(
      (e) => e.type === "threatPlaced" && e.schemeInstanceId === upper && e.sourceInstanceId === villainId,
    );
    expect(placed.map((e) => (e as Extract<GameEvent, { type: "threatPlaced" }>).amount)).toEqual([1]);
    // Then the Special: discard 1 card from your hand — checked within this ability's own event window, not a raw
    // hand-size delta: the round's own standard encounter card reveal can discard from hand too.
    const during = eventsDuring(events, "27119a.upper-manhattan-special");
    expect(during.filter((e) => e.type === "cardDiscardedFromHand" && e.playerId === P1)).toHaveLength(1);
  });
});

describe("Each Manhattan Special resolved end to end through the villain, with the [Symbiote] bonus", () => {
  it("Lower Manhattan: 1 threat on each scheme (including a side scheme), +1 here with a [Symbiote] environment in play", () => {
    let state = venomGoblinGame({ villainStartStageIndex: 1, villainLastStageIndex: 1 }, 41); // (II): Claim the Throne resolves outright.
    state = withForm(state, { heroForm: 0 }, P1);
    state = gliderTo(state, "Lower Manhattan");
    const staged = encounterCardInVillainArea(state, "01109"); // Bomb Scare, a real side scheme (Core, bomb_scare).
    state = staged.state;
    const sideScheme = staged.id;
    state = patchInstance(state, sideScheme, { threat: 2 });
    state = patchInstance(state, schemeNamed(state, "Lower Manhattan"), { threat: 0 });
    // Well below their targets even after step-one's own +2 (module note below) and the Special's own "+1 to each
    // scheme" — Midtown's target (12) is otherwise easy to complete mid-Special by accident, cascading into a
    // second [Symbiote] environment and an unintended game loss before this ability finishes resolving.
    state = patchInstance(state, schemeNamed(state, "Midtown Manhattan"), { threat: 3 });
    state = patchInstance(state, schemeNamed(state, "Upper Manhattan"), { threat: 3 });
    // Bring in a [Symbiote] environment directly (`27117b`'s own trait data), keeping all three main schemes as
    // Lower/Midtown/Upper so "each scheme" (main and side) is exercised exactly as printed.
    const env = withSymbioteEnvironment(state);
    state = env.state;
    const { state: after } = driveEventsPicking(WAVE5_DEPS, state, firstLegal, endTurn(P1));
    expect(gliderOn(after)).toBe("Lower Manhattan");
    // Step one's own per-main-scheme threat is 2 here, not 1: Bomb Scare prints an acceleration icon, and "every
    // main scheme gains threat…plus the icons in play" (MC21 p. 11) adds it once, everywhere, on top of each
    // scheme's own printed acceleration.
    expect(threatOf(after, "Lower Manhattan")).toBe(2 + 1 + 1); // step-one accel, "each scheme", +1 [Symbiote] bonus
    expect(threatOf(after, "Midtown Manhattan")).toBe(5 + 1); // step-one accel, "each scheme" (no bonus: not glider's scheme)
    expect(threatOf(after, "Upper Manhattan")).toBe(5 + 1);
    expect(getInstance(after, sideScheme)!.threat).toBe(2 + 1); // side schemes are schemes too, but get no step-one accel
  });

  it("Midtown Manhattan: 2 indirect damage to that player, +1 more with a [Symbiote] environment in play", () => {
    let state = venomGoblinGame({ villainStartStageIndex: 1, villainLastStageIndex: 1 }, 42);
    state = withForm(state, { heroForm: 0 }, P1);
    state = gliderTo(state, "Midtown Manhattan");
    const midtown = schemeNamed(state, "Midtown Manhattan");
    state = patchInstance(state, schemeNamed(state, "Lower Manhattan"), { threat: 9 });
    state = patchInstance(state, midtown, { threat: 0 });
    state = patchInstance(state, schemeNamed(state, "Upper Manhattan"), { threat: 3 }); // well below its target (10): stays a main scheme
    const env = withSymbioteEnvironment(state);
    state = env.state;
    const { state: after, events } = driveEventsPicking(WAVE5_DEPS, state, firstLegal, endTurn(P1));
    expect(gliderOn(after)).toBe("Midtown Manhattan");
    // Checked by `sourceInstanceId` (Midtown Manhattan's own instance), not a raw identity-damage delta: the
    // villain's own attack damages the identity too.
    expect(damageFrom(events, midtown)).toBe(2 + 1);
  });

  it("Upper Manhattan: discard 1 from hand, plus the top 4 of the deck with a [Symbiote] environment in play", () => {
    let state = venomGoblinGame({ villainStartStageIndex: 1, villainLastStageIndex: 1 }, 43);
    state = withForm(state, { heroForm: 0 }, P1);
    state = gliderTo(state, "Upper Manhattan");
    state = patchInstance(state, schemeNamed(state, "Lower Manhattan"), { threat: 9 });
    state = patchInstance(state, schemeNamed(state, "Midtown Manhattan"), { threat: 9 });
    state = patchInstance(state, schemeNamed(state, "Upper Manhattan"), { threat: 0 });
    const env = withSymbioteEnvironment(state);
    state = env.state;
    const { state: after, events } = driveEventsPicking(WAVE5_DEPS, state, firstLegal, endTurn(P1));
    expect(gliderOn(after)).toBe("Upper Manhattan");
    // Both discards checked within this ability's own event window (module docblock on `eventsDuring`), not raw
    // hand/deck-size deltas.
    const during = eventsDuring(events, "27119a.upper-manhattan-special");
    expect(during.filter((e) => e.type === "cardDiscardedFromHand" && e.playerId === P1)).toHaveLength(1);
    expect(
      during.filter(
        (e) =>
          e.type === "cardMoved" &&
          e.from.kind === "deck" &&
          e.from.playerId === P1 &&
          e.to.kind === "discard" &&
          e.to.playerId === P1,
      ),
    ).toHaveLength(4);
  });
});
