/**
 * Seat decks (Quin, 2026-11-20): each player brings their own hero and deck. The room stores a deck with its seat, shows
 * everyone only a summary, gives the full lists to the host alone, and relays the host's `deck-refused` to the one seat.
 */
import { describe, expect, it } from "vitest";
import { GameRoomLogic, sha256Hex, type RoomSocket } from "./game-room.js";
import {
  DECK_MESSAGE_BURST,
  DECK_REFILL_SECONDS,
  MAX_DECK_LINES,
  MAX_SEAT_DECK_BYTES,
  parseClientMessage,
  type Participant,
  type RoomBuild,
  type RoomDeck,
  type ServerMessage,
} from "./room-protocol.js";
import { MemoryStorage } from "./test-support.js";

const TOKEN = "T".repeat(32);
const BUILD: RoomBuild = { appVersion: "1.2.3", contentVersion: "c9" };

class FakeSocket implements RoomSocket {
  readonly sent: ServerMessage[] = [];
  attachment: Participant | null = null;
  send(text: string) {
    this.sent.push(JSON.parse(text) as ServerMessage);
  }
  close() {}
  getParticipant() {
    return this.attachment;
  }
  setParticipant(p: Participant) {
    this.attachment = p;
  }
  clearParticipant() {
    this.attachment = null;
  }
  of<K extends string>(kind: K) {
    return this.sent.filter((m) => m.kind === kind) as Extract<ServerMessage, { kind: K }>[];
  }
  last<K extends string>(kind: K) {
    return this.of(kind).at(-1);
  }
  get id() {
    return this.attachment!.id;
  }
  get refusals() {
    return this.of("refused").map((m) => m.reason);
  }
}

const deck = (over: Partial<RoomDeck> = {}): RoomDeck => ({
  name: "Spidey Justice",
  hero: "01001a",
  heroName: "Spider-Man",
  aspects: ["justice"],
  cards: [
    { cardId: "01010", quantity: 3 },
    { cardId: "01011", quantity: 2 },
  ],
  mods: [],
  ...over,
});

async function setup() {
  const storage = new MemoryStorage();
  const clock = { now: 1_000 };
  const limits = { maxParticipants: 25, maxMessageBytes: 64 * 1024, maxLogBytes: 8 * 1024 * 1024 };
  const room = new GameRoomLogic(storage, limits, () => clock.now);
  await room.create(await sha256Hex(TOKEN), clock.now, { code: "K7M2PQ", roomId: "AAAAAAAAAAAA" });
  const send = (s: RoomSocket, m: unknown) => room.message(s, JSON.stringify({ v: 1, ...(m as object) }));
  const join = async (name: string, token?: string) => {
    const s = new FakeSocket();
    await send(s, {
      ch: "room",
      kind: "hello",
      caps: ["watch", "chat", "seats"],
      ...(token ? { token } : {}),
      name,
      build: BUILD,
    });
    return s;
  };
  const h = await join("Hosty", TOKEN);
  await send(h, {
    ch: "room",
    kind: "lobby-set",
    seats: [{ id: "s1" }, { id: "s2" }, { id: "s3" }],
    settings: { multiSeat: true },
  });
  const assign = (seat: string, to: FakeSocket) =>
    send(h, { ch: "room", kind: "seat-assign", seat, participant: to.id });
  const setDeck = (s: RoomSocket, seat: string, d: RoomDeck = deck()) =>
    send(s, { ch: "room", kind: "seat-deck", seat, deck: d });
  return { storage, clock, room, send, join, h, assign, setDeck };
}

