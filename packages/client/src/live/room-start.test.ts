import { describe, expect, it, vi } from "vitest";
import type { RoomDeck } from "@mc/sync-worker/room-protocol";
import type { SessionConfig } from "../engine/host.js";
import { NO_ROOM, type RoomSeat, type RoomState, type SeatDeckEntry } from "./room-state.js";
import { startRoomGame, type RoomStartDeps, type SeatDeckRefusal } from "./room-start.js";
import type { SeatDeckVerdict } from "./room-deck.js";

const deck = (hero: string): RoomDeck => ({
  name: `${hero} deck`,
  hero,
  heroName: hero,
  aspects: ["justice"],
  cards: [{ cardId: "c1", quantity: 2 }],
  mods: [],
});
const seat = (id: string, holder: string | null): RoomSeat => ({
  id,
  label: "",
  holder,
  holderName: holder,
  holderConnected: holder !== null,
  mismatch: false,
  mine: false,
  player: null,
  takenOver: false,
  away: false,
  requests: [],
  requestedByMe: false,
  deck: null,
  deckProblem: null,
});
const room = (seats: RoomSeat[], over: Partial<RoomState> = {}): RoomState => ({
  ...NO_ROOM,
  role: "host",
  connection: "connected",
  settings: {
    playMode: "strict",
    tableRules: {},
    mods: [{ id: "cool", version: "2" }],
    multiSeat: false,
    chat: true,
    appVersion: "1",
    contentVersion: "1",
  },
  seats,
  ...over,
});
const BASE = { scenarioId: "rhino", difficulty: "standard", seed: 5 } as unknown as Omit<SessionConfig, "players">;

function deps(
  state: RoomState,
  entries: SeatDeckEntry[] | null,
  verdict?: (seats: string[]) => SeatDeckVerdict[] | null,
) {
  const refused: SeatDeckRefusal[] = [];
  const started: SessionConfig[] = [];
  const check = vi.fn(async (input: Parameters<RoomStartDeps["check"]>[0]) =>
    verdict ? verdict(input.seats.map((s) => s.seat)) : input.seats.map((s) => ({ seat: s.seat, ok: true as const })),
  );
  const d: RoomStartDeps = {
    state: () => state,
    requestDecks: async () => entries,
    refuse: (r) => refused.push(r),
    check,
    start: async (config) => {
      started.push(config);
      return null;
    },
  };
  return { d, refused, started, check };
}
const entry = (s: string, hero: string, preset = false): SeatDeckEntry => ({
  seat: s,
  holder: "g",
  preset,
  deck: deck(hero),
});

describe("the host's Start with the players' own decks", () => {
  it("starts the game from the seats' decks in seat order, with the host's own choices", async () => {
    const { d, started, check } = deps(room([seat("s1", "a"), seat("s2", "b")]), [
      entry("s2", "Hulk"),
      entry("s1", "Spidey"),
    ]);
    expect(await startRoomGame(BASE, d)).toEqual({ ok: true });
    expect(started[0]).toMatchObject({ scenarioId: "rhino", seed: 5 });
    expect(started[0]!.players).toEqual([
      { identityCardId: "Spidey", deck: ["c1", "c1"], aspects: ["justice"], deckName: "Spidey deck" },
      { identityCardId: "Hulk", deck: ["c1", "c1"], aspects: ["justice"], deckName: "Hulk deck" },
    ]);
    // The check sees the allowed mods from the lobby and the seats in order.
    expect(check.mock.calls[0]![0]).toMatchObject({
      allowed: [{ id: "cool", version: "2" }],
      seats: [{ seat: "s1" }, { seat: "s2" }],
    });
  });

  it("refuses each failing seat to that seat alone and starts nothing", async () => {
    const { d, refused, started } = deps(
      room([seat("s1", "a"), seat("s2", "b"), seat("s3", "c")]),
      [entry("s1", "A"), entry("s2", "B")],
      (seats) =>
        seats.map((s) =>
          s === "s1"
            ? { seat: s, ok: true }
            : s === "s2"
              ? { seat: s, ok: false, code: "illegal", reason: "28 of 40." }
              : { seat: s, ok: false, code: "no-deck", reason: "No deck." },
        ),
    );
    const result = await startRoomGame(BASE, d);
    expect(result).toEqual({
      ok: false,
      reason: "decks",
      refused: [
        { seat: "s2", code: "illegal", reason: "28 of 40." },
        { seat: "s3", code: "no-deck", reason: "No deck." },
      ],
    });
    expect(refused.map((r) => r.seat)).toEqual(["s2", "s3"]);
    expect(started).toHaveLength(0);
  });

  it("stops for a seat nobody holds, before asking the room for anything", async () => {
    const { d, check } = deps(room([seat("s1", "a"), seat("s2", null)]), []);
    const asked = vi.fn(d.requestDecks);
    expect(await startRoomGame(BASE, { ...d, requestDecks: asked })).toEqual({
      ok: false,
      reason: "unfilled",
      seats: ["s2"],
    });
    expect(asked).not.toHaveBeenCalled();
    expect(check).not.toHaveBeenCalled();
  });

  it("does nothing for a guest or an empty lobby, and says so when the room or the check does not answer", async () => {
    expect(await startRoomGame(BASE, deps(room([seat("s1", "a")], { role: "guest" }), []).d)).toMatchObject({
      reason: "not-host",
    });
    expect(await startRoomGame(BASE, deps(room([]), []).d)).toMatchObject({ reason: "no-seats" });
    const noAnswer = deps(room([seat("s1", "a")]), null);
    expect(await startRoomGame(BASE, noAnswer.d)).toEqual({ ok: false, reason: "no-answer" });
    const noCheck = deps(room([seat("s1", "a")]), [entry("s1", "A")], () => null);
    expect(await startRoomGame(BASE, noCheck.d)).toEqual({ ok: false, reason: "check-failed" });
    expect(noCheck.started).toHaveLength(0);
  });

  it("does not start on a check that skipped a seat, doubled one or named another, or passed a seat with no deck", async () => {
    const seats = [seat("s1", "a"), seat("s2", "b")];
    for (const bad of [
      [{ seat: "s1", ok: true as const }],
      [
        { seat: "s1", ok: true as const },
        { seat: "s1", ok: true as const },
      ],
      [
        { seat: "s1", ok: true as const },
        { seat: "sX", ok: true as const },
      ],
    ]) {
      const t = deps(room(seats), [entry("s1", "A"), entry("s2", "B")], () => bad);
      expect(await startRoomGame(BASE, t.d)).toEqual({ ok: false, reason: "check-failed" });
      expect(t.started).toHaveLength(0);
    }
    // Every seat passes but one has no deck: a result, not a throw.
    const missing = deps(room(seats), [entry("s1", "A")]);
    expect(await startRoomGame(BASE, missing.d)).toEqual({ ok: false, reason: "check-failed" });
  });

  it("reports the engine's own words when it will not start", async () => {
    const { d } = deps(room([seat("s1", "a")]), [entry("s1", "A")]);
    expect(await startRoomGame(BASE, { ...d, start: async () => "No such scenario." })).toEqual({
      ok: false,
      reason: "start-failed",
      error: "No such scenario.",
    });
  });
});
