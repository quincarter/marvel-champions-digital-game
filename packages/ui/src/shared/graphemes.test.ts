import { describe, expect, it } from "vitest";
import { graphemesOf } from "./graphemes";

describe.each([true, false])("graphemesOf (Intl.Segmenter: %s)", (useSegmenter) => {
  const split = (text: string): string[] => graphemesOf(text, useSegmenter);

  it("splits plain text per letter", () => expect(split("abc")).toEqual(["a", "b", "c"]));
  it("keeps an emoji's surrogate pair whole", () => expect(split("a😀b")).toEqual(["a", "😀", "b"]));
  it("keeps a decomposed accent with its base letter", () => {
    const text = "Peña".normalize("NFD");
    expect(split(text)).toEqual(["P", "e", "ñ".normalize("NFD"), "a"]);
  });
  it("keeps a joined emoji sequence and a skin tone together", () => {
    expect(split("👩‍🚀!")).toEqual(["👩‍🚀", "!"]);
    expect(split("👍🏽")).toEqual(["👍🏽"]);
  });
  it("answers an empty list for empty text", () => expect(split("")).toEqual([]));
});
