import { describe, expect, it } from "vitest";
import {
  codeTextOf,
  countdownOf,
  receiveLinkOf,
  transferFailureStatusOf,
  typedCodeOf,
  UNAVAILABLE_TEXT,
} from "./save-transfer-model.js";

const CODE = { room: "ABCDEFGH", keyPart: "JKMN" };

describe("transferFailureStatusOf", () => {
  it("says transfer is unavailable and offers Export", () => {
    const status = transferFailureStatusOf({ kind: "unavailable" });
    expect(status.text).toBe("Online transfer is unavailable right now. You can still export a save file.");
    expect(status.text).toBe(UNAVAILABLE_TEXT);
    expect(status.offerExport).toBe(true);
  });

  it("offers Export when this browser cannot do it at all", () => {
    expect(transferFailureStatusOf({ kind: "unsupported" })).toEqual({
      tone: "error",
      text: "This browser can't send saves online. Use Export instead.",
      offerExport: true,
    });
  });

  it("gives a code that did not work the three likely reasons", () => {
    expect(transferFailureStatusOf({ kind: "not-found" }).text).toBe(
      "That code didn't work. It may be mistyped, already used, or expired (codes last 15 minutes).",
    );
  });

  it("has its own sentence for every other failure", () => {
    const texts = [
      transferFailureStatusOf({ kind: "rate-limited" }),
      transferFailureStatusOf({ kind: "blocked" }),
      transferFailureStatusOf({ kind: "too-large" }),
      transferFailureStatusOf({ kind: "damaged", detail: "bad tag" }),
    ];
    expect(new Set(texts.map((t) => t.text)).size).toBe(4);
    expect(texts.every((t) => t.tone === "error")).toBe(true);
    expect(texts[2]!.offerExport).toBe(true);
    expect(texts[3]!.text).toContain("bad tag");
  });
});

describe("typedCodeOf", () => {
  it("accepts any case and grouping", () => {
    expect(typedCodeOf("abcd efgh-jkmn")).toEqual({ code: CODE });
  });
  it("answers a short or odd code with a status, not a request", () => {
    expect(typedCodeOf("ABCD")).toHaveProperty("status");
    expect(typedCodeOf("ABCD-EFGH-JKM0")).toHaveProperty("status");
  });
});

describe("countdownOf", () => {
  it("counts down in minutes and seconds, rounding up", () => {
    const now = 1_000_000;
    expect(countdownOf(now + 15 * 60_000, now).text).toBe("Expires in 15:00");
    expect(countdownOf(now + 14 * 60_000 + 32_000, now).text).toBe("Expires in 14:32");
    expect(countdownOf(now + 500, now)).toEqual({ text: "Expires in 0:01", expired: false });
  });
  it("reads expired at and after the deadline", () => {
    expect(countdownOf(1000, 1000)).toEqual({ text: "This code has expired", expired: true });
    expect(countdownOf(1000, 5000).expired).toBe(true);
  });
});

describe("links and code text", () => {
  it("shows the code in groups of four", () => {
    expect(codeTextOf(CODE)).toBe("ABCD-EFGH-JKMN");
  });
  it("builds the QR link on the current page's address", () => {
    expect(receiveLinkOf(CODE, { origin: "https://play.example", pathname: "/app/" })).toBe(
      "https://play.example/app/#receive=ABCDEFGH.JKMN",
    );
  });
});
