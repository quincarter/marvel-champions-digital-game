// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import {
  builderEvents,
  inner,
  mount,
  press,
  stop,
  stopKeys,
} from "../../../../components/deck-builder/shared/test-support.js";
import "../mc-deck-builder-page.js";
import type { McDeckBuilderPage } from "../mc-deck-builder-page.js";
import type { BuildModel, DeckBuilderPageModel } from "../mc-deck-builder-page.types.js";

afterEach(() => document.body.replaceChildren());

const header = { title: "DECK BUILDER", backLabel: "Back" };

const card = (index: number) => ({
  cardId: `c${index}`,
  picture: { src: null },
  title: `Card ${index}`,
  cost: 1,
  caption: "Event",
  captionStrong: false,
  typeLine: "Event",
  note: null,
  rules: "",
  quantity: 0,
  minus: { aria: "Remove", disabled: true as const },
  plus: { aria: "Add", disabled: null },
  face: null,
});

const buttonModel = { label: "x", on: false };

const build = (over: Partial<BuildModel> = {}): BuildModel => ({
  identity: { cardId: "01001a", label: "Identity", name: "Spider-Man", cue: "Read card", picture: { src: null } },
  aspects: {
    label: "Aspect",
    chips: [
      {
        aspect: "justice",
        label: "JUSTICE",
        fill: "#fc0",
        ink: "#111",
        selected: true,
        disabled: null,
        infoLabel: "About Justice",
        infoOpen: false,
      },
    ],
  },
  name: { label: "Deck name", text: "My deck", placeholder: "Deck name", clearLabel: "Clear" },
  legality: { text: "Legal: 40 cards", ok: true, frozen: null, dirty: null, status: null },
  rewards: null,
  tabs: {
    prefix: "tab:",
    selected: "pool",
    tabs: [
      { id: "pool", label: "Pool" },
      { id: "deck", label: "Deck 40" },
      { id: "games", label: "From your games" },
    ],
  },
  rail: {
    prefix: "rail:",
    selected: "deck",
    tabs: [
      { id: "deck", label: "Your deck" },
      { id: "games", label: "From your games" },
    ],
  },
  tab: "pool",
  railTab: "deck",
  chartTab: "curve",
  types: { label: "Filter", chips: [{ id: "all", label: "All", selected: true }] },
  shows: {
    label: "Show",
    toggles: [{ id: "show-hero", key: "hideHero", label: "Hero", shown: true }],
    count: "3 cards",
  },
  quick: {
    label: "Quick",
    costs: [{ id: "cost:0", text: "0", on: false }],
    icons: [{ id: "icon:wild", text: "Wild", on: false }],
    trait: { name: "All traits", on: false },
  },
  packs: { label: "Pack", pack: buttonModel, cycle: buttonModel, sort: buttonModel, then: buttonModel },
  search: { text: "", placeholder: "Search", clearLabel: "Clear", helpLabel: "Help", viewLabel: "List view" },
  fold: null,
  countText: "3 cards",
  poolLabel: "Card pool",
  pool: {
    view: "list",
    count: 3,
    cardAt: card,
    cardScale: 1,
    rowHeight: 104,
    thumbWidth: 60,
    desktop: false,
    empty: null,
  },
  charts: {
    curveLabel: "Cost curve",
    curveTab: "Curve",
    oddsLabel: "Odds",
    oddsTab: "Odds",
    bars: [{ label: "0", count: 1, highlight: false }],
    odds: { empty: "Add cards.", group: "", draws: "", canFewer: false, canMore: false, line: "", atLeast: "" },
  },
  deckList: { label: "Your deck", sortLabel: "Sort: Aspect", reviewLabel: "Review", reviewDisabled: false, groups: [] },
  games: {
    reading: "Reading...",
    headline: null,
    insight: null,
    first: [],
    against: null,
    then: [],
    nothing: null,
    note: null,
  },
  actions: {
    precon: { label: "Precon", disabled: null },
    clear: { label: "Clear", disabled: null },
    delete: null,
    freeze: null,
  },
  save: { save: { label: "Save deck", disabled: null }, review: null },
  ...over,
});

const built = (over: Partial<BuildModel> = {}): DeckBuilderPageModel => ({
  stage: "build",
  header,
  pick: null,
  start: null,
  build: build(over),
  tip: null,
});

