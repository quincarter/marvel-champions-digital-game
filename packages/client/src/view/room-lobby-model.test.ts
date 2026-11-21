import { describe, expect, it } from "vitest";
import { NO_ROOM, type RoomSeat, type RoomState } from "../live/room-state.js";
import { t } from "../i18n/translate.js";
import { es } from "../i18n/es.js";
import {
  undoRows,
  cheatsOn,
  CHEATS_NOTE_KEY,
  connectionWords,
  guestModRows,
  hostModRows,
  missingMods,
  participantRows,
  refusalWords,
  deckKeyOf,
  problemOf,
  seatNameOf,
  seatRows,
  startBlock,
  startResultText,
  startResultWords,
  toggleModPatch,
  toggleTableRulePatch,
} from "./room-lobby-model.js";

const settings = {
  playMode: "strict" as const,
  undo: "off" as const,
  cheats: false,
  tableRules: {},
  mods: [],
  multiSeat: false,
  chat: true,
  appVersion: "1",
  contentVersion: "1",
};
const seat = (over: Partial<RoomSeat> = {}): RoomSeat => ({
  id: "s1",
  label: "",
  holder: null,
  holderName: null,
  holderConnected: false,
  mismatch: false,
  mine: false,
  player: null,
  takenOver: false,
  away: false,
  requests: [],
  requestedByMe: false,
  deck: null,
  deckProblem: null,
  ...over,
});
const room = (over: Partial<RoomState> = {}): RoomState => ({
  ...NO_ROOM,
  role: "guest",
  connection: "connected",
  settings,
  seats: [seat()],
  participants: [
    { id: "h", name: "Host", role: "host", me: false, buildMatches: true, seats: [] },
    { id: "g", name: "Guest", role: "watcher", me: true, buildMatches: true, seats: [] },
  ],
  ...over,
});

describe("connectionWords", () => {
  it("is silent while connected and words the problem when ended", () => {
    expect(connectionWords(room())).toBeNull();
    expect(connectionWords(room({ connection: "reconnecting" }))?.key).toBe("room.state.reconnecting");
    expect(connectionWords(room({ connection: "ended", problem: "not-found" }))?.key).toBe("room.problem.notFound");
  });
});

describe("refusalWords", () => {
  it("names the seat", () => {
    const state = room();
    expect(refusalWords({ reason: "seat-taken", seat: "s1", seq: 1 }, state)).toEqual({
      key: "room.refusal.seatTaken",
      params: { seat: "Seat 1" },
    });
    expect(refusalWords({ reason: "build-mismatch", seq: 2 }, state)?.key).toBe("room.refusal.buildMismatch");
    expect(refusalWords(null, state)).toBeNull();
  });
});

describe("participantRows", () => {
  it("marks the host by role and a seat holder as a player", () => {
    const rows = participantRows(
      room({
        participants: [
          { id: "h", name: "Host", role: "host", me: false, buildMatches: true, seats: [] },
          { id: "g", name: "G", role: "watcher", me: true, buildMatches: false, seats: ["s1"] },
          { id: "w", name: "W", role: "watcher", me: false, buildMatches: true, seats: [] },
        ],
      }),
    );
    expect(rows.map((r) => r.role)).toEqual(["host", "player", "watcher"]);
    expect(rows[1]).toMatchObject({ seats: ["Seat 1"], differentVersion: true });
  });
});

