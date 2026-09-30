/**
 * `view/round-debrief-model.ts` (guided mode G8 part 1, `docs/guided-mode.md` §4): the "Worth remembering"
 * heuristics against synthetic `GameEvent`s, the lesson checklist mapping, the Log-tab unlock note, and the
 * headline/layout math. Real card ids (Black Cat `01002`, an ally with a real printed cost; Backflip `01003`, a
 * zero-cost card) come from the pool (`content/pool.ts`), the same "real data, not a hand-rolled mock" discipline
 * `how-to-win-model.test.ts` follows.
 */
import { describe, expect, test } from "vitest";
import type { GameEvent, InstanceId, PlayerId } from "@mc/engine";
import { instanceId, playerId } from "@mc/engine";
import { CARDS_BY_ID } from "../content/pool.js";
import type { Lesson, LessonListEntry } from "./lesson-model.js";
import {
  blockedWithAllyLine,
  headlineFor,
  lessonRowsOf,
  newOnBoardLines,
  paidExactlyLine,
  roundDebriefContentOf,
  roundDebriefLayout,
  roundDebriefLayoutRects,
  schemeGrewUnthwartedLine,
  tookDamageWithoutDefendingLine,
  worthRemembering,
} from "./round-debrief-model.js";

const P1: PlayerId = playerId("p1");
const BLACK_CAT_CARD = CARDS_BY_ID.get("01002")!; // Black Cat — an ally, cost 2.
const SCHEME_ID: InstanceId = instanceId("scheme:1");
const ATTACK_ID: InstanceId = instanceId("attack:1");

const EMPTY_POOL = { physical: 0, mental: 0, energy: 0, wild: 0 };

function cardPlayed(instId: InstanceId, cardId: string, resourcesPaid: number): GameEvent {
  return {
    type: "cardPlayed",
    playerId: P1,
    instanceId: instId,
    cardId: cardId as never,
    resourcesPaid,
    paid: EMPTY_POOL,
  };
}

function lesson(id: string, overrides: Partial<Lesson> = {}): Lesson {
  return { id, title: `Lesson ${id}`, steps: [], ...overrides };
}

function entries(...statuses: readonly ["done" | "current" | "upcoming", Lesson][]): readonly LessonListEntry[] {
  return statuses.map(([status, l]) => ({ lesson: l, status }));
}

describe("worthRemembering heuristics", () => {
  test("blockedWithAllyLine: an ally played this round later defends", () => {
    const events: readonly GameEvent[] = [
      cardPlayed(instanceId("ally:1"), "01002", 2),
      { type: "defenderDeclared", attackInstanceId: ATTACK_ID, defenderInstanceId: instanceId("ally:1"), playerId: P1 },
    ];
    expect(blockedWithAllyLine(events)).toBe(
      `You blocked with ${BLACK_CAT_CARD.name} — good call. That's what allies are for.`,
    );
  });

  test("blockedWithAllyLine: null when the defender wasn't an ally played this round", () => {
    const events: readonly GameEvent[] = [
      { type: "defenderDeclared", attackInstanceId: ATTACK_ID, defenderInstanceId: instanceId("hero:1"), playerId: P1 },
    ];
    expect(blockedWithAllyLine(events)).toBeNull();
  });

  test("tookDamageWithoutDefendingLine: fires on defenseDeclined", () => {
    const events: readonly GameEvent[] = [{ type: "defenseDeclined", attackInstanceId: ATTACK_ID, playerId: P1 }];
    expect(tookDamageWithoutDefendingLine(events)).toContain("without defending");
  });

  test("tookDamageWithoutDefendingLine: null with no defenseDeclined", () => {
    expect(tookDamageWithoutDefendingLine([])).toBeNull();
  });

  test("schemeGrewUnthwartedLine: threat placed, none removed", () => {
    const events: readonly GameEvent[] = [
      { type: "threatPlaced", schemeInstanceId: SCHEME_ID, amount: 2, sourceInstanceId: null },
    ];
    expect(schemeGrewUnthwartedLine(events)).toContain("didn't thwart");
  });

  test("schemeGrewUnthwartedLine: null once a thwart lands", () => {
    const events: readonly GameEvent[] = [
      { type: "threatPlaced", schemeInstanceId: SCHEME_ID, amount: 2, sourceInstanceId: null },
      { type: "threatRemoved", schemeInstanceId: SCHEME_ID, amount: 3, sourceInstanceId: null },
    ];
    expect(schemeGrewUnthwartedLine(events)).toBeNull();
  });

  test("paidExactlyLine: resourcesPaid matches the printed cost", () => {
    const cost = "cost" in BLACK_CAT_CARD ? (BLACK_CAT_CARD as { cost: number }).cost : 0;
    expect(cost).toBeGreaterThan(0);
    const events: readonly GameEvent[] = [cardPlayed(instanceId("c:1"), "01002", cost)];
    expect(paidExactlyLine(events)).toBe(`You paid exactly ${cost} for ${BLACK_CAT_CARD.name} — no resources wasted.`);
  });

  test("paidExactlyLine: null when the payment overshoots the cost", () => {
    const events: readonly GameEvent[] = [cardPlayed(instanceId("c:1"), "01002", 99)];
    expect(paidExactlyLine(events)).toBeNull();
  });

  test("paidExactlyLine: null for a zero-cost card (Backflip)", () => {
    const events: readonly GameEvent[] = [cardPlayed(instanceId("c:1"), "01003", 0)];
    expect(paidExactlyLine(events)).toBeNull();
  });

  test("worthRemembering: falls back with no notable events", () => {
    expect(worthRemembering([])).toBe("A clean round — nothing to flag.");
  });

  test("worthRemembering: blocked-with-ally outranks a wasted payment in the same round", () => {
    const events: readonly GameEvent[] = [
      cardPlayed(instanceId("ally:1"), "01002", 2),
      { type: "defenderDeclared", attackInstanceId: ATTACK_ID, defenderInstanceId: instanceId("ally:1"), playerId: P1 },
      cardPlayed(instanceId("c:1"), "01003", 99),
    ];
    expect(worthRemembering(events)).toContain("blocked with");
  });
});