describe("seat decks: who may set one, and what everyone sees", () => {
  it("shows everyone only a summary, never the card list, and the host the full lists on request", async () => {
    const { join, h, assign, setDeck, send } = await setup();
    const a = await join("Ann");
    const b = await join("Bo");
    await assign("s1", a);
    await setDeck(a, "s1");
    for (const watcher of [a, b, h]) {
      const seat = watcher.last("lobby")!.seats[0]!;
      expect(seat.deck).toEqual({
        hero: "01001a",
        heroName: "Spider-Man",
        aspects: ["justice"],
        name: "Spidey Justice",
        cards: 5,
        mods: [],
      });
      expect(JSON.stringify(watcher.last("lobby"))).not.toContain("01010");
    }
    // Nothing but the lobby reached the guests, and no message of theirs carries a card id.
    expect(JSON.stringify(b.sent)).not.toContain("01010");
    expect(b.of("seat-decks")).toHaveLength(0);
    await send(h, { ch: "room", kind: "seat-decks-request" });
    expect(h.last("seat-decks")!.decks).toEqual([{ seat: "s1", holder: a.id, preset: false, deck: deck() }]);
    // A guest asking for the lists is refused and gets nothing.
    await send(b, { ch: "room", kind: "seat-decks-request" });
    expect(b.refusals).toEqual(["not-allowed"]);
    expect(b.of("seat-decks")).toHaveLength(0);
  });

  it("bumps the lobby revision on every stored change, a replaced deck and a changed holder included", async () => {
    const { join, h, assign, setDeck, send } = await setup();
    const a = await join("Ann");
    const b = await join("Bo");
    const rev = () => h.last("lobby")!.rev;
    const r0 = rev();
    await assign("s1", a);
    const r1 = rev();
    expect(r1).toBeGreaterThan(r0);
    await setDeck(a, "s1");
    const r2 = rev();
    expect(r2).toBeGreaterThan(r1);
    // The same summary, a different card list: the revision still moves.
    await setDeck(a, "s1", deck({ cards: [{ cardId: "01012", quantity: 5 }] }));
    const r3 = rev();
    expect(r3).toBeGreaterThan(r2);
    await send(h, { ch: "room", kind: "seat-deny", seat: "s1", participant: a.id });
    const r4 = rev();
    expect(r4).toBeGreaterThan(r3);
    await assign("s1", b);
    expect(rev()).toBeGreaterThan(r4);
  });

  it("refuses a deck from someone who does not hold the seat, and for a seat that does not exist", async () => {
    const { join, assign, setDeck } = await setup();
    const a = await join("Ann");
    const b = await join("Bo");
    await assign("s1", a);
    await setDeck(b, "s1");
    await setDeck(a, "s2");
    await setDeck(a, "nope");
    expect(b.refusals).toEqual(["not-allowed"]);
    expect(a.refusals).toEqual(["not-allowed", "no-such-seat"]);
  });

  it("lets the host preset a deck for any seat, and the holder replaces it with their own", async () => {
    const { join, h, assign, setDeck, send } = await setup();
    const a = await join("Ann");
    await setDeck(h, "s2", deck({ name: "Preset" }));
    expect(a.last("lobby")!.seats[1]!.deck).toMatchObject({ name: "Preset", preset: true });
    await assign("s2", a);
    expect(a.last("lobby")!.seats[1]).toMatchObject({ holder: a.id, deck: { name: "Preset", preset: true } });
    await setDeck(a, "s2", deck({ name: "Mine" }));
    expect(a.last("lobby")!.seats[1]!.deck).toEqual(expect.objectContaining({ name: "Mine" }));
    expect(a.last("lobby")!.seats[1]!.deck!.preset).toBeUndefined();
    await send(h, { ch: "room", kind: "seat-decks-request" });
    expect(h.last("seat-decks")!.decks[0]).toMatchObject({ seat: "s2", preset: false, deck: { name: "Mine" } });
  });

  it("treats the host's deck for a seat the host holds as their own, not a preset", async () => {
    const { h, setDeck, send } = await setup();
    await send(h, { ch: "room", kind: "seat-request", seat: "s1" });
    await setDeck(h, "s1");
    expect(h.last("lobby")!.seats[0]!.deck!.preset).toBeUndefined();
    await send(h, { ch: "room", kind: "seat-release", seat: "s1" });
    expect(h.last("lobby")!.seats[0]!.deck).toBeUndefined();
  });
});