describe("seatRows", () => {
  const ctx = { installed: [] };
  it("offers Ask on an open seat, and Leave on mine", () => {
    expect(seatRows(room(), ctx)[0]?.action).toMatchObject({ kind: "ask", enabled: true });
    const mine = seatRows(room({ seats: [seat({ holder: "g", holderName: "Guest", mine: true })] }), ctx)[0];
    expect(mine?.action?.kind).toBe("leave");
  });
  it("turns Ask off with the reason", () => {
    expect(seatRows(room({ buildMatches: false }), ctx)[0]?.action).toMatchObject({
      enabled: false,
      reason: "room.seat.differentVersion",
    });
    expect(seatRows(room({ mySeats: ["s2"] }), ctx)[0]?.action?.reason).toBe("room.seat.oneEach");
    const multi = room({ mySeats: ["s2"], settings: { ...settings, multiSeat: true } });
    expect(seatRows(multi, ctx)[0]?.action?.enabled).toBe(true);
    const mods = room({ settings: { ...settings, mods: [{ id: "x", version: "1" }] } });
    expect(seatRows(mods, ctx)[0]?.action?.reason).toBe("room.seat.needsMods");
  });
  it("shows requests to the host only, with approve off for a different version", () => {
    const requested = [seat({ requests: [{ participant: "g", name: "Guest" }] })];
    expect(seatRows(room({ seats: requested }), ctx)[0]?.requests).toEqual([]);
    const host = room({
      role: "host",
      seats: requested,
      participants: [{ id: "g", name: "Guest", role: "watcher", me: false, buildMatches: false, seats: [] }],
    });
    expect(seatRows(host, ctx)[0]?.requests[0]).toMatchObject({ approvable: false, reason: "room.seat.theirVersion" });
    expect(seatRows(host, ctx)[0]?.action?.kind).toBe("take");
  });
});

const deck = (over: Partial<NonNullable<RoomSeat["deck"]>> = {}): NonNullable<RoomSeat["deck"]> => ({
  hero: "01001a",
  heroName: "Spider-Man",
  aspects: ["justice"],
  name: "Webs",
  cards: 40,
  mods: [],
  ...over,
});