describe("lessonRowsOf", () => {
  test("done lessons stay done; the first not-done lesson is upNext with a subline; the rest are upcoming", () => {
    const l1 = lesson("l1");
    const l2 = lesson("l2", { waitingCopy: "It starts at the top of round 2, after the villain phase." });
    const l3 = lesson("l3");
    const rows = lessonRowsOf(entries(["done", l1], ["upcoming", l2], ["upcoming", l3]));
    expect(rows).toEqual([
      { id: "l1", title: "Lesson l1", status: "done" },
      { id: "l2", title: "Lesson l2", status: "upNext", subline: "Next round" },
      { id: "l3", title: "Lesson l3", status: "upcoming" },
    ]);
  });

  test("no waitingCopy: a bare 'Next round' subline", () => {
    const rows = lessonRowsOf(entries(["upcoming", lesson("l1")]));
    expect(rows[0]!.subline).toBe("Next round");
  });

  test("every lesson done: no upNext row at all", () => {
    const rows = lessonRowsOf(entries(["done", lesson("l1")], ["done", lesson("l2")]));
    expect(rows.every((row) => row.status === "done")).toBe(true);
  });
});

describe("newOnBoardLines", () => {
  test("pending: names the lesson count as the unlock condition", () => {
    const rows = entries(["done", lesson("l1")], ["done", lesson("l2")], ["upcoming", lesson("l3")]);
    expect(newOnBoardLines(rows)).toEqual(["The Log tab unlocks after lesson 3."]);
  });

  test("the run's last lesson just finished: the unlocked note", () => {
    const rows = entries(["done", lesson("l1")], ["done", lesson("l2")]);
    expect(newOnBoardLines(rows)).toEqual(["The Log tab just unlocked."]);
  });

  test("empty run: nothing to say", () => {
    expect(newOnBoardLines([])).toEqual([]);
  });
});

describe("headlineFor", () => {
  test("deterministic per round, and varies across rounds", () => {
    const first = headlineFor(1);
    expect(headlineFor(1)).toBe(first);
    expect(headlineFor(2)).not.toBe(first);
  });
});

describe("roundDebriefContentOf", () => {
  test("assembles the whole screen from its inputs", () => {
    const lessons = entries(
      ["done", lesson("how-to-win")],
      ["done", lesson("hero-and-alter-ego")],
      ["done", lesson("paying-for-cards")],
      ["done", lesson("villain-phase")],
      ["upcoming", lesson("threat-and-thwarting", { waitingCopy: "It starts at the top of round 2." })],
    );
    const content = roundDebriefContentOf({ lessons, round: 1, events: [], level: "full" });
    expect(content.title).toBe("End of round 1");
    expect(content.lessons).toHaveLength(5);
    expect(content.lessons[4]).toMatchObject({ status: "upNext", subline: "Next round" });
    expect(content.newOnBoard).toEqual(["The Log tab unlocks after lesson 5."]);
    expect(content.worthRemembering).toBe("A clean round — nothing to flag.");
    expect(content.level).toBe("full");
    expect(content.isFinal).toBe(false);
  });

  test("isFinal defaults to false, and threads through when set", () => {
    const lessons = entries(["done", lesson("l1")]);
    expect(roundDebriefContentOf({ lessons, round: 1, events: [], level: "full" }).isFinal).toBe(false);
    expect(roundDebriefContentOf({ lessons, round: 2, events: [], level: "hints", isFinal: true }).isFinal).toBe(true);
  });
});

describe("roundDebriefLayout", () => {
  const lessons = lessonRowsOf(
    entries(
      ["done", lesson("l1")],
      ["done", lesson("l2")],
      ["upcoming", lesson("l3", { waitingCopy: "It starts soon." })],
    ),
  );

  test("narrow (phone): stacked, no art panel", () => {
    const layout = roundDebriefLayout(390, 844, lessons);
    expect(layout.wide).toBe(false);
    expect(layout.art.width).toBe(0);
    expect(layout.lessonRows).toHaveLength(3);
  });

  test("wide (desktop): a left art panel, content to its right", () => {
    const layout = roundDebriefLayout(1440, 900, lessons);
    expect(layout.wide).toBe(true);
    expect(layout.art.width).toBeGreaterThan(0);
    expect(layout.header.x).toBeGreaterThanOrEqual(layout.art.x + layout.art.width);
  });

  test("no overlap among the non-art content regions, narrow and wide", () => {
    for (const [w, h] of [
      [390, 844],
      [1024, 768],
      [1440, 900],
    ] as const) {
      const layout = roundDebriefLayout(w, h, lessons);
      const rects = roundDebriefLayoutRects(layout);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i]!;
          const b = rects[j]!;
          const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
          expect(overlaps).toBe(false);
        }
      }
    }
  });
});
