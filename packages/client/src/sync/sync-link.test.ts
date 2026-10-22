import { CODE_ALPHABET, PROOF_HEADER, isRoomCode } from "@mc/sync-worker/protocol";
import { describe, expect, test } from "vitest";
import { receiveSaveFile, sendSaveFile, type TransferDeps } from "../save-data/transfer-client.js";
import { sampleSaveFile } from "../save-data/transfer-fixtures.js";
import { newRecoveryCode } from "./sync-credentials.js";
import {
  LINK_DIGITS_LENGTH,
  LINK_KEY_LENGTH,
  formatLinkCode,
  newLinkDigits,
  parseLinkCode,
  receiveSyncLinkCode,
  linkFragmentOf,
  newLinkKey,
  parseLinkFragment,
  receiveSyncLink,
  sendSyncLink,
} from "./sync-link.js";

const BASE = "https://mc-sync.test";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** An in-memory stand-in for the Worker's transfer rooms: one upload per room, released once to the matching proof. */
function fakeServer(): { deps: TransferDeps; rooms: Map<string, { proof: string; bytes: Uint8Array }> } {
  const rooms = new Map<string, { proof: string; bytes: Uint8Array }>();
  let next = 0;
  const fetchFake = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const proof = new Headers(init?.headers).get(PROOF_HEADER) ?? "";
    if (init?.method === "POST" && url === `${BASE}/transfer`) {
      const room = `ABCDEFG${String.fromCharCode(65 + next++)}`;
      rooms.set(room, { proof, bytes: new Uint8Array(init.body as Uint8Array) });
      return json(201, { code: room, expiresAt: 456 });
    }
    const room = url.slice(`${BASE}/transfer/`.length);
    const held = rooms.get(room);
    if (!held || held.proof !== proof) return json(404, { reason: "not-found", error: "no" });
    rooms.delete(room);
    return new Response(held.bytes as Uint8Array<ArrayBuffer>, { status: 200 });
  };
  return { deps: { baseUrl: BASE, fetch: fetchFake as typeof fetch }, rooms };
}

describe("link key and fragment", () => {
  test("a link key is 22 characters of the alphabet", () => {
    const key = newLinkKey();
    expect(key).toHaveLength(LINK_KEY_LENGTH);
    expect([...key].every((char) => CODE_ALPHABET.includes(char))).toBe(true);
    expect(newLinkKey()).not.toBe(key);
  });

  test("the fragment round-trips, in any case, with or without the #", () => {
    const link = { room: "ABCDEFGH", key: "ABCDEFGHJKMNPQRSTUVWXY" };
    const fragment = linkFragmentOf(link);
    expect(fragment).toBe("link=ABCDEFGH.ABCDEFGHJKMNPQRSTUVWXY");
    expect(parseLinkFragment(`#${fragment}`)).toEqual(link);
    expect(parseLinkFragment(fragment.toLowerCase())).toEqual(link);
  });

  test("anything else is null: other hashes, wrong lengths, letters outside the alphabet, the 12-character receive", () => {
    expect(parseLinkFragment("")).toBeNull();
    expect(parseLinkFragment("#receive=ABCDEFGH.ABCD")).toBeNull();
    expect(parseLinkFragment("#link=ABCDEFGH.ABCD")).toBeNull();
    expect(parseLinkFragment("#link=ABCDEFGH.ABCDEFGHJKMNPQRSTUVWX0")).toBeNull(); // 0 is not in the alphabet
    expect(parseLinkFragment("#link=ABCDEFG0.ABCDEFGHJKMNPQRSTUVWXY")).toBeNull();
  });
});

describe("device link", () => {
  test("the recovery code reaches the other device, once, and the server never holds it in the clear", async () => {
    const { deps, rooms } = fakeServer();
    const recoveryCode = newRecoveryCode();
    const sent = await sendSyncLink(recoveryCode, deps);
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(isRoomCode(sent.link.room)).toBe(true);
    expect(sent.link.key).toHaveLength(LINK_KEY_LENGTH);
    expect(sent.expiresAt).toBe(456);
    const held = [...rooms.values()][0]!;
    expect(new TextDecoder().decode(held.bytes)).not.toContain(recoveryCode);
    expect(held.proof).not.toContain(sent.link.key);
    expect(await receiveSyncLink(sent.link, deps)).toEqual({ ok: true, recoveryCode });
    expect(await receiveSyncLink(sent.link, deps)).toEqual({ ok: false, failure: { kind: "not-found" } });
  });

  test("a typed, grouped code is stored normalized", async () => {
    const { deps } = fakeServer();
    const sent = await sendSyncLink("abcde-fghjk-mnpqr-stuvw-xyz23", deps);
    if (!sent.ok) throw new Error("send failed");
    expect(await receiveSyncLink(sent.link, deps)).toEqual({ ok: true, recoveryCode: "ABCDEFGHJKMNPQRSTUVWXYZ23" });
  });

  test("a wrong key is not-found, and transfer failures pass through", async () => {
    const { deps } = fakeServer();
    const sent = await sendSyncLink(newRecoveryCode(), deps);
    if (!sent.ok) throw new Error("send failed");
    const wrong = { room: sent.link.room, key: newLinkKey() };
    expect(await receiveSyncLink(wrong, deps)).toEqual({ ok: false, failure: { kind: "not-found" } });
    const offline: TransferDeps = { baseUrl: null, fetch };
    expect(await sendSyncLink(newRecoveryCode(), offline)).toEqual({ ok: false, failure: { kind: "unavailable" } });
    expect(await receiveSyncLink(sent.link, offline)).toEqual({ ok: false, failure: { kind: "unavailable" } });
  });

  test("a malformed recovery code is refused before anything is sent", async () => {
    const { deps, rooms } = fakeServer();
    await expect(sendSyncLink("short", deps)).rejects.toThrow(/recovery code/);
    expect(rooms.size).toBe(0);
  });

  test("a save file received as a link is damaged with a clear detail", async () => {
    const { deps } = fakeServer();
    const sent = await sendSaveFile(sampleSaveFile(2), deps);
    if (!sent.ok) throw new Error("send failed");
    const got = await receiveSyncLink({ room: sent.code.room, key: sent.code.keyPart }, deps);
    expect(got).toMatchObject({ ok: false, failure: { kind: "damaged" } });
    expect(JSON.stringify(got)).toMatch(/save file, not a device-sync link/);
  });

  test("a link received as a save file is damaged with a clear detail", async () => {
    const { deps } = fakeServer();
    const sent = await sendSyncLink(newRecoveryCode(), deps);
    if (!sent.ok) throw new Error("send failed");
    const got = await receiveSaveFile({ room: sent.link.room, keyPart: sent.link.key }, deps);
    expect(got).toMatchObject({ ok: false, failure: { kind: "damaged" } });
    expect(JSON.stringify(got)).toMatch(/device-sync link, not a save/);
  });
});

