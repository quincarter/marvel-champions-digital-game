import { describe, expect, it } from "vitest";
import {
  HERO_UNSET,
  groupOptionLabel,
  isGroupChoice,
  epicStartBlock,
  epicTableViews,
  minutesText,
  newEpicPlan,
  nextTimeLimit,
  planOf,
  statusKey,
  withNextDifficulty,
  withNextPod,
  withSeatCount,
  withSeatHero,
  withTableCount,
  withTableName,
} from "./epic-lobby-model.js";
import { epicRoomFixture } from "./epic-room-fixture.js";

describe("the organizer's plan", () => {
  it("starts with two tables in one pod, one open seat each", () => {
    const plan = newEpicPlan();
    expect(plan.tables.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(plan.pods).toHaveLength(1);
    expect(plan.seats.map((s) => [s.id, s.table, s.label])).toEqual([
      ["t1s1", "t1", HERO_UNSET],
      ["t2s1", "t2", HERO_UNSET],
    ]);
  });

  it("keeps the table count between 2 and 8 and drops a removed table's seats", () => {
    const six = withTableCount(newEpicPlan(), 6);
    expect(six.tables).toHaveLength(6);
    expect(six.seats).toHaveLength(6);
    expect(withTableCount(six, 99).tables).toHaveLength(8);
    expect(withTableCount(six, 0).tables).toHaveLength(2);
    const back = withTableCount(six, 3);
    expect(back.seats.map((s) => s.table)).toEqual(["t1", "t2", "t3"]);
  });

  it("names a table (trimmed, capped; blank keeps the old name)", () => {
    const plan = newEpicPlan();
    expect(withTableName(plan, "t1", "  North  ").tables[0]?.name).toBe("North");
    expect(withTableName(plan, "t1", "   ")).toBe(plan);
    expect(withTableName(plan, "t1", "x".repeat(90)).tables[0]?.name).toHaveLength(40);
  });

  it("flips a table's difficulty on its own", () => {
    const plan = withNextDifficulty(newEpicPlan(), "t2");
    expect(plan.tables.map((t) => t.difficulty)).toEqual(["standard", "expert"]);
    expect(withNextDifficulty(plan, "t2").tables[1]?.difficulty).toBe("standard");
  });

  it("moves a table through the other tables' pods, then a pod of its own, then back", () => {
    let plan = withTableCount(newEpicPlan(), 3);
    expect(new Set(plan.tables.map((t) => t.pod)).size).toBe(1);
    plan = withNextPod(plan, "t3");
    expect(plan.tables.map((t) => t.pod)).toEqual(["p1", "p1", "p2"]);
    expect(plan.pods.map((p) => p.id)).toEqual(["p1", "p2"]);
    plan = withNextPod(plan, "t3");
    expect(plan.tables[2]?.pod).toBe("p1");
    expect(plan.pods).toHaveLength(1);
  });

  it("a table alone in its pod joins the other tables' pod next", () => {
    const plan = newEpicPlan();
    const lone = {
      ...plan,
      tables: plan.tables.map((t, i) => (i === 0 ? t : { ...t, pod: "p2" })),
      pods: [
        { id: "p1", name: "Pod 1" },
        { id: "p2", name: "Pod 2" },
      ],
    };
    expect(withNextPod(lone, "t1").tables.map((t) => t.pod)).toEqual(["p2", "p2"]);
    expect(withNextPod(newEpicPlan(), "t1").tables.map((t) => t.pod)).toEqual(["p2", "p1"]);
  });

  it("gives a table 1 to 4 seats, in table order, with new seats open", () => {
    let plan = withTableCount(newEpicPlan(), 3);
    plan = withSeatCount(plan, "t1", 3);
    expect(plan.seats.filter((s) => s.table === "t1").map((s) => s.id)).toEqual(["t1s1", "t1s2", "t1s3"]);
    expect(plan.seats.map((s) => s.table)).toEqual(["t1", "t1", "t1", "t2", "t3"]);
    expect(withSeatCount(plan, "t1", 9).seats.filter((s) => s.table === "t1")).toHaveLength(4);
    expect(withSeatCount(plan, "t1", 0).seats.filter((s) => s.table === "t1")).toHaveLength(1);
  });

  it("sets a seat's hero label", () => {
    const plan = withSeatHero(newEpicPlan(), "t2s1", "Spider-Man|01001a");
    expect(plan.seats[1]?.label).toBe("Spider-Man|01001a");
    expect(plan.seats[0]?.label).toBe(HERO_UNSET);
  });

  it("reads the plan back from the room without the tables' hosts", () => {
    const plan = planOf(epicRoomFixture({ as: "organizer", phase: "lobby" }));
    expect(plan?.tables.map((t) => [t.id, t.difficulty])).toEqual([
      ["t1", "standard"],
      ["t2", "standard"],
      ["t3", "expert"],
    ]);
    expect(plan?.tables.every((t) => !("host" in t))).toBe(true);
    expect(plan?.seats.filter((s) => s.table === "t3")).toHaveLength(2);
  });
});

describe("the time limit choices", () => {
  it("cycle through none and a few hours, and read in hours and minutes", () => {
    expect(nextTimeLimit(null)).toBe(60);
    expect(nextTimeLimit(180)).toBe(240);
    expect(nextTimeLimit(240)).toBeNull();
    expect(nextTimeLimit(77)).toBeNull();
    expect([minutesText(45), minutesText(90), minutesText(120)]).toEqual(["45 min", "1 h 30 min", "2 h"]);
  });
});

describe("why Start is off", () => {
  const ctx = { missingDecks: [] as string[] };
  const organizer = () => epicRoomFixture({ as: "organizer", phase: "lobby" });

  it("is organizer only", () => {
    expect(epicStartBlock(epicRoomFixture({ as: "player", phase: "lobby" }), ctx)?.key).toBe("room.start.hostOnly");
  });

  it("names the first problem in order: open seats, then a host, then the host's deck", () => {
    const room = organizer();
    expect(epicStartBlock(room, ctx)).toEqual({ key: "room.start.openSeats", params: { count: 2 } });
    const seated = {
      ...room,
      seats: room.seats.map((s) =>
        s.holder === null ? { ...s, holder: "u4", holderName: "Dev", holderConnected: true } : s,
      ),
    };
    expect(epicStartBlock(seated, ctx)).toBeNull();
    const noHost = {
      ...seated,
      epic: {
        ...seated.epic!,
        tables: seated.epic!.tables.map((t) => (t.id === "t2" ? { ...t, host: null, hostName: null } : t)),
      },
    };
    expect(epicStartBlock(noHost, ctx)).toEqual({ key: "epic.start.noHost", params: { table: "South Table" } });
    expect(epicStartBlock(seated, { missingDecks: ["Iron Man"] })?.key).toBe("epic.start.noDeck");
  });

  it("wants a hero on every seat and refuses while its host is away", () => {
    const room = organizer();
    const unset = { ...room, seats: room.seats.map((s) => (s.id === "t2s1" ? { ...s, label: HERO_UNSET } : s)) };
    expect(epicStartBlock(unset, ctx)).toEqual({ key: "epic.start.heroNotSet", params: { table: "South Table" } });
    const seated = {
      ...room,
      seats: room.seats.map((s) =>
        s.holder === null ? { ...s, holder: "u4", holderName: "Dev", holderConnected: true } : s,
      ),
    };
    const away = {
      ...seated,
      epic: {
        ...seated.epic!,
        tables: seated.epic!.tables.map((t) => (t.id === "t1" ? { ...t, hostConnected: false } : t)),
      },
    };
    expect(epicStartBlock(away, ctx)?.key).toBe("epic.start.hostAway");
  });

  it("says started once the organizer has started", () => {
    const playing = epicRoomFixture({ as: "organizer", phase: "playing" });
    expect(epicStartBlock(playing, ctx)?.key).toBe("room.start.started");
  });
});

describe("the table cards", () => {
  it("lists each table's seats and who may host it, the organizer included once", () => {
    const views = epicTableViews(epicRoomFixture({ as: "organizer", phase: "lobby" }), { installed: [] });
    expect(views.map((v) => [v.name, v.seatCount, v.podName])).toEqual([
      ["North Table", 2, "Pod 1"],
      ["South Table", 1, "Pod 1"],
      ["Harbour Table", 2, "Pod 2"],
    ]);
    expect(views[0]?.hostChoices.map((c) => c.name)).toEqual(["Ava", "Ben", "Mara"]);
    expect(views[0]?.seats.map((s) => s.holderName)).toEqual(["Ava", "Ben"]);
    expect(views[2]?.canAddSeat).toBe(true);
  });

  it("has every status in words", () => {
    for (const status of ["lobby", "setup", "player", "villain", "halted", "waiting", "dropped", "over"] as const) {
      expect(statusKey(status)).toBe(`epic.status.${status}`);
    }
  });
});

describe("a group choice", () => {
  it("is recognised when every option is a table of the game, and labelled by table name", () => {
    const epic = epicRoomFixture({ as: "player", phase: "playing" }).epic!;
    expect(isGroupChoice(epic, ["t1", "t2"])).toBe(true);
    expect(isGroupChoice(epic, ["t1", "yes"])).toBe(false);
    expect(isGroupChoice(epic, ["t1"])).toBe(false);
    expect(isGroupChoice(null, ["t1", "t2"])).toBe(false);
    expect(groupOptionLabel(epic, "t2")).toBe("South Table");
  });
});
