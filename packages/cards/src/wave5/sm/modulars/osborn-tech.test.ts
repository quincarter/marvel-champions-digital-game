import { cardId, encounterSetId } from "@mc/content";
import {
  activeEncounterDeckId,
  activeVillain,
  applyCommand,
  createGame,
  damageTakenAfterConstants,
  hasKeyword,
  legalActions,
  legalDefenders,
  replay,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  playerOf,
  settle,
  toHero,
  use,
} from "../../../testing/harness.js";
import { driveEvents } from "../../../testing/staging.js";
import { playToOutcome } from "../../../testing/driver.js";
import { playFromHand, runWave5, startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario, ghostSpiderScenarioWithExtras } from "../ghost-spider/support.js";
import { wave5Scenario } from "../../setup.js";

/**
 * Osborn Tech (`sm` 27147–27152, `osborn-tech.ts`). A `ghostSpiderScenario("venom", …)` game — Venom prints
 * Toughness on every stage (`withoutTough`, `venom/villain.test.ts`'s own precedent), so a plain attack deals 0
 * damage unless it's stripped first.
 */
const venomGame = (seed = 1) =>
  startWave5Game(ghostSpiderScenario("venom", { seed, modularSetIds: [encounterSetId("osborn_tech")] }));

const withoutTough = (state: GameState, id: InstanceId) =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, tough: 0 } });

/** Every Osborn Tech card is an encounter card: `discard(self)` sends it to its own encounter deck's discard pile,
 * never `playerOf(...).discard` (`wave1/twc/bulldozer.test.ts`'s own "Bulldozer's Helmet" precedent). */
const inAnyEncounterDiscard = (state: GameState, id: InstanceId): boolean =>
  Object.values(state.encounterDecks).some((piles) => piles.discard.includes(id));

/** `toHero` toggles form; only send it when the identity isn't hero already. */
const asHero = (state: GameState): GameState =>
  playerOf(state, P1).identity.form === "hero" ? state : runWave5(state, toHero(P1));

/** Attaches an encounter-deck card straight to `hostId` — test-only surgery (no shared file to import it from;
 * `wave5/sm/venom/symbiotic-strength.test.ts`'s own `attachToHost` precedent, `wave3/gmw/nebula.test.ts`'s own
 * `attachToVillain`). */
function attachToHost(
  state: GameState,
  code: string,
  hostId: InstanceId,
): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = cardId(code);
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === wanted) ??
    pile.discard.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  const host = inst(state, hostId);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, attachedTo: hostId },
        [hostId]: { ...host, attachments: [...host.attachments, id] },
      },
    },
  };
}

describe("Arm Cannon (27147)", () => {
  it("27147.arm-cannon-constant: attached villain's attacks gain overkill and piercing", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const attached = attachToHost(state, "27147", villain);
    expect(WAVE5_DEPS.abilities["27147.arm-cannon-constant"]).toMatchObject({
      trigger: {
        kind: "constant",
        rules: [
          {
            kind: "attackKeywords",
            keywords: ["overkill", "piercing"],
            attacker: { categories: ["villain"], hostOfSelf: true },
          },
        ],
      },
    });
    expect(inst(attached.state, villain).attachments).toContain(attached.id);
  });

  it("27147.arm-cannon-action: discards the highest-cost upgrade you control, then discards itself", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const attached = attachToHost(state, "27147", villain);
    // Web-Bracelet (27009, cost 2) and Plan B (27024, cost 1) — Ghost-Spider's own precon upgrades.
    const withPlanB = playFromHand(attached.state, "27024", 1);
    const withBoth = playFromHand(withPlanB.state, "27009", 2);
    const resolved = settle(
      runWave5(asHero(withBoth.state), use(P1, attached.id, "27147.arm-cannon-action")),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(playerOf(resolved, P1).discard).toContain(withBoth.id); // Web-Bracelet (cost 2), the highest
    expect(inst(resolved, withBoth.id).attachedTo).toBeNull(); // left play
    expect(inst(resolved, withPlanB.id).attachedTo).not.toBeNull(); // Plan B (cost 1) stays attached (to your identity)
    expect(inAnyEncounterDiscard(resolved, attached.id)).toBe(true);
  });

  it("27147.arm-cannon-action: not legal with no upgrade controlled — the cost has nothing to pay with", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const attached = attachToHost(state, "27147", villain);
    const hero = asHero(attached.state);
    const actions = legalActions(hero, P1, WAVE5_DEPS);
    if (actions.kind === "turn") {
      expect(
        actions.legal.some((a) => a.action.kind === "useAbility" && a.action.abilityId === "27147.arm-cannon-action"),
      ).toBe(false);
    }
    const refused = applyCommand(hero, use(P1, attached.id, "27147.arm-cannon-action"), WAVE5_DEPS);
    expect(refused.ok).toBe(false);
  });
});