describe("seat decks: a change of holder", () => {
  it("clears a holder's own deck when they release, are taken back, or the seat is given on, but keeps a preset", async () => {
    const { join, h, assign, setDeck, send } = await setup();
    const a = await join("Ann");
    const b = await join("Bo");
    await assign("s1", a);
    await setDeck(a, "s1");
    await send(a, { ch: "room", kind: "seat-release", seat: "s1" });
    expect(h.last("lobby")!.seats[0]).toMatchObject({ id: "s1" });
    expect(h.last("lobby")!.seats[0]!.deck).toBeUndefined();
    // Taken back by the host, then given to someone else: the next holder starts without it.
    await assign("s1", a);
    await setDeck(a, "s1");
    await send(h, { ch: "room", kind: "seat-deny", seat: "s1", participant: a.id });
    await assign("s1", b);
    expect(b.last("lobby")!.seats[0]).toMatchObject({ holder: b.id });
    expect(b.last("lobby")!.seats[0]!.deck).toBeUndefined();
    // A preset survives both.
    await setDeck(h, "s3", deck({ name: "Preset" }));
    await assign("s3", a);
    await send(h, { ch: "room", kind: "seat-deny", seat: "s3", participant: a.id });
    await assign("s3", b);
    expect(b.last("lobby")!.seats[2]).toMatchObject({ holder: b.id, deck: { name: "Preset", preset: true } });
  });

  it("keeps a holder's deck when they come back by seat token", async () => {
    const { join, assign, setDeck, send, room } = await setup();
    const a = await join("Ann");
    await assign("s1", a);
    const token = a.last("seat-token")!.token;
    await setDeck(a, "s1");
    await room.close(a);
    const a2 = new FakeSocket();
    await send(a2, { ch: "room", kind: "hello", caps: ["watch"], name: "Ann", build: BUILD, seatTokens: [token] });
    expect(a2.last("lobby")!.seats[0]).toMatchObject({ holder: a2.id, deck: { name: "Spidey Justice", cards: 5 } });
  });

  it("drops the deck of a seat the host removes from the lobby", async () => {
    const { join, h, assign, setDeck, send } = await setup();
    const a = await join("Ann");
    await assign("s1", a);
    await setDeck(a, "s1");
    await send(h, { ch: "room", kind: "lobby-set", seats: [{ id: "s2" }] });
    await send(h, { ch: "room", kind: "seat-decks-request" });
    expect(h.last("seat-decks")!.decks).toEqual([]);
  });
});

