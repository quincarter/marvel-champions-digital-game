import { describe, expect, it } from "vitest";
import { parseClientMessage } from "./room-protocol.js";

const parse = (m: object) => parseClientMessage(JSON.stringify({ v: 1, ...m }));

describe("several tables: parsing", () => {
  it("reads tables, pods, mode and seat tables in a lobby-set", () => {
    const m = parse({
      ch: "room",
      kind: "lobby-set",
      settings: { mode: "epic" },
      pods: [{ id: "pa", name: "Pod A" }],
      tables: [{ id: "t1", name: "One", pod: "pa", difficulty: { level: 2 }, host: null }],
      seats: [{ id: "s1", label: "Hero", table: "t1" }],
    });
    expect(m).not.toBeNull();
    expect(parse({ ch: "room", kind: "lobby-set", settings: { mode: "huge" } })).toBeNull();
    expect(parse({ ch: "room", kind: "lobby-set", tables: [{ id: "T 1", name: "x", pod: "pa" }] })).toBeNull();
    expect(parse({ ch: "room", kind: "lobby-set", seats: [{ id: "s1", label: "H", table: "BAD ID" }] })).toBeNull();
  });

  it("reads follow, table tokens and the pod channel", () => {
    expect(parse({ ch: "room", kind: "hello", caps: [], follow: ["t2"], tableTokens: ["x"] })).not.toBeNull();
    expect(parse({ ch: "room", kind: "hello", caps: [], follow: "some" })).toBeNull();
    expect(parse({ ch: "room", kind: "follow", tables: "all" })).not.toBeNull();
    expect(parse({ ch: "room", kind: "follow", tables: [1] })).toBeNull();
    expect(parse({ ch: "pod", kind: "event", table: "t1", seq: 3, event: { a: 1 } })).not.toBeNull();
    expect(parse({ ch: "pod", kind: "inbound", table: "t1", seq: -1, event: 1 })).toBeNull();
    expect(parse({ ch: "pod", kind: "event", table: "t1", seq: 1 })).toBeNull();
    expect(parse({ ch: "pod", kind: "state", state: { loki: 40 } })).not.toBeNull();
    expect(parse({ ch: "pod", kind: "state" })).toBeNull();
  });
});

describe("two teams: parsing", () => {
  it("reads the competitive mode, tie-breaks and a seat's team in a lobby-set", () => {
    expect(
      parse({
        ch: "room",
        kind: "lobby-set",
        settings: { mode: "competitive", tieBreaks: false },
        seats: [{ id: "s1", label: "Iron Man", team: "registration" }],
      }),
    ).not.toBeNull();
    expect(parse({ ch: "room", kind: "lobby-set", settings: { tieBreaks: "yes" } })).toBeNull();
    expect(parse({ ch: "room", kind: "lobby-set", seats: [{ id: "s1", label: "H", team: "villains" }] })).toBeNull();
  });

  it("reads the team messages and caps a sealed scenario's size", () => {
    expect(parse({ ch: "room", kind: "team-set", seat: "s1", team: "resistance" })).not.toBeNull();
    expect(parse({ ch: "room", kind: "team-set", seat: "s1", team: "hydra" })).toBeNull();
    expect(parse({ ch: "room", kind: "team-ready", team: "registration", ready: true })).not.toBeNull();
    expect(parse({ ch: "room", kind: "team-ready", team: "registration" })).toBeNull();
    expect(parse({ ch: "room", kind: "scenario-submit", team: "registration", scenario: { a: 1 } })).not.toBeNull();
    expect(parse({ ch: "room", kind: "scenario-submit", team: "registration" })).toBeNull();
    expect(
      parse({ ch: "room", kind: "scenario-submit", team: "registration", scenario: "x".repeat(41 * 1024) }),
    ).toBeNull();
    expect(parse({ ch: "room", kind: "sealed-reveal" })).not.toBeNull();
  });
});
