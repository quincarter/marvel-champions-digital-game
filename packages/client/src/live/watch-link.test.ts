import { describe, expect, test } from "vitest";
import { fakePage } from "../platform/address-page.js";
import { watchLinkOf } from "./live-publisher.js";
import { clearWatchAddress, takeWatchLink } from "./watch-link.js";

const ID = "AbCdEf123_-x";

describe("takeWatchLink", () => {
  test("reads ?watch= and keeps it, so a reload opens the watch again", () => {
    const p = fakePage(`/?a=1&watch=${ID}`);
    expect(takeWatchLink(p.location, p.history)).toBe(ID);
    expect(p.log).toEqual([]);
  });

  test("converts an incoming #watch= link to ?watch= on arrival", () => {
    const p = fakePage(`/?a=1#watch=${ID}`);
    expect(takeWatchLink(p.location, p.history)).toBe(ID);
    expect(p.url()).toBe(`/?a=1&watch=${ID}`);
  });

  test("clearWatchAddress removes only the watch param", () => {
    const p = fakePage(`/?a=1&watch=${ID}`);
    clearWatchAddress(p.location, p.history);
    expect(p.url()).toBe("/?a=1");
    const room = fakePage("/?room=ABC234");
    clearWatchAddress(room.location, room.history);
    expect(room.log).toEqual([]);
  });

  test("is null for any other link, and leaves the address alone", () => {
    const p = fakePage(`/#replay=${ID}`);
    expect(takeWatchLink(p.location, p.history)).toBeNull();
    expect(takeWatchLink(fakePage("/").location, p.history)).toBeNull();
    expect(p.log).toEqual([]);
  });

  test("calls a link that names no room invalid, and drops it from the address", () => {
    for (const url of ["/?watch=", "/?watch=short", "/?watch=has%20space!!", `/?watch=${ID}x`, "/#watch=%E0%A4%A"]) {
      const p = fakePage(url);
      expect(takeWatchLink(p.location, p.history)).toBe("invalid");
      expect(p.url()).toBe("/");
    }
  });

  test("reads what the host makes as its link", () => {
    const link = watchLinkOf(ID, "https://marvel.example/");
    const p = fakePage(`/${link.slice(link.indexOf("#"))}`);
    expect(takeWatchLink(p.location, p.history)).toBe(ID);
  });
});
