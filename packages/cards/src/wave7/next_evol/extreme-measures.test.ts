import { handSize, hasKeyword, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { P1, P2, identityOf, inst, moveToHand, payWith, play, playerOf } from "../../testing/harness.js";
import { wave2StarterDeckSetup } from "../../wave2/setup.js";
import { engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_DEPS } from "../index.js";
import { EXTREME_MEASURES } from "./extreme-measures.js";
import {
  BLANK_BOOSTS,
  SPIDER_MAN,
  TWO,
  type Seats,
  attackFor,
  attachmentsOf,
  attacksBy,
  damageOn,
  drive,
  events,
  game,
  handOf,
  heroed,
  inPlayFromDeck,
  nameOf,
  playFromHand,
  round,
  setHand,
} from "./superpower-testing.js";

vi.setConfig({ testTimeout: 120_000 });

/** Ant-Man's hero form (and nothing in the Spider-Man deck) has the TINY trait. */
const ANT_MAN = wave2StarterDeckSetup("ant-leadership") as unknown as Seats[number];
/** Stryfe with Extreme Measures chosen: no tough status card, no retaliate; Hope Summers is the first player's ally. */
const stryfe = (players: Seats = [SPIDER_MAN]) => game({ scenario: "stryfe", sets: ["extreme_measures"], players });
const hopeOf = (s: GameState) => s.players.flatMap((p) => p.playArea).find((id) => nameOf(s, id) === "Hope Summers")!;
const minionOf = (s: GameState, player: typeof P1, name: string) =>
  playerOf(s, player).playArea.find((id) => nameOf(s, id) === name)!;
const blanks = (n: number) => BLANK_BOOSTS.slice(0, n);
const BLANK2 = blanks(2)[1]!;

describe("registry", () => {
  it("registers every ref of the set", () => {
    expect(Object.keys(EXTREME_MEASURES).sort()).toEqual(
      [
        "40180.when-revealed",
        "40181.tempo-constant",
        "40181.tempo-forced-response",
        "40182.thumbelina-constant",
        "40182.when-revealed",
        "40183.when-revealed",
        "40184.extreme-measures-forced-response",
      ].sort(),
    );
  });
});

describe("Strobe (40180)", () => {
  const reveal = (choose: string, players: Seats = [SPIDER_MAN], reveals: readonly string[] = ["40180"]) =>
    round(stryfe(players), {
      boostCards: blanks(players.length),
      reveals,
      plan: { choose },
    });

  it("patrol is a keyword of the card", () => {
    const s = engageMinion(stryfe(), "40180");
    expect(hasKeyword(s.state, s.id, "patrol", WAVE7_DEPS)).toBe(true);
  });

  it("40180.when-revealed, option 1: stuns each character the revealing player controls (their identity and Hope Summers)", () => {
    const run = reveal("Stun");
    expect(inst(run.state, identityOf(run.state)).statuses.stunned).toBe(1);
    expect(inst(run.state, hopeOf(run.state)).statuses.stunned).toBe(1);
    expect(damageOn(run.state, identityOf(run.state))).toBe(0);
  });

  it("40180.when-revealed, option 2: deals 1 damage to each character you control", () => {
    const run = reveal("Deal 1 damage");
    expect(damageOn(run.state, identityOf(run.state))).toBe(1);
    expect(damageOn(run.state, hopeOf(run.state))).toBe(1);
    expect(inst(run.state, identityOf(run.state)).statuses.stunned).toBe(0);
  });

  it("40180.when-revealed, 2 players: only the revealing player's characters are affected (P2 reveals it: P1's identity and Hope are untouched)", () => {
    const run = reveal("Stun", TWO, [BLANK2, "40180"]);
    expect(inst(run.state, identityOf(run.state, P2)).statuses.stunned).toBe(1);
    expect(inst(run.state, identityOf(run.state, P1)).statuses.stunned).toBe(0);
    expect(inst(run.state, hopeOf(run.state)).statuses.stunned).toBe(0);
  });

  it("40180.when-revealed, 2 players, damage: P1 reveals it, so P1's identity and Hope take 1 and P2's identity takes none", () => {
    const run = reveal("Deal 1 damage", TWO, ["40180", BLANK2]);
    expect(damageOn(run.state, identityOf(run.state, P1))).toBe(1);
    expect(damageOn(run.state, hopeOf(run.state))).toBe(1);
    expect(damageOn(run.state, identityOf(run.state, P2))).toBe(0);
  });
});

/** The cards `player` milled from the top of their deck to the discard pile by `abilityId`'s resolution. */
const milledBy = (run: readonly GameEvent[], abilityId: string, player: typeof P1) => {
  const start = run.findIndex((e) => e.type === "abilityResolved" && e.abilityId === abilityId);
  expect(start).toBeGreaterThanOrEqual(0);
  let n = 0;
  for (const e of run.slice(start + 1)) {
    if (e.type === "stepChanged") break;
    if (e.type !== "cardMoved") continue;
    if (e.from.kind === "deck" && e.to.kind === "discard" && e.to.playerId === player) n++;
  }
  return n;
};

describe("Tempo (40181)", () => {
  it("40181.tempo-constant: while engaged with you, you get +1 hand size; the other player's is unchanged", () => {
    const control = stryfe(TWO);
    const s = engageMinion(control, "40181").state;
    expect(handSize(s, P1, WAVE7_DEPS)).toBe(handSize(control, P1, WAVE7_DEPS) + 1);
    expect(handSize(s, P2, WAVE7_DEPS)).toBe(handSize(control, P2, WAVE7_DEPS));
  });

  it("40181.tempo-constant: engaged with the second player it is hers", () => {
    const control = stryfe(TWO);
    const s = engageMinion(control, "40181", P2).state;
    expect(handSize(s, P1, WAVE7_DEPS)).toBe(handSize(control, P1, WAVE7_DEPS));
    expect(handSize(s, P2, WAVE7_DEPS)).toBe(handSize(control, P2, WAVE7_DEPS) + 1);
  });

  it("40181.tempo-forced-response: after Tempo attacks you, discard cards from the top of your deck equal to twice your hand (hand 6: 12)", () => {
    const base = engageMinion(heroed(stryfe()), "40181").state;
    expect(handOf(base, P1)).toHaveLength(6);
    const run = round(base, { boosts: 2 });
    const tempo = minionOf(run.state, P1, "Tempo");
    expect(attacksBy(run.events, tempo)).toHaveLength(1);
    expect(milledBy(run.events, "40181.tempo-forced-response", P1)).toBe(12);
  });

  it("40181.tempo-forced-response: also after it schemes against you (alter-ego form: twice a hand of the larger alter-ego hand size)", () => {
    const base = engageMinion(stryfe(), "40181").state;
    const size = handSize(base, P1, WAVE7_DEPS);
    const run = round(base, { boosts: 2 });
    expect(events(run.events, "schemeResolved").length).toBeGreaterThanOrEqual(2);
    expect(milledBy(run.events, "40181.tempo-forced-response", P1)).toBe(2 * size);
    expect(size).toBeGreaterThan(6);
  });

  it("40181.tempo-forced-response, 2 players: only the player Tempo is engaged with (P2) discards", () => {
    const base = engageMinion(heroed(stryfe(TWO)), "40181", P2).state;
    const run = round(base, { boosts: 3 });
    expect(milledBy(run.events, "40181.tempo-forced-response", P2)).toBe(2 * 6);
    expect(milledBy(run.events, "40181.tempo-forced-response", P1)).toBe(0);
  });
});

describe("Thumbelina (40182)", () => {
  const withThumbelina = (players: Seats = [SPIDER_MAN]) => engageMinion(heroed(stryfe(players)), "40182");

  it("40182.thumbelina-constant: damage from each attack is reduced by 1: Spider-Man's basic attack (2) deals 1", () => {
    const { state, id } = withThumbelina();
    expect(damageOn(attackFor(state, id).state, id)).toBe(1);
  });

  it("40182.thumbelina-constant: Swinging Web Kick (8) is reduced by 1 and deals 7 (she has 3 hit points and is defeated)", () => {
    const { state, id } = withThumbelina();
    const given = moveToHand(state, P1, "01005");
    const run = drive(
      given.state,
      { pick: ["Thumbelina"] },
      play(P1, given.ids[0]!, payWith(given.state, P1, 3, given.ids)),
    );
    expect(events(run.events, "damagePrevented").map((e) => e.amount)).toContain(1);
    expect(events(run.events, "damageDealt").find((e) => e.targetInstanceId === id)?.amount).toBe(7);
  });

  it("40182.thumbelina-constant: unless the attacker has the TINY trait: Ant-Man's attack (2) deals the full 2", () => {
    const { state, id } = withThumbelina([ANT_MAN]);
    expect(damageOn(attackFor(state, id).state, id)).toBe(2);
  });

  const upgraded = (base: GameState) => {
    const identity = identityOf(base);
    const first = playFromHand(base, P1, "01008", { host: identity }); // Web-Shooter, cost 1
    return playFromHand(first.state, P1, "01093", { host: identity }).state; // Tenacity, cost 2
  };
  const reveal = (s: GameState) => round(setHand(s, P1, []), { boosts: 1, reveals: ["40182"] });

  it("40182.when-revealed: returns the highest-cost upgrade you control (Tenacity 2 over Web-Shooter 1) to its owner's hand", () => {
    const s = upgraded(stryfe());
    expect(attachmentsOf(s, identityOf(s))).toEqual(["Web-Shooter", "Tenacity"]);
    const run = reveal(s);
    expect(attachmentsOf(run.state, identityOf(run.state))).toEqual(["Web-Shooter"]);
    expect(handOf(run.state, P1).map((id) => nameOf(run.state, id))).toContain("Tenacity");
  });

  it("40182.when-revealed: with no upgrade nothing is returned and Thumbelina is simply in play", () => {
    const run = reveal(stryfe());
    expect(playerOf(run.state, P1).playArea.map((id) => nameOf(run.state, id))).toContain("Thumbelina");
    expect(attachmentsOf(run.state, identityOf(run.state))).toEqual([]);
  });

  it("40182.when-revealed, 2 players: reads the revealing player's upgrades (P2 has none; P1's upgrade stays)", () => {
    const base = stryfe(TWO);
    const mine = playFromHand(base, P1, "01008", { host: identityOf(base) }).state;
    const run = round(mine, { boostCards: blanks(2), reveals: [BLANK2, "40182"] });
    expect(attachmentsOf(run.state, identityOf(run.state, P1))).toEqual(["Web-Shooter"]);
    expect(minionOf(run.state, P2, "Thumbelina")).toBeDefined();
  });
});

describe("Wildside (40183)", () => {
  const reveal = (choose: string, s: GameState = stryfe()) =>
    round(s, { boosts: 1, reveals: ["40183"], plan: { choose } });

  it("40183.when-revealed, option 1: Wildside attacks you (ATK 3)", () => {
    const run = reveal("Wildside attacks", heroed(stryfe()));
    const attacks = attacksBy(run.events, minionOf(run.state, P1, "Wildside"));
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.baseAtk).toBe(3);
  });

  /** Interrogation Room (cost 1) and Surveillance Team (cost 2), both supports, in Spider-Man's play area. */
  const supported = () => {
    const first = inPlayFromDeck(stryfe(), P1, "01063");
    return inPlayFromDeck(first.state, P1, "01064").state;
  };
  const names = (s: GameState) => playerOf(s, P1).playArea.map((id) => nameOf(s, id));

  it("40183.when-revealed, option 2: returns the highest-cost support you control (Surveillance Team 2 over Interrogation Room 1) to hand", () => {
    expect(names(supported())).toEqual(expect.arrayContaining(["Interrogation Room", "Surveillance Team"]));
    const run = reveal("Return", setHand(supported(), P1, []));
    expect(names(run.state)).not.toContain("Surveillance Team");
    expect(names(run.state)).toContain("Interrogation Room");
    expect(handOf(run.state, P1).map((id) => nameOf(run.state, id))).toContain("Surveillance Team");
  });

  it("40183.when-revealed, option 2: Wildside does not attack", () => {
    const run = reveal("Return", heroed(setHand(supported(), P1, [])));
    expect(attacksBy(run.events, minionOf(run.state, P1, "Wildside"))).toHaveLength(0);
  });

  it("40183.when-revealed, option 2 with no support: nothing is returned and he does not attack", () => {
    const run = reveal("Return", heroed(stryfe()));
    expect(attacksBy(run.events, minionOf(run.state, P1, "Wildside"))).toHaveLength(0);
  });
});

