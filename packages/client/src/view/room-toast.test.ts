import { describe, expect, it, vi } from "vitest";
import type { ParticipantChange } from "./room-notices.js";
import {
  ROOM_TOAST_HEIGHT,
  ROOM_TOAST_IN_MS,
  ROOM_TOAST_MAX,
  ROOM_TOAST_MS,
  RoomToastQueue,
  roomToastFrameAt,
  roomToastRects,
} from "./room-toast.js";

const joined = (id: string, name = id): ParticipantChange => ({ kind: "joined", id, name, device: undefined });

describe("RoomToastQueue", () => {
  it("stacks the newest on top, at most three", () => {
    const queue = new RoomToastQueue();
    for (const id of ["a", "b", "c", "d"]) queue.push(joined(id), 0);
    expect(queue.toasts).toHaveLength(ROOM_TOAST_MAX);
    expect(queue.toasts.map((t) => t.change.id)).toEqual(["d", "c", "b"]);
  });

  it("replaces a person's own toast when they leave right after joining", () => {
    const queue = new RoomToastQueue();
    queue.push(joined("a"), 0);
    queue.push({ ...joined("a"), kind: "left" }, 100);
    expect(queue.toasts.map((t) => t.change.kind)).toEqual(["left"]);
  });

  it("hides each toast after four seconds", () => {
    const queue = new RoomToastQueue();
    queue.push(joined("a"), 0);
    queue.push(joined("b"), 1000);
    expect(queue.expire(ROOM_TOAST_MS - 1)).toBe(false);
    expect(queue.expire(ROOM_TOAST_MS)).toBe(true);
    expect(queue.toasts.map((t) => t.change.id)).toEqual(["b"]);
    expect(queue.expire(1000 + ROOM_TOAST_MS)).toBe(true);
    expect(queue.toasts).toEqual([]);
  });

  it("dismisses one by id, or the top one for the keyboard and pad", () => {
    const queue = new RoomToastQueue();
    queue.push(joined("a"), 0);
    queue.push(joined("b"), 0);
    queue.push(joined("c"), 0);
    queue.dismissTop();
    expect(queue.toasts.map((t) => t.change.id)).toEqual(["b", "a"]);
    queue.dismiss(queue.toasts[1]!.id);
    expect(queue.toasts.map((t) => t.change.id)).toEqual(["b"]);
    queue.dismiss(9999);
    expect(queue.toasts).toHaveLength(1);
  });

  it("tells subscribers when the set changes, and not when nothing did", () => {
    const queue = new RoomToastQueue();
    const seen = vi.fn();
    const off = queue.subscribe(seen);
    queue.push(joined("a"), 0);
    queue.expire(10);
    expect(seen).toHaveBeenCalledTimes(1);
    queue.clear();
    expect(seen).toHaveBeenCalledTimes(2);
    off();
    queue.push(joined("b"), 0);
    expect(seen).toHaveBeenCalledTimes(2);
  });
});

describe("roomToastRects", () => {
  it("sits at the top right on a desktop, 340 wide, stacked downward", () => {
    const rects = roomToastRects(1440, 3);
    expect(rects[0]).toMatchObject({ x: 1440 - 16 - 340, y: 76, width: 340, height: ROOM_TOAST_HEIGHT });
    expect(rects[1]!.y).toBeGreaterThan(rects[0]!.y + ROOM_TOAST_HEIGHT);
    expect(new Set(rects.map((r) => r.x)).size).toBe(1);
  });

  it("is full width less the gutters on a phone, and inside the screen at 375", () => {
    const [rect] = roomToastRects(375, 1);
    expect(rect).toMatchObject({ x: 8, width: 359 });
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(375);
  });

  it("fits a portrait tablet and never runs past the right edge", () => {
    for (const width of [412, 768, 1024]) {
      const [rect] = roomToastRects(width, 1);
      expect(rect!.x).toBeGreaterThanOrEqual(0);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
    }
  });
});

describe("roomToastFrameAt", () => {
  it("slides in, holds and fades out", () => {
    expect(roomToastFrameAt(0, false)).toEqual({ alpha: 0, slide: 1 });
    expect(roomToastFrameAt(ROOM_TOAST_IN_MS, false)).toEqual({ alpha: 1, slide: 0 });
    expect(roomToastFrameAt(2000, false)).toEqual({ alpha: 1, slide: 0 });
    expect(roomToastFrameAt(ROOM_TOAST_MS - 10, false).alpha).toBeLessThan(0.1);
  });

  it("does not move or fade under reduced motion", () => {
    expect(roomToastFrameAt(0, true)).toEqual({ alpha: 1, slide: 0 });
    expect(roomToastFrameAt(ROOM_TOAST_MS - 10, true)).toEqual({ alpha: 1, slide: 0 });
  });
});
