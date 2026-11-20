import { describe, expect, it } from "vitest";
import { epicRoomFixture } from "./epic-room-fixture.js";
import { justFlipped, podStripHeight, podStripOf, tableLines, timeLine, type PodStripInput } from "./pod-strip.js";

const nameOf = (id: string): string => (id === "55041" ? "The Mangog" : id);
const input = (over: Partial<PodStripInput> & { room: ReturnType<typeof epicRoomFixture> }): PodStripInput => ({
  epic: over.room.epic!,
  game: over.game ?? null,
  now: over.now ?? Date.now(),
  flipBanner: over.flipBanner ?? false,
  nameOf,
});
const texts = (strip: ReturnType<typeof podStripOf>) => strip?.lines.map((l) => l.text) ?? [];

describe("the pod strip", () => {
  it("is absent before the game starts", () => {
    const room = epicRoomFixture({ as: "player", phase: "lobby" });
    expect(podStripOf(input({ room }), 60)).toBeNull();
  });

  it("shows Loki's hit points, the scheme and every table with its round and status in words", () => {
    const room = epicRoomFixture({ as: "player", phase: "playing" });
    const strip = podStripOf(input({ room }), 80)!;
    expect(strip.lines[0]).toMatchObject({ kind: "shared", tone: "plain" });
    expect(strip.lines[0]?.text.startsWith("Loki, God of Lies 39/50 HP · Worlds Collide 3/6 · ")).toBe(true);
    expect(strip.lines[0]?.text.endsWith(" left")).toBe(true);
    expect(strip.flipped).toBe(false);
    const tables = strip.lines.filter((l) => l.kind === "tables").map((l) => l.text);
    expect(tables.join(" | ")).toContain("You: North Table · R3 · player phase");
    expect(tables.join(" | ")).toContain("South Table · R4 · villain phase");
  });

  it("says a halted, waiting or dropped table in words", () => {
    const room = epicRoomFixture({ as: "watcher", phase: "playing", hostAway: true });
    const lines = tableLines(room.epic!.tables, null, 200);
    expect(lines.join(" ")).toContain("Harbour Table · R2 · waiting for its host");
    const halted = room.epic!.tables.map((t) => ({ ...t, status: "halted" as const }));
    expect(tableLines(halted, null, 200).join(" ")).toContain("halted");
    const dropped = room.epic!.tables.map((t) => ({ ...t, status: "dropped" as const }));
    expect(tableLines(dropped, null, 200).join(" ")).toContain("North Table · dropped");
  });

  it("wraps the tables to the character budget without splitting one", () => {
    const room = epicRoomFixture({ as: "watcher", phase: "playing" });
    const lines = tableLines(room.epic!.tables, null, 40);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(60);
    expect(lines.join(" ")).toContain("Harbour Table");
  });

  it("marks the flip in the numbers and, for a few seconds, in a banner", () => {
    const room = epicRoomFixture({ as: "player", phase: "playing", flipped: true });
    const strip = podStripOf(input({ room, flipBanner: true }), 80)!;
    expect(strip.flipped).toBe(true);
    expect(strip.lines[0]?.text).toContain("FLIPPED");
    expect(strip.lines.find((l) => l.kind === "banner")?.tone).toBe("alert");
    expect(justFlipped(false, true)).toBe(true);
    expect(justFlipped(null, true)).toBe(false);
    expect(justFlipped(true, true)).toBe(false);
  });

  it("shows 'waiting for the pod' from the group's own state, and stopped when halted", () => {
    const room = epicRoomFixture({ as: "player", phase: "playing" });
    const waiting = podStripOf(input({ room, game: { pod: { awaiting: 4 } } as never }), 80)!;
    expect(waiting.lines.find((l) => l.kind === "wait")?.text).toMatch(/Waiting for the pod/);
    const halted = podStripOf(input({ room, game: { pod: { halted: true } } as never }), 80)!;
    expect(halted.lines.find((l) => l.kind === "wait")?.text).toMatch(/stopped/);
    expect(podStripOf(input({ room, game: { pod: {} } as never }), 80)!.lines.some((l) => l.kind === "wait")).toBe(
      false,
    );
  });

  it("lists what my pod can reach, with the card's name and where it is", () => {
    const room = epicRoomFixture({ as: "player", phase: "playing", mangog: true });
    const strip = podStripOf(input({ room }), 80)!;
    expect(strip.targets).toBe(1);
    expect(texts(strip).join("\n")).toContain("The Mangog (12) at South Table");
  });

  it("says who won or lost for everyone", () => {
    const room = epicRoomFixture({ as: "player", phase: "playing" });
    const won = { ...room.epic!, pod: { ...room.epic!.pod!, outcome: "won" as const } };
    expect(texts(podStripOf({ ...input({ room }), epic: won }, 80))).toContain("Loki is defeated: all groups win.");
    const lost = { ...room.epic!, pod: { ...room.epic!.pod!, outcome: "lost" as const } };
    expect(texts(podStripOf({ ...input({ room }), epic: lost }, 80))).toContain(
      "Worlds Collide wins: all groups lose.",
    );
  });

  it("measures its height from its lines", () => {
    const room = epicRoomFixture({ as: "player", phase: "playing" });
    const strip = podStripOf(input({ room }), 80)!;
    expect(podStripHeight(strip, 18)).toBe(strip.lines.length * 18 + 10);
    expect(podStripHeight(strip, 18, 44)).toBe(44 + (strip.lines.length - 1) * 18 + 10);
    expect(podStripHeight(null, 18)).toBe(0);
  });
});

describe("the time limit clock", () => {
  const base = { timeLimitMinutes: 180, start: { id: "x", seed: 1, at: 1_000_000 } };
  it("counts down from the organizer's start and runs out without ending anything", () => {
    expect(timeLine(base, 1_000_000 + 38 * 60_000)).toBe("2 h 22 min left");
    expect(timeLine(base, 1_000_000 + 180 * 60_000)).toBe("Time limit passed (nothing ends)");
  });
  it("shows just the limit when the start has no clock, and nothing with no limit", () => {
    expect(timeLine({ timeLimitMinutes: 120, start: { id: "x", seed: 1 } }, 5)).toBe("Time limit 2 h");
    expect(timeLine({ timeLimitMinutes: null, start: null }, 5)).toBeNull();
  });
});

describe("wrapping a long line", () => {
  it("splits at spaces to the budget and keeps the line's kind and tone", () => {
    const room = epicRoomFixture({ as: "player", phase: "playing", flipped: true });
    const strip = podStripOf(input({ room, flipBanner: true }), 30)!;
    const banner = strip.lines.filter((l) => l.kind === "banner");
    expect(banner.length).toBeGreaterThan(1);
    for (const line of banner) {
      expect(line.tone).toBe("alert");
      expect(line.text.length).toBeLessThanOrEqual(30);
    }
    expect(banner.map((l) => l.text).join(" ")).toContain("Loki flipped!");
  });
});

describe("the compact strip on a short screen", () => {
  it("is the one shared line, keeps alerts, and leaves the tables and reach to the sheet", () => {
    const room = epicRoomFixture({ as: "player", phase: "playing", flipped: true, mangog: true });
    const strip = podStripOf({ ...input({ room, flipBanner: true }), compact: true }, 80)!;
    expect(strip.lines.map((l) => l.kind)).toEqual(["shared", "banner"]);
    expect(strip.targets).toBe(1);
  });
});
