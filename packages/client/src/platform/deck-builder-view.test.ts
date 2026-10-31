import { describe, expect, test } from "vitest";
import {
  DECK_BUILDER_VIEW_KEY,
  DEFAULT_DECK_BUILDER_VIEW,
  deckBuilderView,
  rememberDeckBuilderView,
} from "./deck-builder-view.js";

const memory = (initial: Record<string, string> = {}) => {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  };
};

describe("deck builder view between visits (issue #531)", () => {
  test("nothing stored, or junk, is the default view", () => {
    expect(deckBuilderView(memory())).toEqual(DEFAULT_DECK_BUILDER_VIEW);
    expect(deckBuilderView(memory({ [DECK_BUILDER_VIEW_KEY]: "{not json" }))).toEqual(DEFAULT_DECK_BUILDER_VIEW);
  });

  test("sort, kept filters and the card/list view come back; search text and aspect are not kept", () => {
    const storage = memory();
    rememberDeckBuilderView(
      {
        sort: { primary: "aspect", secondary: "type" },
        filter: {
          type: "ally",
          cost: 2,
          resource: "mental",
          trait: "Avenger" as never,
          packCode: "core",
          text: "x",
          aspect: "justice",
        },
        poolView: "list",
      },
      storage,
    );
    expect(deckBuilderView(storage)).toEqual({
      sort: { primary: "aspect", secondary: "type" },
      filter: { type: "ally", cost: 2, resource: "mental", trait: "Avenger", packCode: "core" },
      poolView: "list",
    });
  });

  test("an unknown field value falls back for that field alone", () => {
    const storage = memory({
      [DECK_BUILDER_VIEW_KEY]: JSON.stringify({
        sort: { primary: "bogus", secondary: "cost" },
        filter: { type: "villain", cost: -1, resource: "plasma", trait: 3 },
        poolView: "table",
      }),
    });
    expect(deckBuilderView(storage)).toEqual({
      sort: { primary: "match", secondary: "cost" },
      filter: {},
      poolView: "grid",
    });
  });
});