describe("seat decks", () => {
  const ctx = { installed: [] };
  it("names an open seat by its number, or by the host's label", () => {
    expect(seatRows(room(), ctx)[0]?.name).toBe("Seat 1");
    expect(seatNameOf({ id: "s3", label: "" }, 2)).toBe("Seat 3");
    expect(seatNameOf({ id: "s3", label: "Tank" }, 2)).toBe("Tank");
    expect(seatRows(room(), ctx)[0]?.deck).toBeNull();
  });
  it("shows the hero, aspect, deck name and card count, and says when the host preset it", () => {
    const rows = seatRows(
      room({ seats: [seat({ deck: deck({ aspects: ["leadership", "protection"], preset: true }) })] }),
      ctx,
    );
    expect(rows[0]?.deck).toEqual({
      cardId: "01001a",
      heroName: "Spider-Man",
      aspects: "Leadership + Protection",
      name: "Webs",
      cards: 40,
      preset: true,
      mods: [],
    });
  });
  it("offers Choose your deck on my seat, Change deck once it has one, and Set deck to the host on the others", () => {
    const mine = room({ seats: [seat({ holder: "g", holderName: "Guest", mine: true })] });
    expect(seatRows(mine, ctx)[0]?.deckButton).toMatchObject({ kind: "choose", labelKey: "room.deck.choose" });
    const withDeck = room({ seats: [seat({ holder: "g", holderName: "Guest", mine: true, deck: deck() })] });
    expect(seatRows(withDeck, ctx)[0]?.deckButton?.labelKey).toBe("room.deck.change");
    expect(seatRows(room(), ctx)[0]?.deckButton).toBeNull();
    const host = room({ role: "host", seats: [seat()] });
    expect(seatRows(host, ctx)[0]?.deckButton).toMatchObject({ kind: "preset", labelKey: "room.deck.set" });
    const hostMine = room({ role: "host", seats: [seat({ holder: "h", mine: true })] });
    expect(seatRows(hostMine, ctx)[0]?.deckButton?.kind).toBe("choose");
  });
  it("turns the deck button off with the reason while disconnected or on another build", () => {
    const mine = [seat({ holder: "g", holderName: "Guest", mine: true })];
    expect(seatRows(room({ seats: mine, connection: "reconnecting" }), ctx)[0]?.deckButton).toMatchObject({
      enabled: false,
      reason: "room.seat.notConnected",
    });
    expect(seatRows(room({ seats: mine, buildMatches: false }), ctx)[0]?.deckButton?.reason).toBe(
      "room.seat.differentVersion",
    );
  });
  it("words my seat's deck problem with the engine's reason as the detail", () => {
    const state = room({
      seats: [
        seat({ holder: "g", mine: true, deck: deck(), deckProblem: { code: "illegal", reason: "Too few cards." } }),
      ],
    });
    expect(seatRows(state, ctx)[0]?.problem).toEqual({
      titleKey: "room.deckProblem.illegal",
      reason: "Too few cards.",
      code: "illegal",
    });
    expect(seatRows(room(), ctx)[0]?.problem).toBeNull();
  });
  it("shows the host a refusal of its own seat until that seat's deck changes", () => {
    const state = room({ role: "host", seats: [seat({ holder: "h", mine: true, deck: deck() })] });
    const refused = [{ seat: "s1", code: "mod-missing" as const, reason: "No fan-pack.", deckKey: deckKeyOf(deck()) }];
    expect(seatRows(state, { installed: [], refused })[0]?.problem?.titleKey).toBe("room.deckProblem.modMissing");
    const changed = room({ role: "host", seats: [seat({ holder: "h", mine: true, deck: deck({ name: "Other" }) })] });
    expect(seatRows(changed, { installed: [], refused })[0]?.problem).toBeNull();
  });
  it("names the mods my seat's deck needs that this device lacks", () => {
    const mods = [
      { id: "fan-pack", version: "1.2.0" },
      { id: "have", version: "1" },
    ];
    const state = room({ seats: [seat({ holder: "g", mine: true, deck: deck({ mods }) })] });
    expect(seatRows(state, { installed: [{ id: "have", version: "1" }] })[0]?.missingMods).toEqual([mods[0]]);
    const theirs = room({ seats: [seat({ holder: "x", deck: deck({ mods }) })] });
    expect(seatRows(theirs, { installed: [] })[0]?.missingMods).toEqual([]);
  });
  it("words every problem code", () => {
    for (const code of [
      "no-deck",
      "illegal",
      "unknown-card",
      "mod-missing",
      "mod-version",
      "mod-not-allowed",
    ] as const) {
      expect(problemOf(code, "x").titleKey).toMatch(/^room\.deckProblem\./);
    }
  });
});

describe("what Start said", () => {
  const state = room({
    role: "host",
    seats: [seat({ id: "s1", holder: "h", holderName: "Mara" }), seat({ id: "s2", holder: "g", holderName: "Ava" })],
  });
  it("says nothing on success and words each stop", () => {
    expect(startResultWords({ ok: true }, state)).toBeNull();
    expect(startResultWords({ ok: false, reason: "no-answer" }, state)?.headline.key).toBe("room.startResult.noAnswer");
    expect(startResultWords({ ok: false, reason: "check-failed" }, state)?.headline.key).toBe(
      "room.startResult.checkFailed",
    );
    expect(startResultWords({ ok: false, reason: "not-host" }, state)?.headline.key).toBe("room.start.hostOnly");
    expect(startResultWords({ ok: false, reason: "no-seats" }, state)?.headline.key).toBe("room.start.noTable");
    expect(startResultWords({ ok: false, reason: "unfilled", seats: ["s1", "s2"] }, state)?.headline).toEqual({
      key: "room.startResult.unfilled",
      params: { seats: "Seat 1, Seat 2" },
    });
    expect(startResultWords({ ok: false, reason: "start-failed", error: "boom" }, state)?.headline.params).toEqual({
      error: "boom",
    });
  });
  it("lists which seats were refused, whose they are and why", () => {
    const view = startResultWords(
      {
        ok: false,
        reason: "decks",
        refused: [
          { seat: "s1", code: "no-deck", reason: "Seat 1 has no deck." },
          { seat: "s2", code: "illegal", reason: "Too few cards." },
        ],
      },
      state,
    );
    expect(view?.headline).toEqual({ key: "room.startResult.decks", params: { count: 2 } });
    expect(view?.lines).toEqual([
      { seat: "Seat 1", holder: "Mara", title: "No deck chosen", reason: "Seat 1 has no deck." },
      { seat: "Seat 2", holder: "Ava", title: "The deck is not legal", reason: "Too few cards." },
    ]);
    const text = startResultText(view!);
    expect(text).toContain("2 decks were turned down");
    expect(text).toContain("Seat 2 (Ava): The deck is not legal. Too few cards.");
  });
});