describe("seat decks: storage, size and rate", () => {
  it("writes the lobby row once for a new deck and nothing for the same deck again", async () => {
    const { join, assign, setDeck, storage } = await setup();
    const a = await join("Ann");
    await assign("s1", a);
    const before = storage.rowsWritten;
    await setDeck(a, "s1");
    expect(storage.rowsWritten).toBe(before + 1);
    await setDeck(a, "s1");
    expect(storage.rowsWritten).toBe(before + 1);
    await setDeck(a, "s1", deck({ name: "Changed" }));
    expect(storage.rowsWritten).toBe(before + 2);
  });

  it("stores the deck with its seat, so a woken room still has it", async () => {
    const { join, assign, setDeck, storage, send } = await setup();
    const a = await join("Ann");
    await assign("s1", a);
    await setDeck(a, "s1");
    const woken = new GameRoomLogic(
      storage,
      { maxParticipants: 25, maxMessageBytes: 64 * 1024, maxLogBytes: 1 << 23 },
      () => 5_000,
    );
    const h2 = new FakeSocket();
    await woken.message(
      h2,
      JSON.stringify({ v: 1, ch: "room", kind: "hello", caps: ["watch"], token: TOKEN, name: "Hosty", build: BUILD }),
    );
    expect(h2.last("lobby")!.seats[0]!.deck).toMatchObject({ name: "Spidey Justice" });
    await woken.message(h2, JSON.stringify({ v: 1, ch: "room", kind: "seat-decks-request" }));
    expect(h2.last("seat-decks")!.decks[0]!.deck).toEqual(deck());
    void send;
  });

  it("reads a deck by its shape, and cleans its text before keeping it", async () => {
    const { join, assign, setDeck, h, send } = await setup();
    const a = await join("Ann");
    await assign("s1", a);
    await setDeck(a, "s1", { ...deck({ name: "  Dirty\nName​  " }), extra: "junk" } as RoomDeck);
    expect(h.last("lobby")!.seats[0]!.deck!.name).toBe("Dirty Name");
    await send(h, { ch: "room", kind: "seat-decks-request" });
    expect(JSON.stringify(h.last("seat-decks"))).not.toContain("junk");
    for (const bad of [
      { ...deck(), cards: [{ cardId: "x", quantity: 0 }] },
      { ...deck(), cards: [{ cardId: "x", quantity: 1.5 }] },
      { ...deck(), cards: Array.from({ length: MAX_DECK_LINES + 1 }, (_, i) => ({ cardId: `c${i}`, quantity: 1 })) },
      { ...deck(), aspects: "justice" },
      { ...deck(), hero: "" },
      { ...deck(), mods: [{ id: "m" }] },
    ]) {
      expect(
        parseClientMessage(JSON.stringify({ v: 1, ch: "room", kind: "seat-deck", seat: "s1", deck: bad })),
      ).toBeNull();
    }
    const blank = await (async () => {
      await setDeck(a, "s1", deck({ name: "​ \n" }));
      return a.refusals.at(-1);
    })();
    expect(blank).toBe("bad-message");
  });

  it("refuses a deck over the byte cap too-large, and stores nothing", async () => {
    const { join, assign, setDeck, h, storage } = await setup();
    const a = await join("Ann");
    await assign("s1", a);
    const before = storage.rowsWritten;
    // Within the shape limits but over the byte cap: 64 mods with long ids and versions, in multi-byte characters.
    const fat = deck({
      mods: Array.from({ length: 64 }, (_, i) => ({ id: `${"€".repeat(60)}${i}`, version: "€".repeat(30) })),
    });
    expect(new TextEncoder().encode(JSON.stringify(fat)).length).toBeGreaterThan(MAX_SEAT_DECK_BYTES);
    await setDeck(a, "s1", fat);
    expect(a.refusals).toEqual(["too-large"]);
    expect(storage.rowsWritten).toBe(before);
    expect(h.last("lobby")!.seats[0]!.deck).toBeUndefined();
  });

  it("rate limits decks per participant, then lets one through each refill", async () => {
    const { join, assign, setDeck, clock } = await setup();
    const a = await join("Ann");
    await assign("s1", a);
    // The lobby's own limiter (burst 10, 2 a second) is looser; the deck limiter bites first.
    for (let i = 0; i < DECK_MESSAGE_BURST + 2; i++) await setDeck(a, "s1", deck({ name: `Deck ${i}` }));
    expect(a.refusals).toEqual(["rate-limited", "rate-limited"]);
    clock.now += DECK_REFILL_SECONDS * 1000;
    await setDeck(a, "s1", deck({ name: "After wait" }));
    expect(a.refusals).toHaveLength(2);
    expect(a.last("lobby")!.seats[0]!.deck!.name).toBe("After wait");
  });
});

describe("deck-refused", () => {
  it("goes only to that seat's holder, from the host only, with the reason cleaned", async () => {
    const { join, h, assign, setDeck, send } = await setup();
    const a = await join("Ann");
    const b = await join("Bo");
    await assign("s1", a);
    await assign("s2", b);
    await setDeck(a, "s1");
    await send(h, {
      ch: "room",
      kind: "deck-refused",
      seat: "s1",
      code: "illegal",
      reason: "Too\nfew cards: 28 of 40.",
    });
    expect(a.of("deck-refused")).toEqual([
      { v: 1, ch: "room", kind: "deck-refused", seat: "s1", code: "illegal", reason: "Too few cards: 28 of 40." },
    ]);
    expect(b.of("deck-refused")).toHaveLength(0);
    expect(h.of("deck-refused")).toHaveLength(0);
    // A guest cannot send one, or send one about someone else's seat.
    await send(b, { ch: "room", kind: "deck-refused", seat: "s1", code: "illegal", reason: "Spoof" });
    expect(b.refusals).toEqual(["not-allowed"]);
    expect(a.of("deck-refused")).toHaveLength(1);
    // A seat with no holder: nobody is told, nothing breaks.
    await send(h, { ch: "room", kind: "deck-refused", seat: "s3", code: "no-deck", reason: "No deck." });
    expect(a.of("deck-refused")).toHaveLength(1);
    // An unknown code is not a message this room reads.
    expect(
      parseClientMessage(
        JSON.stringify({ v: 1, ch: "room", kind: "deck-refused", seat: "s1", code: "x", reason: "r" }),
      ),
    ).toBeNull();
  });
});

