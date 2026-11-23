/**
 * `startCompetitive` against a room that moves under it (issue #883): the reveal is tied to the room's competitive
 * revision, and the seat to player mapping must be in the room's own lobby before the engine starts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomState } from "../live/room-state.js";

const h = vi.hoisted(() => ({
  publish: null as null | ((s: unknown) => void),
  sealedListener: null as null | ((s: { registration: unknown; resistance: unknown; rev: number }) => void),
  commands: [] as { kind: string; [k: string]: unknown }[],
  start: vi.fn(async () => {}),
  gate: null as null | Promise<void>,
  lobbyRev: (): number => 0,
  revealRev: 5,
  built: [] as { setup: { seats: { seat: string; player: string }[] }; teams: unknown }[],
}));

vi.mock("./live-watch.js", () => ({
  postRoomCommand: (c: { kind: string }) => {
    h.commands.push(c);
    if (c.kind === "room-reveal")
      queueMicrotask(() => h.sealedListener?.({ registration: {}, resistance: {}, rev: h.revealRev }));
    return true;
  },
  setRoomDecksListener: () => {},
  setChatPopoutListener: () => {},
  setRoomStateListener: (l: (s: unknown) => void) => {
    h.publish = l;
  },
  setSealedListener: (l: typeof h.sealedListener) => {
    h.sealedListener = l;
  },
}));
vi.mock("../session.js", () => ({ appSession: () => ({ store: { start: h.start, state: { status: "playing" } } }) }));
vi.mock("../live/room-deck-check-client.js", () => ({ RoomDeckWorker: class {} }));
vi.mock("../live/room-start.js", () => ({
  // The deck fetch and check stand in as one awaited gate; then the seats' players reach `begin`.
  startRoomGame: async (
    base: object,
    deps: { start: (c: unknown) => Promise<string | null>; seatIds?: readonly string[] },
  ) => {
    await h.gate;
    const error = await deps.start({
      ...base,
      roomLobbyRev: h.lobbyRev(),
      players: (deps.seatIds ?? []).map((_s, i) => `hero${i}`),
    });
    return error === null ? { ok: true } : { ok: false, reason: "start-failed", error };
  },
}));
vi.mock("../live/competitive-start.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../live/competitive-start.js")>()),
  buildCompetitiveConfig: (input: (typeof h.built)[number]) => {
    h.built.push(input);
    return { scenarioId: "x", difficulty: "standard", players: [], seed: 1 };
  },
}));

const { startCompetitive } = await import("./room.js");
const { NO_ROOM } = await import("../live/room-state.js");

const seat = (id: string, team: string, player: string | null, deck: unknown = null) => ({
  id,
  label: "",
  deck,
  deckProblem: null,
  holder: `h-${id}`,
  holderName: id,
  holderConnected: true,
  mismatch: false,
  mine: false,
  player,
  team,
});
const room = (over: {
  rev: number;
  ready?: boolean;
  players?: Record<string, string | null>;
  lobby?: number;
  deck?: string;
}): RoomState => {
  const p = over.players ?? {};
  const team = (id: string, seats: string[]) => ({ team: id, seats, submitted: true, ready: over.ready ?? true });
  return {
    ...NO_ROOM,
    role: "host",
    rev: over.lobby ?? 0,
    // Lobby order: resistance's seat first, so registration-first order reverses it.
    seats: [seat("s1", "resistance", p.s1 ?? null, over.deck ?? null), seat("s2", "registration", p.s2 ?? null)],
    competitive: {
      myTeam: null,
      teams: { registration: team("registration", ["s2"]), resistance: team("resistance", ["s1"]) },
      tieBreaks: true,
      sized: true,
      canStart: over.ready ?? true,
      rev: over.rev,
    },
  } as unknown as RoomState;
};

beforeEach(() => {
  h.commands.length = 0;
  h.start.mockClear();
  h.gate = null;
  h.lobbyRev = () => 0;
  h.revealRev = 5;
  h.built.length = 0;
  vi.useRealTimers();
  h.publish!(room({ rev: 5, players: { s1: "p2", s2: "p1" } }));
});

describe("startCompetitive when the room moves", () => {
  it("does not launch the engine when a team un-readies during the deck validation", async () => {
    let release!: () => void;
    h.gate = new Promise((r) => (release = r));
    const started = startCompetitive({ seed: 1 });
    await new Promise((r) => setTimeout(r, 0));
    h.publish!(room({ rev: 6, ready: false, players: { s1: "p2", s2: "p1" } }));
    release();
    const result = await started;
    expect(result).toMatchObject({ ok: false, reason: "room", result: { reason: "start-failed" } });
    expect(h.start).not.toHaveBeenCalled();
  });

  it("does not launch when a team re-readies with another scenario (same flags, newer revision)", async () => {
    let release!: () => void;
    h.gate = new Promise((r) => (release = r));
    const started = startCompetitive({ seed: 1 });
    await new Promise((r) => setTimeout(r, 0));
    h.publish!(room({ rev: 8, players: { s1: "p2", s2: "p1" } }));
    release();
    expect((await started).ok).toBe(false);
    expect(h.start).not.toHaveBeenCalled();
  });

  it("refuses at once when the room moved before the reveal answer arrived", async () => {
    const started = startCompetitive({ seed: 1 });
    h.publish!(room({ rev: 9 }));
    expect(await started).toEqual({ ok: false, reason: "not-ready" });
    expect(h.start).not.toHaveBeenCalled();
  });

  it("does not build from the earlier teams when a swap and a new ready land before the reveal answers", async () => {
    // Initial snapshot: rev 5 (s2 registration, s1 resistance). Before the answer the teams swap and both re-ready at
    // rev 8, and the room's reveal answers with rev 8: the rev 5 team lists must not be used for the newer reveal.
    h.revealRev = 8;
    const swapped = room({ rev: 8, players: { s1: "p1", s2: "p2" } });
    const comp = swapped.competitive!;
    const started = startCompetitive({ seed: 1 });
    h.publish!({
      ...swapped,
      competitive: {
        ...comp,
        teams: {
          registration: { ...comp.teams.registration, seats: ["s1"] },
          resistance: { ...comp.teams.resistance, seats: ["s2"] },
        },
      },
    } as unknown as RoomState);
    expect(await started).toEqual({ ok: false, reason: "not-ready" });
    expect(h.built).toHaveLength(0);
    expect(h.start).not.toHaveBeenCalled();
  });

  it("starts the engine once the room's lobby already shows the mapping", async () => {
    expect(await startCompetitive({ seed: 1 })).toEqual({ ok: true });
    // Registration's seat (s2) is player one, whatever the lobby order.
    expect(h.built[0]!.setup.seats.map((x) => x.seat)).toEqual(["s2", "s1"]);
    expect(h.start).toHaveBeenCalledTimes(1);
    expect(h.commands.some((c) => c.kind === "room-lobby")).toBe(false);
  });

  it("waits for the room to show the registration-first mapping before starting the engine", async () => {
    h.publish!(room({ rev: 5 }));
    const started = startCompetitive({ seed: 1 });
    await vi.waitFor(() => expect(h.commands.some((c) => c.kind === "room-lobby")).toBe(true));
    const lobby = h.commands.find((c) => c.kind === "room-lobby") as unknown as {
      seats: { id: string; player?: string }[];
    };
    // The registration seat (s2, second in the lobby) is p1; the resistance seat is p2.
    expect(lobby.seats).toMatchObject([
      { id: "s1", player: "p2" },
      { id: "s2", player: "p1" },
    ]);
    await Promise.resolve();
    expect(h.start).not.toHaveBeenCalled();
    h.publish!(room({ rev: 5, lobby: 1, players: { s1: "p2", s2: "p1" } }));
    expect(await started).toEqual({ ok: true });
    expect(h.start).toHaveBeenCalledTimes(1);
  });

  it("does not start the engine when the mapping update is never accepted", async () => {
    h.publish!(room({ rev: 5 }));
    vi.useFakeTimers();
    const started = startCompetitive({ seed: 1 });
    await vi.advanceTimersByTimeAsync(6_000);
    expect(await started).toMatchObject({ ok: false, reason: "room", result: { reason: "start-failed" } });
    expect(h.start).not.toHaveBeenCalled();
  });

  it("does not start the engine when the room moves on while the mapping is pending", async () => {
    h.publish!(room({ rev: 5 }));
    const started = startCompetitive({ seed: 1 });
    await vi.waitFor(() => expect(h.commands.some((c) => c.kind === "room-lobby")).toBe(true));
    h.publish!(room({ rev: 6, players: { s1: "p2", s2: "p1" } }));
    expect((await started).ok).toBe(false);
    expect(h.start).not.toHaveBeenCalled();
  });

  it("sends the mapping as a compare and swap on the revision the decks were judged at", async () => {
    h.lobbyRev = () => 3;
    h.publish!(room({ rev: 5, lobby: 3 }));
    const started = startCompetitive({ seed: 1 });
    await vi.waitFor(() => expect(h.commands.some((c) => c.kind === "room-lobby")).toBe(true));
    expect(h.commands.find((c) => c.kind === "room-lobby")).toMatchObject({ ifRev: 3 });
    h.publish!(room({ rev: 5, lobby: 4, players: { s1: "p2", s2: "p1" } }));
    expect(await started).toEqual({ ok: true });
    expect(h.start).toHaveBeenCalledWith(expect.objectContaining({ roomLobbyRev: 4 }));
  });

  it("does not start when the room refuses the mapping as lobby-changed", async () => {
    h.publish!(room({ rev: 5 }));
    const started = startCompetitive({ seed: 1 });
    await vi.waitFor(() => expect(h.commands.some((c) => c.kind === "room-lobby")).toBe(true));
    h.publish!({ ...room({ rev: 5, lobby: 1 }), refusal: { reason: "lobby-changed", seq: 1 } } as unknown as RoomState);
    expect((await started).ok).toBe(false);
    expect(h.start).not.toHaveBeenCalled();
  });

  it("starts with the lobby revision the mapping write produced when no seat changed", async () => {
    h.publish!(room({ rev: 5 }));
    const started = startCompetitive({ seed: 1 });
    await vi.waitFor(() => expect(h.commands.some((c) => c.kind === "room-lobby")).toBe(true));
    h.publish!(room({ rev: 5, lobby: 1, players: { s1: "p2", s2: "p1" } }));
    expect(await started).toEqual({ ok: true });
    expect(h.start).toHaveBeenCalledWith(expect.objectContaining({ roomLobbyRev: 1 }));
  });

  it("does not start when a guest changes their deck while the mapping acknowledgement is delayed", async () => {
    h.publish!(room({ rev: 5 }));
    const started = startCompetitive({ seed: 1 });
    await vi.waitFor(() => expect(h.commands.some((c) => c.kind === "room-lobby")).toBe(true));
    // A same-summary deck swap bumps the revision once more: the mapping write alone would have made it 1.
    h.publish!(room({ rev: 5, lobby: 2, deck: "other", players: { s1: "p2", s2: "p1" } }));
    expect((await started).ok).toBe(false);
    expect(h.start).not.toHaveBeenCalled();
  });
});
