import { describe, expect, it } from "vitest";
import {
  formatTransferCode,
  isKeyPart,
  isRoomCode,
  normalizeCodeInput,
  parseReceiveFragment,
  parseTransferCode,
  receiveFragmentOf,
} from "./protocol.js";

describe("transfer codes", () => {
  it("normalizes grouping and case", () => {
    expect(normalizeCodeInput(" abcd-efgh.jkmn ")).toBe("ABCDEFGHJKMN");
  });

  it("parses a typed code and formats it back", () => {
    const code = parseTransferCode("abcd efgh jkmn");
    expect(code).toEqual({ room: "ABCDEFGH", keyPart: "JKMN" });
    expect(formatTransferCode(code!)).toBe("ABCD-EFGH-JKMN");
  });

  it("rejects wrong length and look-alike characters", () => {
    expect(parseTransferCode("ABCDEFGHJKM")).toBeNull();
    expect(parseTransferCode("ABCDEFGHJKMNP")).toBeNull();
    expect(parseTransferCode("ABCDEFGH0KMN")).toBeNull();
    expect(parseTransferCode("ABCDEFGHJKMI")).toBeNull();
    expect(isRoomCode("ABCDEFG1")).toBe(false);
    expect(isKeyPart("ABC")).toBe(false);
  });

  it("round-trips the receive fragment, with or without #", () => {
    const code = { room: "ABCDEFGH", keyPart: "JKMN" };
    const fragment = receiveFragmentOf(code);
    expect(parseReceiveFragment(`#${fragment}`)).toEqual(code);
    expect(parseReceiveFragment(fragment)).toEqual(code);
    expect(parseReceiveFragment("#other=1")).toBeNull();
    expect(parseReceiveFragment("#receive=ABCDEFGH.JKM0")).toBeNull();
    // The link's 8/4 split is strict, unlike a typed code.
    expect(parseReceiveFragment("#receive=ABCDEFG.HJKMN")).toBeNull();
    expect(parseReceiveFragment("#receive=AB-CDEFGH.JKMN")).toBeNull();
  });
});
