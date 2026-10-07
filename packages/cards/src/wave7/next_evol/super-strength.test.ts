import { hasKeyword, statusActive, traitsOf, type GameState } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { P1, identityOf, inst, moveToHand, payWith, play, playerOf, use } from "../../testing/harness.js";
import { attachToHost, handWith } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_DEPS } from "../index.js";
import { SUPER_STRENGTH } from "./super-strength.js";
import {
  BLACK_PANTHER,
  SPIDER_MAN,
  TWO,
  accepted,
  attackFor,
  attachmentOf,
  attachmentsOf,
  attacksBy,
  deckNames,
  discardNames,
  damageOn,
  drive,
  events,
  game,
  heroed,
  nameOf,
  playFromHand,
  round,
  setHand,
  villainId,
  withStatuses,
  type Run,
} from "./superpower-testing.js";

vi.setConfig({ testTimeout: 120_000 });

const traitNames = (s: GameState, id: Parameters<typeof traitsOf>[1]) => traitsOf(s, id, WAVE7_DEPS).map(String);
/** Juggernaut stage I prints ATK 2 and starts with 1 momentum counter (+1 ATK): 3 before any SUPERPOWER stat box. */
const JUGGERNAUT_ATK = 3;
const juggernaut = (sets: readonly string[] = ["super_strength"]) => game({ sets });
const stryfe = (sets: readonly string[] = ["super_strength"], players = [SPIDER_MAN] as const) =>
  game({ scenario: "stryfe", sets, players: [...players] });
const withAttached = (s: GameState, code: string) => attachToHost(s, code, villainId(s));

describe("registry", () => {
  it("registers every ref of the set", () => {
    expect(Object.keys(SUPER_STRENGTH).sort()).toEqual(
      [
        "40155.super-strength-constant",
        "40156.impervious-constant",
        "40156.impervious-action",
        "40157.thrown-object-constant",
        "40157.thrown-object-forced-response",
        "40158.when-revealed",
      ].sort(),
    );
  });
});

describe("Super Strength as a modular set: Setup, Attach to the villain, Permanent", () => {
  it('Juggernaut: attached at setup; Impervious, Thrown Object and both copies of "I\'ll Take That" are in the deck', () => {
    const s = juggernaut();
    expect(attachmentsOf(s, villainId(s))).toContain("Super Strength");
    const deck = deckNames(s);
    expect(deck).not.toContain("Super Strength");
    expect(deck.filter((n) => n === "Impervious")).toHaveLength(1);
    expect(deck.filter((n) => n === "Thrown Object")).toHaveLength(1);
    expect(deck.filter((n) => n === '"I\'ll Take That"')).toHaveLength(2);
    expect(hasKeyword(s, attachmentOf(s, villainId(s), "Super Strength"), "permanent", WAVE7_DEPS)).toBe(true);
  });

  it("Stryfe: attached to Stryfe", () => {
    const s = stryfe();
    expect(attachmentsOf(s, villainId(s))).toEqual(["Super Strength"]);
  });
});

describe("40155.super-strength-constant: attached villain gains the BRUTE trait and steady", () => {
  it("Stryfe (PSIONIC) gains BRUTE and steady; without the card he has neither", () => {
    const s = stryfe();
    expect(traitNames(s, villainId(s))).toEqual(expect.arrayContaining(["PSIONIC", "BRUTE"]));
    expect(hasKeyword(s, villainId(s), "steady", WAVE7_DEPS)).toBe(true);
    const without = stryfe(["flight"]);
    expect(traitNames(without, villainId(without))).not.toContain("BRUTE");
    expect(hasKeyword(without, villainId(without), "steady", WAVE7_DEPS)).toBe(false);
  });

  it("steady: one stunned status card does not stun him, two do", () => {
    const s = stryfe();
    const id = villainId(s);
    expect(statusActive(withStatuses(s, id, { stunned: 1 }), id, "stunned", WAVE7_DEPS)).toBe(false);
    expect(statusActive(withStatuses(s, id, { stunned: 2 }), id, "stunned", WAVE7_DEPS)).toBe(true);
    expect(statusActive(withStatuses(s, id, { confused: 1 }), id, "confused", WAVE7_DEPS)).toBe(false);
    expect(statusActive(withStatuses(s, id, { confused: 2 }), id, "confused", WAVE7_DEPS)).toBe(true);
  });

  it("steady in the villain phase: with 1 stunned status card he still attacks and keeps the card; with 2 the attack is canceled and both go", () => {
    const one = round(heroed(withStatuses(stryfe(), villainId(stryfe()), { stunned: 1 })), { boosts: 1 });
    expect(attacksBy(one.events, villainId(one.state))).toHaveLength(1);
    expect(inst(one.state, villainId(one.state)).statuses.stunned).toBe(1);
    const two = round(heroed(withStatuses(stryfe(), villainId(stryfe()), { stunned: 2 })), { boosts: 1 });
    expect(attacksBy(two.events, villainId(two.state))).toHaveLength(0);
    expect(inst(two.state, villainId(two.state)).statuses.stunned).toBe(0);
  });

  it("stat box ATK +1: Juggernaut attacks for 2 + 1 momentum + 1 = 4", () => {
    const run = round(heroed(juggernaut()), { boosts: 1 });
    expect(attacksBy(run.events, villainId(run.state))[0]!.baseAtk).toBe(JUGGERNAUT_ATK + 1);
  });
});

