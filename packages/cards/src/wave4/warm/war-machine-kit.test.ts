import { activeVillain, traitsOf, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  play,
  playerOf,
  resourceAbility,
  runWith,
  settle,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { moveToDiscard } from "../../testing/staging.js";
import { WAVE4_DEPS } from "../index.js";
import { playFromHand, startWave4Game } from "../testing.js";
import { warMachineScenario } from "./support.js";

/** War Machine's own real precon (`war-machine-leadership`) against Rhino. He starts in alter-ego. */
const warMachineVsRhino = (seed = 1) => startWave4Game(warMachineScenario("rhino", { seed }));

const ammoOn = (state: GameState, id: InstanceId): number => inst(state, id).counters.ammo ?? 0;

/** Picks the offered option whose id names one of `wanted` (an ordinary "Response:" ability's own "use it?" prompt,
 * `../../wave4/nebu/nebula-kit.test.ts`'s own `accepting` helper); anything else falls back to `fallback`. */
const accepting =
  (wanted: readonly string[], fallback: Picker = firstLegal): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : fallback(state);
  };

/** Changing form fires an ordinary — optional — "Response:" (Locked and Loaded / James Rhodes' own forced response
 * is forced and needs no prompt), which `firstLegal` alone would decline (`minSelections` 0). */
const changeForm = (state: GameState, pick: Picker = accepting(["23001a.war-machine-constant"])): GameState =>
  settle(runWith(WAVE4_DEPS, state, toHero()), pick, undefined, WAVE4_DEPS);

/** Ends P1's turn and answers every choice (with `pick`) until a new round's player phase begins — the only way to
 * legally change form a second time (RRG 1.8 "Form, Change Form": once per round). */
const nextRound = (state: GameState, pick: Picker = firstLegal): GameState => {
  const round = state.round;
  return settle(
    runWith(WAVE4_DEPS, state, endTurn(P1)),
    pick,
    (s) => s.round > round && s.step.phase === "player",
    WAVE4_DEPS,
  );
};

/** `../testing.js`'s own `use`, settled through any prompts it raises with `pick` (defaulting to `firstLegal`). */
const useSettled = (state: GameState, id: InstanceId, ability: string, pick: Picker = firstLegal): GameState =>
  settle(runWith(WAVE4_DEPS, state, use(P1, id, ability)), pick, undefined, WAVE4_DEPS);

describe("War Machine / James Rhodes (identity, 23001a/b)", () => {
  it("Locked and Loaded (23001a.war-machine-constant): changing to hero form places 5 ammo counters on War Machine", () => {
    const start = warMachineVsRhino(1);
    const identity = identityOf(start, P1);
    expect(ammoOn(start, identity)).toBe(0);
    const hero = changeForm(start);
    expect(ammoOn(hero, identity)).toBe(5);
  });

  it("James Rhodes' forced response (23001b.james-rhodes-forced-response): changing back to alter-ego discards every ammo counter", () => {
    const hero = changeForm(warMachineVsRhino(1));
    const identity = identityOf(hero, P1);
    expect(ammoOn(hero, identity)).toBe(5);
    // Advance to a new round (villain phase) so the once-per-round form change is available again.
    const roundTwo = nextRound(hero);
    const alterEgo = changeForm(roundTwo);
    expect(ammoOn(alterEgo, identity)).toBe(0);
  });

  it("James Rhodes' Action (23001b.james-rhodes-action): shuffles a War Machine card from the discard pile into the deck (limit once per phase)", () => {
    const start = warMachineVsRhino(2);
    const identity = identityOf(start, P1);
    // A War Machine identity-set card (Repulsor Beam, 23008) in the discard pile to be found.
    const { state: discarded, id: repulsor } = moveToDiscard(start, P1, "23008");
    const deckBefore = playerOf(discarded, P1).deck.length;
    const after = useSettled(discarded, identity, "23001b.james-rhodes-action");
    expect(playerOf(after, P1).discard).not.toContain(repulsor);
    expect(playerOf(after, P1).deck.length).toBe(deckBefore + 1);
  });
});