describe("typed link code", () => {
  test("send returns both rooms, each opening only with its own key", async () => {
    const { deps, rooms } = fakeServer();
    const recoveryCode = newRecoveryCode();
    const sent = await sendSyncLink(recoveryCode, deps);
    if (!sent.ok) throw new Error("send failed");
    expect(rooms.size).toBe(2);
    expect(sent.typed.room).not.toBe(sent.link.room);
    expect(isRoomCode(sent.typed.room)).toBe(true);
    expect(sent.typed.digits).toMatch(/^[0-9]{8}$/);
    // Neither room opens with the other's key.
    expect(await receiveSyncLink({ room: sent.typed.room, key: sent.link.key }, deps)).toMatchObject({ ok: false });
    expect(await receiveSyncLinkCode({ room: sent.link.room, digits: sent.typed.digits }, deps)).toMatchObject({
      ok: false,
    });
  });

  test("each room delivers the recovery code with its own key, independently", async () => {
    const { deps } = fakeServer();
    const recoveryCode = newRecoveryCode();
    const sent = await sendSyncLink(recoveryCode, deps);
    if (!sent.ok) throw new Error("send failed");
    expect(await receiveSyncLinkCode(sent.typed, deps)).toEqual({ ok: true, recoveryCode });
    expect(await receiveSyncLink(sent.link, deps)).toEqual({ ok: true, recoveryCode });
  });

  test("wrong digits fail as not-found", async () => {
    const { deps } = fakeServer();
    const sent = await sendSyncLink(newRecoveryCode(), deps);
    if (!sent.ok) throw new Error("send failed");
    const digits = sent.typed.digits === "00000000" ? "11111111" : "00000000";
    expect(await receiveSyncLinkCode({ room: sent.typed.room, digits }, deps)).toEqual({
      ok: false,
      failure: { kind: "not-found" },
    });
  });

  test("a failing second upload fails the send", async () => {
    const { deps } = fakeServer();
    let posts = 0;
    const flaky: TransferDeps = {
      ...deps,
      fetch: ((input, init) =>
        init?.method === "POST" && ++posts === 2
          ? Promise.resolve(json(429, { reason: "rate-limited", error: "slow" }))
          : deps.fetch(input, init)) as typeof fetch,
    };
    expect(await sendSyncLink(newRecoveryCode(), flaky)).toEqual({ ok: false, failure: { kind: "rate-limited" } });
  });

  test("formats and parses in any case and grouping", () => {
    const code = { room: "ABCDEFGH", digits: "12345678" };
    expect(formatLinkCode(code)).toBe("ABCD-EFGH 1234-5678");
    expect(parseLinkCode("ABCD-EFGH 1234-5678")).toEqual(code);
    expect(parseLinkCode("abcd efgh 1234 5678")).toEqual(code);
    expect(parseLinkCode("abcdefgh12345678")).toEqual(code);
  });

  test("rejects wrong lengths, letters in the digits and digits outside the alphabet in the room", () => {
    expect(parseLinkCode("")).toBeNull();
    expect(parseLinkCode("ABCD-EFGH 1234-567")).toBeNull();
    expect(parseLinkCode("ABCD-EFGH 1234-56789")).toBeNull();
    expect(parseLinkCode("ABCD-EFGH 1234-567A")).toBeNull();
    expect(parseLinkCode("ABCD-EFG0 1234-5678")).toBeNull(); // 0 is not in the room alphabet
    expect(parseLinkCode("ABCD-EFGH ABCD-EFGH")).toBeNull();
  });

  test("digits are unbiased: bytes of 250 and above are rejected", () => {
    let calls = 0;
    const digits = newLinkDigits((length) => {
      calls++;
      return new Uint8Array(length).fill(calls === 1 ? 255 : 13);
    });
    expect(calls).toBe(2);
    expect(digits).toBe("3".repeat(LINK_DIGITS_LENGTH));
    expect(newLinkDigits()).toMatch(/^[0-9]{8}$/);
  });
});
