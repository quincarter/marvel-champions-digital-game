import { hasKeyword, traitsOf, type GameState } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  P2,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  use,
} from "../../testing/harness.js";
import { attachToHost, handWith } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_DEPS } from "../index.js";
import { FLIGHT } from "./flight.js";
import {
  ANGEL,
  BLACK_PANTHER,
  SPIDER_MAN,
  TWO,
  type Seats,
  seatWithCard,
  accepted,
  attackFor,
  basicAttackBy,
  attackRound,
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
  inPlayFromDeck,
  setHand,
  nameOf,
  round,
  villainId,
  withStatuses,
  type Run,
} from "./superpower-testing.js";

vi.setConfig({ testTimeout: 120_000 });

/** 3 upgrades, 2 events and a support: the largest group of one type is 3 (Stryfe's X). */
const UP3 = ["01007", "01007", "01008", "01004", "01005", "01063"] as const;
const traitNames = (s: GameState, id: Parameters<typeof traitsOf>[1]) => traitsOf(s, id, WAVE7_DEPS).map(String);
/** Juggernaut stage I prints ATK 2 and starts with 1 momentum counter (+1 ATK): 3 before any SUPERPOWER stat box. */
const JUGGERNAUT_ATK = 3;
/** A Juggernaut game (stage I: ATK 2, SCH 1, BRUTE) with Flight chosen as the modular set. */
const flightGame = (players: Seats = [SPIDER_MAN]) => game({ sets: ["flight"], players });
/** `code` attached to the villain out of the encounter deck (no reveal). */
const withAttached = (s: GameState, code: string) => attachToHost(s, code, villainId(s));

describe("registry", () => {
  it("registers every ref of the set", () => {
    expect(Object.keys(FLIGHT).sort()).toEqual(
      [
        "40151.flight-constant",
        "40151.flight-constant-2",
        "40152.aerial-bombardment-constant",
        "40152.aerial-bombardment-action",
        "40153.out-of-reach-constant",
        "40153.out-of-reach-action",
        "40154.when-revealed",
        "40154.boost",
      ].sort(),
    );
  });
});

describe("Flight as a modular set: Setup, Attach to the villain, Permanent", () => {
  it("Juggernaut: Flight is attached to the villain at setup; the other four cards are in the encounter deck", () => {
    const s = flightGame();
    expect(attachmentsOf(s, villainId(s))).toContain("Flight");
    const deck = deckNames(s);
    expect(deck).not.toContain("Flight");
    expect(deck.filter((n) => n === "Out of Reach")).toHaveLength(1);
    expect(deck.filter((n) => n === "Aerial Bombardment")).toHaveLength(1);
    expect(deck.filter((n) => n === "High Ground")).toHaveLength(2);
    expect(hasKeyword(s, attachmentOf(s, villainId(s), "Flight"), "permanent", WAVE7_DEPS)).toBe(true);
  });

  it("Stryfe: the same set attaches to Stryfe, whichever villain is in play", () => {
    const s = game({ scenario: "stryfe", sets: ["flight"] });
    expect(attachmentsOf(s, villainId(s))).toEqual(["Flight"]);
  });
});

describe("40151.flight-constant: attached villain gains the AERIAL trait", () => {
  it("Juggernaut keeps BRUTE and gains AERIAL; without Flight he is not AERIAL", () => {
    const s = flightGame();
    expect(traitNames(s, villainId(s))).toEqual(expect.arrayContaining(["BRUTE", "AERIAL"]));
    const without = game({ sets: ["telepathy"] });
    expect(traitNames(without, villainId(without))).not.toContain("AERIAL");
  });

  it("Stryfe: PSIONIC and AERIAL", () => {
    const s = game({ scenario: "stryfe", sets: ["flight"] });
    expect(traitNames(s, villainId(s))).toEqual(expect.arrayContaining(["PSIONIC", "AERIAL"]));
  });
});