describe("Iron Man (ally, 23002)", () => {
  it("23002.iron-man-response: after entering play, searches the deck and discard pile for a tech upgrade to hand", () => {
    const start = warMachineVsRhino(1);
    // Gauntlet Gun (23005) is a tech upgrade; stage a copy in the discard pile so the search finds it there.
    const { state: staged, id: gun } = moveToDiscard(start, P1, "23005");
    const pickGun: Picker = accepting(["23002.iron-man-response"], (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      const hit = choice.options.find((o) => o.ref && o.ref.kind === "card" && o.ref.instanceId === gun);
      return hit ? [hit.optionId] : firstLegal(state);
    });
    const { state: after } = playFromHand(staged, "23002", 3, pickGun);
    expect(playerOf(after, P1).hand).toContain(gun);
  });
});

describe("Munitions Bunker (support, 23003)", () => {
  it("Alter-Ego Action (23003.munitions-bunker-action): places 2 ammo counters on Munitions Bunker", () => {
    const { state, id: bunker } = playFromHand(warMachineVsRhino(1), "23003", 2);
    const used = useSettled(state, bunker, "23003.munitions-bunker-action");
    expect(ammoOn(used, bunker)).toBe(2);
  });

  it("Hero Action (23003.munitions-bunker-hero-action): moves every ammo counter from Munitions Bunker to War Machine", () => {
    const { state: withBunker, id: bunker } = playFromHand(warMachineVsRhino(1), "23003", 2);
    const loaded = useSettled(withBunker, bunker, "23003.munitions-bunker-action");
    const readied = patchInstance(loaded, bunker, { exhausted: false });
    const hero = changeForm(readied);
    const identity = identityOf(hero, P1);
    expect(ammoOn(hero, identity)).toBe(5);
    const after = useSettled(hero, bunker, "23003.munitions-bunker-hero-action");
    expect(ammoOn(after, bunker)).toBe(0);
    expect(ammoOn(after, identity)).toBe(7);
  });
});

describe("Upgraded Chassis (upgrade, 23004)", () => {
  it("23004.upgraded-chassis-constant: War Machine gains the aerial trait", () => {
    const { state } = playFromHand(changeForm(warMachineVsRhino(1)), "23004", 3);
    const identity = identityOf(state, P1);
    expect(traitsOf(state, identity, WAVE4_DEPS)).toContain("AERIAL");
  });

  it("23004.upgraded-chassis-response: after changing to hero form, exhausting Upgraded Chassis gives War Machine a tough status card", () => {
    // Play it while still in alter-ego form (nothing restricts it to hero form), so the one form change this round
    // both places ammo (23001a) and triggers this response.
    const start = warMachineVsRhino(1);
    const { state: withChassis, id: chassis } = playFromHand(start, "23004", 3);
    const identity = identityOf(withChassis, P1);
    const hero = changeForm(withChassis, accepting(["23001a.war-machine-constant", "23004.upgraded-chassis-response"]));
    expect(inst(hero, chassis).exhausted).toBe(true);
    expect(inst(hero, identity).statuses.tough).toBeGreaterThan(0);
  });
});

