import { describe, expect, it } from "vitest";
import type { PlayerId } from "@mc/engine";
import { TOGETHER_ACHIEVEMENTS } from "./achievements-together.js";
import { NO_MULTIPLAYER_FACTS, type GameRow, type MultiplayerFacts } from "./room-seats.js";

type Room = {
  friends?: string[];
  tookOver?: { player: string; reason: "away" | "left" }[];
  chatSent?: number;
  strict?: boolean;
};
interface Opts {
  won?: boolean;
  players?: number;
  room?: Room;
  together?: Record<string, Record<string, number>>;
  defeated?: number[];
  mySeats?: string[];
}

function row(o: Opts = {}): GameRow {
  const players = o.players ?? 2;
  const mySeats = (o.mySeats ?? Array.from({ length: players }, (_, i) => `p${i + 1}`)) as PlayerId[];
  const roomPlay = o.room
    ? { friends: [], tookOver: [], chatSent: 0, strict: false, cheats: false, mySeats, ...o.room }
    : undefined;
  return {
    won: o.won ?? true,
    summary: {
      together: o.together,
      seats: Array.from({ length: players }, (_, i) => ({ defeated: o.defeated?.includes(i) ?? false })),
    },
    roomPlay,
    config: { players: Array.from({ length: players }, () => ({})) },
    mySeats,
    mySeatIndexes: mySeats.map((s) => Number(s.slice(1)) - 1),
  } as unknown as GameRow;
}

const facts = (...rows: GameRow[]): MultiplayerFacts => ({ ...NO_MULTIPLAYER_FACTS, rows });
const get = (id: string) => {
  const def = TOGETHER_ACHIEVEMENTS.find((d) => d.id === id);
  if (!def) throw new Error(id);
  return def;
};
const earned = (id: string, ...rows: GameRow[]) => {
  const p = get(id).measure(facts(...rows));
  return p !== null && p.current >= p.target;
};

describe("together achievements", () => {
  it("defines the 17 rows with the plan's points", () => {
    expect(TOGETHER_ACHIEVEMENTS).toHaveLength(17);
    expect(TOGETHER_ACHIEVEMENTS.filter((d) => d.family === "funny").map((d) => d.id)).toEqual([
      "together-oops",
      "together-friendly-fire",
    ]);
    expect(TOGETHER_ACHIEVEMENTS.reduce((s, d) => s + (d.points ?? 0), 0)).toBe(1025);
  });

  it("earns nothing from no games", () => {
    for (const d of TOGETHER_ACHIEVEMENTS) expect(earned(d.id)).toBe(false);
  });

  it("Assemble! needs a won four-seat room game", () => {
    expect(earned("room-four-players", row({ players: 4, room: {} }))).toBe(true);
    expect(earned("room-four-players", row({ players: 4 }))).toBe(false);
    expect(earned("room-four-players", row({ players: 3, room: {} }))).toBe(false);
    expect(earned("room-four-players", row({ players: 4, room: {}, won: false }))).toBe(false);
  });

  it("Tag Team counts wins with the best friend", () => {
    const withAnna = row({ room: { friends: ["Anna"] } });
    const mixed = row({ room: { friends: ["Anna", "Bo"] } });
    const progress = get("room-tag-team-10").measure(facts(withAnna, mixed, row({ room: { friends: ["Bo"] } })));
    expect(progress).toEqual({ current: 2, target: 10 });
    const ten = Array.from({ length: 10 }, () => row({ room: { friends: ["Anna"] } }));
    expect(earned("room-tag-team-10", ...ten)).toBe(true);
    expect(earned("room-tag-team-10", ...ten.slice(0, 9), row({ room: { friends: ["Anna"] }, won: false }))).toBe(
      false,
    );
  });

  it("takeovers need a win and the right reason", () => {
    const away = row({ room: { tookOver: [{ player: "p2", reason: "away" }] } });
    const left = row({ room: { tookOver: [{ player: "p2", reason: "left" }] } });
    expect(earned("room-takeover-away", away)).toBe(true);
    expect(earned("room-takeover-away", left)).toBe(false);
    expect(earned("room-takeover-left", left)).toBe(true);
    expect(earned("room-takeover-left", away)).toBe(false);
    expect(
      earned("room-takeover-left", row({ won: false, room: { tookOver: [{ player: "p2", reason: "left" }] } })),
    ).toBe(false);
  });

  it("Talk It Out sums chat across room rows", () => {
    expect(earned("room-chat-50", row({ room: { chatSent: 30 } }), row({ room: { chatSent: 20 } }))).toBe(true);
    expect(earned("room-chat-50", row({ room: { chatSent: 30 } }), row({ room: { chatSent: 19 } }))).toBe(false);
  });

  it("Strict Rules Club counts won strict room games", () => {
    const strict = Array.from({ length: 5 }, () => row({ room: { strict: true } }));
    expect(earned("room-strict-5", ...strict)).toBe(true);
    expect(earned("room-strict-5", ...strict.slice(0, 4), row({ room: {} }))).toBe(false);
  });

  it("Avenge Me! needs a win with one of my heroes defeated", () => {
    expect(earned("together-avenge-me", row({ defeated: [1] }))).toBe(true);
    expect(earned("together-avenge-me", row({ defeated: [1], won: false }))).toBe(false);
    expect(earned("together-avenge-me", row({ defeated: [] }))).toBe(false);
    // Only a seat I do not hold was defeated.
    expect(earned("together-avenge-me", row({ defeated: [1], room: {}, mySeats: ["p1"] }))).toBe(false);
  });

  const counters: [string, string, number][] = [
    ["together-upgrade-given", "upgradesGiven", 1],
    ["together-get-behind-me", "cancelledForOthers", 1],
    ["together-human-shield", "defendedForOthers", 3],
    ["together-combat-medic", "healedOthers", 6],
    ["together-alliance-paid", "multiPayerPlays", 1],
    ["together-kill-steal", "killSteals", 1],
    ["together-care-package", "drewForOthers", 5],
    ["together-sticky-fingers", "takenFromOthers", 1],
    ["together-oops", "oopsMinions", 1],
    ["together-friendly-fire", "friendlyFire", 1],
  ];
  for (const [id, counter, target] of counters) {
    it(`${id} reads ${counter} >= ${target} in one game`, () => {
      expect(earned(id, row({ together: { p1: { [counter]: target } } }))).toBe(true);
      expect(earned(id, row({ together: { p1: { [counter]: target - 1 } } }))).toBe(target === 1 ? false : false);
      // Several games do not add up.
      if (target > 1) {
        const part = row({ together: { p1: { [counter]: target - 1 } } });
        expect(earned(id, part, part)).toBe(false);
      }
      // A counter on a seat this device does not hold, and an older summary without counters, earn nothing.
      expect(earned(id, row({ room: {}, mySeats: ["p1"], together: { p2: { [counter]: target } } }))).toBe(false);
      expect(earned(id, row())).toBe(false);
    });
  }

  it("counts a multi-seat solo game for the Together list", () => {
    expect(earned("together-kill-steal", row({ players: 2, together: { p2: { killSteals: 1 } } }))).toBe(true);
  });

  it("sums my seats' counters within one game", () => {
    expect(
      earned(
        "together-human-shield",
        row({ together: { p1: { defendedForOthers: 2 }, p2: { defendedForOthers: 1 } } }),
      ),
    ).toBe(true);
  });
});