describe("giving a seat", () => {
  it("lists who the host could give an open seat to", () => {
    const host = room({
      role: "host",
      participants: [
        { id: "h", name: "Host", role: "host", me: true, buildMatches: true, seats: [] },
        { id: "a", name: "A", role: "watcher", me: false, buildMatches: true, seats: [] },
        { id: "b", name: "B", role: "watcher", me: false, buildMatches: true, seats: ["s9"] },
        { id: "c", name: "C", role: "watcher", me: false, buildMatches: false, seats: [] },
      ],
    });
    expect(seatRows(host, { installed: [] })[0]?.candidates.map((p) => p.id)).toEqual(["a"]);
    const multi = { ...host, settings: { ...settings, multiSeat: true } };
    expect(seatRows(multi, { installed: [] })[0]?.candidates.map((p) => p.id)).toEqual(["a", "b"]);
    expect(seatRows(room(), { installed: [] })[0]?.candidates).toEqual([]);
  });
});

describe("devices in words", () => {
  it("says platform and form on each person and seat holder, and nothing for an older client", () => {
    const state = room({
      participants: [
        {
          id: "a",
          name: "A",
          role: "watcher",
          me: false,
          buildMatches: true,
          seats: ["s1"],
          device: { platform: "android", form: "phone" },
        },
        { id: "b", name: "B", role: "watcher", me: false, buildMatches: true, seats: [] },
      ],
      seats: [seat({ holder: "a", holderName: "A", holderConnected: true })],
    });
    expect(participantRows(state).map((p) => p.device)).toEqual(["Android · phone", null]);
    expect(participantRows(state)[0]?.platform).toBe("android");
    expect(seatRows(state, { installed: [] })[0]?.holderDevice).toBe("Android · phone");
  });
});

describe("startBlock", () => {
  const ready = { tableReady: true, packsUsed: [] };
  const held = seat({ holder: "g", holderName: "Guest", holderConnected: true });
  it("needs a table, held seats, matching builds and allowed mods", () => {
    const host = room({ role: "host", seats: [held] });
    expect(startBlock(host, ready)).toBeNull();
    expect(startBlock(host, { ...ready, tableReady: false })?.key).toBe("room.start.noTable");
    expect(startBlock(room({ role: "host", seats: [seat()] }), ready)).toEqual({
      key: "room.start.openSeats",
      params: { count: 1 },
    });
    expect(startBlock(room({ role: "host", seats: [{ ...held, mismatch: true }] }), ready)?.key).toBe(
      "room.start.versionMismatch",
    );
    expect(startBlock(room({ role: "host", seats: [{ ...held, holderConnected: false }] }), ready)?.key).toBe(
      "room.start.holderAway",
    );
    expect(startBlock(host, { ...ready, packsUsed: [{ id: "p", version: "1" }] })?.key).toBe(
      "room.start.modNotAllowed",
    );
    expect(startBlock(room({ seats: [held] }), ready)?.key).toBe("room.start.hostOnly");
  });
});