describe("Gauntlet Gun (upgrade, 23005)", () => {
  it("23005.gauntlet-gun-resource: generates a wild resource usable to pay for a War Machine card", () => {
    const hero = changeForm(warMachineVsRhino(1));
    const { state: withGun, id: gun } = playFromHand(hero, "23005", 2);
    const readiedGun = patchInstance(withGun, gun, { exhausted: false });
    // Repulsor Beam (23008) is a War Machine identity-set card: the ability's own resource is a legal payment.
    const { state: givenBeam, ids } = moveToHand(readiedGun, P1, "23008");
    const [beam] = ids as [InstanceId];
    const played = settle(
      runWith(
        WAVE4_DEPS,
        givenBeam,
        play(P1, beam, [], { abilities: [resourceAbility(gun, "23005.gauntlet-gun-resource")] }),
      ),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(playerOf(played, P1).hand).not.toContain(beam);
  });
});

describe("Weapon upgrades (23006, 23007)", () => {
  const villainId = (state: GameState) => activeVillain(state).instanceId;

  it("Missile Launcher (23006.missile-launcher-action): exhausts and removes 1 ammo → 2 ranged damage", () => {
    const hero = changeForm(warMachineVsRhino(1));
    const identity = identityOf(hero, P1);
    const { state: withLauncher, id: launcher } = playFromHand(hero, "23006", 1);
    const villain = villainId(withLauncher);
    const before = inst(withLauncher, villain).damage;
    const after = useSettled(withLauncher, launcher, "23006.missile-launcher-action");
    expect(inst(after, villain).damage).toBe(before + 2);
    expect(ammoOn(after, identity)).toBe(4);
  });

  it("Shoulder Cannon (23007.shoulder-cannon-action): 1 damage, then may remove 1 ammo to ready itself", () => {
    const hero = changeForm(warMachineVsRhino(2));
    const identity = identityOf(hero, P1);
    const { state: withCannon, id: cannon } = playFromHand(hero, "23007", 2);
    const villain = villainId(withCannon);
    const before = inst(withCannon, villain).damage;
    const pickReady: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      const hit = choice.options.find((o) => o.label.startsWith("Remove 1 ammo"));
      return hit ? [hit.optionId] : firstLegal(state);
    };
    const after = useSettled(withCannon, cannon, "23007.shoulder-cannon-action", pickReady);
    expect(inst(after, villain).damage).toBe(before + 1);
    expect(inst(after, cannon).exhausted).toBe(false);
    expect(ammoOn(after, identity)).toBe(4);
  });
});

describe("Events costed in ammo (23008–23011): resolve as soon as they're played", () => {
  const villainId = (state: GameState) => activeVillain(state).instanceId;

  it("Repulsor Beam (23008.repulsor-beam-action): removes 1 ammo → 4 damage to an enemy", () => {
    const hero = changeForm(warMachineVsRhino(1));
    const identity = identityOf(hero, P1);
    const villain = villainId(hero);
    const before = inst(hero, villain).damage;
    const { state: after } = playFromHand(hero, "23008", 1);
    expect(inst(after, villain).damage).toBe(before + 4);
    expect(ammoOn(after, identity)).toBe(4);
  });

  it("Targeted Strike (23009.targeted-strike-action): removes 1 ammo → removes 3 threat from a scheme", () => {
    const hero = changeForm(warMachineVsRhino(1));
    const identity = identityOf(hero, P1);
    const mainScheme = hero.mainScheme.instanceId;
    const staged = patchInstance(hero, mainScheme, { threat: 5 });
    const { state: after } = playFromHand(staged, "23009", 1);
    expect(inst(after, mainScheme).threat).toBe(2);
    expect(ammoOn(after, identity)).toBe(4);
  });

  it("Scorched Earth (23010.scorched-earth-action): removes 3 ammo → 3 damage to each enemy in play", () => {
    const hero = changeForm(warMachineVsRhino(1));
    const identity = identityOf(hero, P1);
    const villain = villainId(hero);
    const before = inst(hero, villain).damage;
    const { state: after } = playFromHand(hero, "23010", 3);
    expect(inst(after, villain).damage).toBe(before + 3);
    expect(ammoOn(after, identity)).toBe(2);
  });

  it("Full Auto (23011.full-auto-action): removes 4 ammo and chooses an enemy → 8 overkill damage", () => {
    const hero = changeForm(warMachineVsRhino(1));
    const identity = identityOf(hero, P1);
    const villain = villainId(hero);
    const before = inst(hero, villain).damage;
    const { state: after } = playFromHand(hero, "23011", 2);
    expect(inst(after, villain).damage).toBe(before + 8);
    expect(ammoOn(after, identity)).toBe(1);
  });
});