describe("Extreme Measures (40184), a side scheme with hinder 2 per hero", () => {
  /** The scheme revealed to P1 in the villain phase; the next player phase begins. */
  const revealed = (players: Seats = [SPIDER_MAN]) =>
    round(stryfe(players), { boostCards: blanks(players.length), reveals: ["40184"] }).state;
  const sustained = (s: GameState, ...ids: InstanceId[]) => ids.reduce((sum, id) => sum + damageOn(s, id), 0);

  it("enters play with 3 threat and hinder 2 per hero (5 for one player, 7 for two)", () => {
    const threat = (s: GameState) => Object.values(s.instances).find((i) => i.cardId === "40184")!.threat;
    expect(threat(revealed())).toBe(5);
    expect(threat(revealed(TWO))).toBe(7);
  });

  it("40184.extreme-measures-forced-response: an upgrade enters play: its controller takes indirect damage equal to its printed cost (Tenacity 2)", () => {
    const s = heroed(revealed());
    const run = playFromHand(s, P1, "01093", { host: identityOf(s) });
    expect(sustained(run.state, identityOf(run.state), hopeOf(run.state))).toBe(2);
  });

  it("40184.extreme-measures-forced-response: a support (Surveillance Team, cost 2) and an ally (Black Cat, cost 2) each deal 2", () => {
    const s = heroed(revealed());
    const support = playFromHand(s, P1, "01064");
    expect(sustained(support.state, identityOf(support.state), hopeOf(support.state))).toBe(2);
    const ally = playFromHand(s, P1, "01002");
    expect(sustained(ally.state, identityOf(ally.state), hopeOf(ally.state))).toBe(2);
  });

  it("40184.extreme-measures-forced-response: a printed cost 1 support (Interrogation Room) deals 1", () => {
    const s = heroed(revealed());
    const run = playFromHand(s, P1, "01063");
    expect(sustained(run.state, identityOf(run.state), hopeOf(run.state))).toBe(1);
  });

  it("control: without the scheme in play the same upgrade deals no damage", () => {
    const s = heroed(stryfe());
    const run = playFromHand(s, P1, "01093", { host: identityOf(s) });
    expect(sustained(run.state, identityOf(run.state), hopeOf(run.state))).toBe(0);
  });

  it("40184.extreme-measures-forced-response, 2 players: P2's Helicarrier (cost 3) hurts only P2 (P1 and Hope take none)", () => {
    const s = heroed(revealed(TWO));
    const run = playFromHand(s, P2, "01092");
    expect(damageOn(run.state, identityOf(run.state, P2))).toBe(3);
    expect(sustained(run.state, identityOf(run.state, P1), hopeOf(run.state))).toBe(0);
  });
});
