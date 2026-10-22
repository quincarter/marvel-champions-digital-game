/**
 * Sending a save to another device and receiving one, over the sync Worker (`@mc/sync-worker/protocol`). What the
 * save becomes on the wire is made in `transfer-crypto.ts`; this file is the two requests and one plain answer for
 * every way they can go wrong, so a screen shows a sentence per failure and never inspects a status code.
 */
import {
  PROOF_HEADER,
  type TransferCode,
  type TransferCreated,
  type TransferError,
  type TransferErrorReason,
  isRoomCode,
} from "@mc/sync-worker/protocol";
import { parseSaveFile, type SaveFile } from "./save-file.js";
import { syncServiceUrl } from "./transfer-config.js";
import { newKeyPart, openSealed, proofOf, sealPayload } from "./transfer-crypto.js";

/** How long a request may take before it counts as the service being unavailable. */
export const TRANSFER_TIMEOUT_MS = 20_000;

export type TransferFailure =
  /** No service configured, a network error or timeout, a 5xx, or the service refusing this origin. */
  | { readonly kind: "unavailable" }
  /** 404: the code is wrong, was already used, or expired. */
  | { readonly kind: "not-found" }
  /** 429: too many requests from here for now. */
  | { readonly kind: "rate-limited" }
  /** 429 after too many wrong codes: this device is blocked for a while. */
  | { readonly kind: "blocked" }
  /** 413: the save is bigger than the service accepts. */
  | { readonly kind: "too-large" }
  /** The bytes arrived but didn't decrypt or parse as a save file. */
  /** This browser can't encrypt (no crypto.subtle or CompressionStream); Export and Import still work. */
  | { readonly kind: "unsupported" }
  | { readonly kind: "damaged"; readonly detail: string };

export interface TransferDeps {
  readonly baseUrl: string | null;
  readonly fetch: typeof fetch;
}

export type SendResult =
  | { readonly ok: true; readonly code: TransferCode; readonly expiresAt: number }
  | { readonly ok: false; readonly failure: TransferFailure };

export type ReceiveResult =
  | { readonly ok: true; readonly file: SaveFile }
  | { readonly ok: false; readonly failure: TransferFailure };

function defaultDeps(): TransferDeps {
  return { baseUrl: syncServiceUrl(), fetch: (...args) => globalThis.fetch(...args) };
}

async function reasonOf(response: Response): Promise<TransferErrorReason | null> {
  try {
    const body = (await response.json()) as Partial<TransferError>;
    return typeof body.reason === "string" ? body.reason : null;
  } catch {
    return null;
  }
}

async function failureOf(response: Response): Promise<TransferFailure> {
  const { status } = response;
  const reason = await reasonOf(response);
  if (status === 404 || reason === "not-found") return { kind: "not-found" };
  if (status === 413 || reason === "too-large") return { kind: "too-large" };
  if (status === 429) return { kind: reason === "blocked" ? "blocked" : "rate-limited" };
  // Everything else, including a 403 `turnstile`: this client doesn't send Turnstile tokens yet.
  return { kind: "unavailable" };
}

async function request(
  deps: TransferDeps,
  path: string,
  init: RequestInit,
): Promise<{ readonly response: Response } | { readonly failure: TransferFailure }> {
  if (!deps.baseUrl) return { failure: { kind: "unavailable" } };
  try {
    const signal = AbortSignal.timeout(TRANSFER_TIMEOUT_MS);
    return { response: await deps.fetch(`${deps.baseUrl}${path}`, { ...init, signal }) };
  } catch {
    // A network error, a refused connection and the timeout all read the same to the player.
    return { failure: { kind: "unavailable" } };
  }
}

export async function sendSaveFile(file: SaveFile, deps: TransferDeps = defaultDeps()): Promise<SendResult> {
  return await sendPayload(new TextEncoder().encode(JSON.stringify(file)), deps);
}

/**
 * Seals any bytes and uploads them to a new room; `sendSaveFile` and the sync link share it. The key defaults to a
 * fresh 4-character key part (the typed transfer); the sync link passes a long one, which rides only in a QR fragment.
 */
export async function sendPayload(
  payload: Uint8Array,
  deps: TransferDeps = defaultDeps(),
  key?: string,
): Promise<SendResult> {
  let keyPart: string;
  let body: Uint8Array;
  let proof: string;
  try {
    keyPart = key ?? newKeyPart();
    body = await sealPayload(payload, keyPart);
    proof = await proofOf(keyPart);
  } catch {
    // No crypto.subtle (an insecure origin) or no CompressionStream (an old webview).
    return { ok: false, failure: { kind: "unsupported" } };
  }
  const sent = await request(deps, "/transfer", {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", [PROOF_HEADER]: proof },
    body: new Uint8Array(body),
  });
  if ("failure" in sent) return { ok: false, failure: sent.failure };
  if (sent.response.status !== 201) return { ok: false, failure: await failureOf(sent.response) };
  try {
    const created = (await sent.response.json()) as TransferCreated;
    if (!isRoomCode(created.code) || !Number.isFinite(created.expiresAt)) {
      return { ok: false, failure: { kind: "unavailable" } };
    }
    return { ok: true, code: { room: created.code, keyPart }, expiresAt: created.expiresAt };
  } catch {
    return { ok: false, failure: { kind: "unavailable" } };
  }
}

export async function receiveSaveFile(code: TransferCode, deps: TransferDeps = defaultDeps()): Promise<ReceiveResult> {
  const got = await receivePayload(code, deps);
  if (!got.ok) return got;
  if (isSyncLinkText(got.text)) {
    return {
      ok: false,
      failure: { kind: "damaged", detail: "This is a device-sync link, not a save: use Link a device." },
    };
  }
  const parsed = parseSaveFile(got.text);
  if (!parsed.ok) return { ok: false, failure: { kind: "damaged", detail: parsed.error } };
  return { ok: true, file: parsed.file };
}

/**
 * True for the small JSON a sync link sends, so a save screen can say what it was given. The kind is spelled out here
 * because `sync/sync-link.ts` imports this file; importing it back would be a cycle.
 */
function isSyncLinkText(text: string): boolean {
  try {
    return (JSON.parse(text) as { kind?: unknown } | null)?.kind === "mc-sync-link";
  } catch {
    return false;
  }
}

export type ReceivePayloadResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly failure: TransferFailure };

/** Fetches and opens a room's upload, returning the decrypted text; the caller decides what it must parse as. */
export async function receivePayload(
  code: TransferCode,
  deps: TransferDeps = defaultDeps(),
): Promise<ReceivePayloadResult> {
  let proof: string;
  try {
    proof = await proofOf(code.keyPart);
  } catch {
    return { ok: false, failure: { kind: "unsupported" } };
  }
  const got = await request(deps, `/transfer/${encodeURIComponent(code.room)}`, {
    method: "GET",
    headers: { [PROOF_HEADER]: proof },
  });
  if ("failure" in got) return { ok: false, failure: got.failure };
  if (!got.response.ok) return { ok: false, failure: await failureOf(got.response) };
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await got.response.arrayBuffer());
  } catch {
    // The connection dropped or the timeout fired mid-body: the service is the problem, not the data.
    return { ok: false, failure: { kind: "unavailable" } };
  }
  let text: string;
  try {
    text = await openSealed(bytes, code.keyPart);
  } catch (error) {
    return { ok: false, failure: { kind: "damaged", detail: error instanceof Error ? error.message : String(error) } };
  }
  return { ok: true, text };
}
