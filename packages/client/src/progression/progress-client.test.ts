import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PROGRESS_WORKER_STARTUP_MS,
  PROGRESS_WORKER_TIMEOUT_MS,
  progressOffMain,
  resetProgressWorkerForTests,
  type ProgressReply,
  type ProgressRequest,
} from "./progress-client.js";
import type { ProgressInputs, ProgressResult, ProgressSaves } from "./progress-compute.js";

/** A stand-in for the progress worker: records what it is sent, and answers when the test says. */
class FakeWorker {
  static last: FakeWorker | null = null;
  onmessage: ((event: MessageEvent<ProgressReply>) => void) | null = null;
  onerror: (() => void) | null = null;
  readonly sent: ProgressRequest[] = [];
  terminated = false;
  throwOnPost = false;
  constructor() {
    FakeWorker.last = this;
  }
  postMessage(message: ProgressRequest): void {
    if (this.throwOnPost) throw new DOMException("could not be cloned", "DataCloneError");
    this.sent.push(message);
  }
  terminate(): void {
    this.terminated = true;
  }
  reply(message: ProgressReply): void {
    this.onmessage?.({ data: message } as MessageEvent<ProgressReply>);
  }
}

const inputs = {} as ProgressInputs;
const saves = [] as unknown as ProgressSaves;
const result = { earnedIds: ["wins-1"] } as unknown as ProgressResult;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("indexedDB", {});
  FakeWorker.last = null;
  resetProgressWorkerForTests();
});

afterEach(() => {
  resetProgressWorkerForTests();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("progressOffMain (issue #722)", () => {
  it("answers with the worker's result for its own request", async () => {
    const pending = progressOffMain(inputs, saves);
    const worker = FakeWorker.last!;
    worker.reply({ id: 0, result: null, ready: true });
    worker.reply({ id: worker.sent[0]!.id, result });
    await expect(pending).resolves.toBe(result);
  });

  it("matches replies to requests by id", async () => {
    const first = progressOffMain(inputs, saves);
    const second = progressOffMain(inputs, saves);
    const worker = FakeWorker.last!;
    const other = { earnedIds: [] } as unknown as ProgressResult;
    worker.reply({ id: worker.sent[1]!.id, result: other });
    worker.reply({ id: worker.sent[0]!.id, result });
    await expect(first).resolves.toBe(result);
    await expect(second).resolves.toBe(other);
  });

  it("no worker or no IndexedDB: null, so the main thread computes", async () => {
    vi.stubGlobal("indexedDB", undefined);
    await expect(progressOffMain(inputs, saves)).resolves.toBeNull();
    expect(FakeWorker.last).toBeNull();
  });

  it("saves that can't be cloned: null for that refresh, and the worker is kept", async () => {
    const pending = progressOffMain(inputs, saves);
    const worker = FakeWorker.last!;
    worker.reply({ id: worker.sent[0]!.id, result });
    await pending;
    worker.throwOnPost = true;
    await expect(progressOffMain(inputs, saves)).resolves.toBeNull();
    expect(worker.terminated).toBe(false);
  });

  it("a worker still loading its modules is waited for, within its startup allowance", async () => {
    let settled: ProgressResult | null | undefined;
    void progressOffMain(inputs, saves).then((value) => (settled = value));
    const worker = FakeWorker.last!;
    await vi.advanceTimersByTimeAsync(PROGRESS_WORKER_TIMEOUT_MS * 2);
    expect(settled).toBeUndefined();
    expect(worker.terminated).toBe(false);
    worker.reply({ id: 0, result: null, ready: true });
    worker.reply({ id: worker.sent[0]!.id, result });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(result);
  });

  it("a ready worker that goes quiet is retired, and later refreshes compute on the main thread", async () => {
    const pending = progressOffMain(inputs, saves);
    const worker = FakeWorker.last!;
    worker.reply({ id: 0, result: null, ready: true });
    await vi.advanceTimersByTimeAsync(PROGRESS_WORKER_TIMEOUT_MS * 2 + 1);
    await expect(pending).resolves.toBeNull();
    expect(worker.terminated).toBe(true);
    await expect(progressOffMain(inputs, saves)).resolves.toBeNull();
  });

  it("a worker that never gets ready is given up on after its startup allowance", async () => {
    const pending = progressOffMain(inputs, saves);
    const worker = FakeWorker.last!;
    await vi.advanceTimersByTimeAsync(PROGRESS_WORKER_STARTUP_MS + PROGRESS_WORKER_TIMEOUT_MS + 1);
    await expect(pending).resolves.toBeNull();
    expect(worker.terminated).toBe(true);
  });

  it("a worker that fails to start lets every waiting refresh go to the main thread", async () => {
    const pending = progressOffMain(inputs, saves);
    FakeWorker.last!.onerror?.();
    await expect(pending).resolves.toBeNull();
  });
});
