/**
 * A made-up Civil War Competitive room for the lobby's dev preview (`?screen=room-lobby&competitive=host|guest`,
 * `scenes/boot-dev-jump.ts`, issue #883): a 1v1 or 2v2 table with each side's seats, whether each side has sealed a
 * scenario and is ready. Screenshots and the e2e specs use it, so no room service has to run. Dev only.
 */
import {
  NO_ROOM,
  type CompetitiveTeam,
  type RoomParticipant,
  type RoomSeat,
  type RoomState,
  type TeamId,
} from "../live/room-state.js";

export interface CompetitiveRoomFixtureOptions {
  readonly as: "host" | "guest";
  /** `building`: nothing sealed. `sealed`: both sealed, none ready. `ready`: both sealed and ready (Start is on). */
  readonly phase: "building" | "sealed" | "ready";
  readonly perTeam: 1 | 2;
  /** The side the viewing player is on. */
  readonly side?: TeamId;
}

const HEROES: Readonly<Record<string, string>> = {
  s1: "Spider-Man (Justice)|01001a",
  s2: "Captain Marvel (Protection)|01010a",
  s3: "She-Hulk (Aggression)|01019a",
  s4: "Black Panther (Protection)|01036a",
};

export function competitiveRoomFixture(options: CompetitiveRoomFixtureOptions): RoomState {
  const host = options.as === "host";
  const side = options.side ?? "registration";
  const count = options.perTeam * 2;
  const seatIds = Array.from({ length: count }, (_, i) => `s${i + 1}`);
  const teamOf = (index: number): TeamId => (index < options.perTeam ? "registration" : "resistance");
  const names = ["Ava", "Ben", "Cleo", "Dev"];
  const mineIndex = seatIds.findIndex((_, i) => teamOf(i) === side);
  const seats: RoomSeat[] = seatIds.map((id, i) => ({
    id,
    label: HEROES[id] ?? "?",
    holder: `p${i + 1}`,
    holderName: names[i] ?? `Player ${i + 1}`,
    holderConnected: true,
    mismatch: false,
    mine: !host && i === mineIndex,
    player: null,
    takenOver: false,
    away: false,
    requests: [],
    requestedByMe: false,
    team: teamOf(i),
  })) as RoomSeat[];
  const participants: RoomParticipant[] = [
    {
      id: "p0",
      name: host ? "Mara (host)" : "Ava the host",
      role: "host",
      me: host,
      buildMatches: true,
      device: { platform: "windows", form: "desktop" },
      seats: [],
    },
    ...seatIds.map((id, i): RoomParticipant => ({
      id: `p${i + 1}`,
      name: names[i] ?? `Player ${i + 1}`,
      role: "watcher",
      me: !host && i === mineIndex,
      buildMatches: true,
      device: { platform: "web", form: "desktop" },
      seats: [id],
    })),
  ] as RoomParticipant[];
  const sealed = options.phase !== "building";
  const ready = options.phase === "ready";
  const team = (id: TeamId): CompetitiveTeam => ({
    team: id,
    seats: seatIds.filter((_, i) => teamOf(i) === id),
    submitted: sealed,
    ready,
  });
  return {
    ...NO_ROOM,
    role: host ? "host" : "guest",
    connection: "connected",
    roomId: "preview",
    code: "8F2CH9",
    link: "https://marvel.champions-digital-game.com/#join=8F2CH9",
    me: { id: host ? "p0" : `p${mineIndex + 1}`, name: host ? "Mara (host)" : (names[mineIndex] ?? "Ava") },
    participants,
    settings: {
      playMode: "host",
      tableRules: {},
      mods: [],
      multiSeat: false,
      chat: true,
      mode: "competitive",
      tieBreaks: true,
      appVersion: "preview",
      contentVersion: "preview",
    },
    seats,
    mySeats: host ? [] : [seatIds[mineIndex]!],
    mode: "competitive",
    buildMatches: true,
    competitive: {
      myTeam: host ? null : side,
      teams: { registration: team("registration"), resistance: team("resistance") },
      tieBreaks: true,
      sized: true,
      canStart: ready,
    },
  } as RoomState;
}