describe("Ionic Boots (27148)", () => {
  // Ionic Boots reacts to the *villain* attacking the player, not the player attacking the villain — Spiked
  // Gauntlet's own Hero Action ("The villain attacks you") attached alongside it is the reliable, deterministic way
  // to produce that event in a test (no dependency on the encounter AI's own villain-phase choice to attack).
  it("27148.ionic-boots-forced-response: after attached villain attacks and damages your identity, places 2 threat on the main scheme", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const stripped = withoutTough(state, villain);
    const boots = attachToHost(stripped, "27148", villain);
    const gauntlet = attachToHost(boots.state, "27151", villain);
    const hero = asHero(gauntlet.state);
    const main = hero.mainScheme.instanceId;
    const { state: after, events } = driveEvents(
      WAVE5_DEPS,
      hero,
      use(P1, gauntlet.id, "27151.spiked-gauntlet-action"),
    );
    const placed = events
      .filter(
        (e): e is Extract<(typeof events)[number], { type: "threatPlaced" }> =>
          e.type === "threatPlaced" && e.sourceInstanceId === boots.id && e.schemeInstanceId === main,
      )
      .reduce((sum, e) => sum + e.amount, 0);
    expect(placed).toBe(2);
    expect(inst(after, boots.id).attachedTo).toBe(villain);
  });

  it("27148.ionic-boots-forced-response: no threat placed when your identity took no damage (tough absorbs it)", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const stripped = withoutTough(state, villain);
    const boots = attachToHost(stripped, "27148", villain);
    const gauntlet = attachToHost(boots.state, "27151", villain);
    const hero = asHero(gauntlet.state);
    const identity = identityOf(hero);
    const toughened = patchInstance(hero, identity, { statuses: { ...inst(hero, identity).statuses, tough: 1 } });
    const main = toughened.mainScheme.instanceId;
    const { events } = driveEvents(WAVE5_DEPS, toughened, use(P1, gauntlet.id, "27151.spiked-gauntlet-action"));
    const placed = events.filter(
      (e) => e.type === "threatPlaced" && e.sourceInstanceId === boots.id && e.schemeInstanceId === main,
    );
    expect(placed).toHaveLength(0);
  });

  it("27148.ionic-boots-action: spends [energy][mental][physical] resources, then discards itself", () => {
    const config = ghostSpiderScenarioWithExtras("venom", {
      seed: 1,
      modularSetIds: [encounterSetId("osborn_tech")],
      extraCodes: ["01088", "01089", "01090"], // Energy, Genius (mental), Strength (physical)
    });
    const state = startWave5Game(config);
    const villain = activeVillain(state).instanceId;
    const attached = attachToHost(state, "27148", villain);
    const given = moveToHand(asHero(attached.state), P1, "01088", "01089", "01090");
    const paid = settle(
      runWave5(
        given.state,
        use(
          P1,
          attached.id,
          "27148.ionic-boots-action",
          given.ids.map((fromHand) => ({ fromHand })),
        ),
      ),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(paid, attached.id).attachedTo).toBeNull();
    expect(inAnyEncounterDiscard(paid, attached.id)).toBe(true);
  });
});

describe("Kinetic Armor (27149)", () => {
  it("27149.kinetic-armor-constant: attached villain gains retaliate 1", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const attached = attachToHost(state, "27149", villain);
    expect(hasKeyword(attached.state, villain, "retaliate", WAVE5_DEPS)).toBe(true);
  });

  it("27149.kinetic-armor-constant: no retaliate without the attachment", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    expect(hasKeyword(state, villain, "retaliate", WAVE5_DEPS)).toBe(false);
  });

  it("27149.kinetic-armor-action: takes 3 indirect damage, then discards itself", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const attached = attachToHost(state, "27149", villain);
    const hero = asHero(attached.state);
    const identity = identityOf(hero);
    const before = inst(hero, identity).damage;
    const resolved = settle(
      runWave5(hero, use(P1, attached.id, "27149.kinetic-armor-action")),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(resolved, identity).damage).toBe(before + 3); // solo game: only the identity to assign it to
    expect(inst(resolved, attached.id).attachedTo).toBeNull();
    expect(inAnyEncounterDiscard(resolved, attached.id)).toBe(true);
  });
});

