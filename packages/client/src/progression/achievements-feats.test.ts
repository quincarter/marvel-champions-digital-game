import { describe, expect, it } from "vitest";
import type { PlayerId } from "@mc/engine";
import { FEATS_ACHIEVEMENTS } from "./achievements-feats.js";
import { NO_MULTIPLAYER_FACTS, type GameRow, type MultiplayerFacts } from "./room-seats.js";

const SEAT = {
  minionsDefeated: 0,
  maxEngagedMinions: 0,
  maxExcess: 0,
  deckResets: 0,
  stunDefeats: 0,
  maxPaidForOneCard: 0,
  fellBelowHalf: false,
  ownObligationRemoved: false,
  maxSurgeChain: 0,
};
type SeatFeats = typeof SEAT;

interface Opts {
  won?: boolean;
  /** Per seat (p1, p2...) feat overrides. */
  feats?: Partial<SeatFeats>[];
  boosts?: { luckyStreakMax?: number; bigBoosts?: number }[];
  winners?: { hitPoints: number | null; maxHitPoints: number | null; printedHitPoints: number }[];
  fullUses?: number[];
  minionsInPlayAtEnd?: number;
  sideSchemesInPlayAtEnd?: number;
  victoryDisplayCount?: number;
  endPhase?: "player" | "villain";
  finalBlowBy?: string | null;
  finalBlowCardId?: string | null;
  allyDamage?: Record<string, number>[];
  mySeats?: string[];
  room?: boolean;
  bare?: boolean;
}

function row(o: Opts = {}): GameRow {
  const players = 2;
  const mySeats = (o.mySeats ?? ["p1", "p2"]) as PlayerId[];
  const seatId = (i: number) => `p${i + 1}`;
  const feats = Object.fromEntries(
    Array.from({ length: players }, (_, i) => [seatId(i), { ...SEAT, ...o.feats?.[i] }]),
  );
  const boosts = {
    seats: Object.fromEntries(
      Array.from({ length: players }, (_, i) => [
        seatId(i),
        { luckyStreakMax: 0, bigBoosts: 0, remoteDefeats: [], ...o.boosts?.[i] },
      ]),
    ),
  };
  const defaultWinners = Array.from({ length: players }, () => ({
    hitPoints: 5,
    maxHitPoints: 10,
    printedHitPoints: 10,
  }));
  const endState = {
    winners: (o.winners ?? defaultWinners).map((w, i) => ({ playerId: seatId(i), ...w })),
    seats: Array.from({ length: players }, (_, i) => ({ playerId: seatId(i), fullUsesSupports: o.fullUses?.[i] ?? 0 })),
    minionsInPlayAtEnd: o.minionsInPlayAtEnd ?? 1,
    sideSchemesInPlayAtEnd: o.sideSchemesInPlayAtEnd ?? 1,
    victoryDisplayCount: o.victoryDisplayCount ?? 0,
    endPhase: o.endPhase ?? "player",
  };
  return {
    won: o.won ?? true,
    summary: o.bare
      ? { seats: [] }
      : {
          feats,
          boosts,
          endState,
          finalBlowBy: o.finalBlowBy ?? null,
          finalBlowCardId: o.finalBlowCardId ?? null,
          seats: Array.from({ length: players }, (_, i) => ({
            identityCardId: `hero${i + 1}`,
            allyDamage: o.allyDamage?.[i],
          })),
        },
    roomPlay: o.room ? { mySeats } : undefined,
    config: { players: Array.from({ length: players }, () => ({})) },
    mySeats,
    mySeatIndexes: mySeats.map((s) => Number(s.slice(1)) - 1),
  } as unknown as GameRow;
}

const facts = (...rows: GameRow[]): MultiplayerFacts => ({ ...NO_MULTIPLAYER_FACTS, rows });
const get = (id: string) => {
  const def = FEATS_ACHIEVEMENTS.find((d) => d.id === id);
  if (!def) throw new Error(id);
  return def;
};
const earned = (id: string, ...rows: GameRow[]) => {
  const p = get(id).measure(facts(...rows));
  return p !== null && p.current >= p.target;
};

