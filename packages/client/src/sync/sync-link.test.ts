import { CODE_ALPHABET, PROOF_HEADER, isRoomCode } from "@mc/sync-worker/protocol";
import { describe, expect, test } from "vitest";
import { receiveSaveFile, sendSaveFile, type TransferDeps } from "../save-data/transfer-client.js";
import { sampleSaveFile } from "../save-data/transfer-fixtures.js";
import { newRecoveryCode } from "./sync-credentials.js";
import {
  LINK_KEY_LENGTH,
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
