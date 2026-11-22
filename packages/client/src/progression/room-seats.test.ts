import { describe, expect, it } from "vitest";
import type { PlayerId } from "@mc/engine";
import type { RoomPlayRecord } from "../engine/room-play.js";
import {
  ACHIEVEMENT_FAMILIES,
  achievementStatuses,
  isAchievementEarned,
  type AchievementHistory,
  type AchievementSave,
} from "./achievements.js";
import {
  countsForAchievements,
  isCompetitiveRow,
  isGuestRow,
  isRoomRow,
  mergeRoomGames,
  multiplayerFactsOf,
  mySeatIndexesOf,
  mySeatsOf,
} from "./room-seats.js";
import { UNLOCK_HEROES } from "./unlocks.js";

const heroId = (name: string): string => UNLOCK_HEROES.find((h) => h.name === name)!.identityCardId;
const seat = (name: string) => ({ identityCardId: heroId(name), deck: [] });

const room = (over: Partial<RoomPlayRecord> = {}): RoomPlayRecord => ({
  role: "host",
  roomId: "r1",
  gameKey: "r1:1",
  mode: "standard",
  mySeats: ["p1"] as PlayerId[],
  friends: [],
  tookOver: [],
  chatSent: 0,
  strict: false,
  cheats: false,
  ...over,
});

const game = (
  scenarioId: string,
  status: "won" | "lost",
  names: readonly string[],
  extra: Partial<AchievementSave> = {},
): AchievementSave => ({
  status,
  round: 5,
  config: { scenarioId, players: names.map(seat) },
  ...extra,
});

const hist = (saves: AchievementSave[]): AchievementHistory => ({ saves, campaigns: [] });
const earned = (id: string, saves: AchievementSave[]): boolean => isAchievementEarned(id, hist(saves));

describe("the room-seat filters", () => {
  it("reads a room row's own seats and every seat of a game played alone", () => {
    const alone = game("rhino", "won", ["Hulk", "Thor"]);
    expect(mySeatsOf(alone)).toEqual(["p1", "p2"]);
    expect(mySeatIndexesOf(alone)).toEqual([0, 1]);
    const inRoom = game("rhino", "won", ["Hulk", "Thor"], { roomPlay: room({ mySeats: ["p2"] as PlayerId[] }) });
    expect(mySeatsOf(inRoom)).toEqual(["p2"]);
    expect(mySeatIndexesOf(inRoom)).toEqual([1]);
  });

  it("tells room and guest rows from the rest", () => {
    const alone = game("rhino", "won", ["Hulk"]);
    expect(isRoomRow(alone)).toBe(false);
    expect(isGuestRow(alone)).toBe(false);
    const host = game("rhino", "won", ["Hulk"], { roomPlay: room() });
    expect(isRoomRow(host)).toBe(true);
    expect(isGuestRow(host)).toBe(false);
    expect(isGuestRow(game("rhino", "won", ["Hulk"], { roomPlay: room({ role: "guest" }) }))).toBe(true);
  });

  it("counts nothing for an adjusted game, a Cheats room or a host with no seat", () => {
    expect(countsForAchievements(game("rhino", "won", ["Hulk"]))).toBe(true);
    expect(countsForAchievements(game("rhino", "won", ["Hulk"], { adjusted: true }))).toBe(false);
    expect(countsForAchievements(game("rhino", "won", ["Hulk"], { roomPlay: room({ cheats: true }) }))).toBe(false);
    expect(countsForAchievements(game("rhino", "won", ["Hulk"], { roomPlay: room({ mySeats: [] }) }))).toBe(false);
    expect(countsForAchievements(game("rhino", "won", ["Hulk"], { roomPlay: room() }))).toBe(true);
  });

  it("spots a competitive row", () => {
    expect(isCompetitiveRow({ config: { competitive: {} } })).toBe(true);
    expect(isCompetitiveRow({ config: {} })).toBe(false);
  });
});

