import { PROOF_HEADER, PROOF_PATTERN, isRoomCode } from "@mc/sync-worker/protocol";
import { describe, expect, test, vi } from "vitest";
import { TRANSFER_TIMEOUT_MS, receiveSaveFile, sendSaveFile, type TransferDeps } from "./transfer-client.js";
import { sampleSaveFile } from "./transfer-fixtures.js";

const BASE = "https://mc-sync.test";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** An in-memory stand-in for the Worker: one upload per room, released once to the matching proof. */
function fakeServer(): { deps: TransferDeps; rooms: Map<string, { proof: string; bytes: Uint8Array }> } {
  const rooms = new Map<string, { proof: string; bytes: Uint8Array }>();
  let next = 0;
  const fetchFake = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const proof = new Headers(init?.headers).get(PROOF_HEADER) ?? "";
    if (init?.method === "POST" && url === `${BASE}/transfer`) {
      const room = `ABCDEFG${String.fromCharCode(65 + next++)}`;
      rooms.set(room, { proof, bytes: new Uint8Array(init.body as Uint8Array) });
      return json(201, { code: room, expiresAt: 123 });
    }
    const room = url.slice(`${BASE}/transfer/`.length);
    const held = rooms.get(room);
    if (!held || held.proof !== proof) return json(404, { reason: "not-found", error: "no" });
    rooms.delete(room);
    return new Response(held.bytes as Uint8Array<ArrayBuffer>, { status: 200 });
  };
  return { deps: { baseUrl: BASE, fetch: fetchFake as typeof fetch }, rooms };
}

const failing = (response: () => Response | Promise<Response>): TransferDeps => ({
  baseUrl: BASE,
  fetch: (async () => response()) as typeof fetch,
});

describe("send and receive", () => {
  test("a save sent on one device arrives on the other, once", async () => {
    const { deps, rooms } = fakeServer();
    const file = sampleSaveFile(3);
    const sent = await sendSaveFile(file, deps);
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(isRoomCode(sent.code.room)).toBe(true);
    expect(sent.expiresAt).toBe(123);
    // The server holds a proof that looks like one and bytes that aren't the save in the clear.
    const held = [...rooms.values()][0]!;
    expect(held.proof).toMatch(PROOF_PATTERN);
    expect(new TextDecoder().decode(held.bytes)).not.toContain("game-0");

    const got = await receiveSaveFile(sent.code, deps);
    expect(got).toEqual({ ok: true, file: expect.objectContaining({ exportedAt: file.exportedAt }) });
    expect(await receiveSaveFile(sent.code, deps)).toEqual({ ok: false, failure: { kind: "not-found" } });
  });

  test("a wrong key part is not-found, not a decrypt error (the proof fails first)", async () => {
    const { deps } = fakeServer();
    const sent = await sendSaveFile(sampleSaveFile(1), deps);
    if (!sent.ok) throw new Error("send failed");
    const wrong = { room: sent.code.room, keyPart: sent.code.keyPart === "2222" ? "3333" : "2222" };
    expect(await receiveSaveFile(wrong, deps)).toEqual({ ok: false, failure: { kind: "not-found" } });
  });
});