describe("40151 stat box: ATK +1", () => {
  it("Juggernaut's attack is 2 + 1 momentum + 1 = 4; his scheme stays 1", () => {
    const attack = attackRound(flightGame());
    expect(attacksBy(attack.events, villainId(attack.state))[0]!.baseAtk).toBe(JUGGERNAUT_ATK + 1);
    const scheme = round(flightGame(), { boosts: 1 });
    expect(events(scheme.events, "schemeResolved")[0]!.baseSch).toBe(1);
  });
});

describe("40151.flight-constant-2: [star] attached villain's attacks gain overkill", () => {
  /**
   * Stryfe (no overkill of his own; Juggernaut's Helmet gives Juggernaut overkill) attacks a hero with 3 upgrades, 2
   * events and a support in hand: X = 3, +1 from the stat box = 4 ATK. Daredevil (1 hit point left) defends.
   */
  const defended = (set: string): Run => {
    const stryfe = game({ scenario: "stryfe", sets: [set] });
    const { state, id } = inPlayFromDeck(setHand(heroed(stryfe), P1, UP3), P1, "01058");
    return round(patchInstance(state, id, { damage: 2 }), { boostCards: ["01186"], plan: { defend: "Daredevil" } });
  };

  it("with overkill the excess damage from a defended attack goes to the hero: 4 - 1 = 3", () => {
    const run = defended("flight");
    expect(attacksBy(run.events, villainId(run.state))[0]!.baseAtk).toBe(4);
    expect(damageOn(run.state, identityOf(run.state))).toBe(3);
    expect(playerOf(run.state, P1).playArea.map((id) => nameOf(run.state, id))).not.toContain("Daredevil");
  });

  it("control: Super Strength gives the same 4 ATK and no overkill, so the hero takes nothing", () => {
    const run = defended("super_strength");
    expect(attacksBy(run.events, villainId(run.state))[0]!.baseAtk).toBe(4);
    expect(damageOn(run.state, identityOf(run.state))).toBe(0);
  });
});

describe("Aerial Bombardment (40152), attached to the villain", () => {
  const bombed = (players: Seats = [SPIDER_MAN]) => {
    const s = flightGame(players);
    return withAttached(s, "40152").state;
  };

  it("40152.aerial-bombardment-constant: +1 ATK against a non-AERIAL hero (2 + 1 momentum + 1 + 1 = 5), only while attacking", () => {
    const run = attackRound(bombed());
    expect(attacksBy(run.events, villainId(run.state))[0]!.baseAtk).toBe(JUGGERNAUT_ATK + 2);
    const scheme = round(bombed(), { boosts: 1 });
    expect(events(scheme.events, "schemeResolved")[0]!.baseSch).toBe(1);
  });

  it("40152.aerial-bombardment-constant, 2 players: Spider-Man is attacked at 5, the AERIAL Angel at 4", () => {
    const run = attackRound(bombed([SPIDER_MAN, ANGEL]));
    const attacks = attacksBy(run.events, villainId(run.state));
    expect(attacks.map((a) => [a.targetInstanceId, a.baseAtk])).toEqual([
      [identityOf(run.state, P1), JUGGERNAUT_ATK + 2],
      [identityOf(run.state, P2), JUGGERNAUT_ATK + 1],
    ]);
  });

  it("40152.aerial-bombardment-constant: the villain ignores Black Panther's retaliate 1; without it he takes 1", () => {
    // Stryfe has no tough status card to soak the retaliate damage (Juggernaut's reveal gives him one).
    const stryfe = () => game({ scenario: "stryfe", sets: ["flight"], players: [BLACK_PANTHER] });
    const withIt = attackRound(withAttached(stryfe(), "40152").state);
    expect(attacksBy(withIt.events, villainId(withIt.state))).toHaveLength(1);
    expect(damageOn(withIt.state, villainId(withIt.state))).toBe(0);
    const control = attackRound(stryfe());
    expect(damageOn(control.state, villainId(control.state))).toBe(1);
  });

  it("40152.aerial-bombardment-action: Hero Action, exhaust your hero and spend [mental][mental] to discard it", () => {
    const base = heroed(bombed());
    const card = attachmentOf(base, villainId(base), "Aerial Bombardment");
    const { state, ids } = handWith(base, P1, "mental", 2);
    const run = drive(
      state,
      {},
      use(
        P1,
        card,
        "40152.aerial-bombardment-action",
        ids.map((fromHand) => ({ fromHand })),
      ),
    );
    expect(attachmentsOf(run.state, villainId(run.state))).toEqual(["Flight", "Juggernaut's Helmet"]);
    expect(discardNames(run.state)).toContain("Aerial Bombardment");
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(true);
    expect(playerOf(run.state, P1).discard).toHaveLength(2);
  });

  it("40152.aerial-bombardment-action: not usable with only one [mental] resource", () => {
    const base = heroed(bombed());
    const card = attachmentOf(base, villainId(base), "Aerial Bombardment");
    const { state, ids } = handWith(base, P1, "mental", 1);
    expect(
      accepted(
        state,
        use(
          P1,
          card,
          "40152.aerial-bombardment-action",
          ids.map((fromHand) => ({ fromHand })),
        ),
      ),
    ).toBe(false);
  });
});