describe("room rows in the existing facts", () => {
  it("credits a room row only for the seats this device held", () => {
    const row = game("rhino", "won", ["Hulk", "Thor"], { roomPlay: room({ mySeats: ["p2"] as PlayerId[] }) });
    expect(earned(`hero-${heroId("Thor")}`, [row])).toBe(true);
    expect(earned(`hero-${heroId("Hulk")}`, [row])).toBe(false);
    expect(earned(`played-${heroId("Hulk")}`, [row])).toBe(false);
    expect(earned("beat-rhino", [row])).toBe(true);
  });

  it("gives a guest row only the guest's hero, and a solo game every hero", () => {
    const guest = game("rhino", "won", ["Hulk", "Thor"], {
      roomPlay: room({ role: "guest", mySeats: ["p1"] as PlayerId[] }),
    });
    expect(earned(`hero-${heroId("Hulk")}`, [guest])).toBe(true);
    expect(earned(`hero-${heroId("Thor")}`, [guest])).toBe(false);
    const alone = game("rhino", "won", ["Hulk", "Thor"]);
    expect(earned(`hero-${heroId("Hulk")}`, [alone])).toBe(true);
    expect(earned(`hero-${heroId("Thor")}`, [alone])).toBe(true);
  });

  it("gives a host who held no seat no win, scenario or hero", () => {
    const hosted = game("rhino", "won", ["Hulk"], { roomPlay: room({ mySeats: [] }) });
    const statuses = achievementStatuses(hist([hosted]));
    expect(statuses.filter((s) => s.earned)).toEqual([]);
  });

  it("gives an adjusted game and a Cheats room nothing", () => {
    const earnedIds = (saves: AchievementSave[]) =>
      achievementStatuses(hist(saves))
        .filter((s) => s.earned)
        .map((s) => s.def.id);
    expect(earnedIds([game("rhino", "won", ["Hulk"], { adjusted: true })])).toEqual([]);
    expect(earnedIds([game("rhino", "won", ["Hulk"], { roomPlay: room({ cheats: true }) })])).toEqual([]);
  });

  it("keeps competitive rows out of every existing fact", () => {
    const competitive = {
      status: "won",
      round: 5,
      config: { scenarioId: "rhino", players: [seat("Hulk")], competitive: {} },
    } as unknown as AchievementSave;
    expect(achievementStatuses(hist([competitive])).filter((s) => s.earned)).toEqual([]);
  });
});

describe("one game held as a host row and a guest row (#909)", () => {
  const host = (): AchievementSave =>
    game("rhino", "won", ["Hulk", "Thor"], { roomPlay: room({ role: "host", mySeats: ["p1"] as PlayerId[] }) });
  const guest = (): AchievementSave =>
    game("rhino", "won", ["Hulk", "Thor"], { roomPlay: room({ role: "guest", mySeats: ["p2"] as PlayerId[] }) });

  it("merges to one row with the host as base and both seats credited", () => {
    const rows = mergeRoomGames([guest(), host()]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.roomPlay!.role).toBe("host");
    expect(rows[0]!.roomPlay!.mySeats).toEqual(["p2", "p1"]);
  });

  it("counts once in the multiplayer facts, with both seats", () => {
    const { rows } = multiplayerFactsOf([host(), guest()], () => false, 0);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.mySeatIndexes).toEqual([0, 1]);
  });

  it("credits both heroes and one win in the existing facts", () => {
    const saves = [host(), guest()];
    expect(earned(`hero-${heroId("Hulk")}`, saves)).toBe(true);
    expect(earned(`hero-${heroId("Thor")}`, saves)).toBe(true);
    const wins = achievementStatuses(hist(saves)).filter((s) => s.def.id === "wins-10")[0];
    expect(wins?.progress?.current ?? 1).toBe(1);
  });
});

describe("the multiplayer facts", () => {
  const competitive = (): AchievementSave =>
    ({
      status: "won",
      config: { scenarioId: "rhino", players: [seat("Hulk")], competitive: {} },
    }) as unknown as AchievementSave;

  it("splits rows into counted, competitive and hosted, and drops the rest", () => {
    const alone = game("rhino", "won", ["Hulk"]);
    const hosted = game("klaw", "lost", ["Hulk"], { roomPlay: room({ mySeats: [], gameKey: "k1" }) });
    const guest = game("klaw", "won", ["Hulk"], { roomPlay: room({ role: "guest", gameKey: "k2" }) });
    const cheats = game("klaw", "won", ["Hulk"], { roomPlay: room({ cheats: true, gameKey: "k3" }) });
    const adjusted = game("klaw", "won", ["Hulk"], { adjusted: true });
    const lesson = game("klaw", "won", ["Hulk"], { guided: { kind: "aspect" } });
    const ongoing = game("klaw", "won", ["Hulk"], { status: "playing" });
    const facts = multiplayerFactsOf(
      [alone, hosted, guest, cheats, adjusted, lesson, ongoing, competitive()],
      (s) => s.guided?.kind === "aspect",
      3,
    );
    expect(facts.rows.map((r) => r.save)).toEqual([alone, guest]);
    expect(facts.competitiveRows).toHaveLength(1);
    expect(facts.hostedRows.map((r) => r.save)).toEqual([hosted]);
    expect(facts.watched).toBe(3);
  });

  it("reaches the definitions through the history, with the watched count", () => {
    const row = game("rhino", "won", ["Hulk"], { roomPlay: room() });
    const facts = multiplayerFactsOf([row], () => false, 0);
    expect(facts.rows[0]).toMatchObject({ won: true, roomPlay: row.roomPlay, mySeats: ["p1"], mySeatIndexes: [0] });
  });
});

describe("the multiplayer families", () => {
  it("sit after Feats in the Trophy Room's order, labelled", () => {
    const list = ACHIEVEMENT_FAMILIES.map((f) => f.id);
    const at = list.indexOf("feats");
    expect(list.slice(at + 1, at + 5)).toEqual(["together", "epic", "competitive", "hosting"]);
    expect(ACHIEVEMENT_FAMILIES.find((f) => f.id === "hosting")?.label).toBe("Watching and hosting");
  });
});
