import { describe, expect, test } from "vitest";
import { parseMarvelCdbReference } from "./url.js";

describe("parseMarvelCdbReference", () => {
  test("a bare id is a decklist reference (the public-sharing endpoint)", () => {
    expect(parseMarvelCdbReference("1")).toEqual({ kind: "decklist", id: "1" });
    expect(parseMarvelCdbReference("  2416  ")).toEqual({ kind: "decklist", id: "2416" });
  });

  test("a decklist URL is a decklist reference", () => {
    expect(parseMarvelCdbReference("https://marvelcdb.com/decklist/view/1/black-panther-protection-starter-deck")).toEqual({
      kind: "decklist",
      id: "1",
    });
  });

  test("a deck URL is a deck reference", () => {
    expect(parseMarvelCdbReference("https://marvelcdb.com/deck/view/12345/my-deck")).toEqual({ kind: "deck", id: "12345" });
  });

  test("http, no slug, and trailing query strings all still parse", () => {
    expect(parseMarvelCdbReference("http://marvelcdb.com/deck/view/7")).toEqual({ kind: "deck", id: "7" });
    expect(parseMarvelCdbReference("https://marvelcdb.com/decklist/view/9?utm_source=x")).toEqual({ kind: "decklist", id: "9" });
  });

  test("garbage input is refused rather than guessed at", () => {
    expect(parseMarvelCdbReference("not a url or id")).toBeNull();
    expect(parseMarvelCdbReference("https://example.com/deck/view/1")).toBeNull();
    expect(parseMarvelCdbReference("")).toBeNull();
    expect(parseMarvelCdbReference("12a")).toBeNull();
  });
});