describe("Out of Reach (40153), attached to the villain (Stryfe: no tough status card to hide the damage)", () => {
  const stryfe = (players: Seats = [SPIDER_MAN]) => game({ scenario: "stryfe", sets: ["flight"], players });
  const blocked = (players: Seats = [SPIDER_MAN]) => withAttached(stryfe(players), "40153").state;

  it("40153.out-of-reach-constant: a non-AERIAL hero's basic attack cannot target him (it would deal no damage)", () => {
    const s = heroed(blocked());
    expect(accepted(s, basicAttackBy(s, identityOf(s), villainId(s)))).toBe(false);
  });

  it("control: without Out of Reach the same attack is legal and deals the hero's ATK (Spider-Man 2)", () => {
    const s = stryfe();
    expect(damageOn(attackFor(s, villainId(s)).state, villainId(s))).toBe(2);
  });

  it("40153.out-of-reach-constant: an AERIAL attacker (Angel, ATK 1) damages him", () => {
    const s = blocked([ANGEL]);
    const run = attackFor(s, villainId(s));
    expect(damageOn(run.state, villainId(run.state))).toBe(1);
  });

  it("40153.out-of-reach-constant: an attack with the AERIAL trait (Swinging Web Kick, 8 damage) damages him", () => {
    const s = blocked();
    const given = moveToHand(heroed(s), P1, "01005");
    const [kick] = given.ids;
    const run = drive(given.state, {}, play(P1, kick!, payWith(given.state, P1, 3, given.ids)));
    expect(damageOn(run.state, villainId(run.state))).toBe(8);
  });

  it("40153.out-of-reach-constant: an attack with ranged (War Machine's basic attack, ATK 2) damages him", () => {
    const seat = seatWithCard("core-captain-marvel-leadership", "04020");
    const s = blocked([seat]);
    const { state, id } = inPlayFromDeck(heroed(s), P1, "04020");
    const run = drive(
      state,
      {},
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: id,
        targetInstanceId: villainId(state),
      },
    );
    expect(damageOn(run.state, villainId(run.state))).toBe(2);
  });

  it("40153.out-of-reach-action: Hero Action, exhaust your hero and spend [energy][energy] to discard it", () => {
    const base = heroed(blocked());
    const card = attachmentOf(base, villainId(base), "Out of Reach");
    const { state, ids } = handWith(base, P1, "energy", 2);
    const run = drive(
      state,
      {},
      use(
        P1,
        card,
        "40153.out-of-reach-action",
        ids.map((fromHand) => ({ fromHand })),
      ),
    );
    expect(attachmentsOf(run.state, villainId(run.state))).toEqual(["Flight"]);
    expect(discardNames(run.state)).toContain("Out of Reach");
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(true);
  });

  it("40153.out-of-reach-action: not usable with an exhausted hero", () => {
    const base = patchInstance(heroed(blocked()), identityOf(blocked()), { exhausted: true });
    const card = attachmentOf(base, villainId(base), "Out of Reach");
    const { state, ids } = handWith(base, P1, "energy", 2);
    expect(
      accepted(
        state,
        use(
          P1,
          card,
          "40153.out-of-reach-action",
          ids.map((fromHand) => ({ fromHand })),
        ),
      ),
    ).toBe(false);
  });
});