describe("Impervious (40156), attached to the villain", () => {
  it("40156.impervious-constant: damage from each attack is reduced by 1: Spider-Man's basic attack (2) deals 1 to Stryfe", () => {
    const s = withAttached(stryfe(), "40156").state;
    expect(damageOn(attackFor(s, villainId(s)).state, villainId(s))).toBe(1);
    const control = stryfe();
    expect(damageOn(attackFor(control, villainId(control)).state, villainId(control))).toBe(2);
  });

  it("40156.impervious-constant: Swinging Web Kick (8) deals 7", () => {
    const s = heroed(withAttached(stryfe(), "40156").state);
    const given = moveToHand(s, P1, "01005");
    const run = drive(given.state, {}, play(P1, given.ids[0]!, payWith(given.state, P1, 3, given.ids)));
    expect(damageOn(run.state, villainId(run.state))).toBe(7);
  });

  it("40156.impervious-action: Hero Action, spend [physical][physical] to give the villain a tough status card and discard it", () => {
    const base = heroed(withAttached(stryfe(), "40156").state);
    const card = attachmentOf(base, villainId(base), "Impervious");
    const { state, ids } = handWith(base, P1, "physical", 2);
    const run = drive(
      state,
      {},
      use(
        P1,
        card,
        "40156.impervious-action",
        ids.map((fromHand) => ({ fromHand })),
      ),
    );
    expect(inst(run.state, villainId(run.state)).statuses.tough).toBe(1);
    expect(attachmentsOf(run.state, villainId(run.state))).toEqual(["Super Strength"]);
    expect(discardNames(run.state)).toContain("Impervious");
    expect(playerOf(run.state, P1).discard).toHaveLength(2);
  });

  it("40156.impervious-action: not usable with one [physical] resource", () => {
    const base = heroed(withAttached(stryfe(), "40156").state);
    const card = attachmentOf(base, villainId(base), "Impervious");
    const { state, ids } = handWith(base, P1, "physical", 1);
    expect(
      accepted(
        state,
        use(
          P1,
          card,
          "40156.impervious-action",
          ids.map((fromHand) => ({ fromHand })),
        ),
      ),
    ).toBe(false);
  });
});

describe("Thrown Object (40157), attached to the villain", () => {
  it("40157 stat box ATK +3: Juggernaut attacks for 3 + 1 + 3 = 7", () => {
    const s = heroed(withAttached(juggernaut(), "40157").state);
    const run = round(s, { boosts: 1 });
    expect(attacksBy(run.events, villainId(run.state))[0]!.baseAtk).toBe(JUGGERNAUT_ATK + 1 + 3);
  });

  it("40157.thrown-object-forced-response: after the villain attacks, discard it (the next attack is 4 again)", () => {
    const s = heroed(withAttached(juggernaut(), "40157").state);
    const run = round(s, { boosts: 1 });
    expect(attachmentsOf(run.state, villainId(run.state))).toEqual(["Super Strength", "Juggernaut's Helmet"]);
    expect(discardNames(run.state)).toContain("Thrown Object");
  });

  it("40157.thrown-object-constant: his attacks gain ranged, which ignores Black Panther's retaliate 1 (control: he takes 1)", () => {
    const players = [BLACK_PANTHER];
    const control = round(heroed(stryfe(["super_strength"], players as never)), { boosts: 1 });
    expect(damageOn(control.state, villainId(control.state))).toBe(1);
    const base = withAttached(stryfe(["super_strength"], players as never), "40157").state;
    const run = round(heroed(base), { boosts: 1 });
    expect(attacksBy(run.events, villainId(run.state))).toHaveLength(1);
    expect(damageOn(run.state, villainId(run.state))).toBe(0);
  });

  it("40157.thrown-object-forced-response: not discarded by a scheme activation", () => {
    const s = withAttached(juggernaut(), "40157").state;
    const run = round(s, { boosts: 1 });
    expect(attachmentsOf(run.state, villainId(run.state))).toContain("Thrown Object");
  });
});