describe("lobby seats without labels", () => {
  it("sets open seats as a count, with no hero label", async () => {
    const { h } = await setup();
    expect(h.last("lobby")!.seats).toEqual([{ id: "s1" }, { id: "s2" }, { id: "s3" }]);
  });
});

describe("seat decks: presets and own decks together", () => {
  it("brings a replaced preset back when the holder gives the seat up", async () => {
    const { join, h, assign, setDeck, send } = await setup();
    const a = await join("Ann");
    await setDeck(h, "s1", deck({ name: "Preset" }));
    await assign("s1", a);
    await setDeck(a, "s1", deck({ name: "Mine" }));
    await setDeck(a, "s1", deck({ name: "Mine again" }));
    await send(a, { ch: "room", kind: "seat-release", seat: "s1" });
    expect(h.last("lobby")!.seats[0]).toMatchObject({ deck: { name: "Preset", preset: true } });
    expect(h.last("lobby")!.seats[0]!.holder).toBeUndefined();
    await send(h, { ch: "room", kind: "seat-decks-request" });
    expect(h.last("seat-decks")!.decks).toEqual([{ seat: "s1", preset: true, deck: deck({ name: "Preset" }) }]);
  });

  it("refuses a host preset over the deck a holder chose, and allows it over a preset or an empty seat", async () => {
    const { join, h, assign, setDeck } = await setup();
    const a = await join("Ann");
    await assign("s1", a);
    await setDeck(a, "s1", deck({ name: "Mine" }));
    await setDeck(h, "s1", deck({ name: "Preset" }));
    expect(h.refusals).toEqual(["not-allowed"]);
    expect(h.last("lobby")!.seats[0]!.deck).toMatchObject({ name: "Mine" });
    await assign("s2", a).catch(() => undefined);
    // A held seat with no deck of its own takes a preset.
    await setDeck(h, "s3", deck({ name: "P1" }));
    await setDeck(h, "s3", deck({ name: "P2" }));
    expect(h.last("lobby")!.seats[2]!.deck).toMatchObject({ name: "P2", preset: true });
  });
});

describe("seat decks: a running game", () => {
  it("refuses a different deck while the game is live, and accepts one again once the table has ended", async () => {
    const { join, h, assign, setDeck, send } = await setup();
    const a = await join("Ann");
    await assign("s1", a);
    await setDeck(a, "s1");
    await send(h, { ch: "game", kind: "start", table: "t1", header: { h: 1 } });
    const before = a.last("lobby")!.seats[0]!.deck;
    await setDeck(a, "s1", deck({ name: "Other deck" }));
    await setDeck(h, "s1", deck({ name: "Host preset" }));
    expect(a.refusals).toEqual(["not-allowed"]);
    expect(h.refusals).toEqual(["not-allowed"]);
    expect(h.last("lobby")!.seats[0]!.deck).toEqual(before);
    await send(h, { ch: "game", kind: "end", table: "t1", outcome: {} });
    await setDeck(a, "s1", deck({ name: "Other deck" }));
    expect(a.refusals).toEqual(["not-allowed"]);
    expect(h.last("lobby")!.seats[0]!.deck!.name).toBe("Other deck");
  });
});

describe("seat decks: the room-wide limit", () => {
  it("stops a crowd of fresh participants that each stay under their own limit", async () => {
    const { join, h, assign, setDeck, send } = await setup();
    const results: string[] = [];
    let holders: FakeSocket[] = [];
    // Each round, every seat changes hands to a new participant (a new id, a new personal bucket) who sends 4 decks.
    for (let round = 0; round < 3; round++) {
      for (const [i, old] of holders.entries())
        await send(old, { ch: "room", kind: "seat-release", seat: `s${i + 1}` });
      holders = [];
      for (let i = 0; i < 3; i++) {
        const fresh = await join(`R${round}P${i}`);
        await assign(`s${i + 1}`, fresh);
        holders.push(fresh);
        for (let k = 0; k < 4; k++) await setDeck(fresh, `s${i + 1}`, deck({ name: `${round}-${i}-${k}` }));
        results.push(...fresh.refusals);
      }
    }
    // 36 sent, the room allows a burst of 20 and then one every 2 seconds.
    expect(results.filter((r) => r === "rate-limited").length).toBe(16);
    void h;
  });
});