describe("the feats", () => {
  it("defines 20 feats with unique ids, plain text, and funny ones at 0 points with a pack", () => {
    expect(FEATS_ACHIEVEMENTS).toHaveLength(20);
    expect(new Set(FEATS_ACHIEVEMENTS.map((d) => d.id)).size).toBe(20);
    for (const d of FEATS_ACHIEVEMENTS) {
      expect(d.description).not.toBe("");
      if (d.id === "chain-reaction" || d.id === "cursed-boosts") {
        expect(d.family).toBe("funny");
        expect(d.points).toBe(0);
        expect(d.rewardPackId).toBeTruthy();
      } else {
        expect(d.family).toBe("feats");
        expect(d.points).toBeGreaterThan(0);
        expect(d.rewardPackId).toBeUndefined();
      }
    }
    expect(FEATS_ACHIEVEMENTS.reduce((a, d) => a + (d.points ?? 0), 0)).toBe(1500);
  });

  it("earns nothing from an older summary without the counters, or from no games", () => {
    for (const d of FEATS_ACHIEVEMENTS) {
      expect(earned(d.id, row({ bare: true })), d.id).toBe(false);
      expect(earned(d.id), d.id).toBe(false);
    }
  });

  const full = { hitPoints: 10, maxHitPoints: 10, printedHitPoints: 10 };
  it("Not a Scratch and Plenty to Spare read the winners' hit points", () => {
    expect(earned("feat-full-health", row({ winners: [full, full] }))).toBe(true);
    expect(earned("feat-full-health", row({ winners: [full, full], won: false }))).toBe(false);
    expect(earned("feat-full-health", row())).toBe(false);
    const over = { hitPoints: 12, maxHitPoints: 12, printedHitPoints: 10 };
    expect(earned("feat-over-printed-hp", row({ winners: [over, full] }))).toBe(true);
    expect(earned("feat-over-printed-hp", row({ winners: [full, full] }))).toBe(false);
  });

  it("Surrounded, Overkill, Bloodthirsty, Deck Goes Brrr, Stop Drop and Punch, Big Spender, Chain Reaction", () => {
    expect(earned("feat-surrounded", row({ feats: [{ maxEngagedMinions: 3 }] }))).toBe(true);
    expect(earned("feat-surrounded", row({ feats: [{ maxEngagedMinions: 2 }] }))).toBe(false);
    expect(earned("feat-overkill-5", row({ feats: [{}, { maxExcess: 5 }] }))).toBe(true);
    expect(earned("feat-overkill-5", row({ feats: [{ maxExcess: 4 }] }))).toBe(false);
    expect(earned("feat-minions-8", row({ feats: [{ minionsDefeated: 5 }, { minionsDefeated: 3 }] }))).toBe(true);
    expect(earned("feat-minions-8", row({ feats: [{ minionsDefeated: 7 }] }))).toBe(false);
    expect(earned("feat-deck-reset-2", row({ feats: [{ deckResets: 2 }] }))).toBe(true);
    expect(earned("feat-deck-reset-2", row({ feats: [{ deckResets: 1 }] }))).toBe(false);
    expect(earned("feat-stun-defeat", row({ feats: [{ stunDefeats: 1 }] }))).toBe(true);
    expect(earned("feat-stun-defeat", row())).toBe(false);
    expect(earned("feat-big-spender", row({ feats: [{ maxPaidForOneCard: 6 }] }))).toBe(true);
    expect(earned("feat-big-spender", row({ feats: [{ maxPaidForOneCard: 5 }] }))).toBe(false);
    expect(earned("chain-reaction", row({ feats: [{ maxSurgeChain: 3 }] }))).toBe(true);
    expect(earned("chain-reaction", row({ feats: [{ maxSurgeChain: 2 }] }))).toBe(false);
  });

  it("Clean Sweep, Case Closed, Trophy Case, Come at Me Bro read the end state", () => {
    expect(earned("feat-clean-sweep", row({ minionsInPlayAtEnd: 0 }))).toBe(true);
    expect(earned("feat-clean-sweep", row({ minionsInPlayAtEnd: 0, won: false }))).toBe(false);
    expect(earned("feat-clean-sweep", row({ minionsInPlayAtEnd: 1 }))).toBe(false);
    expect(earned("feat-case-closed", row({ sideSchemesInPlayAtEnd: 0 }))).toBe(true);
    expect(earned("feat-case-closed", row({ sideSchemesInPlayAtEnd: 2 }))).toBe(false);
    expect(earned("feat-trophy-case", row({ victoryDisplayCount: 3, won: false }))).toBe(true);
    expect(earned("feat-trophy-case", row({ victoryDisplayCount: 2 }))).toBe(false);
    expect(earned("feat-villain-phase-win", row({ endPhase: "villain" }))).toBe(true);
    expect(earned("feat-villain-phase-win", row({ endPhase: "villain", won: false }))).toBe(false);
    expect(earned("feat-villain-phase-win", row())).toBe(false);
  });

  it("Pacifist and Tough as Nails need a win and every seat clean", () => {
    expect(earned("feat-pacifist", row())).toBe(true);
    expect(earned("feat-pacifist", row({ feats: [{}, { minionsDefeated: 1 }] }))).toBe(false);
    expect(earned("feat-pacifist", row({ won: false }))).toBe(false);
    expect(earned("feat-tough-as-nails", row())).toBe(true);
    expect(earned("feat-tough-as-nails", row({ feats: [{ fellBelowHalf: true }] }))).toBe(false);
    expect(earned("feat-tough-as-nails", row({ won: false }))).toBe(false);
  });

  it("Saving It for Later sums my seats' full-use supports in a win", () => {
    expect(earned("feat-full-supports", row({ fullUses: [1, 1] }))).toBe(true);
    expect(earned("feat-full-supports", row({ fullUses: [1, 0] }))).toBe(false);
    expect(earned("feat-full-supports", row({ fullUses: [2, 0], won: false }))).toBe(false);
  });

  it("Giant Slayer needs my ally to have dealt the final blow", () => {
    const blow = { finalBlowBy: "hero1", finalBlowCardId: "ally-x", allyDamage: [{ "ally-x": 3 }] };
    expect(earned("feat-ally-final-blow", row(blow))).toBe(true);
    expect(earned("feat-ally-final-blow", row({ ...blow, won: false }))).toBe(false);
    // A hero's own card: no ally damage under that id.
    expect(earned("feat-ally-final-blow", row({ ...blow, allyDamage: [{}] }))).toBe(false);
    // Another seat's ally in a room.
    expect(earned("feat-ally-final-blow", row({ ...blow, room: true, mySeats: ["p2"] }))).toBe(false);
    expect(earned("feat-ally-final-blow", row({ ...blow, room: true, mySeats: ["p1"] }))).toBe(true);
  });

  it("Lucky Charm, Cursed and Not Today, Life", () => {
    expect(earned("feat-lucky-charm", row({ boosts: [{ luckyStreakMax: 3 }] }))).toBe(true);
    expect(earned("feat-lucky-charm", row({ boosts: [{ luckyStreakMax: 2 }] }))).toBe(false);
    expect(earned("cursed-boosts", row({ boosts: [{ bigBoosts: 1 }, { bigBoosts: 1 }] }))).toBe(true);
    expect(earned("cursed-boosts", row({ boosts: [{ bigBoosts: 1 }] }))).toBe(false);
    expect(earned("feat-own-obligation", row({ feats: [{ ownObligationRemoved: true }] }))).toBe(true);
    expect(earned("feat-own-obligation", row())).toBe(false);
  });

  it("a room row only credits my seats", () => {
    const theirs = { feats: [{}, { maxExcess: 9, ownObligationRemoved: true, minionsDefeated: 9 }] };
    expect(earned("feat-overkill-5", row({ ...theirs, room: true, mySeats: ["p1"] }))).toBe(false);
    expect(earned("feat-overkill-5", row({ ...theirs, room: true, mySeats: ["p2"] }))).toBe(true);
    expect(earned("feat-own-obligation", row({ ...theirs, room: true, mySeats: ["p1"] }))).toBe(false);
    // Pacifist: the other seat's defeats do not spoil mine.
    expect(earned("feat-pacifist", row({ ...theirs, room: true, mySeats: ["p1"] }))).toBe(true);
    expect(earned("feat-pacifist", row({ ...theirs, room: true, mySeats: ["p2"] }))).toBe(false);
    // Not a Scratch: only my winner counts.
    const full = { hitPoints: 10, maxHitPoints: 10, printedHitPoints: 10 };
    const half = { hitPoints: 4, maxHitPoints: 10, printedHitPoints: 10 };
    expect(earned("feat-full-health", row({ winners: [half, full], room: true, mySeats: ["p1"] }))).toBe(false);
    expect(earned("feat-full-health", row({ winners: [half, full], room: true, mySeats: ["p2"] }))).toBe(true);
    // Lucky Charm is measured against my seats' boosts.
    expect(earned("feat-lucky-charm", row({ boosts: [{}, { luckyStreakMax: 4 }], room: true, mySeats: ["p1"] }))).toBe(
      false,
    );
  });
});