describe("Neocarbon Scales (27150)", () => {
  it("27150.neocarbon-scales-constant: reduces damage attached villain takes from an attack by 1", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const attached = attachToHost(state, "27150", villain);
    expect(damageTakenAfterConstants(attached.state, WAVE5_DEPS, villain, 4, true)).toBe(3);
  });

  it("27150.neocarbon-scales-constant: does not reduce damage that isn't from an attack", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const attached = attachToHost(state, "27150", villain);
    expect(damageTakenAfterConstants(attached.state, WAVE5_DEPS, villain, 4, false)).toBe(4);
  });

  it("27150.neocarbon-scales-action: gives the villain a tough status card and 1 facedown boost card, then discards itself", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    // Venom prints its own Toughness, granting a tough status by default — stripped first so the gain below is
    // unambiguously this card's own Hero Action, not a no-op against an already-capped tough status.
    const stripped = withoutTough(state, villain);
    const attached = attachToHost(stripped, "27150", villain);
    const hero = asHero(attached.state);
    const beforeTough = inst(hero, villain).statuses.tough;
    const beforeBoosts = inst(hero, villain).boostCards.length;
    const resolved = settle(
      runWave5(hero, use(P1, attached.id, "27150.neocarbon-scales-action")),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(resolved, villain).statuses.tough).toBe(beforeTough + 1);
    expect(inst(resolved, villain).boostCards.length).toBe(beforeBoosts + 1);
    expect(inst(resolved, attached.id).attachedTo).toBeNull();
    expect(inAnyEncounterDiscard(resolved, attached.id)).toBe(true);
  });
});

describe("Spiked Gauntlet (27151)", () => {
  it("27151.spiked-gauntlet-action: the villain attacks you; damaging your identity keeps this card attached", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const stripped = withoutTough(state, villain);
    const attached = attachToHost(stripped, "27151", villain);
    const hero = asHero(attached.state);
    const identity = identityOf(hero);
    const { state: after } = driveEvents(WAVE5_DEPS, hero, use(P1, attached.id, "27151.spiked-gauntlet-action"));
    expect(inst(after, identity).damage).toBeGreaterThan(0);
    expect(inst(after, attached.id).attachedTo).toBe(villain);
  });

  it("27151.spiked-gauntlet-action: your identity taking no damage discards this card", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const stripped = withoutTough(state, villain);
    const attached = attachToHost(stripped, "27151", villain);
    const hero = asHero(attached.state);
    const identity = identityOf(hero);
    const toughened = patchInstance(hero, identity, { statuses: { ...inst(hero, identity).statuses, tough: 1 } });
    const { state: after } = driveEvents(WAVE5_DEPS, toughened, use(P1, attached.id, "27151.spiked-gauntlet-action"));
    expect(inst(after, identity).damage).toBe(0);
    expect(inst(after, attached.id).attachedTo).toBeNull();
    expect(inAnyEncounterDiscard(after, attached.id)).toBe(true);
  });
});

describe("Tracking Display (27152)", () => {
  it("27152.tracking-display-constant: each character cannot defend against the attached villain's attacks", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const attached = attachToHost(state, "27152", villain);
    expect(legalDefenders(asHero(attached.state), P1, WAVE5_DEPS, villain)).toEqual([]);
  });

  it("27152.tracking-display-constant: without the attachment, your identity can still defend", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const hero = asHero(state);
    const identity = identityOf(hero);
    expect(legalDefenders(hero, P1, WAVE5_DEPS, villain)).toContain(identity);
  });

  it("27152.tracking-display-action: exhausts a character you control and discards 1 random card from hand, then discards itself", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const attached = attachToHost(state, "27152", villain);
    const hero = asHero(attached.state);
    const identity = identityOf(hero);
    const handBefore = playerOf(hero, P1).hand.length;
    const resolved = settle(
      runWave5(hero, use(P1, attached.id, "27152.tracking-display-action", [], { exhausted: [identity] })),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(resolved, identity).exhausted).toBe(true);
    expect(playerOf(resolved, P1).hand.length).toBe(handBefore - 1);
    expect(inst(resolved, attached.id).attachedTo).toBeNull();
    expect(inAnyEncounterDiscard(resolved, attached.id)).toBe(true);
  });
});

describe("wave5Scenario with Osborn Tech swapped in", () => {
  it("Venom, solo: Ghost-Spider, with Osborn Tech in place of the scenario's own recommended modular", () => {
    const config = ghostSpiderScenario("venom", { seed: 2026, modularSetIds: [encounterSetId("osborn_tech")] });
    const created = createGame(config, WAVE5_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE5_DEPS);
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, WAVE5_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);

  it("also builds via wave5Scenario directly (a Core precon), unaffected by the swap", () => {
    expect(() =>
      wave5Scenario("venom", {
        seed: 3,
        players: [{ starterDeckId: "core-captain-marvel-leadership" }],
        modularSetIds: [encounterSetId("osborn_tech")],
      }),
    ).not.toThrow();
  });
});
