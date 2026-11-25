import { describe, expect, it } from "vitest";
import {
  competitiveStartBlock,
  expertOn,
  expertPatch,
  newCompetitivePlan,
  perTeamOf,
  planOf,
  speakingFor,
  teamViews,
  tieBreaksOn,
  withTeamSize,
} from "./competitive-lobby-model.js";
import { NO_ROOM, type RoomSeat, type RoomState } from "../live/room-state.js";

const seat = (id: string, team: "registration" | "resistance", over: Partial<RoomSeat> = {}): RoomSeat =>
  ({
    id,
    label: "",
    deck: { hero: "01029a", heroName: "Iron Man", aspects: ["Justice"], name: "My deck", cards: 40, mods: [] },
    deckProblem: null,
    holder: "u" + id,
    holderName: "Player " + id,
    holderConnected: true,
    mismatch: false,
    mine: false,
    player: null,
    takenOver: false,
    away: false,
    requests: [],
    requestedByMe: false,
    team,
    ...over,
  }) as RoomSeat;

const room = (over: Partial<RoomState> = {}, competitive: Partial<NonNullable<RoomState["competitive"]>> = {}) =>
  ({
    ...NO_ROOM,
    role: "host",
    connection: "connected",
    mode: "competitive",
    seats: [seat("s1", "registration", { mine: true }), seat("s2", "resistance")],
    mySeats: ["s1"],
    competitive: {
      myTeam: "registration",
      teams: {
        registration: { team: "registration", seats: ["s1"], submitted: false, ready: false },
        resistance: { team: "resistance", seats: ["s2"], submitted: false, ready: false },
      },
      tieBreaks: true,
      sized: true,
      canStart: false,
      ...competitive,
    },
    ...over,
  }) as RoomState;

describe("the plan", () => {
  it("starts as registration then resistance, one or two seats each", () => {
    expect(newCompetitivePlan(1).map((s) => [s.id, s.team])).toEqual([
      ["s1", "registration"],
      ["s2", "resistance"],
    ]);
    expect(newCompetitivePlan(2).map((s) => s.team)).toEqual([
      "registration",
      "registration",
      "resistance",
      "resistance",
    ]);
  });

  it("keeps each side's seat labels when the size changes", () => {
    const plan = newCompetitivePlan(1).map((s) => (s.id === "s2" ? { ...s, label: "Cap" } : s));
    const bigger = withTeamSize(plan, 2);
    expect(perTeamOf(bigger)).toBe(2);
    expect(bigger.find((s) => s.team === "resistance")!.label).toBe("Cap");
    expect(withTeamSize(bigger, 1)).toHaveLength(2);
  });

  it("reads the room's seats back", () => {
    expect(planOf(room()).map((s) => s.team)).toEqual(["registration", "resistance"]);
  });

  it("shows each seat's hero from its own deck, and asks for a deck before a side can be readied", () => {
    const sealed = {
      registration: { team: "registration" as const, seats: ["s1"], submitted: true, ready: false },
      resistance: { team: "resistance" as const, seats: ["s2"], submitted: true, ready: false },
    };
    const views = teamViews(room({}, { teams: sealed }), "registration");
    expect(views[0]!.seats[0]).toMatchObject({ hero: "Iron Man", cardId: "01029a" });
    expect(views[0]!.readyBlock).toBeNull();
    const noDeck = room(
      { seats: [seat("s1", "registration", { mine: true, deck: null }), seat("s2", "resistance")] },
      { teams: sealed },
    );
    const [first] = teamViews(noDeck, "registration");
    expect(first!.seats[0]!.hero).toBeNull();
    expect(first!.readyBlock).toBe("comp.block.deckFirst");
  });
});

describe("teamViews", () => {
  it("lets a side's own players build and ready it, once it is sealed", () => {
    const [mine, theirs] = teamViews(room(), speakingFor(room()));
    expect(mine!.mine).toBe(true);
    expect(mine!.buildBlock).toBeNull();
    expect(mine!.readyBlock).toBe("comp.block.sealFirst");
    expect(theirs!.mine).toBe(false);
    expect(theirs!.buildBlock).toBe("comp.block.notYourSide");
  });

  it("carries only submitted and ready for the other side, never contents", () => {
    const views = teamViews(
      room(
        {},
        {
          teams: {
            registration: { team: "registration", seats: ["s1"], submitted: true, ready: true },
            resistance: { team: "resistance", seats: ["s2"], submitted: true, ready: false },
          },
        },
      ),
      "registration",
    );
    expect(Object.keys(views[1]!).sort()).toEqual(
      ["buildBlock", "nameKey", "ready", "readyBlock", "mine", "seats", "submitted", "team"].sort(),
    );
    expect(views[1]!.submitted).toBe(true);
  });

  it("a host with no seat speaks for the team it picked", () => {
    const hostless = room({ mySeats: [] }, { myTeam: null });
    expect(speakingFor(hostless)).toBeNull();
    expect(speakingFor(hostless, "resistance")).toBe("resistance");
    expect(speakingFor({ ...hostless, role: "guest" } as RoomState, "resistance")).toBeNull();
  });
});

describe("options", () => {
  it("tie-breaks default on and expert default off, toggled through the table rules", () => {
    expect(tieBreaksOn(room())).toBe(true);
    expect(tieBreaksOn(room({}, { tieBreaks: false }))).toBe(false);
    expect(expertOn(room())).toBe(false);
    const patch = expertPatch(room());
    expect(patch.tableRules).toEqual({ competitiveExpert: true });
    const on = room({ settings: { tableRules: patch.tableRules } as never });
    expect(expertOn(on)).toBe(true);
    expect(expertPatch(on).tableRules).toEqual({});
  });
});

describe("competitiveStartBlock", () => {
  it("walks the reasons in order", () => {
    expect(competitiveStartBlock(room({ role: "guest" }))!.key).toBe("room.start.hostOnly");
    expect(competitiveStartBlock(room({}, { sized: false }))!.key).toBe("comp.start.sizes");
    expect(
      competitiveStartBlock(room({ seats: [seat("s1", "registration", { deck: null }), seat("s2", "resistance")] }))!
        .key,
    ).toBe("comp.start.noDeck");
    expect(competitiveStartBlock(room())).toMatchObject({
      key: "comp.start.notSealed",
      params: { side: "Registration" },
    });
    const sealed = {
      registration: { team: "registration" as const, seats: ["s1"], submitted: true, ready: true },
      resistance: { team: "resistance" as const, seats: ["s2"], submitted: true, ready: false },
    };
    expect(competitiveStartBlock(room({}, { teams: sealed }))).toMatchObject({
      key: "comp.start.notReady",
      params: { side: "Resistance" },
    });
    const both = { ...sealed, resistance: { ...sealed.resistance, ready: true } };
    expect(competitiveStartBlock(room({}, { teams: both, canStart: true }))).toBeNull();
  });
});