describe('"I\'ll Take That" (40158), a treachery', () => {
  /** Spider-Man with Web-Shooter (cost 1) and Heroic Intuition (cost 2) attached to his hero, in hero form. */
  const upgraded = (base: GameState): GameState => {
    const identity = identityOf(base);
    const first = playFromHand(base, P1, "01008", { host: identity });
    return playFromHand(first.state, P1, "01065", { host: identity }).state;
  };
  const upgradeNames = (s: GameState) => attachmentsOf(s, identityOf(s));
  /** Villain activations in the round: his own, plus Advance (a scheme) if "I'll Take That" surged into it. */
  const activations = (run: Run) =>
    events(run.events, "schemeResolved").length + attacksBy(run.events, villainId(run.state)).length;
  const reveal = (s: GameState) => round(setHand(s, P1, []), { boosts: 1, reveals: ["40158", "01186"] });

  it("sets up: Web-Shooter and Heroic Intuition are in play on the hero", () => {
    expect(upgradeNames(upgraded(juggernaut()))).toEqual(["Web-Shooter", "Heroic Intuition"]);
  });

  it("40158.when-revealed: discards the upgrade with the lowest cost (Web-Shooter 1 before Heroic Intuition 2); no surge", () => {
    const run = reveal(upgraded(juggernaut()));
    expect(upgradeNames(run.state)).toEqual(["Heroic Intuition"]);
    expect(playerOf(run.state, P1).discard.map((id) => nameOf(run.state, id))).toContain("Web-Shooter");
    // His own activation only: no surge reveal of the second card.
    expect(activations(run)).toBe(1);
  });

  it("40158.when-revealed: the highest cost instead if the villain has the PSIONIC trait (Stryfe: Heroic Intuition goes)", () => {
    const s = upgraded(stryfe());
    expect(traitNames(s, villainId(s))).toContain("PSIONIC");
    const run = reveal(s);
    expect(upgradeNames(run.state)).toEqual(["Web-Shooter"]);
    expect(activations(run)).toBe(1);
  });

  it("40158.when-revealed: with no upgrade the card gains surge, and the next encounter card is revealed", () => {
    const run = reveal(heroed(juggernaut()));
    expect(activations(run)).toBe(2);
    expect(discardNames(run.state)).toEqual(expect.arrayContaining(['"I\'ll Take That"', "Advance"]));
  });

  it("40158.when-revealed, 2 players: it reads the revealing player's own upgrades: P1 holds one, P2 holds none, so P2's copy surges and P1 keeps hers", () => {
    const base = game({ sets: ["super_strength"], players: TWO });
    const mine = playFromHand(base, P1, "01008", { host: identityOf(base) }).state;
    const run = round(heroed(mine), { boostCards: ["01187", "01187"], reveals: ["01186", "40158", "40158", "01186"] });
    expect(attachmentsOf(run.state, identityOf(run.state, P1))).toEqual(["Web-Shooter"]);
    // P1's Advance, P2's "I'll Take That" (no upgrade of hers: surge) and the Advance it surged into (each Advance's
    // scheme draws its own boost card, hence the second copy of the card stacked between them, which serves as that boost).
    expect(discardNames(run.state).filter((n) => n === "Advance")).toHaveLength(2);
    expect(discardNames(run.state).filter((n) => n === '"I\'ll Take That"')).toHaveLength(2);
    expect(attacksBy(run.events, villainId(run.state))).toHaveLength(2);
  });
});
