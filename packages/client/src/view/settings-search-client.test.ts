import { describe, expect, it } from "vitest";
import { SettingsSearchClient, type SettingsSearchWorkerLike } from "./settings-search-client.js";
import type { SettingsSearchRequest, SettingsSearchResult } from "./settings-search.js";

class FakeWorker implements SettingsSearchWorkerLike {
  readonly sent: SettingsSearchRequest[] = [];
  onmessage: SettingsSearchWorkerLike["onmessage"] = null;
  onerror: SettingsSearchWorkerLike["onerror"] = null;
  terminated = false;

  postMessage(message: SettingsSearchRequest): void {
    this.sent.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  answer(requestId: number): void {
    this.onmessage?.({ data: { requestId, results: [] } });
  }
}

describe("SettingsSearchClient", () => {
  it("delivers only the newest query's answer", () => {
    const worker = new FakeWorker();
    const client = new SettingsSearchClient(() => worker);
    const answers: (readonly SettingsSearchResult[])[] = [];
    client.search("da", () => answers.push([]));
    client.search("dar", (results) => answers.push(results));
    worker.answer(1);
    expect(answers).toHaveLength(0);
    worker.answer(2);
    expect(answers).toHaveLength(1);
  });

  it("drops an answer after cancel, and ends the worker on destroy", () => {
    const worker = new FakeWorker();
    const client = new SettingsSearchClient(() => worker);
    let answered = false;
    client.search("da", () => (answered = true));
    client.cancel();
    worker.answer(1);
    expect(answered).toBe(false);
    client.destroy();
    expect(worker.terminated).toBe(true);
  });
});
