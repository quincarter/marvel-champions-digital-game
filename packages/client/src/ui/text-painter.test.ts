import { describe, expect, it } from "vitest";
import {
  APPLY_BUDGET_MS,
  TEXT_WORKER_IDLE_MS,
  TEXT_WORKER_START_MS,
  TextPainter,
  type PaintTarget,
  type PaintWorkerLike,
  type PainterDeps,
} from "./text-painter.js";
import type { PaintJob, TextPaintRequest, TextPaintResponse } from "./text-paint-protocol.js";

class FakeWorker implements PaintWorkerLike {
  sent: TextPaintRequest[] = [];
  terminated = false;
  onmessage: ((event: { readonly data: TextPaintResponse }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  postMessage(message: TextPaintRequest): void {
    this.sent.push(message);
  }
  terminate(): void {
    this.terminated = true;
  }
  reply(data: TextPaintResponse): void {
    this.onmessage?.({ data });
  }
  get paintJobs(): PaintJob[] {
    return this.sent.flatMap((message) => (message.type === "paint" ? [...message.jobs] : []));
  }
}

class FakeBitmap {
  closed = false;
  close(): void {
    this.closed = true;
  }
}
const bitmap = (): FakeBitmap & ImageBitmap => new FakeBitmap() as unknown as FakeBitmap & ImageBitmap;

class FakeLabel implements PaintTarget {
  active = true;
  applied: { bitmap: ImageBitmap; width: number; height: number; resolution: number }[] = [];
  paintedOnMain = 0;
  applyBitmap(bitmap: ImageBitmap, width: number, height: number, resolution: number): void {
    this.applied.push({ bitmap, width, height, resolution });
  }
  paintOnMain(): void {
    this.paintedOnMain++;
  }
}

const job = (text = "x"): Omit<PaintJob, "id"> => ({
  width: 10,
  height: 5,
  resolution: 2,
  font: "11px A",
  background: null,
  paddingLeft: 0,
  paddingTop: 0,
  fill: "#fff",
  stroke: "#000",
  strokeThickness: 0,
  letterSpacing: 0,
  shadow: { offsetX: 0, offsetY: 0, color: "#000", blur: 0, fill: false, stroke: false },
  lines: [{ text, x: 0, y: 4 }],
});
const frame = { width: 10.5, height: 5 };

function setup(options: { spawn?: () => FakeWorker | null } = {}) {
  const workers: FakeWorker[] = [];
  const tasks: (() => void)[] = [];
  const frames: (() => void)[] = [];
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let timerId = 0;
  let clock = 0;
  const deps: PainterDeps = {
    spawn: () => {
      const worker = options.spawn ? options.spawn() : new FakeWorker();
      if (worker) workers.push(worker);
      return worker;
    },
    fonts: () => [],
    now: () => clock,
    afterTask: (fn) => tasks.push(fn),
    nextFrame: (fn) => frames.push(fn),
    setTimer: (fn, ms) => {
      timers.set(++timerId, { fn, ms });
      return timerId;
    },
    clearTimer: (handle) => {
      timers.delete(handle as number);
    },
  };
  const painter = new TextPainter(deps);
  return {
    painter,
    workers,
    /** The worker that is up now. */
    get worker(): FakeWorker {
      return workers[workers.length - 1]!;
    },
    endTask: () => tasks.splice(0).forEach((fn) => fn()),
    endFrame: () => frames.splice(0).forEach((fn) => fn()),
    advance: (ms: number) => {
      clock += ms;
    },
    timers,
    fire: (ms: number) => {
      for (const [id, timer] of [...timers]) {
        if (timer.ms === ms) {
          timers.delete(id);
          timer.fn();
        }
      }
    },
  };
}

/** A painter whose worker has loaded its fonts. */
function ready() {
  const t = setup();
  expect(t.painter.wants()).toBe(false); // the first label of the session paints on the main thread
  t.worker.reply({ type: "ready", ok: true });
  expect(t.painter.mode).toBe("ready");
  return t;
}

describe("starting", () => {
  it("starts the worker on the first request but paints that label itself", () => {
    const t = setup();
    expect(t.painter.wants()).toBe(false);
    expect(t.painter.mode).toBe("starting");
    expect(t.worker.sent[0]).toEqual({ type: "init", fonts: [] });
    t.worker.reply({ type: "ready", ok: true });
    expect(t.painter.wants()).toBe(true);
  });

  it("stays off where there is no worker", () => {
    const t = setup({ spawn: () => null });
    expect(t.painter.wants()).toBe(false);
    expect(t.painter.mode).toBe("off");
    expect(t.painter.wants()).toBe(false);
  });

  it("goes off, and paints what waits, when the worker says it cannot paint here", () => {
    const t = ready();
    t.fire(TEXT_WORKER_IDLE_MS);
    expect(t.painter.mode).toBe("idle");
    expect(t.painter.wants()).toBe(true); // restarting: waits for the worker rather than painting on the main thread
    const label = new FakeLabel();
    t.painter.submit(label, undefined, job(), frame);
    t.worker.reply({ type: "ready", ok: false, reason: "no fonts in workers" });
    expect(label.paintedOnMain).toBe(1);
    expect(t.painter.mode).toBe("off");
    expect(t.painter.wants()).toBe(false);
    expect(t.worker.terminated).toBe(true);
  });

  it("gives up, and paints what waits, when the worker never becomes ready", () => {
    const t = ready();
    t.fire(TEXT_WORKER_IDLE_MS);
    expect(t.painter.wants()).toBe(true);
    const label = new FakeLabel();
    t.painter.submit(label, undefined, job(), frame);
    t.fire(TEXT_WORKER_START_MS);
    expect(label.paintedOnMain).toBe(1);
    expect(t.painter.mode).toBe("off");
  });

  it("falls back on a worker error", () => {
    const t = ready();
    const label = new FakeLabel();
    t.painter.submit(label, undefined, job(), frame);
    t.worker.onerror?.({});
    expect(label.paintedOnMain).toBe(1);
    expect(t.painter.mode).toBe("off");
  });
});

describe("painting", () => {
  it("sends every job queued in one task as one message and applies the results", () => {
    const t = ready();
    const a = new FakeLabel();
    const b = new FakeLabel();
    const idA = t.painter.submit(a, undefined, job("a"), frame);
    const idB = t.painter.submit(b, undefined, job("b"), { width: 7, height: 3 });
    expect(t.worker.paintJobs).toHaveLength(0);
    t.endTask();
    expect(t.worker.sent.filter((message) => message.type === "paint")).toHaveLength(1);
    expect(t.worker.paintJobs.map((j) => [j.id, j.lines[0]!.text])).toEqual([
      [idA, "a"],
      [idB, "b"],
    ]);
    const bitmaps = [bitmap(), bitmap()];
    t.worker.reply({
      type: "painted",
      results: [
        { id: idA, bitmap: bitmaps[0]! },
        { id: idB, bitmap: bitmaps[1]! },
      ],
    });
    t.endFrame();
    expect(a.applied).toEqual([{ bitmap: bitmaps[0], width: 10.5, height: 5, resolution: 2 }]);
    expect(b.applied[0]).toMatchObject({ width: 7, height: 3 });
    expect(t.painter.pendingCount).toBe(0);
  });

  it("drops the result of a job its label has since replaced", () => {
    const t = ready();
    const label = new FakeLabel();
    const first = t.painter.submit(label, undefined, job("old"), frame);
    t.endTask();
    const second = t.painter.submit(label, first, job("new"), frame);
    t.endTask();
    const stale = bitmap();
    const fresh = bitmap();
    t.worker.reply({
      type: "painted",
      results: [
        { id: first, bitmap: stale },
        { id: second, bitmap: fresh },
      ],
    });
    t.endFrame();
    expect(stale.closed).toBe(true);
    expect(fresh.closed).toBe(false);
    expect(label.applied.map((applied) => applied.bitmap)).toEqual([fresh]);
  });

  it("does not even send a job that was replaced in the same task", () => {
    const t = ready();
    const label = new FakeLabel();
    const first = t.painter.submit(label, undefined, job("old"), frame);
    t.painter.submit(label, first, job("new"), frame);
    t.endTask();
    expect(t.worker.paintJobs.map((j) => j.lines[0]!.text)).toEqual(["new"]);
  });

  it("closes the bitmap of a label that is gone", () => {
    const t = ready();
    const forgotten = new FakeLabel();
    const destroyed = new FakeLabel();
    const idForgotten = t.painter.submit(forgotten, undefined, job(), frame);
    const idDestroyed = t.painter.submit(destroyed, undefined, job(), frame);
    t.endTask();
    t.painter.forget(idForgotten);
    destroyed.active = false;
    const bitmaps = [bitmap(), bitmap()];
    t.worker.reply({
      type: "painted",
      results: [
        { id: idForgotten, bitmap: bitmaps[0]! },
        { id: idDestroyed, bitmap: bitmaps[1]! },
      ],
    });
    t.endFrame();
    expect(bitmaps.every((b) => b.closed)).toBe(true);
    expect(forgotten.applied).toHaveLength(0);
    expect(destroyed.applied).toHaveLength(0);
  });

  it("spreads uploads over frames by time budget, at least one a frame", () => {
    const t = ready();
    const labels = [new FakeLabel(), new FakeLabel(), new FakeLabel()];
    const ids = labels.map((label) => t.painter.submit(label, undefined, job(), frame));
    t.endTask();
    // Each upload "takes" a whole frame's budget.
    labels.forEach((label) => {
      const original = label.applyBitmap.bind(label);
      label.applyBitmap = (...args) => {
        original(...args);
        t.advance(APPLY_BUDGET_MS);
      };
    });
    t.worker.reply({ type: "painted", results: ids.map((id) => ({ id, bitmap: bitmap() })) });
    t.endFrame();
    expect(labels.map((label) => label.applied.length)).toEqual([1, 0, 0]);
    t.endFrame();
    t.endFrame();
    expect(labels.map((label) => label.applied.length)).toEqual([1, 1, 1]);
  });

  it("paints on the main thread a job the worker reports failed", () => {
    const t = ready();
    const label = new FakeLabel();
    const id = t.painter.submit(label, undefined, job(), frame);
    t.endTask();
    t.worker.reply({ type: "failed", ids: [id], reason: "paint threw" });
    expect(label.paintedOnMain).toBe(1);
    expect(t.painter.mode).toBe("ready");
  });

  it("holds jobs submitted while the worker restarts until it is ready", () => {
    const t = ready();
    t.fire(TEXT_WORKER_IDLE_MS);
    expect(t.painter.mode).toBe("idle");
    expect(t.worker.terminated).toBe(true);
    expect(t.painter.wants()).toBe(true);
    const label = new FakeLabel();
    const id = t.painter.submit(label, undefined, job(), frame);
    t.endTask();
    expect(t.workers).toHaveLength(2);
    expect(t.worker.paintJobs).toHaveLength(0);
    t.worker.reply({ type: "ready", ok: true });
    expect(t.worker.paintJobs.map((j) => j.id)).toEqual([id]);
  });

  it("ignores messages from a worker it has ended, closing their bitmaps", () => {
    const t = ready();
    const old = t.worker;
    t.fire(TEXT_WORKER_IDLE_MS);
    const late = bitmap();
    old.reply({ type: "painted", results: [{ id: 1, bitmap: late }] });
    expect(late.closed).toBe(true);
  });
});

describe("idle", () => {
  it("ends the worker after it has been idle, and not while jobs are pending", () => {
    const t = ready();
    expect(t.timers.size).toBe(1);
    const label = new FakeLabel();
    const id = t.painter.submit(label, undefined, job(), frame);
    expect(t.timers.size).toBe(0);
    t.endTask();
    t.worker.reply({ type: "painted", results: [{ id, bitmap: bitmap() }] });
    t.endFrame();
    expect([...t.timers.values()].map((timer) => timer.ms)).toEqual([TEXT_WORKER_IDLE_MS]);
    t.fire(TEXT_WORKER_IDLE_MS);
    expect(t.worker.terminated).toBe(true);
    expect(t.painter.mode).toBe("idle");
  });
});