describe("High Ground (40154), a treachery", () => {
  const toughIn = (s: GameState, id: Parameters<typeof inst>[1]) => inst(s, id).statuses.tough;

  it("40154.when-revealed: Juggernaut is BRUTE, so the players as a group take 4 indirect damage, and tough status cards on friendly characters are discarded first", () => {
    const base = withStatuses(flightGame(), identityOf(flightGame()), { tough: 1 });
    const run = round(base, { boosts: 1, reveals: ["40154"] });
    expect(damageOn(run.state, identityOf(run.state))).toBe(4);
    expect(toughIn(run.state, identityOf(run.state))).toBe(0);
    expect(discardNames(run.state)).toContain("High Ground");
  });

  it("40154.when-revealed: only friendly characters lose tough: the villain keeps his", () => {
    const base = flightGame();
    expect(toughIn(base, villainId(base))).toBe(1);
    const run = round(base, { boosts: 1, reveals: ["40154"] });
    expect(toughIn(run.state, villainId(run.state))).toBe(1);
  });

  it("40154.when-revealed: an ally's tough status card is discarded too", () => {
    const { state, id } = inPlayFromDeck(flightGame(), P1, "01058");
    const run = round(withStatuses(state, id, { tough: 1 }), { boosts: 1, reveals: ["40154"] });
    expect(toughIn(run.state, id)).toBe(0);
  });

  it("40154.when-revealed: Stryfe is not BRUTE: 2 indirect damage", () => {
    const stryfe = game({ scenario: "stryfe", sets: ["flight"] });
    expect(traitNames(stryfe, villainId(stryfe))).not.toContain("BRUTE");
    const run = round(stryfe, { boosts: 1, reveals: ["40154"] });
    expect(damageOn(run.state, identityOf(run.state))).toBe(2);
  });

  it("40154.when-revealed, 2 players: 4 indirect damage in total for the group, not for each player; each player's tough is discarded", () => {
    const base = flightGame(TWO);
    const toughBoth = withStatuses(withStatuses(base, identityOf(base, P1), { tough: 1 }), identityOf(base, P2), {
      tough: 1,
    });
    const run = round(toughBoth, { boosts: 2, reveals: ["40154"] });
    const total = damageOn(run.state, identityOf(run.state, P1)) + damageOn(run.state, identityOf(run.state, P2));
    expect(total).toBe(4);
    expect(toughIn(run.state, identityOf(run.state, P1))).toBe(0);
    expect(toughIn(run.state, identityOf(run.state, P2))).toBe(0);
  });

  it("40154.boost: if the villain is attacking, this attack gains piercing: the hero's tough status card is discarded and the full 4 + 1 icon lands", () => {
    const base = withStatuses(heroed(flightGame()), identityOf(flightGame()), { tough: 1 });
    const run = round(base, { boostCards: ["40154"] });
    expect(attacksBy(run.events, villainId(run.state))[0]!.boostIcons).toBe(1);
    expect(damageOn(run.state, identityOf(run.state))).toBe(5);
    expect(toughIn(run.state, identityOf(run.state))).toBe(0);
  });

  it("40154.boost, control: a blank boost card lets tough prevent the damage", () => {
    const base = withStatuses(heroed(flightGame()), identityOf(flightGame()), { tough: 1 });
    const run = round(base, { boostCards: ["01186"] });
    expect(damageOn(run.state, identityOf(run.state))).toBe(0);
    expect(toughIn(run.state, identityOf(run.state))).toBe(0);
  });

  it("40154.boost: no effect on a scheme activation", () => {
    const run = round(flightGame(), { boostCards: ["40154"] });
    expect(events(run.events, "schemeResolved")[0]!.baseSch).toBe(1);
    expect(events(run.events, "schemeResolved")[0]!.boostIcons).toBe(1);
  });
});
