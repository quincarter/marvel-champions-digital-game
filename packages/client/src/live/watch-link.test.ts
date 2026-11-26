import { describe, expect, test } from "vitest";
import { fakePage } from "../platform/address-page.js";
import { watchLinkOf } from "./live-publisher.js";
import { clearWatchAddress, parseWatchTarget, takeWatchLink } from "./watch-link.js";

const ID = "AbCdEf123_-x";

describe("takeWatchLink", () => {
  test("reads ?watching= and keeps it, so a reload opens the watch again", () => {
    const p = fakePage(`/?a=1&watching=${ID}`);
    expect(takeWatchLink(p.location, p.history)).toBe(ID);
    expect(p.log).toEqual([]);
  });

  test("converts an incoming #watch= link to ?watching= on arrival", () => {
    const p = fakePage(`/?a=1#watch=${ID}`);
    expect(takeWatchLink(p.location, p.history)).toBe(ID);
    expect(p.url()).toBe(`/?a=1&watching=${ID}`);
  });

  test("clearWatchAddress removes only the watch param", () => {
    const p = fakePage(`/?a=1&watching=${ID}`);
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
    for (const url of [
      "/?watching=",
      "/?watching=short",
      "/?watching=has%20space!!",
      `/?watching=${ID}x`,
      "/#watch=%E0%A4%A",
    ]) {
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

  test("an Epic room's other table rides after a dot, and the first table's link stays the room id alone (#1021)", () => {
    expect(watchLinkOf(ID, "https://marvel.example/", "t1")).toBe(`https://marvel.example/#watch=${ID}`);
    const link = watchLinkOf(ID, "https://marvel.example/", "t2");
    expect(link).toBe(`https://marvel.example/#watch=${ID}.t2`);
    const p = fakePage(`/${link.slice(link.indexOf("#"))}`);
    expect(takeWatchLink(p.location, p.history)).toBe(`${ID}.t2`);
    expect(p.url()).toBe(`/?watching=${ID}.t2`);
    for (const url of [`/?watching=${ID}.`, `/?watching=${ID}.T2`, `/?watching=x.t2`]) {
      expect(takeWatchLink(fakePage(url).location, fakePage(url).history), url).toBe("invalid");
    }
  });
});

describe("parseWatchTarget", () => {
  test("splits a target into its room and table, the first table by default", () => {
    expect(parseWatchTarget(ID)).toEqual({ roomId: ID, table: "t1" });
    expect(parseWatchTarget(`${ID}.t3`)).toEqual({ roomId: ID, table: "t3" });
    expect(parseWatchTarget(`${ID}.`)).toBeNull();
    expect(parseWatchTarget("short.t2")).toBeNull();
  });
});