describe("host controls", () => {
  it("toggles a table rule and a mod", () => {
    expect(toggleTableRulePatch(settings, "sameNameHeroAllyConflict")).toEqual({
      tableRules: { sameNameHeroAllyConflict: true },
    });
    const on = { ...settings, tableRules: { sameNameHeroAllyConflict: true } };
    expect(toggleTableRulePatch(on, "sameNameHeroAllyConflict")).toEqual({ tableRules: {} });
    expect(toggleModPatch(settings, { id: "m", version: "2" })).toEqual({ mods: [{ id: "m", version: "2" }] });
    expect(toggleModPatch({ ...settings, mods: [{ id: "m", version: "2" }] }, { id: "m", version: "2" })).toEqual({
      mods: [],
    });
  });
  it("allows a pack only at the version the host allowed", () => {
    const held = seat({ holder: "g", holderName: "Guest", holderConnected: true });
    const ready = { tableReady: true, packsUsed: [] };
    const withMod = room({ role: "host", seats: [held], settings: { ...settings, mods: [{ id: "p", version: "1" }] } });
    expect(startBlock(withMod, { ...ready, packsUsed: [{ id: "p", version: "1" }] })).toBeNull();
    expect(startBlock(withMod, { ...ready, packsUsed: [{ id: "p", version: "2" }] })?.key).toBe(
      "room.start.modNotAllowed",
    );
    expect(hostModRows(withMod.settings, [{ id: "p", version: "2", name: "P" }])[0]?.allowed).toBe(false);
    expect(toggleModPatch(withMod.settings!, { id: "p", version: "2" })).toEqual({ mods: [{ id: "p", version: "2" }] });
  });
  it("finds the mods a guest lacks, at the same version", () => {
    const allowed = [{ id: "m", version: "2" }];
    expect(missingMods(allowed, [{ id: "m", version: "1" }])).toEqual(allowed);
    expect(missingMods(allowed, [{ id: "m", version: "2" }])).toEqual([]);
    expect(guestModRows({ ...settings, mods: allowed }, [])[0]?.have).toBe(false);
  });
});

describe("a host preset over a deck its holder chose", () => {
  it("is turned off with 'take the seat back first'", () => {
    const own = deck();
    const state = room({ role: "host", seats: [seat({ holder: "g", holderName: "Guest", deck: own })] });
    expect(seatRows(state, { installed: [] })[0]?.deckButton).toMatchObject({
      kind: "preset",
      enabled: false,
      reason: "room.deck.takeBackFirst",
    });
    const preset = room({ role: "host", seats: [seat({ holder: "g", deck: deck({ preset: true }) })] });
    expect(seatRows(preset, { installed: [] })[0]?.deckButton?.enabled).toBe(true);
    expect(refusalWords({ reason: "not-allowed", seat: "s1", seq: 1 }, state)?.key).toBe("room.deck.takeBackFirst");
  });
});

describe("the Undo and Cheats rows", () => {
  it("Strict offers only Off; Host control offers Off, Host only and Ask, Ask selected by default", () => {
    expect(undoRows(settings).map((r) => [r.value, r.selected])).toEqual([["off", true]]);
    const host = { ...settings, playMode: "host" as const, undo: "ask" as const };
    expect(undoRows(host).map((r) => [r.value, r.selected])).toEqual([
      ["off", false],
      ["host", false],
      ["ask", true],
    ]);
    expect(undoRows({ ...host, undo: "host" }).find((r) => r.selected)?.value).toBe("host");
    expect(undoRows({ ...settings, undo: "ask" }).find((r) => r.selected)?.value).toBe("off");
  });

  it("explains each choice in one line, in English and Spanish", () => {
    expect(t("room.undo.hostDetail")).toBe("The host may Undo or Back out; guests cannot ask.");
    expect(es["room.undo.askDetail"]).toContain("invitados");
    expect(t(CHEATS_NOTE_KEY)).toBe("No one earns points, achievements or stats from a game with cheats on.");
    expect(es[CHEATS_NOTE_KEY]).toContain("Nadie gana");
    expect(cheatsOn(settings)).toBe(false);
    expect(cheatsOn({ ...settings, cheats: true })).toBe(true);
  });
});
