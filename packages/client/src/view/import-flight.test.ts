import { describe, expect, it } from "vitest";
import { ImportFlight } from "./import-flight.js";

describe("ImportFlight", () => {
  it("stores one deck for two Enters during a slow save", async () => {
    const flight = new ImportFlight();
    const saved: string[] = [];
    let finishPut!: () => void;
    const put = (id: string): Promise<void> =>
      new Promise((resolve) => {
        finishPut = () => {
          saved.push(id);
          resolve();
        };
      });
    // The fetch has answered; the deck's write to storage is still pending.
    const first = flight.run(() => put("deck-1"));
    expect(flight.busy).toBe(true);
    // A second Enter while the write is in flight is refused.
    expect(await flight.run(() => put("deck-2"))).toBe(false);
    finishPut();
    expect(await first).toBe(true);
    expect(saved).toEqual(["deck-1"]);
    expect(flight.busy).toBe(false);
  });

  it("is free again after a failed run", async () => {
    const flight = new ImportFlight();
    await expect(flight.run(() => Promise.reject(new Error("quota")))).rejects.toThrow("quota");
    expect(flight.busy).toBe(false);
    expect(await flight.run(() => Promise.resolve())).toBe(true);
  });
});
