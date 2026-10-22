/**
 * Room-code generation. The alphabet has 31 symbols, which does not divide 256, so a plain `byte % 31` would favor
 * the first 8 symbols. Bytes at or above 248 (the largest multiple of 31 that fits) are thrown away instead.
 */

import { CODE_ALPHABET, ROOM_CODE_LENGTH } from "./protocol.js";

export type RandomBytes = (length: number) => Uint8Array;

export const defaultRandomBytes: RandomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));

const LIMIT = 256 - (256 % CODE_ALPHABET.length);

export function generateRoomCode(randomBytes: RandomBytes = defaultRandomBytes): string {
  let code = "";
  while (code.length < ROOM_CODE_LENGTH) {
    for (const byte of randomBytes(ROOM_CODE_LENGTH * 2)) {
      if (byte >= LIMIT) continue;
      code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (code.length === ROOM_CODE_LENGTH) break;
    }
  }
  return code;
}