describe("failures", () => {
  const code = { room: "ABCDEFGH", keyPart: "JKMN" };

  test("no service URL is unavailable", async () => {
    const deps: TransferDeps = { baseUrl: null, fetch: vi.fn() as unknown as typeof fetch };
    expect(await sendSaveFile(sampleSaveFile(1), deps)).toEqual({ ok: false, failure: { kind: "unavailable" } });
    expect(await receiveSaveFile(code, deps)).toEqual({ ok: false, failure: { kind: "unavailable" } });
    expect(deps.fetch).not.toHaveBeenCalled();
  });

  test.each([
    ["a network error", () => Promise.reject(new TypeError("Failed to fetch")), "unavailable"],
    ["a 503", () => json(503, { reason: "disabled", error: "off" }), "unavailable"],
    ["a 500", () => new Response("boom", { status: 500 }), "unavailable"],
    ["a refused origin", () => json(403, { reason: "origin", error: "no" }), "unavailable"],
    ["a 404", () => json(404, { reason: "not-found", error: "no" }), "not-found"],
    ["a 404 with no body", () => new Response(null, { status: 404 }), "not-found"],
    ["a rate limit", () => json(429, { reason: "rate-limited", error: "slow" }), "rate-limited"],
    ["a 429 with no body", () => new Response(null, { status: 429 }), "rate-limited"],
    ["a block", () => json(429, { reason: "blocked", error: "wait" }), "blocked"],
    ["a 413", () => json(413, { reason: "too-large", error: "big" }), "too-large"],
  ])("%s on both requests is %s", async (_, response, kind) => {
    const deps = failing(response);
    expect(await sendSaveFile(sampleSaveFile(1), deps)).toEqual({ ok: false, failure: { kind } });
    expect(await receiveSaveFile(code, deps)).toEqual({ ok: false, failure: { kind } });
  });

  test("bytes that aren't a sealed save are damaged", async () => {
    const got = await receiveSaveFile(
      code,
      failing(() => new Response(new Uint8Array(80))),
    );
    expect(got).toMatchObject({ ok: false, failure: { kind: "damaged" } });
  });

  test("a sealed non-save is damaged and carries the parse error", async () => {
    const { sealSaveFile } = await import("./transfer-crypto.js");
    const bogus = await sealSaveFile({ hello: 1 } as never, code.keyPart);
    const got = await receiveSaveFile(
      code,
      failing(() => new Response(bogus as Uint8Array<ArrayBuffer>)),
    );
    expect(got).toMatchObject({
      ok: false,
      failure: { kind: "damaged", detail: expect.stringContaining("save file") },
    });
  });

  test("a request that never answers is aborted after the timeout and reads as unavailable", async () => {
    const timeout = new AbortController();
    const spy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
    try {
      const deps: TransferDeps = {
        baseUrl: BASE,
        fetch: ((_: unknown, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            // The client can reach fetch after the abort below on a slow runner (it derives its key first): a signal
            // that is already aborted never fires "abort" again, so reject at once rather than hang the test.
            if (init?.signal?.aborted) reject(init.signal.reason);
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          })) as typeof fetch,
      };
      const pending = receiveSaveFile(code, deps);
      await new Promise((resolve) => setTimeout(resolve, 0));
      timeout.abort(new DOMException("timed out", "TimeoutError"));
      expect(await pending).toEqual({ ok: false, failure: { kind: "unavailable" } });
      expect(spy).toHaveBeenCalledWith(TRANSFER_TIMEOUT_MS);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("hardening", () => {
  const code = { room: "ABCDEFGH", keyPart: "JKMN" };

  test("a body that fails mid-read is unavailable, not damaged", async () => {
    const response = new Response(new Uint8Array(4));
    vi.spyOn(response, "arrayBuffer").mockRejectedValue(new TypeError("terminated"));
    expect(
      await receiveSaveFile(
        code,
        failing(() => response),
      ),
    ).toEqual({ ok: false, failure: { kind: "unavailable" } });
  });

  test("a device without WebCrypto is unsupported on both sides", async () => {
    const spy = vi.spyOn(crypto.subtle, "importKey").mockRejectedValue(new Error("no subtle"));
    try {
      const deps = failing(() => json(201, {}));
      expect(await sendSaveFile(sampleSaveFile(1), deps)).toEqual({ ok: false, failure: { kind: "unsupported" } });
      expect(await receiveSaveFile(code, deps)).toEqual({ ok: false, failure: { kind: "unsupported" } });
    } finally {
      spy.mockRestore();
    }
  });

  test.each([
    ["a bad room", { code: "nope", expiresAt: 5 }],
    ["a missing expiry", { code: "ABCDEFGH" }],
    ["a non-finite expiry", { code: "ABCDEFGH", expiresAt: "soon" }],
  ])("a 201 with %s is unavailable", async (_, body) => {
    expect(
      await sendSaveFile(
        sampleSaveFile(1),
        failing(() => json(201, body)),
      ),
    ).toEqual({
      ok: false,
      failure: { kind: "unavailable" },
    });
  });

  test("a 403 turnstile is unavailable", async () => {
    expect(
      await sendSaveFile(
        sampleSaveFile(1),
        failing(() => json(403, { reason: "turnstile", error: "x" })),
      ),
    ).toEqual({
      ok: false,
      failure: { kind: "unavailable" },
    });
  });
});