describe("mc-deck-builder-page", () => {
  it("draws the hero picker for the first step", async () => {
    const el = await mount<McDeckBuilderPage>("mc-deck-builder-page", {
      model: {
        stage: "pick",
        header,
        pick: {
          label: "Pick a hero",
          search: { text: "", placeholder: "Search heroes", clearLabel: "Clear" },
          tiles: [{ id: "01001a", name: "Spider-Man", picture: { src: null } }],
          empty: null,
          tileMin: 170,
        },
        start: null,
        build: null,
        tip: null,
      } satisfies DeckBuilderPageModel,
    });
    expect(stopKeys(el)).toEqual(["back", "identity-search", "identity:01001a"]);
  });

  it("draws the wide layout as a rail, the pool and the ink deck panel, with every stop key the route uses", async () => {
    const el = await mount<McDeckBuilderPage>("mc-deck-builder-page", { model: built(), layout: "wide" });
    const keys = stopKeys(el);
    for (const key of [
      "back",
      "identity-card",
      "aspect:justice",
      "type:all",
      "quick:cost:0",
      "trait:prev",
      "pack:sort",
      "chart:curve",
      "filter-text",
      "filter-help",
      "pool-view",
      "card:c0",
      "name",
      "rail:deck",
      "deck-sort",
      "deck-review",
      "preconstructed",
      "clear",
      "save",
    ])
      expect(keys, key).toContain(key);
    expect(inner(el, ".rail-right")).not.toBeNull();
  });

  it("draws the narrow layout as tabs over one body, Save pinned under the Deck tab", async () => {
    const pool = await mount<McDeckBuilderPage>("mc-deck-builder-page", { model: built(), layout: "narrow" });
    expect(stopKeys(pool)).toEqual(
      expect.arrayContaining(["tab:pool", "tab:deck", "tab:games", "filter-text", "card:c0"]),
    );
    expect(stopKeys(pool)).not.toContain("save");
    document.body.replaceChildren();
    const deck = await mount<McDeckBuilderPage>("mc-deck-builder-page", {
      model: built({
        tab: "deck",
        deckList: { label: "Your deck", sortLabel: "Sort", reviewLabel: null, reviewDisabled: false, groups: [] },
        save: { save: { label: "Save deck", disabled: null }, review: { label: "Review", disabled: null } },
      }),
      layout: "phone",
    });
    expect(stopKeys(deck)).toEqual(expect.arrayContaining(["aspect:justice", "name", "save", "deck-review"]));
  });

  it("folds the filters behind the Filters chip and puts them in the list's place when it is open", async () => {
    const fold = { label: "Filters", open: false, active: 2 };
    const closed = await mount<McDeckBuilderPage>("mc-deck-builder-page", {
      model: built({ fold }),
      layout: "narrow",
    });
    expect(stopKeys(closed)).toContain("filters-toggle");
    expect(stopKeys(closed)).not.toContain("type:all");
    document.body.replaceChildren();
    const open = await mount<McDeckBuilderPage>("mc-deck-builder-page", {
      model: built({ fold: { ...fold, open: true } }),
      layout: "narrow",
    });
    expect(stopKeys(open)).toEqual(expect.arrayContaining(["filters-toggle", "type:all", "pack:sort"]));
    expect(stopKeys(open)).not.toContain("card:c0");
  });

  it("passes its parts' events on and says the Filters chip's own", async () => {
    const el = await mount<McDeckBuilderPage>("mc-deck-builder-page", {
      model: built({ fold: { label: "Filters", open: false, active: 0 } }),
      layout: "narrow",
    });
    const seen = builderEvents(el);
    press(stop(el, "back"));
    press(stop(el, "filters-toggle"));
    expect(seen).toEqual([{ type: "back" }, { type: "filters-toggle" }]);
  });

  it("opens the aspect tip's plate over the screen, and its link is the first thing the route can reach", async () => {
    const el = await mount<McDeckBuilderPage>("mc-deck-builder-page", {
      model: {
        ...built(),
        tip: {
          aspect: "justice",
          heading: "Justice",
          tagline: "Thwarting",
          body: "Keeps threat off the scheme",
          linkLabel: "Aspects",
          linkReason: "",
          linkAvailable: true,
        },
      },
      layout: "wide",
    });
    expect(inner(el, "mc-tip-plate")).not.toBeNull();
    const seen = builderEvents(el);
    press(stop(el, "aspect-tip-link"));
    expect(seen).toEqual([{ type: "tip-link", aspect: "justice" }]);
  });

  it("names its lists, for the scene to remember where each was left", async () => {
    const el = await mount<McDeckBuilderPage>("mc-deck-builder-page", { model: built(), layout: "wide" });
    expect([...el.scrollers().keys()]).toContain("pool");
    expect(el.mainScroller).not.toBeNull();
  });
});
