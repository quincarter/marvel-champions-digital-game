/**
 * A made-up Epic room (Trickster Takeover Epic Multiplayer, issue #882) for the unit tests and the dev previews
 * (`?screen=room-lobby&epic=organizer|player`, the board's `pod=` preview): three tables in two pods, seats with heroes,
 * hosts, a pending request, and, once playing, the coordinator's shared record and a Mangog in another table of the pod.
 * Dev and tests only: a production build never loads it.
 */
import type { SharedPodState } from "@mc/engine";
import {
  NO_ROOM,
  type EpicState,
  type EpicTable,
  type RoomParticipant,
  type RoomSeat,
  type RoomState,
} from "../live/room-state.js";

export type EpicFixtureAs = "organizer" | "player" | "watcher";

const seat = (id: string, label: string, holder: string | null, name: string | null, mine = false): RoomSeat => ({
  id,
  label,
  holder,
  holderName: name,
  holderConnected: holder !== null,
  mismatch: false,
  mine,
  player: null,
  takenOver: false,
  away: false,
  requests: [],
  requestedByMe: false,
});

export interface EpicFixtureOptions {
  readonly as: EpicFixtureAs;
  /** `lobby`: before Start; `playing`: the game is under way with the coordinator's record. */
  readonly phase: "lobby" | "playing";
  /** Loki has flipped in the shared record. */
  readonly flipped?: boolean;
  /** The third table's host is away. */
  readonly hostAway?: boolean;
  /** Hand the viewer's table a Mangog in the second table of its pod. */
  readonly mangog?: boolean;
  /**
   * The shared record to show (so a board fixture's strip says what its game's own neutral panels say). Absent: made-up
   * numbers, for the lobby and the unit tests.
   */
  readonly sharedOf?: (flipped: boolean) => SharedPodState;
}

export function epicRoomFixture(options: EpicFixtureOptions): RoomState {
  const { as, phase } = options;
  const playing = phase === "playing";
  const participants: RoomParticipant[] = [
    { id: "o", name: "Mara", role: "host", me: as === "organizer", buildMatches: true, seats: [] },
    ...["Ava", "Ben", "Cleo", "Dev", "Esi"].map((name, i): RoomParticipant => ({
      id: `u${i + 1}`,
      name,
      role: "watcher",
      me: as === "player" && i === 0,
      buildMatches: true,
      seats: [],
    })),
  ];
  const seats: RoomSeat[] = [
    seat("t1s1", "Spider-Man (Justice) - Core Set starter deck|01001a", "u1", "Ava", as === "player"),
    seat("t1s2", "She-Hulk (Aggression) - Core Set starter deck|01019a", "u2", "Ben"),
    seat("t2s1", "Captain Marvel (Leadership) - Core Set starter deck|01010a", "u3", "Cleo"),
    seat("t3s1", "Iron Man (Aggression) - Core Set starter deck|01029a", playing ? "u4" : null, playing ? "Dev" : null),
    seat(
      "t3s2",
      "Black Panther (Protection) - Core Set starter deck|01022a",
      playing ? "u5" : null,
      playing ? "Esi" : null,
    ),
  ];
  const byTable: Record<string, string[]> = { t1: ["t1s1", "t1s2"], t2: ["t2s1"], t3: ["t3s1", "t3s2"] };
  const mk = (id: string, name: string, pod: string, host: string | null, hostName: string | null): EpicTable => ({
    id,
    name,
    pod,
    difficulty: id === "t3" ? "expert" : "standard",
    host,
    hostName,
    hostConnected: host !== null && !(options.hostAway && id === "t3"),
    seats: byTable[id] ?? [],
    myRole: as === "player" && id === "t1" ? "player" : "watcher",
    status: !playing ? "lobby" : options.hostAway && id === "t3" ? "waiting" : id === "t2" ? "villain" : "player",
    round: playing ? (id === "t1" ? 3 : id === "t2" ? 4 : 2) : 0,
    started: playing,
    commands: playing ? 120 : 0,
    watching: id === "t2" ? 2 : 0,
    followed: true,
  });
  const tables = [
    mk("t1", "North Table", "p1", "u1", "Ava"),
    mk("t2", "South Table", "p1", "u3", "Cleo"),
    mk(
      "t3",
      "Harbour Table",
      "p2",
      playing || as === "organizer" ? "u4" : null,
      playing || as === "organizer" ? "Dev" : null,
    ),
  ];
  const flipped = options.flipped === true;
  const epic: EpicState = {
    organizer: as === "organizer",
    hostsTable: as === "player" ? "t1" : null,
    myTable: as === "watcher" ? null : "t1",
    tables,
    pods: [
      { id: "p1", name: "Pod 1", tables: ["t1", "t2"] },
      { id: "p2", name: "Pod 2", tables: ["t3"] },
    ],
    start: playing ? { id: "go", seed: 7, at: Date.now() - 38 * 60_000 } : null,
    timeLimitMinutes: 180,
    pod: playing
      ? {
          shared: options.sharedOf?.(flipped) ?? {
            villainHp: 25 * 2,
            villainDamage: flipped ? 33 : 11,
            villainFlipAtRemaining: 10,
            villainFlipped: flipped,
            schemeThreat: 3,
            schemeTarget: 6,
            status: "playing",
          },
          outcome: "playing",
        }
      : null,
    remoteTargets:
      playing && options.mangog && as !== "watcher"
        ? [
            {
              table: "t2",
              tableName: "South Table",
              card: { instanceId: "i9", cardId: "55041", by: "attack", remainingHitPoints: 12 } as never,
            },
          ]
        : [],
    following: "all",
    podStuck: false,
  };
  return {
    ...NO_ROOM,
    role: as === "organizer" ? "host" : "guest",
    connection: "connected",
    roomId: "preview",
    code: "8F2CH9",
    link: "https://marvel.champions-digital-game.com/#join=8F2CH9",
    me: { id: participants.find((p) => p.me)?.id ?? "w", name: participants.find((p) => p.me)?.name ?? "Watcher" },
    participants,
    settings: {
      playMode: "host",
      tableRules: { epicTimeLimitMinutes: 180 },
      mods: [],
      multiSeat: false,
      chat: true,
      mode: "epic",
      appVersion: "preview",
      contentVersion: "preview",
    },
    seats,
    mySeats: as === "player" ? ["t1s1"] : [],
    started: playing,
    mode: "epic",
    epic,
    buildMatches: true,
  };
}
